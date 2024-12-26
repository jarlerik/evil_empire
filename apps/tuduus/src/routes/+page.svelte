<!-- +page.svelte -->
<script lang="ts">
	import { Pause } from 'lucide-svelte';
	import type { Todo } from '$lib/server/db/schema';
	import { enhance } from '$app/forms';

	// This data will come from the +page.server.ts load function
	export let data: { todos: Todo[] };

	let newTodoTitle = '';
</script>

<div class="grid-container">
	<div class="task-bucket">
		<h1>Task bucket</h1>
		<form
			class="add-todo-form"
			method="POST"
			action="?/create"
			use:enhance={() => {
				return ({ result }) => {
					if (result.type === 'success') {
						// Add the new todo to the list
						data.todos = [...data.todos, result.data.todo];
						newTodoTitle = ''; // Clear input on success
					}
				};
			}}
		>
			<input
				name="title"
				type="text"
				placeholder="Add a new task..."
				class="todo-input"
				bind:value={newTodoTitle}
			/>
		</form>
		<ul class="todo-list">
			{#each data.todos as todo}
				<li class="todo-item">
					<label class="todo-label">
						<span class="todo-title">{todo.title}</span>
					</label>
				</li>
			{/each}
		</ul>
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
		grid-template-columns: 1fr 1fr;
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

	.todo-list {
		list-style: none;
		padding: 0;
		margin: 1rem 0 0 0;
	}

	.todo-item {
		padding: 0.5rem 0;
	}

	.todo-item:last-child {
		border-bottom: none;
	}

	.todo-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.todo-checkbox {
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 4px;
		border: 2px solid #ffffff;
		appearance: none;
		background: none;
		cursor: pointer;
	}

	.todo-checkbox:checked {
		background-color: #ffffff;
		position: relative;
	}

	.todo-title {
		color: #ffffff;
	}

	.add-todo-form {
		margin-top: 1rem;
	}

	.todo-input {
		width: 100%;
		padding: 0.5rem;
		border: none;
		border-radius: 4px;
		background-color: #333333;
		color: #ffffff;
	}

	.todo-input::placeholder {
		color: #888888;
	}

	.todo-input:focus {
		outline: 2px solid #ffffff33;
	}
</style>
