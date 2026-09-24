using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var hmacSecret = Environment.GetEnvironmentVariable("MILESTONE_BRIDGE_HMAC_SECRET") ?? "local-dev-secret";
const string TsHeader = "X-RC-Milestone-Timestamp";
const string SigHeader = "X-RC-Milestone-Signature";

bool Verify(HttpRequest req, string path, string body)
{
    if (!req.Headers.TryGetValue(TsHeader, out var tsValues)) return false;
    if (!req.Headers.TryGetValue(SigHeader, out var sigValues)) return false;
    var ts = tsValues.ToString();
    var sig = sigValues.ToString();
    if (!long.TryParse(ts, out var unix)) return false;
    var skew = Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - unix);
    if (skew > 300) return false;
    var payload = $"{ts}.{req.Method.ToUpperInvariant()}.{path}.{body}";
    using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(hmacSecret));
    var hex = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    var expected = $"v1={hex}";
    return CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(expected),
        Encoding.UTF8.GetBytes(sig.ToLowerInvariant()));
}

async Task<string> ReadBody(HttpRequest req)
{
    using var reader = new StreamReader(req.Body, Encoding.UTF8);
    return await reader.ReadToEndAsync();
}

var mockCameras = new[]
{
    new {
        cameraId = "ballantine-entry-1",
        displayName = "Ballantine Hall — Main Entry",
        xprotectGuid = "mock-guid-1",
        latitude = 39.1653,
        longitude = -86.5264,
        buildingId = "BALLANTINE",
        floor = "1",
        zoneCode = "BH-1",
        status = "online",
        ptzCapable = false
    },
    new {
        cameraId = "wells-east-1",
        displayName = "Wells Library — East",
        xprotectGuid = "mock-guid-2",
        latitude = 39.1678,
        longitude = -86.5195,
        buildingId = "WELLS",
        floor = "1",
        zoneCode = "WL-1",
        status = "online",
        ptzCapable = true
    }
};

app.MapGet("/v1/health", () => Results.Json(new
{
    ok = true,
    xprotectConnected = true,
    siteLabel = "Mock XProtect",
    version = "mock-1.0.0"
}));

app.MapGet("/v1/cameras", async (HttpRequest req) =>
{
    var body = await ReadBody(req);
    if (!Verify(req, "/v1/cameras", body)) return Results.Unauthorized();
    return Results.Json(new { cameras = mockCameras });
});

app.MapPost("/v1/cameras/{cameraId}/live", async (string cameraId, HttpRequest req) =>
{
    var body = await ReadBody(req);
    if (!Verify(req, $"/v1/cameras/{cameraId}/live", body)) return Results.Unauthorized();
    using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
    var format = doc.RootElement.TryGetProperty("format", out var f) ? f.GetString() ?? "hls" : "hls";
    return Results.Json(new
    {
        cameraId,
        streamUrl = $"http://127.0.0.1:8443/mock-hls/{Uri.EscapeDataString(cameraId)}.m3u8",
        format,
        expiresAt = DateTime.UtcNow.AddMinutes(5).ToString("o"),
        mock = true
    });
});

app.MapPost("/v1/events", async (HttpRequest req) =>
{
    var body = await ReadBody(req);
    if (!Verify(req, "/v1/events", body)) return Results.Unauthorized();
    using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
    var incidentId = doc.RootElement.TryGetProperty("incidentId", out var id) ? id.GetString() : "unknown";
    return Results.Json(new { ok = true, bridgeEventId = $"mock-evt-{incidentId}", mock = true });
});

app.MapPost("/v1/alarms", async (HttpRequest req) =>
{
    var body = await ReadBody(req);
    if (!Verify(req, "/v1/alarms", body)) return Results.Unauthorized();
    using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
    var incidentId = doc.RootElement.TryGetProperty("incidentId", out var id) ? id.GetString() : "unknown";
    return Results.Json(new { ok = true, bridgeEventId = $"mock-alm-{incidentId}", mock = true });
});

app.Urls.Add("http://127.0.0.1:8443");
Console.WriteLine("RC Milestone Bridge (mock) listening on http://127.0.0.1:8443");
app.Run();
