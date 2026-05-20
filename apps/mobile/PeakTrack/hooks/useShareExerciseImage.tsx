import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Alert, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
	buildExerciseSessionLayout,
	fetchExerciseProgressionData,
	lookupExactRm,
	type ExerciseSessionLayout,
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import {
	ShareableExerciseCard,
	SHARE_CARD_HEIGHT,
	SHARE_CARD_WIDTH,
} from '../components/share/ShareableExerciseCard';

interface ShareInput {
	exerciseName: string;
	weightUnit: 'kg' | 'lbs';
	layouts?: ExerciseSessionLayout[];
}

interface ShareState {
	exerciseName: string;
	weightUnit: 'kg' | 'lbs';
	layouts: ExerciseSessionLayout[];
	oneRepMax: { weight: number } | null;
}

export interface UseShareExerciseImageResult {
	share: (input: ShareInput) => Promise<void>;
	capturing: boolean;
	OffscreenCard: ReactNode;
}

function waitFrame(): Promise<void> {
	return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export function useShareExerciseImage(): UseShareExerciseImageResult {
	const { user } = useAuth();
	const [state, setState] = useState<ShareState | null>(null);
	const [capturing, setCapturing] = useState(false);
	const cardRef = useRef<View>(null);
	const layoutReadyRef = useRef<(() => void) | null>(null);

	const waitForLayout = useCallback((): Promise<void> => {
		return new Promise(resolve => {
			layoutReadyRef.current = resolve;
		});
	}, []);

	const handleLayout = useCallback(() => {
		const fn = layoutReadyRef.current;
		if (fn) {
			layoutReadyRef.current = null;
			fn();
		}
	}, []);

	const share = useCallback(
		async (input: ShareInput) => {
			if (!user || capturing) {
				return;
			}
			setCapturing(true);
			try {
				const isAvailable = await Sharing.isAvailableAsync();
				if (!isAvailable) {
					Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
					return;
				}

				let layouts: ExerciseSessionLayout[] = input.layouts ?? [];
				if (layouts.length === 0) {
					const { data: rows, error } = await fetchExerciseProgressionData(
						user.id,
						input.exerciseName,
					);
					if (error || !rows) {
						Alert.alert('Could not load progression', error ?? 'Unknown error');
						return;
					}
					layouts = [];
					for (const row of rows) {
						const layout = buildExerciseSessionLayout({
							row,
							weightUnit: input.weightUnit,
						});
						if (layout) {
							layouts.push(layout);
						}
					}
				}

				if (layouts.length === 0) {
					Alert.alert(
						'Nothing to share',
						'No recorded sessions for this exercise yet.',
					);
					return;
				}

				const { data: oneRepMax } = await lookupExactRm(user.id, input.exerciseName, 1);

				setState({
					exerciseName: input.exerciseName,
					weightUnit: input.weightUnit,
					layouts,
					oneRepMax: oneRepMax ?? null,
				});

				await waitForLayout();
				await waitFrame();
				await waitFrame();

				const uri = await captureRef(cardRef, {
					format: 'png',
					result: 'tmpfile',
					width: SHARE_CARD_WIDTH,
					height: SHARE_CARD_HEIGHT,
				});

				await Sharing.shareAsync(uri, {
					mimeType: 'image/png',
					dialogTitle: 'Share progress',
					UTI: 'public.png',
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Could not generate image';
				Alert.alert('Share failed', message);
			} finally {
				setState(null);
				setCapturing(false);
			}
		},
		[user, capturing, waitForLayout],
	);

	const OffscreenCard = state ? (
		<View
			ref={cardRef}
			collapsable={false}
			pointerEvents="none"
			onLayout={handleLayout}
			style={{
				position: 'absolute',
				left: -100000,
				top: 0,
				width: SHARE_CARD_WIDTH,
				height: SHARE_CARD_HEIGHT,
				backgroundColor: 'transparent',
			}}
		>
			<ShareableExerciseCard
				exerciseName={state.exerciseName}
				layouts={state.layouts}
				weightUnit={state.weightUnit}
				oneRepMax={state.oneRepMax}
			/>
		</View>
	) : null;

	return { share, capturing, OffscreenCard };
}
