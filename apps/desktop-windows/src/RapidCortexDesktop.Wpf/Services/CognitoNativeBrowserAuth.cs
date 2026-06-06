using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using RapidCortex.Desktop.Configuration;

namespace RapidCortex.Desktop.Services;

/// <summary>
/// Cognito OAuth (authorization code + PKCE) via **default browser**: Next.js <c>/auth/native-login</c> → branded
/// <c>/login</c> → Cognito <c>/oauth2/authorize</c>, HTTPS <c>/auth/return-to-app</c>, then <c>rapidcortex://oauth/callback</c>. Exchanges the code at
/// <c>{WebAppBaseUrl}/api/auth/native/token</c> (no client secret).
/// </summary>
public static class CognitoNativeBrowserAuth
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private static TaskCompletionSource<string?>? _activation;

    /// <summary>Called from <see cref="App"/> when the OS launches the app with a <c>rapidcortex://</c> URL.</summary>
    public static void TryHandleActivationUri(string url)
    {
        _activation?.TrySetResult(url);
    }

    public static async Task SignInAsync(
        DesktopConfiguration configuration,
        IProgress<string>? progress,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(configuration.WebAppBaseUrl))
        {
            throw new InvalidOperationException("WebAppBaseUrl is required for native browser sign-in.");
        }

        var webBase = DesktopConfiguration.NormalizeApiBase(configuration.WebAppBaseUrl);
        var verifier = RandomUrlSafeString(48);
        var challenge = Base64Url(Sha256(Encoding.ASCII.GetBytes(verifier)));
        var state = RandomUrlSafeString(32);
        var returnTo = $"{webBase}/auth/return-to-app";
        var bridge =
            $"{webBase}/auth/native-login?code_challenge={Uri.EscapeDataString(challenge)}"
            + $"&state={Uri.EscapeDataString(state)}"
            + $"&redirect_uri={Uri.EscapeDataString(returnTo)}";

        _activation = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            progress?.Report("Opening sign-in in your browser…");
            Process.Start(
                new ProcessStartInfo
                {
                    FileName = bridge,
                    UseShellExecute = true,
                });

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromMinutes(5));
            var activationUrl = await _activation.Task.WaitAsync(cts.Token).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(activationUrl))
            {
                throw new InvalidOperationException("Sign-in did not return to the app.");
            }

            var uri = new Uri(activationUrl);
            var query = ParseQuery(uri.Query);
            query.TryGetValue("error", out var err);
            if (!string.IsNullOrEmpty(err))
            {
                query.TryGetValue("error_description", out var ed);
                throw new InvalidOperationException(string.IsNullOrWhiteSpace(ed) ? err : ed);
            }

            query.TryGetValue("code", out var code);
            query.TryGetValue("state", out var returnedState);
            if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(returnedState))
            {
                throw new InvalidOperationException("Missing code or state in callback URL.");
            }

            if (!string.Equals(returnedState, state, StringComparison.Ordinal))
            {
                throw new InvalidOperationException("OAuth state mismatch.");
            }

            progress?.Report("Exchanging code for tokens…");
            var token = await ExchangeCodeAsync(webBase, configuration, code, verifier, returnTo, cancellationToken)
                .ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(token.IdToken))
            {
                throw new InvalidOperationException("Token response did not include id_token.");
            }

            ProtectedTokenStore.SaveSession(idToken: token.IdToken, refreshToken: token.RefreshToken);
            progress?.Report("Signed in. Tokens stored securely.");
        }
        finally
        {
            _activation = null;
        }
    }

    private static async Task<TokenResponse> ExchangeCodeAsync(
        string webBase,
        DesktopConfiguration configuration,
        string code,
        string codeVerifier,
        string redirectUri,
        CancellationToken cancellationToken)
    {
        var url = $"{webBase}/api/auth/native/token";
        var payload = JsonSerializer.Serialize(
            new Dictionary<string, string>
            {
                ["code"] = code,
                ["codeVerifier"] = codeVerifier,
                ["redirectUri"] = redirectUri,
            });
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var res = await Http.SendAsync(req, cancellationToken).ConfigureAwait(false);
        var text = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("Token exchange failed: " + (int)res.StatusCode + " " + text);
        }

        var token = JsonSerializer.Deserialize<TokenResponse>(text, JsonOptions);
        return token ?? new TokenResponse();
    }

    private static byte[] Sha256(byte[] data)
    {
        using var sha = SHA256.Create();
        return sha.ComputeHash(data);
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string RandomUrlSafeString(int byteLength)
    {
        var bytes = new byte[byteLength];
        RandomNumberGenerator.Fill(bytes);
        return Base64Url(bytes);
    }

    private static Dictionary<string, string> ParseQuery(string query)
    {
        var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var q = query.TrimStart('?');
        if (string.IsNullOrEmpty(q))
        {
            return d;
        }

        foreach (var part in q.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = part.Split('=', 2);
            var key = Uri.UnescapeDataString(kv[0]);
            var val = kv.Length > 1 ? Uri.UnescapeDataString(kv[1]) : "";
            d[key] = val;
        }

        return d;
    }

    private sealed class TokenResponse
    {
        [JsonPropertyName("id_token")]
        public string? IdToken { get; set; }

        [JsonPropertyName("refresh_token")]
        public string? RefreshToken { get; set; }

        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }
    }
}
