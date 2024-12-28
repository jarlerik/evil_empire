<script lang="ts">
	import { Pause, Play } from 'lucide-svelte';
	import { onDestroy } from 'svelte';

	const { title = '' } = $props();

	let isPaused = $state(true);
	let timeLeft = $state(25 * 60); // Make timeLeft reactive with $state
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
					stopTimer();
				}
			}, 1000);
		}
		isPaused = false;
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
		timeLeft = 25 * 60;
	}

	function toggleTimer() {
		if (isPaused) {
			startTimer();
		} else {
			pauseTimer();
		}
	}

	// Cleanup interval on component destruction
	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	});
</script>

<div class="current-task">
	<h1>Working on: <span class="current-task-title">{title}</span></h1>
	<div class="timer-section">
		<div class="timer-container">
			<div class="timer">
				<span class="time">{formatTime(timeLeft)}</span>
			</div>
		</div>
		<button class="pause-button" on:click={toggleTimer}>
			{#if isPaused}
				<Play size={24} />
			{:else}
				<Pause size={24} />
			{/if}
		</button>
	</div>
</div>

<style>
	.current-task {
		background-color: #242424;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.current-task-title {
		font-weight: 400;
	}

	.timer-section {
		display: flex;
		align-items: center;
		gap: 1rem;
		justify-content: center;
		margin-top: 1rem;
	}

	.timer-container {
		background-color: #ff000033;
		border-radius: 8px;
		padding: 1rem;
		width: 33%;
		border: 2px solid #ffffff;
		display: flex;
		justify-content: center;
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
</style>
