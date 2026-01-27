import { useState, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, ActivityIndicator, Pressable, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { colors, commonStyles } from '../../styles/common';
import { Button } from '../../components/Button';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const { signUp } = useAuth();
  const passwordInputRef = useRef<TextInput>(null);

  const handleSignUp = async () => {
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Unable to validate email address: invalid format');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password);
      router.replace('/sign-in');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';

      if (errMsg.includes('Unable to validate email address')) {
        setErrorMessage('Unable to validate email address: invalid format');
      } else if (errMsg.includes('429')) {
        setErrorMessage('Too many attempts. Please try again later.');
      } else if (errMsg.includes('email')) {
        setErrorMessage('Invalid email address');
      } else if (errMsg.includes('password')) {
        setErrorMessage('Password is too weak');
      } else {
        setErrorMessage('An error occurred during sign up');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }} accessible={false}>
      <View style={commonStyles.container}>
        <View style={commonStyles.headerRow}>
          <Text style={commonStyles.title}>Sign Up</Text>
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
            onSubmitEditing={handleSignUp}
          />
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Button
              title="Sign Up"
              onPress={handleSignUp}
              disabled={isLoading}
            />
          )}
          <TouchableOpacity
            onPress={() => router.push('/sign-in')}
            disabled={isLoading}
          >
            <Text style={styles.link}>Already have an account? Sign In</Text>
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
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
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
