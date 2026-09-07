import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Colors, ThemeProvider } from '@/theme';
import { isSafeSoundPublicEnabled } from '@/utils/feature-flags';
import { Strings } from '@/utils/strings';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>
  );
}

function SafeSoundTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.safeSound.blue,
        tabBarInactiveTintColor: Colors.safeSound.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.safeSound.surface,
          borderTopColor: Colors.safeSound.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: Strings.safeSound.myDevices,
          tabBarIcon: ({ focused }) => <TabIcon symbol="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ focused }) => <TabIcon symbol="🗺️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: Strings.safeSound.alerts.title,
          tabBarIcon: ({ focused }) => <TabIcon symbol="🔔" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused }) => <TabIcon symbol="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

export default function SafeSoundLayout() {
  const { isAuthenticated, productPath } = useAuth();

  if (!isSafeSoundPublicEnabled()) return <Redirect href="/" />;
  if (!isAuthenticated) return <Redirect href="/" />;
  if (productPath !== 'safe-sound') return <Redirect href="/" />;

  return (
    <ThemeProvider product="safeSound">
      <SafeSoundTabs />
    </ThemeProvider>
  );
}
