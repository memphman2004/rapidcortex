using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using RapidCortex.Desktop.Configuration;
using RapidCortex.Desktop.Services;

namespace RapidCortex.Desktop;

public partial class MainWindow : Window
{
    private readonly ConnectivityService _connectivity = new();
    private DesktopConfiguration _configuration;
    private Uri? _webAppBaseUri;
    private bool _webViewInitialized;

    public MainWindow(bool sessionRestoredFromDisk = false)
    {
        InitializeComponent();
        _configuration = DesktopConfigurationLoader.Load();
        RenderAboutConfiguration();
        EnvironmentText.Text = $"Environment: {_configuration.EnvironmentName}";

        if (ProtectedTokenStore.TryReadIdToken() is not null)
        {
            LegacyTabs.SelectedIndex = 0;
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
        ApplyWorkspaceMode();
        UpdateSessionRoleLabel();
    }

    private void ApplyWorkspaceMode()
    {
        if (!_configuration.HasWebWorkspace)
        {
#if DEBUG
            LegacyTabs.Visibility = Visibility.Visible;
            WebWorkspace.Visibility = Visibility.Collapsed;
            WebWorkspaceRequiredPanel.Visibility = Visibility.Collapsed;
#else
            LegacyTabs.Visibility = Visibility.Collapsed;
            WebWorkspace.Visibility = Visibility.Collapsed;
            WebWorkspaceRequiredPanel.Visibility = Visibility.Visible;
#endif
            return;
        }

        LegacyTabs.Visibility = Visibility.Collapsed;
        WebWorkspaceRequiredPanel.Visibility = Visibility.Collapsed;
        WebWorkspace.Visibility = Visibility.Visible;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (!_configuration.HasWebWorkspace)
        {
            return;
        }

        await InitializeWebWorkspaceAsync(forceReload: false).ConfigureAwait(true);
    }

    private async Task InitializeWebWorkspaceAsync(bool forceReload)
    {
        if (ProtectedTokenStore.TryReadIdToken() is not { Length: > 0 } idToken)
        {
            MessageBox.Show(
                this,
                "No session token found. Please sign in again.",
                "Rapid Cortex",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
            await SignOutAndPromptLoginAsync().ConfigureAwait(true);
            return;
        }

        _webAppBaseUri = new Uri(DesktopConfiguration.NormalizeWebBase(_configuration.WebAppBaseUrl) + "/");

        try
        {
            if (!_webViewInitialized)
            {
                await WorkspaceWebView.EnsureCoreWebView2Async().ConfigureAwait(true);
                WorkspaceWebView.CoreWebView2.Settings.UserAgent =
                    "RapidCortexDesktop/1.0 (Windows; WebView2) RapidCortexWebShell";
                _webViewInitialized = true;
            }

            RenderWebToolbar(idToken);

            if (forceReload || WorkspaceWebView.Source is null)
            {
                await WorkspaceWebShellHost
                    .NavigateRoleHomeAsync(
                        WorkspaceWebView.CoreWebView2,
                        _webAppBaseUri,
                        ResolveJurisdictionSlug(),
                        idToken,
                        ProtectedTokenStore.TryReadRefreshToken())
                    .ConfigureAwait(true);
            }

            UpdateSessionRoleLabel();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                this,
                $"Unable to open the web workspace.\n\n{ex.Message}",
                "Rapid Cortex",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private void RenderWebToolbar(string idToken)
    {
        var role = DesktopPostLoginRouting.SessionRoleFromIdToken(idToken);
        var jurisdiction = ResolveJurisdictionSlug();

        WebRoleBadgeText.Text = DesktopWorkspaceNavigation.RoleBadgeLabel(role);
        WebAgencyText.Text = ReadAgencyIdFromToken(idToken) ?? "";

        WebQuickNavPanel.Children.Clear();
        foreach (var link in DesktopWorkspaceNavigation.QuickLinks(role, jurisdiction))
        {
            var button = new Button
            {
                Content = link.Label,
                Margin = new Thickness(0, 0, 6, 0),
                Padding = new Thickness(10, 4, 10, 4),
                Tag = link.Path,
            };
            button.Click += OnWebQuickNavClick;
            WebQuickNavPanel.Children.Add(button);
        }

        WebManualButton.Visibility = DesktopWorkspaceNavigation.ShowsOperationsManual(role)
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    private static string? ReadAgencyIdFromToken(string idToken)
    {
        var payload = JwtPayloadParser.TryParsePayload(idToken);
        if (payload is null)
        {
            return null;
        }

        var agency = JwtPayloadParser.ReadString(payload.Value, "custom:agencyId");
        return string.IsNullOrWhiteSpace(agency) ? null : agency.Trim();
    }

    private string ResolveJurisdictionSlug() =>
        DesktopWorkspaceNavigation.ResolveJurisdictionSlug(
            _configuration.DefaultJurisdictionSlug,
            ProtectedTokenStore.TryReadIdToken());

    private async void OnWebQuickNavClick(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string path } || _webAppBaseUri is null)
        {
            return;
        }

        await NavigateWebPathAsync(path).ConfigureAwait(true);
    }

    private async void OnWebManualMenu(object sender, RoutedEventArgs e)
    {
        var menu = new ContextMenu();
        menu.Items.Add(CreateManualMenuItem("Complete Operations Manual", includeRingChapter: false));
        menu.Items.Add(CreateManualMenuItem("Ring Connect (Chapter 10B)", includeRingChapter: true));
        menu.PlacementTarget = WebManualButton;
        menu.IsOpen = true;
    }

    private MenuItem CreateManualMenuItem(string label, bool includeRingChapter)
    {
        var item = new MenuItem { Header = label };
        item.Click += async (_, _) =>
        {
            await NavigateWebPathAsync(DesktopWorkspaceNavigation.OperationsManualHref(includeRingChapter))
                .ConfigureAwait(true);
        };
        return item;
    }

    private async Task NavigateWebPathAsync(string path)
    {
        if (_webAppBaseUri is null
            || ProtectedTokenStore.TryReadIdToken() is not { Length: > 0 } idToken
            || WorkspaceWebView.CoreWebView2 is null)
        {
            return;
        }

        await WorkspaceWebShellHost
            .NavigatePathAsync(
                WorkspaceWebView.CoreWebView2,
                _webAppBaseUri,
                path,
                idToken,
                ProtectedTokenStore.TryReadRefreshToken(),
                ProtectedTokenStore.TryReadAccessToken())
            .ConfigureAwait(true);
    }

    private void UpdateSessionRoleLabel()
    {
        if (ProtectedTokenStore.TryReadIdToken() is not { Length: > 0 } idToken)
        {
            SessionRoleText.Text = "";
            return;
        }

        var role = DesktopPostLoginRouting.SessionRoleFromIdToken(idToken);
        SessionRoleText.Text = $"Role: {role}";
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
            + $"Default jurisdiction: {(string.IsNullOrWhiteSpace(_configuration.DefaultJurisdictionSlug) ? "—" : _configuration.DefaultJurisdictionSlug)}\n"
            + $"Cognito domain: {(string.IsNullOrWhiteSpace(_configuration.CognitoDomain) ? "—" : _configuration.CognitoDomain)}\n"
            + $"Configured: {(_configuration.IsConfigured ? "yes" : "no")}";
    }

    private void OnReloadConfiguration(object sender, RoutedEventArgs e)
    {
        _configuration = DesktopConfigurationLoader.Load();
        RenderAboutConfiguration();
        EnvironmentText.Text = $"Environment: {_configuration.EnvironmentName}";
        ApplyWorkspaceMode();
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
            UpdateSessionRoleLabel();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Rapid Cortex", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void OnWebReload(object sender, RoutedEventArgs e)
    {
        await InitializeWebWorkspaceAsync(forceReload: true).ConfigureAwait(true);
    }

    private async void OnWebSignOut(object sender, RoutedEventArgs e)
    {
        await SignOutAndPromptLoginAsync().ConfigureAwait(true);
    }

    private async Task SignOutAndPromptLoginAsync()
    {
        if (_webViewInitialized && WorkspaceWebView.CoreWebView2 is not null && _webAppBaseUri is not null)
        {
            try
            {
                await WorkspaceWebShellHost.ClearAuthCookiesAsync(WorkspaceWebView.CoreWebView2, _webAppBaseUri)
                    .ConfigureAwait(true);
            }
            catch
            {
                // Best-effort cookie cleanup before clearing local session.
            }
        }

        ProtectedTokenStore.Clear();

        var login = new LoginWindow();
        Hide();
        var signedIn = login.ShowDialog() == true;
        if (!signedIn)
        {
            Close();
            Application.Current.Shutdown();
            return;
        }

        Show();
        ApplyWorkspaceMode();
        await InitializeWebWorkspaceAsync(forceReload: true).ConfigureAwait(true);
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
