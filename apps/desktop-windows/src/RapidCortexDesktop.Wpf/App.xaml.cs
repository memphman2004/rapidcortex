using System.Windows;
using RapidCortex.Desktop.Services;

namespace RapidCortex.Desktop;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        foreach (var a in e.Args)
        {
            if (a.StartsWith("rapidcortex://", StringComparison.OrdinalIgnoreCase))
            {
                CognitoNativeBrowserAuth.TryHandleActivationUri(a);
            }
        }

        base.OnStartup(e);

        if (ProtectedTokenStore.TryReadIdToken() is not null)
        {
            new MainWindow(sessionRestoredFromDisk: true).Show();
            return;
        }

        var login = new LoginWindow();
        if (login.ShowDialog() != true)
        {
            Shutdown();
            return;
        }

        new MainWindow(sessionRestoredFromDisk: false).Show();
    }
}
