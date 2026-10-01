import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { SecuritySessionProvider } from '../hooks/useSecuritySession';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SecuritySessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </SecuritySessionProvider>
    </SafeAreaProvider>
  );
}
