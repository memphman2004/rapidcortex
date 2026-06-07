using Microsoft.Web.WebView2.Core;

namespace RapidCortex.Desktop.Services;

/// <summary>Injects Rapid Cortex session cookies and navigates to the role home in WebView2.</summary>
public static class WorkspaceWebShellHost
{
    private const string CookieIdToken = "rc_id_token";
    private const string CookieAccessToken = "rc_access_token";
    private const string CookieRefreshToken = "rc_refresh_token";

    public static async Task NavigateRoleHomeAsync(
        CoreWebView2 webView,
        Uri webAppBaseUrl,
        string jurisdictionSlug,
        string idToken,
        string? refreshToken,
        CancellationToken cancellationToken = default)
    {
        var path = DesktopPostLoginRouting.DesktopPostLoginWebPath(idToken, jurisdictionSlug);
        var target = new Uri(webAppBaseUrl, path);
        var host = webAppBaseUrl.Host;
        var isSecure = webAppBaseUrl.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);

        var cookieManager = webView.CookieManager;
        var accessExpiry = DateTimeOffset.UtcNow.AddHours(1);
        var refreshExpiry = DateTimeOffset.UtcNow.AddDays(30);

        await SetCookieAsync(cookieManager, host, CookieIdToken, idToken, isSecure, accessExpiry).ConfigureAwait(true);
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            await SetCookieAsync(cookieManager, host, CookieRefreshToken, refreshToken, isSecure, refreshExpiry)
                .ConfigureAwait(true);
        }

        cancellationToken.ThrowIfCancellationRequested();
        webView.Navigate(target.AbsoluteUri);
    }

    public static async Task ClearAuthCookiesAsync(CoreWebView2 webView, Uri webAppBaseUrl)
    {
        var cookieManager = webView.CookieManager;
        var host = webAppBaseUrl.Host;
        foreach (var name in new[] { CookieIdToken, CookieAccessToken, CookieRefreshToken })
        {
            var existing = await cookieManager.GetCookiesAsync(webAppBaseUrl.AbsoluteUri).ConfigureAwait(true);
            foreach (var cookie in existing)
            {
                if (cookie.Name == name && cookie.Domain.Contains(host, StringComparison.OrdinalIgnoreCase))
                {
                    cookieManager.DeleteCookie(cookie);
                }
            }
        }
    }

    private static Task SetCookieAsync(
        CoreWebView2CookieManager cookieManager,
        string host,
        string name,
        string value,
        bool isSecure,
        DateTimeOffset expires)
    {
        var cookie = cookieManager.CreateCookie(name, value, host, "/");
        cookie.IsSecure = isSecure;
        cookie.SameSite = CoreWebView2CookieSameSiteKind.Lax;
        cookie.Expires = expires.DateTime;
        cookieManager.AddOrUpdateCookie(cookie);
        return Task.CompletedTask;
    }
}
