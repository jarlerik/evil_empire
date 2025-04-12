import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
	safeArea: {
		flex: 1,
	},
});

export default function Layout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<SafeAreaView style={styles.safeArea}>
					<View style={styles.container}>
						<Stack
							screenOptions={{
								headerShown: false,
								contentStyle: { backgroundColor: 'transparent' },
							}}>
							<Stack.Screen name="index" />
							<Stack.Screen name="create-workout" />
							<Stack.Screen name="add-exercises" />
							<Stack.Screen name="edit-exercise" />
						</Stack>
						<StatusBar style="light" />
					</View>
				</SafeAreaView>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
