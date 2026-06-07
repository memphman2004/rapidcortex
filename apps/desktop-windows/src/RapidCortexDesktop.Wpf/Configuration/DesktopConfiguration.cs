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

    /// <summary>Jurisdiction path segment for PSAP roles (matches <c>NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG</c> on web).</summary>
    public string DefaultJurisdictionSlug { get; init; } = "";

    /// <summary>When true, native hospital routing tools may appear for eligible PSAP roles (future Windows parity).</summary>
    public bool EnableNativeMapKit { get; init; } = true;

    public bool HasWebWorkspace =>
        !string.IsNullOrWhiteSpace(WebAppBaseUrl)
        && Uri.TryCreate(NormalizeWebBase(WebAppBaseUrl), UriKind.Absolute, out _);

    public static string NormalizeWebBase(string url)
    {
        var t = url.Trim();
        while (t.EndsWith('/'))
        {
            t = t[..^1];
        }

        return t;
    }

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
