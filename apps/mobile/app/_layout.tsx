import { Stack } from 'expo-router';
import LoginScreen from '../LoginScreen';
import { AuthProvider, useAuth } from '../lib/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <LoginScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
