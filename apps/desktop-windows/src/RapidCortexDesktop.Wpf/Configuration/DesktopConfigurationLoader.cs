using System.Text.Json;
using System.Text.Json.Serialization;

namespace RapidCortex.Desktop.Configuration;

public static class DesktopConfigurationLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static DesktopConfiguration Load()
    {
        var env =
            Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? "Production";

        var baseDir = AppContext.BaseDirectory;
        var fileNames = new[]
        {
            "appsettings.json",
            $"appsettings.{env}.json",
            "appsettings.Local.json",
        };

        SettingsFileDto? merged = null;
        foreach (var name in fileNames)
        {
            var path = Path.Combine(baseDir, name);
            if (!File.Exists(path))
            {
                continue;
            }

            var next = JsonSerializer.Deserialize<SettingsFileDto>(File.ReadAllText(path), JsonOptions);
            merged = Merge(merged, next);
        }

        merged ??= new SettingsFileDto();
        var rc = merged.RapidCortex ?? new RapidCortexDto();
        var cognito = rc.Cognito ?? new CognitoDto();

        return new DesktopConfiguration
        {
            EnvironmentName =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__Environment"),
                    rc.Environment,
                    env),
            ApiBaseUrl =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__ApiBaseUrl"),
                    rc.ApiBaseUrl),
            ApiBaseUrl2 =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__ApiBaseUrl2"),
                    rc.ApiBaseUrl2),
            WebAppBaseUrl =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__WebAppBaseUrl"),
                    rc.WebAppBaseUrl),
            CognitoRegion =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__Cognito__Region"),
                    cognito.Region,
                    "us-east-1"),
            CognitoUserPoolId =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__Cognito__UserPoolId"),
                    cognito.UserPoolId),
            CognitoDomain =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__Cognito__Domain"),
                    cognito.Domain),
            CognitoClientId =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__Cognito__ClientId"),
                    cognito.ClientId),
            CognitoRedirectUri =
                FirstNonEmpty(
                    Environment.GetEnvironmentVariable("RapidCortex__Cognito__RedirectUri"),
                    cognito.RedirectUri,
                    "http://127.0.0.1:8765/callback"),
        };
    }

    private static SettingsFileDto Merge(SettingsFileDto? acc, SettingsFileDto? next)
    {
        if (next is null)
        {
            return acc ?? new SettingsFileDto();
        }

        if (acc is null)
        {
            return next;
        }

        var left = acc.RapidCortex ?? new RapidCortexDto();
        var right = next.RapidCortex ?? new RapidCortexDto();
        var lc = left.Cognito ?? new CognitoDto();
        var rc = right.Cognito ?? new CognitoDto();

        return new SettingsFileDto
        {
            RapidCortex = new RapidCortexDto
            {
                Environment = Pick(right.Environment, left.Environment),
                ApiBaseUrl = Pick(right.ApiBaseUrl, left.ApiBaseUrl),
                ApiBaseUrl2 = Pick(right.ApiBaseUrl2, left.ApiBaseUrl2),
                WebAppBaseUrl = Pick(right.WebAppBaseUrl, left.WebAppBaseUrl),
                Cognito = new CognitoDto
                {
                    Region = Pick(rc.Region, lc.Region),
                    UserPoolId = Pick(rc.UserPoolId, lc.UserPoolId),
                    Domain = Pick(rc.Domain, lc.Domain),
                    ClientId = Pick(rc.ClientId, lc.ClientId),
                    RedirectUri = Pick(rc.RedirectUri, lc.RedirectUri),
                },
            },
        };
    }

    private static string? Pick(string? winner, string? fallback) =>
        string.IsNullOrWhiteSpace(winner) ? fallback : winner;

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "";

    private sealed class SettingsFileDto
    {
        [JsonPropertyName("RapidCortex")]
        public RapidCortexDto? RapidCortex { get; set; }
    }

    private sealed class RapidCortexDto
    {
        public string? Environment { get; set; }

        public string? ApiBaseUrl { get; set; }

        public string? ApiBaseUrl2 { get; set; }

        public string? WebAppBaseUrl { get; set; }

        public CognitoDto? Cognito { get; set; }
    }

    private sealed class CognitoDto
    {
        public string? Region { get; set; }

        public string? UserPoolId { get; set; }

        public string? Domain { get; set; }

        public string? ClientId { get; set; }

        public string? RedirectUri { get; set; }
    }
}
