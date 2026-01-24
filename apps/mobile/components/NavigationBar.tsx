import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../styles/common';

interface NavigationItem {
	label: string;
	href: Href;
	icon: keyof typeof Ionicons.glyphMap;
	activeIcon: keyof typeof Ionicons.glyphMap;
}

const navigationItems: NavigationItem[] = [
	{ label: 'Home', href: '/', icon: 'home-outline', activeIcon: 'home' },
	{ label: 'History', href: '/history', icon: 'time-outline', activeIcon: 'time' },
	{ label: 'Settings', href: '/settings', icon: 'settings-outline', activeIcon: 'settings' },
];

export function NavigationBar() {
	const pathname = usePathname();
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
			{navigationItems.map((item) => {
				const isActive = pathname === item.href;
				const iconName = isActive ? item.activeIcon : item.icon;

				return (
					<Pressable
						key={item.label}
						onPress={() => router.push(item.href)}
						style={[styles.tab, isActive && styles.tabActive]}
						accessibilityRole="tab"
						accessibilityState={{ selected: isActive }}
					>
						<Ionicons name={iconName} size={22} color={isActive ? colors.primary : colors.text} />
						<Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{item.label}</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		backgroundColor: colors.backgroundCard,
		borderTopWidth: 1,
		borderTopColor: '#222',
		paddingTop: 10,
	},
	tab: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 6,
	},
	tabActive: {
		backgroundColor: 'transparent',
	},
	tabLabel: {
		color: colors.text,
		fontSize: 12,
		marginTop: 4,
	},
	tabLabelActive: {
		color: colors.primary,
		fontWeight: '600',
	},
});
