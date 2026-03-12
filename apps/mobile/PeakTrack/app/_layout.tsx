import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../contexts/AuthContext';
import { UserSettingsProvider } from '../contexts/UserSettingsContext';
import { AudioProvider } from '../contexts/AudioContext';
import { StrictMode, useEffect } from 'react';

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
	safeArea: {
		flex: 1,
		backgroundColor: '#000',
	},
});

export default function Layout() {
	useEffect(() => {
		Notifications.requestPermissionsAsync();
	}, []);

	return (
		<StrictMode>
		<AudioProvider>
		<AuthProvider>
			<UserSettingsProvider>
				<GestureHandlerRootView style={{ flex: 1 }}>
					<SafeAreaProvider>
						<SafeAreaView style={styles.safeArea}>
							<View style={styles.container}>
								<Stack
									screenOptions={{
										headerShown: false,
										contentStyle: { backgroundColor: 'transparent' },
									}}>
								<Stack.Screen name="(auth)" options={{ headerShown: false }} />
								<Stack.Screen name="index" options={{ headerShown: false }} />
								<Stack.Screen name="settings" />
								<Stack.Screen name="history" />
								<Stack.Screen name="add-exercises" />
								<Stack.Screen name="edit-exercise" />
								<Stack.Screen name="repetition-maximums" />
								</Stack>
								<StatusBar style="light" />
							</View>
						</SafeAreaView>
					</SafeAreaProvider>
				</GestureHandlerRootView>
			</UserSettingsProvider>
		</AuthProvider>
		</AudioProvider>
		</StrictMode>
	);
}
