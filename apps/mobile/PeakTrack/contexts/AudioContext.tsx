import { createContext, useContext } from 'react';
import { useAudioPlayer, AudioPlayer } from 'expo-audio';

interface AudioContextValue {
	beepSound: AudioPlayer;
	tenSecondsSound: AudioPlayer;
	letsGoSound: AudioPlayer;
}

const AudioContext = createContext<AudioContextValue | null>(null);

const beepSource = require('../assets/sounds/beep.m4a');
const tenSecondsSource = require('../assets/sounds/ten_seconds.mp3');
const letsGoSource = require('../assets/sounds/lets_go.mp3');

export function AudioProvider({ children }: { children: React.ReactNode }) {
	const beepSound = useAudioPlayer(beepSource);
	const tenSecondsSound = useAudioPlayer(tenSecondsSource);
	const letsGoSound = useAudioPlayer(letsGoSource);
	return (
		<AudioContext.Provider value={{ beepSound, tenSecondsSound, letsGoSound }}>
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
