<!-- +page.svelte -->
<script lang="ts">
	import type { Todo } from '$lib/server/db/schema';
	import { enhance } from '$app/forms';
	import CurrentTask from '$lib/components/CurrentTask.svelte';
	import TodoList from '$lib/components/TodoList.svelte';
	import { getTaskBucketMenuItems, getDailyTodoMenuItems } from '$lib/config/menuItems';

	// This data will come from the +page.server.ts load function
	const { data } = $props();

	let todos = $state(data.todos);

	let newTodoTitle = $state('');
	let openMenuId = $state(null); //number | null = null;
	let currentTodoId: string = '';
	let currentState: string = '';
	let currentTask = $state<Todo | null>(null);

	function toggleMenu(todoId: number, event: MouseEvent) {
		event.stopPropagation(); // Prevent click from bubbling upx
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
			todos = todos.filter((t) => t.id !== todoId);
			openMenuId = null; // Close menu after deletion
		}
	}

	async function addToDailyTodos(todoId: number) {
		const formData = new FormData();
		formData.append('id', todoId.toString());
		await fetch('?/addToDailyTodos', { method: 'POST', body: formData });
		todos = todos.map((todo) => (todo.id === todoId ? { ...todo, state: 'DOING' } : todo));
	}

	async function removeFromDailyTodos(todoId: number) {
		const formData = new FormData();
		formData.append('id', todoId.toString());
		await fetch('?/removeFromDailyTodos', { method: 'POST', body: formData });
		todos = todos.map((todo) => (todo.id === todoId ? { ...todo, state: 'UNDONE' } : todo));
	}

	async function setCurrentTask(todo: Todo) {
		currentTask = todo;
		openMenuId = null; // Close menu after selection
	}

	const taskBucketMenuItems = getTaskBucketMenuItems(addToDailyTodos, handleDelete);
	const dailyTodoMenuItems = getDailyTodoMenuItems(setCurrentTask, removeFromDailyTodos, todos);
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
						todos.push(result.data.todo);
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
		<TodoList
			todos={todos.filter((todo) => todo.state !== 'DOING')}
			menuItems={taskBucketMenuItems}
		/>
	</div>
	<div class="right-panel">
		<CurrentTask todo={currentTask} />
		<div class="daily-tasks">
			<h1>Daily todo</h1>
			<TodoList
				todos={todos.filter((todo) => todo.state === 'DOING')}
				menuItems={dailyTodoMenuItems}
			/>
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
		z-index: 10;
	}

	.popup-menu {
		position: absolute;
		right: 0;
		top: 100%;
		background-color: #18181b;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		min-width: 12rem;
		z-index: 100;
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
