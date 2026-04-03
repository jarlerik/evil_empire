import { useRef, useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useOnboarding } from '../contexts/OnboardingContext';

export function useCoachMark(stepId: string) {
	const ref = useRef<View>(null);
	const { registerLayout, currentStep, steps } = useOnboarding();

	const measure = useCallback(() => {
		if (!ref.current) {return;}
		ref.current.measureInWindow((x, y, width, height) => {
			if (width > 0 && height > 0) {
				registerLayout(stepId, { x, y, width, height });
			}
		});
	}, [stepId, registerLayout]);

	const onLayout = useCallback(() => {
		// Small delay to ensure layout is settled
		setTimeout(measure, 100);
	}, [measure]);

	useFocusEffect(
		useCallback(() => {
			setTimeout(measure, 200);
		}, [measure]),
	);

	const isHighlighted = currentStep !== null && steps[currentStep]?.targetId === stepId;

	return { ref, onLayout, isHighlighted };
}
