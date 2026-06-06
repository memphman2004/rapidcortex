using System.Net.Http;
using System.Net.Http.Headers;
using RapidCortex.Desktop.Configuration;

namespace RapidCortex.Desktop.Services;

public sealed class ApiClient
{
    private readonly HttpClient _http;
    private readonly Func<string?> _idTokenProvider;

    public ApiClient(DesktopConfiguration configuration, Func<string?> idTokenProvider)
    {
        _idTokenProvider = idTokenProvider;
        var baseUrl = DesktopConfiguration.NormalizeApiBase(configuration.ApiBaseUrl);
        _http = new HttpClient { BaseAddress = new Uri(baseUrl + "/", UriKind.Absolute), Timeout = TimeSpan.FromSeconds(30) };
    }

    public async Task<(int Status, string Body)> PingHealthAsync(CancellationToken cancellationToken = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "api/health");
        using var res = await _http.SendAsync(req, cancellationToken).ConfigureAwait(false);
        var body = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        return ((int)res.StatusCode, body);
    }

    public async Task<(int Status, string Body)> FetchIncidentsPreviewAsync(CancellationToken cancellationToken = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "api/incidents");
        var token = _idTokenProvider();
        if (!string.IsNullOrWhiteSpace(token))
        {
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Trim());
        }

        using var res = await _http.SendAsync(req, cancellationToken).ConfigureAwait(false);
        var body = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        return ((int)res.StatusCode, body);
    }
}
