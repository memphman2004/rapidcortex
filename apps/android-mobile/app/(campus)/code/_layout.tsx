import { Stack } from 'expo-router';

export default function CampusCodeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="[id]/index" />
      <Stack.Screen
        name="[id]/nfc-write"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="[id]/qr-view" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="[id]/register-location"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}
