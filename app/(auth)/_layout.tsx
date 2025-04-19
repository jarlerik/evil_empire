import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Check if the user is authenticated and trying to access auth screens
    if (user) {
      // Redirect to home if user is already authenticated
      router.replace('/');
    }
  }, [user, loading]);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <Stack.Screen
        name="sign-in"
        options={{
          title: 'Sign In',
        }}
      />
      <Stack.Screen
        name="sign-up"
        options={{
          title: 'Sign Up',
        }}
      />
    </Stack>
  );
} 