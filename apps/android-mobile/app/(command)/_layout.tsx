import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { Colors, ThemeProvider } from '@/theme';
import { isCommandRole } from '@/utils/roles';
import { Strings } from '@/utils/strings';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>;
}

function CommandTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.campus.blue,
        tabBarInactiveTintColor: Colors.campus.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.campus.surface,
          borderTopColor: Colors.campus.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: Strings.command.home,
          tabBarIcon: ({ focused }) => <TabIcon symbol="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          title: Strings.command.staff,
          tabBarIcon: ({ focused }) => <TabIcon symbol="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: Strings.command.account,
          tabBarIcon: ({ focused }) => <TabIcon symbol="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="incident"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

export default function CommandLayout() {
  const { isAuthenticated, productPath, role } = useAuth();

  if (!isAuthenticated) return <Redirect href="/" />;
  if (productPath !== 'command') return <Redirect href="/" />;
  if (!isCommandRole(role)) return <Redirect href="/" />;

  return (
    <ThemeProvider product="campus">
      <ScreenErrorBoundary>
        <CommandTabs />
      </ScreenErrorBoundary>
    </ThemeProvider>
  );
}
