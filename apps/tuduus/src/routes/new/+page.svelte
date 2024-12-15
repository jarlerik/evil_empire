<!-- +page.svelte -->
<script lang="ts">
	import { Pause } from 'lucide-svelte';
</script>

<div class="grid-container">
	<div class="task-bucket">
		<h1>Task bucket</h1>
		<!-- Task list will go here -->
	</div>
	<div class="right-panel">
		<div class="current-task">
			<h1>Working on: <span class="current-task-title">task #1 title lorem ipsum</span></h1>
			<div class="timer-section">
				<div class="timer-container">
					<div class="timer">
						<span class="time">12:20</span>
					</div>
				</div>
				<button class="pause-button">
					<Pause size={24} />
				</button>
			</div>
		</div>
		<div class="daily-tasks">
			<h1>Daily todo</h1>
			<!-- Daily tasks list will go here -->
		</div>
	</div>
</div>

<style>
	.grid-container {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 2rem;
		height: 100%;
	}

	.task-bucket {
		background-color: #242424;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.right-panel {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

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

	.daily-tasks {
		background-color: #242424;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	h1 {
		font-size: 1.5rem;
		color: #ffffff;
		margin: 0;
	}

	h2 {
		font-size: 1.25rem;
		color: #ffffff;
		margin: 0 0 1rem 0;
	}
</style>
