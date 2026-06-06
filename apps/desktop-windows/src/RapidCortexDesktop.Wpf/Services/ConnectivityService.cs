using System.Net.NetworkInformation;

namespace RapidCortex.Desktop.Services;

/// <summary>
/// Coarse online/offline signal for the status bar (Phase 1).
/// </summary>
public sealed class ConnectivityService : IDisposable
{
    private readonly System.Timers.Timer _timer;

    public ConnectivityService()
    {
        _timer = new System.Timers.Timer(2000) { AutoReset = true };
        _timer.Elapsed += (_, _) => Raise();
        NetworkChange.NetworkAvailabilityChanged += OnNetworkAvailabilityChanged;
        _timer.Start();
        Raise();
    }

    public event EventHandler<bool>? ConnectivityChanged;

    public bool IsOnline { get; private set; }

    private void OnNetworkAvailabilityChanged(object? sender, NetworkAvailabilityEventArgs e)
    {
        Raise();
    }

    private void Raise()
    {
        var online = NetworkInterface.GetIsNetworkAvailable();
        if (online == IsOnline)
        {
            return;
        }

        IsOnline = online;
        ConnectivityChanged?.Invoke(this, online);
    }

    public void Dispose()
    {
        NetworkChange.NetworkAvailabilityChanged -= OnNetworkAvailabilityChanged;
        _timer.Dispose();
    }
}
