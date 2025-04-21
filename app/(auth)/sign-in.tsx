import { useState, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

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
    } catch (error: any) {
      let message = 'An error occurred during sign in';
      
      if (error.message.includes('Email not confirmed')) {
        setShowResend(true);
        message = 'Please verify your email address before signing in.';
      } else if (error.message.includes('Invalid login credentials')) {
        message = 'Invalid email or password';
      } else if (error.message.includes('429')) {
        message = 'Too many attempts. Please try again later.';
      }
      
      Alert.alert('Error', message);
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
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to resend verification email'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
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
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />
          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
          
          {showResend && (
            <TouchableOpacity 
              style={[styles.resendButton, isLoading && styles.buttonDisabled]}
              onPress={handleResendVerification}
              disabled={isLoading}
            >
              <Text style={styles.resendButtonText}>Resend Verification Email</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            onPress={() => router.push('/sign-up')}
            disabled={isLoading}
          >
            <Text style={styles.link}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    color: '#fff',
  },
  button: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  resendButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 16,
  },
}); 