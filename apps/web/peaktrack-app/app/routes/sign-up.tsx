import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Input, Text } from '@evil-empire/ui';
import { useAuth } from '../contexts/AuthContext';
import { redirectIfAuthed } from '../lib/auth-guards';

export const Route = createFileRoute('/sign-up')({
  component: SignUp,
  beforeLoad: redirectIfAuthed,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async () => {
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Unable to validate email address: invalid format');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('already registered')) setError(msg);
      else if (msg.includes('Unable to validate email address')) {
        setError('Unable to validate email address: invalid format');
      } else if (msg.includes('429')) setError('Too many attempts. Please try again later.');
      else if (msg.includes('email')) setError('Invalid email address');
      else if (msg.includes('password')) setError('Password is too weak');
      else setError('An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card variant="bordered" style={{ width: '100%', maxWidth: 420, gap: 16 }}>
        {success ? (
          <>
            <Text variant="display">Check your email</Text>
            <Text variant="body">
              We've sent a verification link to {email}. Confirm your email before signing in.
            </Text>
            <Button
              title="Go to sign in"
              variant="primary"
              onPress={() => router.navigate({ to: '/sign-in' })}
            />
          </>
        ) : (
          <>
            <Text variant="display">Sign Up</Text>
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            <Input
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              error={error || undefined}
            />
            <Button title="Sign Up" variant="primary" loading={loading} onPress={handleSignUp} />
            <Button
              title="Already have an account? Sign in"
              variant="ghost"
              disabled={loading}
              onPress={() => router.navigate({ to: '/sign-in' })}
            />
          </>
        )}
      </Card>
    </View>
  );
}
