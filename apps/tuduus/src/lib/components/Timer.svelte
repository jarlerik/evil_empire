<script lang="ts">
	import { Pause, Play } from 'lucide-svelte';
	import { onDestroy } from 'svelte';
	import { timerStore } from '$lib/stores/timerStore';
	import { WORK_TIME, REST_TIME } from '$lib/config/timerConfig';

	let isPaused = $state($timerStore.isPaused);
	let timeLeft = $state($timerStore.timeLeft);
	let intervalId: NodeJS.Timeout | null = null;

	// Format seconds to MM:SS
	function formatTime(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
	}

	function startTimer() {
		if (!intervalId) {
			intervalId = setInterval(() => {
				if (timeLeft > 0) {
					timeLeft--;
				} else {
					toggleMode();
				}
			}, 1000);
		}
		isPaused = false;
	}

	function toggleMode() {
		timerStore.update(state => ({
			...state,
			isRest: !state.isRest,
			currentSession: !state.isRest ? state.currentSession : state.currentSession + 1
		}));
		timeLeft = $timerStore.isRest ? REST_TIME : WORK_TIME;
		// Don't pause when switching modes
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		startTimer();
	}

	function pauseTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		isPaused = true;
	}

	function stopTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
		isPaused = true;
		timeLeft = WORK_TIME;
	}

	function toggleTimer() {
		if (isPaused) {
			startTimer();
		} else {
			pauseTimer();
		}
	}

	// Update store when timer state changes
	$effect(() => {
		timerStore.update(state => ({
			...state,
			timeLeft,
			isPaused
		}));
	});

	// Initialize from store
	$effect(() => {
		timeLeft = $timerStore.timeLeft;
		isPaused = $timerStore.isPaused;
		if (!isPaused) {
			startTimer();
		}
	});

	// Cleanup interval on component destruction
	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	});
</script>

<div class="timer-section">
    <!-- Session container -->
    <div class="session-container">
        <span class="session-count">{$timerStore.currentSession} / 12 sessions</span>
    </div>
    <!-- Timer container -->
	<div class="timer-container" class:rest={$timerStore.isRest}>
		<div class="timer">
			<span class="time">{formatTime(timeLeft)}</span>
		</div>
		<div class="mode-indicator">
			{$timerStore.isRest ? 'Rest Time' : 'Work Time'}
		</div>
	</div>
	<button 
		class="pause-button" 
		on:click={toggleTimer} 
		disabled={!$timerStore.currentTodo}
		title={!$timerStore.currentTodo ? 'Add task from Daily todo' : ''}
	>
		{#if isPaused}
			<Play size={24} />
		{:else}
			<Pause size={24} />
		{/if}
	</button>
</div>

<style>
	.timer-section {
		display: flex;
		align-items: center;
		gap: 1rem;
		justify-content: center;
		margin-top: 1rem;
	}

	.timer-container {
		background-color: var(--red-500);
		border-radius: 8px;
		padding: 1rem;
		width: 33%;
		border: 2px solid #ffffff;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		transition: background-color 0.3s ease;
	}

	.timer-container.rest {
		background-color: var(--green-500);
	}

	.timer {
		display: flex;
		align-items: center;
	}

	.time {
		font-size: 2rem;
		font-weight: bold;
		color: #ffffff;
	}

	.mode-indicator {
		color: #ffffff;
		font-size: 0.875rem;
		opacity: 0.9;
	}

	.pause-button {
		background: none;
		border: none;
		cursor: pointer;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pause-button:hover {
		opacity: 0.8;
	}

	.pause-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.session-container {

		border-radius: 8px;
		padding: 0.5rem 1rem;
		border: 2px solid #ffffff;
		margin-bottom: 0.5rem;
	}

	.session-count {
		color: #ffffff;
		font-size: 0.875rem;
		font-weight: 500;
	}
</style> 
