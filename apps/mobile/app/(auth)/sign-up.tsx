import { useState, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator, Pressable, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { colors, commonStyles } from '../../styles/common';
import { Button } from '../../components/Button';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signUp } = useAuth();
  const passwordInputRef = useRef<TextInput>(null);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password);
      Alert.alert(
        'Success',
        'Please check your email for verification instructions.',
        [{ text: 'OK', onPress: () => router.replace('/sign-in') }],
      );
    } catch (error) {
      let message = 'An error occurred during sign up';

      if (error instanceof Error) {
      // Handle specific error cases
      if (error?.message?.includes('429')) {
        message = 'Too many attempts. Please try again later.';
      } else if (error?.message?.includes('email')) {
        message = 'Invalid email address';
      } else if (error?.message?.includes('password')) {
        message = 'Password is too weak';
      }

      Alert.alert('Error', message);
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
  loader: {
    padding: 15,
  },
  link: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: 16,
  },
});
