import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Input, Text } from '@evil-empire/ui';
import { useAuth } from '../contexts/AuthContext';
import { redirectIfAuthed } from '../lib/auth-guards';

export const Route = createFileRoute('/sign-in')({
  component: SignIn,
  beforeLoad: redirectIfAuthed,
});

function SignIn() {
  const router = useRouter();
  const { signIn, resendVerificationEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  const handleSignIn = async () => {
    setError('');
    setResendNotice('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      router.navigate({ to: '/' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred during sign in';
      if (msg.includes('check your email and confirm')) setShowResend(true);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await resendVerificationEmail(email);
      setResendNotice('Verification email sent. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card variant="bordered" style={{ width: '100%', maxWidth: 420, gap: 16 }}>
        <Text variant="display">Sign In</Text>
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
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          error={error || undefined}
        />
        {resendNotice ? <Text variant="caption">{resendNotice}</Text> : null}
        <Button title="Sign In" variant="primary" loading={loading} onPress={handleSignIn} />
        {showResend && (
          <Button
            title="Resend verification email"
            variant="outline"
            disabled={loading}
            onPress={handleResend}
          />
        )}
        <Button
          title="Don't have an account? Sign up"
          variant="ghost"
          disabled={loading}
          onPress={() => router.navigate({ to: '/sign-up' })}
        />
      </Card>
    </View>
  );
}
