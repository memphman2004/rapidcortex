import { Stack } from 'expo-router';

export default function VenueCodeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="[id]" />
      <Stack.Screen name="[id]/nfc-write" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="[id]/qr-view" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
