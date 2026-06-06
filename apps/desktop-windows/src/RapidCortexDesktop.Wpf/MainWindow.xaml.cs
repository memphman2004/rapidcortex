using System.Windows;
using System.Windows.Media;
using RapidCortex.Desktop.Configuration;
using RapidCortex.Desktop.Services;

namespace RapidCortex.Desktop;

public partial class MainWindow : Window
{
    private readonly ConnectivityService _connectivity = new();
    private DesktopConfiguration _configuration;

    public MainWindow(bool sessionRestoredFromDisk = false)
    {
        InitializeComponent();
        _configuration = DesktopConfigurationLoader.Load();
        RenderAboutConfiguration();
        EnvironmentText.Text = $"Environment: {_configuration.EnvironmentName}";

        if (ProtectedTokenStore.TryReadIdToken() is not null)
        {
            RootTabs.SelectedIndex = 0;
            if (sessionRestoredFromDisk)
            {
                DashboardAuthHint.Visibility = Visibility.Visible;
            }
        }

#if !DEBUG
        SmokeTestGroup.Visibility = Visibility.Collapsed;
#endif

        _connectivity.ConnectivityChanged += (_, online) =>
        {
            Dispatcher.Invoke(() => SetConnectivity(online));
        };

        SetConnectivity(_connectivity.IsOnline);
    }

    protected override void OnClosed(EventArgs e)
    {
        base.OnClosed(e);
        _connectivity.Dispose();
    }

    private void SetConnectivity(bool online)
    {
        ConnectivityDot.Fill = online ? Brushes.LimeGreen : Brushes.Orange;
        ConnectivityText.Text = online ? "Network: online" : "Network: offline / constrained";
    }

    private void RenderAboutConfiguration()
    {
        AboutEnvironmentLine.Text = $"Environment: {_configuration.EnvironmentName}";
        AboutConfigSummary.Text =
            $"API base: {_configuration.ApiBaseUrl}\n"
            + $"API base (secondary): {(string.IsNullOrWhiteSpace(_configuration.ApiBaseUrl2) ? "—" : _configuration.ApiBaseUrl2)}\n"
            + $"Web app base: {(string.IsNullOrWhiteSpace(_configuration.WebAppBaseUrl) ? "—" : _configuration.WebAppBaseUrl)}\n"
            + $"Cognito domain: {(string.IsNullOrWhiteSpace(_configuration.CognitoDomain) ? "—" : _configuration.CognitoDomain)}\n"
            + $"Configured: {(_configuration.IsConfigured ? "yes" : "no")}";
    }

    private void OnReloadConfiguration(object sender, RoutedEventArgs e)
    {
        _configuration = DesktopConfigurationLoader.Load();
        RenderAboutConfiguration();
        EnvironmentText.Text = $"Environment: {_configuration.EnvironmentName}";
    }

    private void OnSaveSmokeTestToken(object sender, RoutedEventArgs e)
    {
        var token = SmokeTestTokenBox.Password.Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            MessageBox.Show(this, "Paste an id_token first.", "Rapid Cortex", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        try
        {
            ProtectedTokenStore.SaveIdToken(token);
            SmokeTestTokenBox.Clear();
            MessageBox.Show(this, "Stored id_token.", "Rapid Cortex", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Rapid Cortex", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void OnPingHealth(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(_configuration.ApiBaseUrl)
            || !Uri.TryCreate(DesktopConfiguration.NormalizeApiBase(_configuration.ApiBaseUrl), UriKind.Absolute, out _))
        {
            HealthOutput.Text = "Configure ApiBaseUrl first (API Gateway base URL).";
            return;
        }

        try
        {
            var client = new ApiClient(_configuration, ProtectedTokenStore.TryReadIdToken);
            var result = await client.PingHealthAsync().ConfigureAwait(true);
            HealthOutput.Text = $"HTTP {result.Status}\n{Truncate(result.Body, 4000)}";
        }
        catch (Exception ex)
        {
            HealthOutput.Text = ex.ToString();
        }
    }

    private async void OnFetchIncidents(object sender, RoutedEventArgs e)
    {
        if (ProtectedTokenStore.TryReadIdToken() is null)
        {
            IncidentsOutput.Text =
                "No id_token on disk. Restart the application to open the sign-in screen, or use the optional "
                + "development smoke test under About when available.";
            return;
        }

        try
        {
            var client = new ApiClient(_configuration, ProtectedTokenStore.TryReadIdToken);
            var result = await client.FetchIncidentsPreviewAsync().ConfigureAwait(true);
            IncidentsOutput.Text = $"HTTP {result.Status}\n{Truncate(result.Body, 8000)}";
        }
        catch (Exception ex)
        {
            IncidentsOutput.Text = ex.ToString();
        }
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max] + "…";
}
