import { useState, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator, Pressable, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { colors, commonStyles } from '../../styles/common';
import { Button } from '../../components/Button';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const router = useRouter();
  const { signIn, resendVerificationEmail } = useAuth();
  const passwordInputRef = useRef<TextInput>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error) {
      let message = 'An error occurred during sign in';

      if (error instanceof Error) {

      if (error.message.includes('Email not confirmed')) {
        setShowResend(true);
        message = 'Please verify your email address before signing in.';
      } else if (error.message.includes('Invalid login credentials')) {
        message = 'Invalid email or password';
      } else if (error.message.includes('429')) {
        message = 'Too many attempts. Please try again later.';
      }

      Alert.alert('Error', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await resendVerificationEmail(email);
      Alert.alert(
        'Success',
        'Verification email has been resent. Please check your inbox.',
      );
    } catch (error) {
      if (error instanceof Error) {
      Alert.alert(
        'Error',
          error.message || 'Failed to resend verification email',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }} accessible={false}>
      <View style={commonStyles.container}>
        <View style={commonStyles.headerRow}>
          <Text style={commonStyles.title}>Sign In</Text>
        </View>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
          <TextInput
            ref={passwordInputRef}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Button
              title="Sign In"
              onPress={handleSignIn}
              disabled={isLoading}
            />
          )}

          {showResend && (
            <Button
              title="Resend Verification Email"
              variant="secondary"
              onPress={handleResendVerification}
              disabled={isLoading}
            />
          )}

          <TouchableOpacity
            onPress={() => router.push('/sign-up')}
            disabled={isLoading}
          >
            <Text style={styles.link}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: colors.backgroundInput,
    color: colors.text,
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  loader: {
    padding: 15,
  },
  link: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: 16,
  },
});
