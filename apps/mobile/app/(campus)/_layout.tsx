import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { FieldProductProvider } from '@/navigation/field-product';
import { Colors, ThemeProvider } from '@/theme';
import { isCampusRole } from '@/utils/roles';
import { Strings } from '@/utils/strings';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>;
}

function CampusTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.campus.amber,
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
          title: Strings.campus.codes,
          tabBarIcon: ({ focused }) => <TabIcon symbol="🏷️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: Strings.campus.create,
          tabBarIcon: ({ focused }) => <TabIcon symbol="➕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: Strings.campus.account,
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
    </Tabs>
  );
}

export default function CampusLayout() {
  const { isAuthenticated, productPath, role } = useAuth();

  if (!isAuthenticated) return <Redirect href="/" />;
  if (productPath !== 'campus') return <Redirect href="/" />;
  if (!isCampusRole(role)) return <Redirect href="/" />;

  return (
    <ThemeProvider product="campus">
      <FieldProductProvider product="campus">
        <CampusTabs />
      </FieldProductProvider>
    </ThemeProvider>
  );
}
