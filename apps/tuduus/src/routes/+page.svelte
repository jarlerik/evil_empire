<!-- +page.svelte -->
<script lang="ts">
	import { Pause, MoreVertical, Trash2, Edit, Play } from 'lucide-svelte';
	import type { Todo } from '$lib/server/db/schema';
	import { enhance } from '$app/forms';

	// This data will come from the +page.server.ts load function
	export let data: { todos: Todo[] };

	let newTodoTitle = '';
	let openMenuId: number | null = null;

	function toggleMenu(todoId: number, event: MouseEvent) {
		event.stopPropagation(); // Prevent click from bubbling up
		openMenuId = openMenuId === todoId ? null : todoId;
	}

	// Close menu when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (openMenuId !== null) {
			openMenuId = null;
		}
	}

	async function handleDelete(todoId: number) {
		const formData = new FormData();
		formData.append('id', todoId.toString());

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			// Remove the todo from the list
			data.todos = data.todos.filter((t) => t.id !== todoId);
			openMenuId = null; // Close menu after deletion
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

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
				placeholder="Write title of new task and press enter..."
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
					<div class="menu-container">
						<button class="menu-button" on:click|stopPropagation={(e) => toggleMenu(todo.id, e)}>
							<MoreVertical size={18} />
						</button>
						{#if openMenuId === todo.id}
							<div class="popup-menu">
								<button class="menu-item">
									<Play size={16} />
									Add to daily todos
								</button>
								<button class="menu-item">
									<Edit size={16} />
									Edit
								</button>
								<button class="menu-item delete" on:click={() => handleDelete(todo.id)}>
									<Trash2 size={16} />
									Delete
								</button>
							</div>
						{/if}
					</div>
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
		display: flex;
		justify-content: space-between;
		align-items: center;
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

	.menu-button {
		background: none;
		border: none;
		color: #ffffff;
		opacity: 0.6;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.menu-button:hover {
		opacity: 1;
		background-color: #ffffff1a;
	}

	.menu-container {
		position: relative;
	}

	.popup-menu {
		position: absolute;
		right: 0;
		top: 100%;
		background-color: var(--zinc-900);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		min-width: 10rem;
		z-index: 10;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: none;
		color: #ffffff;
		cursor: pointer;
		text-align: left;
		font-size: 14px;
	}

	.menu-item:hover {
		background-color: #ffffff1a;
	}

	.menu-item.delete {
		color: #ff6b6b;
	}

	.menu-item.delete:hover {
		background-color: #ff6b6b1a;
	}
</style>
