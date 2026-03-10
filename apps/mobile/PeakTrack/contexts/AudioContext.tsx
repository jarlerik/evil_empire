import { createContext, useContext } from 'react';
import { useAudioPlayer, AudioPlayer } from 'expo-audio';

interface AudioContextValue {
	beepSound: AudioPlayer;
	beepLongSound: AudioPlayer;
}

const AudioContext = createContext<AudioContextValue | null>(null);

const beepSource = require('../assets/sounds/beep.m4a');
const beepLongSource = require('../assets/sounds/beep-long.m4a');

export function AudioProvider({ children }: { children: React.ReactNode }) {
	const beepSound = useAudioPlayer(beepSource);
	const beepLongSound = useAudioPlayer(beepLongSource);

	return (
		<AudioContext.Provider value={{ beepSound, beepLongSound }}>
			{children}
		</AudioContext.Provider>
	);
}

export function useAudio(): AudioContextValue {
	const context = useContext(AudioContext);
	if (!context) {
		throw new Error('useAudio must be used within an AudioProvider');
	}
	return context;
}
