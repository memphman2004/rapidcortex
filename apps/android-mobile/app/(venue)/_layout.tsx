import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { ScreenErrorBoundary } from '@/components/common/ScreenErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { FieldProductProvider } from '@/navigation/field-product';
import { Colors, ThemeProvider } from '@/theme';
import { isTransitRole, isVenueRole } from '@/utils/roles';
import { Strings } from '@/utils/strings';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>;
}

function VenueTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.venue.amber,
        tabBarInactiveTintColor: Colors.venue.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.venue.surface,
          borderTopColor: Colors.venue.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: Strings.venue.codes,
          tabBarIcon: ({ focused }) => <TabIcon symbol="🏷️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: Strings.venue.create,
          tabBarIcon: ({ focused }) => <TabIcon symbol="➕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: Strings.venue.account,
          tabBarIcon: ({ focused }) => <TabIcon symbol="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="code"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="trade-show-nfc"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

export default function VenueLayout() {
  const { isAuthenticated, productPath, role } = useAuth();

  if (!isAuthenticated) return <Redirect href="/" />;
  if (productPath !== 'venue') return <Redirect href="/" />;
  if (!isVenueRole(role) && !isTransitRole(role)) return <Redirect href="/" />;

  return (
    <ThemeProvider product="venue">
      <FieldProductProvider product="venue">
        <ScreenErrorBoundary>
          <VenueTabs />
        </ScreenErrorBoundary>
      </FieldProductProvider>
    </ThemeProvider>
  );
}
