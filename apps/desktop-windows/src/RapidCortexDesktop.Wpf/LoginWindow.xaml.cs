using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using System.Windows;
using System.Windows.Navigation;
using RapidCortex.Desktop.Configuration;
using RapidCortex.Desktop.Services;

namespace RapidCortex.Desktop;

public partial class LoginWindow : Window
{
    private DesktopConfiguration _configuration;

    public LoginWindow()
    {
        InitializeComponent();
        VersionText.Text = FormatVersion();
        _configuration = DesktopConfigurationLoader.Load();
    }

    private static string FormatVersion()
    {
        var v = Assembly.GetExecutingAssembly().GetName().Version;
        return v is null ? "" : $"v{v.Major}.{v.Minor}.{v.Build}";
    }

    private void HideBanners()
    {
        InfoBanner.Visibility = Visibility.Collapsed;
        ErrorBanner.Visibility = Visibility.Collapsed;
    }

    private void ShowInfo(string message)
    {
        InfoBannerText.Text = message;
        InfoBanner.Visibility = Visibility.Visible;
    }

    private void ShowError(string message)
    {
        ErrorBannerText.Text = message;
        ErrorBanner.Visibility = Visibility.Visible;
    }

    private void SetLoading(bool isLoading)
    {
        LoadingPanel.Visibility = isLoading ? Visibility.Visible : Visibility.Collapsed;
        SignInButton.IsEnabled = !isLoading;
    }

    private async void OnSignInClick(object sender, RoutedEventArgs e)
    {
        HideBanners();
        SetLoading(true);
        try
        {
            var progress = new Progress<string>(m =>
            {
                Dispatcher.Invoke(() =>
                {
                    LoadingMessageText.Text = string.IsNullOrWhiteSpace(m)
                        ? "Connecting to identity provider…"
                        : m;
                });
            });

            if (!string.IsNullOrWhiteSpace(_configuration.WebAppBaseUrl))
            {
                await CognitoNativeBrowserAuth.SignInAsync(_configuration, progress).ConfigureAwait(true);
            }
            else
            {
                await CognitoPkceAuth.SignInWithHostedUiAsync(_configuration, progress).ConfigureAwait(true);
            }

            DialogResult = true;
        }
        catch (OperationCanceledException)
        {
            ShowInfo("Sign-in was cancelled or timed out.");
        }
        catch (Exception ex)
        {
            if (IsCancellationMessage(ex.Message))
            {
                ShowInfo("Sign-in was cancelled.");
            }
            else if (ex is InvalidOperationException or HttpRequestException)
            {
                ShowError(ex.Message);
            }
            else
            {
                ShowError("Sign-in failed. Please try again or contact support.");
            }
        }
        finally
        {
            SetLoading(false);
        }
    }

    private static bool IsCancellationMessage(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        var m = message.AsSpan();
        return m.Contains("cancel", StringComparison.OrdinalIgnoreCase)
            || m.Contains("canceled", StringComparison.OrdinalIgnoreCase)
            || m.Contains("cancelled", StringComparison.OrdinalIgnoreCase);
    }

    private void OnDismissInfo(object sender, RoutedEventArgs e) => InfoBanner.Visibility = Visibility.Collapsed;

    private void OnDismissError(object sender, RoutedEventArgs e) => ErrorBanner.Visibility = Visibility.Collapsed;

    private void OnSupportNavigate(object sender, RequestNavigateEventArgs e)
    {
        Process.Start(
            new ProcessStartInfo
            {
                FileName = e.Uri.AbsoluteUri,
                UseShellExecute = true,
            });
        e.Handled = true;
    }
}
