namespace RapidCortex.Desktop.Configuration;

public sealed class DesktopConfiguration
{
    public string EnvironmentName { get; init; } = "Production";

    public string ApiBaseUrl { get; init; } = "";

    /// <summary>Optional secondary API base (stack-2 / regional); reserved for future routing.</summary>
    public string ApiBaseUrl2 { get; init; } = "";

    public string CognitoRegion { get; init; } = "us-east-1";

    public string CognitoUserPoolId { get; init; } = "";

    public string CognitoDomain { get; init; } = "";

    public string CognitoClientId { get; init; } = "";

    public string CognitoRedirectUri { get; init; } = "http://127.0.0.1:8765/callback";

    /// <summary>Next.js origin (e.g. <c>https://www.rapidcortex.us</c>) for <c>/auth/native-login</c> + BFF token exchange.</summary>
    public string WebAppBaseUrl { get; init; } = "";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ApiBaseUrl)
        && Uri.TryCreate(NormalizeApiBase(ApiBaseUrl), UriKind.Absolute, out var u)
        && u.Scheme == Uri.UriSchemeHttps
        && !string.IsNullOrWhiteSpace(CognitoDomain)
        && !string.IsNullOrWhiteSpace(CognitoClientId);

    public static string NormalizeApiBase(string url)
    {
        var t = url.Trim();
        return t.EndsWith('/') ? t[..^1] : t;
    }
}
