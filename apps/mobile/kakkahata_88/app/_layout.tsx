import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
});

export default function Layout() {
	return (
		<View style={styles.container}>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="index" />
				<Stack.Screen name="create-workout" />
				<Stack.Screen name="add-exercises" />
				<Stack.Screen name="edit-exercise" />
			</Stack>
			<StatusBar style="light" />
		</View>
	);
}
