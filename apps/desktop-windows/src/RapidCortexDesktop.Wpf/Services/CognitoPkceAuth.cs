using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using RapidCortex.Desktop.Configuration;

namespace RapidCortex.Desktop.Services;

/// <summary>
/// PKCE + Cognito Hosted UI with loopback <c>http://127.0.0.1</c> callback (add the same URL to the Cognito app client).
/// </summary>
public static class CognitoPkceAuth
{
    private const int LoopbackTimeoutSeconds = 120;

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(45) };
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public static async Task SignInWithHostedUiAsync(
        DesktopConfiguration configuration,
        IProgress<string>? progress,
        CancellationToken cancellationToken = default)
    {
        if (!configuration.IsConfigured)
        {
            throw new InvalidOperationException("Cognito configuration is incomplete.");
        }

        var redirect = configuration.CognitoRedirectUri.Trim();
        if (redirect.StartsWith("rapidcortex-desktop://", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "This Windows build uses a loopback callback. Set Cognito.RedirectUri to e.g. "
                + "http://127.0.0.1:8765/callback and add that exact URL to the Cognito app client's allowed callback URLs.");
        }

        if (!redirect.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase)
            && !redirect.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Redirect URI must be http://127.0.0.1/... or http://localhost/... for the loopback listener.");
        }

        var verifier = RandomUrlSafeString(48);
        var challenge = Base64Url(Sha256(Encoding.ASCII.GetBytes(verifier)));
        var domainHost = NormalizeCognitoHost(configuration.CognitoDomain);

        var r = new Uri(redirect, UriKind.Absolute);
        var path = r.AbsolutePath;
        if (string.IsNullOrEmpty(path) || path == "/")
        {
            path = "/";
        }
        if (!path.EndsWith('/'))
        {
            path += "/";
        }
        var prefix = $"{r.GetLeftPart(UriPartial.Authority)}{path}";

        using var listener = new HttpListener();
        listener.Prefixes.Add(prefix);
        try
        {
            listener.Start();
        }
        catch (HttpListenerException ex)
        {
            throw new InvalidOperationException(
                "Could not start the local sign-in callback listener. On Windows, reserve the URL (once) with an "
                + "elevated prompt, e.g.: netsh http add urlacl url=" + prefix + " sddl=D:(A;;GX;;;WD)",
                ex);
        }

        try
        {
            progress?.Report("Opening sign-in in your browser…");
            var authUrl = BuildAuthorizeUrl(configuration, domainHost, challenge);
            Process.Start(
                new ProcessStartInfo
                {
                    FileName = authUrl,
                    UseShellExecute = true,
                });

            var code = await AwaitAuthorizationCodeAsync(listener, cancellationToken).ConfigureAwait(false);
            progress?.Report("Exchanging code for tokens…");
            var token = await ExchangeCodeAsync(domainHost, configuration, code, verifier, redirect, cancellationToken)
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
            if (listener.IsListening)
            {
                listener.Stop();
            }
        }
    }

    private static async Task<string> AwaitAuthorizationCodeAsync(
        HttpListener listener,
        CancellationToken cancellationToken)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(LoopbackTimeoutSeconds));
        var context = await listener.GetContextAsync().WaitAsync(cts.Token).ConfigureAwait(false);
        var request = context.Request;
        if (!string.Equals(request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = 405;
            context.Response.Close();
            throw new InvalidOperationException("Unexpected callback request.");
        }

        var code = request.QueryString["code"];
        var err = request.QueryString["error"];
        var errDesc = request.QueryString["error_description"];

        const string html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>Signed in</title></head>"
            + "<body><p>You can return to Rapid Cortex Desktop.</p></body></html>";
        var body = Encoding.UTF8.GetBytes(html);
        context.Response.StatusCode = 200;
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.ContentLength64 = body.Length;
        await context.Response.OutputStream.WriteAsync(body, cts.Token).ConfigureAwait(false);
        context.Response.Close();

        if (!string.IsNullOrEmpty(err))
        {
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(errDesc) ? err : errDesc);
        }

        if (string.IsNullOrEmpty(code))
        {
            throw new InvalidOperationException("Missing authorization code in callback.");
        }

        return code;
    }

    private static async Task<TokenResponse> ExchangeCodeAsync(
        string domainHost,
        DesktopConfiguration configuration,
        string code,
        string codeVerifier,
        string redirectUri,
        CancellationToken cancellationToken)
    {
        var url = new Uri(new Uri("https://" + domainHost, UriKind.Absolute), "/oauth2/token");
        using var content = new FormUrlEncodedContent(
            new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["client_id"] = configuration.CognitoClientId,
                ["code"] = code,
                ["redirect_uri"] = redirectUri,
                ["code_verifier"] = codeVerifier,
            });

        using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
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

    private static string BuildAuthorizeUrl(DesktopConfiguration configuration, string domainHost, string codeChallenge)
    {
        var builder = new UriBuilder
        {
            Scheme = Uri.UriSchemeHttps,
            Host = domainHost,
            Path = "/oauth2/authorize",
        };
        var query = new List<string>
        {
            "response_type=code",
            "client_id=" + Uri.EscapeDataString(configuration.CognitoClientId),
            "redirect_uri=" + Uri.EscapeDataString(configuration.CognitoRedirectUri.Trim()),
            "scope=" + Uri.EscapeDataString("openid email profile"),
            "code_challenge_method=S256",
            "code_challenge=" + Uri.EscapeDataString(codeChallenge),
        };
        builder.Query = string.Join("&", query);
        return builder.Uri.ToString();
    }

    private static string NormalizeCognitoHost(string domain)
    {
        var t = domain.Trim();
        if (t.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            t = t[8..];
        }
        if (t.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        {
            t = t[7..];
        }
        var i = t.IndexOf('/', StringComparison.Ordinal);
        return i < 0 ? t : t[..i];
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
