import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useUserSettings } from './UserSettingsContext';

interface OnboardingStep {
	screen: string;
	targetId: string;
	title: string;
	message: string;
}

interface Layout {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface OnboardingContextType {
	currentStep: number | null;
	isOnboarding: boolean;
	steps: OnboardingStep[];
	layouts: Record<string, Layout>;
	nextStep: () => void;
	skipOnboarding: () => void;
	registerLayout: (stepId: string, layout: Layout) => void;
}

function getSteps(unit: string): OnboardingStep[] {
	return [
		{
			screen: '/',
			targetId: 'week-day-selector',
			title: 'Your Calendar',
			message: 'Select any day to plan workouts. Dots show planned, completed, and missed sessions.',
		},
		{
			screen: '/',
			targetId: 'add-exercise-area',
			title: 'Add an Exercise',
			message: 'Type an exercise name like "Bench Press" and tap Add. A workout is created automatically!',
		},
		{
			screen: '/edit-exercise',
			targetId: 'set-input',
			title: 'Define Sets & Reps',
			message: `Enter sets using formats like "4 x 3 @100${unit}". You can add rest times too, e.g. "4 x 3 @100${unit} 120s".`,
		},
		{
			screen: '/edit-exercise',
			targetId: 'set-input',
			title: 'Use Percentages',
			message: 'Train with percentages of your 1RM: "4 x 3 @80%". PeakTrack calculates the weight from your Repetition Maximums.',
		},
		{
			screen: '/edit-exercise',
			targetId: 'input-options',
			title: "You're All Set!",
			message: 'Tap "Input options" to see all supported formats: waves, compound sets, circuits, and more.',
		},
	];
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
	const [currentStep, setCurrentStep] = useState<number | null>(null);
	const [layouts, setLayouts] = useState<Record<string, Layout>>({});
	const { settings, completeOnboarding } = useUserSettings();
	const pathname = usePathname();
	const steps = getSteps(settings?.weight_unit || 'kg');

	// Start onboarding if not completed (only after unit is selected)
	useEffect(() => {
		if (settings && settings.weight_unit && !settings.onboarding_completed && currentStep === null) {
			setCurrentStep(0);
		}
	}, [settings]);

	// Auto-advance when screen matches next step
	useEffect(() => {
		if (currentStep === null) {return;}
		const step = steps[currentStep];
		if (!step) {return;}

		// If current step's screen doesn't match, check if next step does
		if (step.screen !== pathname) {
			const nextIdx = currentStep + 1;
			if (nextIdx < steps.length && steps[nextIdx].screen === pathname) {
				setCurrentStep(nextIdx);
			}
		}
	}, [pathname, currentStep]);

	const nextStep = useCallback(() => {
		if (currentStep === null) {return;}
		const nextIdx = currentStep + 1;
		if (nextIdx >= steps.length) {
			setCurrentStep(null);
			completeOnboarding();
		} else {
			setCurrentStep(nextIdx);
		}
	}, [currentStep, completeOnboarding]);

	const skipOnboarding = useCallback(() => {
		setCurrentStep(null);
		completeOnboarding();
	}, [completeOnboarding]);

	const registerLayout = useCallback((stepId: string, layout: Layout) => {
		setLayouts(prev => ({ ...prev, [stepId]: layout }));
	}, []);

	const isOnboarding = currentStep !== null;

	return (
		<OnboardingContext.Provider
			value={{ currentStep, isOnboarding, steps, layouts, nextStep, skipOnboarding, registerLayout }}
		>
			{children}
		</OnboardingContext.Provider>
	);
}

export function useOnboarding() {
	const context = useContext(OnboardingContext);
	if (context === undefined) {
		throw new Error('useOnboarding must be used within an OnboardingProvider');
	}
	return context;
}
