import { Stack } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
	return (
		<View style={{ flex: 1, backgroundColor: '#000' }}>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="index" />
				<Stack.Screen name="create-workout" />
				<Stack.Screen name="add-exercises" />
			</Stack>
			<StatusBar style="light" />
		</View>
	);
}
