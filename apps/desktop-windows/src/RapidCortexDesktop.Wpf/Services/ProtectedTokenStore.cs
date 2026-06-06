using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace RapidCortex.Desktop.Services;

/// <summary>
/// Persists Cognito <c>id_token</c> (and optional <c>refresh_token</c>) with DPAPI (current user).
/// </summary>
public static class ProtectedTokenStore
{
    private static string TokenFilePath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "RapidCortexDesktop",
            "cognito_session.dpapi");

    private static string LegacyIdTokenPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "RapidCortexDesktop",
            "id_token.dpapi");

    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };

    public static void SaveIdToken(string idToken)
    {
        SaveSession(idToken, null);
    }

    public static void SaveSession(string idToken, string? refreshToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(TokenFilePath)!);
        var payload = new SessionV2
        {
            V = 2,
            IdToken = idToken,
            RefreshToken = refreshToken,
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var bytes = Encoding.UTF8.GetBytes(json);
        var protectedBytes = ProtectedData.Protect(
            bytes,
            optionalEntropy: null,
            scope: DataProtectionScope.CurrentUser);
        File.WriteAllBytes(TokenFilePath, protectedBytes);
        if (File.Exists(LegacyIdTokenPath))
        {
            File.Delete(LegacyIdTokenPath);
        }
    }

    public static string? TryReadIdToken() => TryReadSession()?.IdToken;

    public static string? TryReadRefreshToken() => TryReadSession()?.RefreshToken;

    private static SessionV2? TryReadSession()
    {
        var path = File.Exists(TokenFilePath) ? TokenFilePath : LegacyIdTokenPath;
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            var protectedBytes = File.ReadAllBytes(path);
            var bytes = ProtectedData.Unprotect(
                protectedBytes,
                optionalEntropy: null,
                scope: DataProtectionScope.CurrentUser);
            var text = Encoding.UTF8.GetString(bytes);
            if (text.Contains("\"id_token\"", StringComparison.Ordinal))
            {
                return JsonSerializer.Deserialize<SessionV2>(text, JsonOptions);
            }

            // Legacy: single raw JWT
            return new SessionV2 { V = 1, IdToken = text, RefreshToken = null };
        }
        catch
        {
            return null;
        }
    }

    public static void Clear()
    {
        if (File.Exists(TokenFilePath))
        {
            File.Delete(TokenFilePath);
        }

        if (File.Exists(LegacyIdTokenPath))
        {
            File.Delete(LegacyIdTokenPath);
        }
    }

    private sealed class SessionV2
    {
        [JsonPropertyName("v")]
        public int V { get; set; }

        [JsonPropertyName("id_token")]
        public string? IdToken { get; set; }

        [JsonPropertyName("refresh_token")]
        public string? RefreshToken { get; set; }
    }
}
