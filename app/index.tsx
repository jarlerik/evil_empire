import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !user) {
			// Redirect to sign in if user is not authenticated
			router.replace('/(auth)/sign-in');
		}
	}, [user, loading]);

	if (loading) {
		return (
			<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
				<Text style={{ color: '#fff' }}>Loading...</Text>
			</View>
		);
	}

	// Your authenticated app content here
	return (
		<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
			<Text style={{ color: '#fff' }}>Welcome, {user?.email}</Text>
		</View>
	);
}
