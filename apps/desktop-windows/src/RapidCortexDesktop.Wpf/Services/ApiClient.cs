using System.Net.Http;
using System.Net.Http.Headers;
using RapidCortex.Desktop.Configuration;

namespace RapidCortex.Desktop.Services;

/// <summary>
/// HTTP client for API Gateway. Sends <c>Authorization: Bearer id_token</c>.
/// Hospital / dispatcher / supervisor / wellness routes use stack 2 when <see cref="DesktopConfiguration.ApiBaseUrl2"/> is set.
/// </summary>
public sealed class ApiClient : IDisposable
{
    private readonly HttpClient _primary;
    private readonly HttpClient? _stack2;
    private readonly Func<string?> _idTokenProvider;

    public ApiClient(DesktopConfiguration configuration, Func<string?> idTokenProvider)
    {
        _idTokenProvider = idTokenProvider;
        var baseUrl = DesktopConfiguration.NormalizeApiBase(configuration.ApiBaseUrl);
        _primary = new HttpClient
        {
            BaseAddress = new Uri(baseUrl + "/", UriKind.Absolute),
            Timeout = TimeSpan.FromSeconds(30),
        };

        var stack2 = DesktopConfiguration.NormalizeApiBase(configuration.ApiBaseUrl2);
        if (!string.IsNullOrWhiteSpace(stack2)
            && Uri.TryCreate(stack2, UriKind.Absolute, out var stack2Uri)
            && !string.Equals(stack2, baseUrl, StringComparison.OrdinalIgnoreCase))
        {
            _stack2 = new HttpClient
            {
                BaseAddress = new Uri(stack2Uri.ToString().TrimEnd('/') + "/", UriKind.Absolute),
                Timeout = TimeSpan.FromSeconds(30),
            };
        }
    }

    public async Task<(int Status, string Body)> PingHealthAsync(CancellationToken cancellationToken = default)
        => await GetAsync("api/health", authorized: false, cancellationToken).ConfigureAwait(false);

    /// <summary>Validates the current id_token with the API (<c>GET /api/me</c>).</summary>
    public async Task<(int Status, string Body)> FetchMeAsync(CancellationToken cancellationToken = default)
        => await GetAsync("api/me", authorized: true, cancellationToken).ConfigureAwait(false);

    public async Task<(int Status, string Body)> FetchIncidentsPreviewAsync(CancellationToken cancellationToken = default)
        => await GetAsync("api/incidents", authorized: true, cancellationToken).ConfigureAwait(false);

    public void Dispose()
    {
        _primary.Dispose();
        _stack2?.Dispose();
    }

    private HttpClient ClientFor(string relativePath)
    {
        if (_stack2 is not null && UsesStack2Api(relativePath))
        {
            return _stack2;
        }

        return _primary;
    }

    private static bool UsesStack2Api(string relativePath)
    {
        var path = relativePath.StartsWith('/') ? relativePath : "/" + relativePath;
        return path.StartsWith("/api/hospitals", StringComparison.Ordinal)
            || path.StartsWith("/api/dispatcher/", StringComparison.Ordinal)
            || path.StartsWith("/api/supervisor/", StringComparison.Ordinal)
            || path.StartsWith("/api/wellness/", StringComparison.Ordinal);
    }

    private async Task<(int Status, string Body)> GetAsync(
        string relativePath,
        bool authorized,
        CancellationToken cancellationToken)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, relativePath.TrimStart('/'));
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (authorized)
        {
            var token = _idTokenProvider();
            if (!string.IsNullOrWhiteSpace(token))
            {
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Trim());
            }
        }

        using var res = await ClientFor(relativePath).SendAsync(req, cancellationToken).ConfigureAwait(false);
        var body = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        return ((int)res.StatusCode, body);
    }
}
