<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	export let data: PageData;
	let newTodoText = '';
	$: todos = data.todos;

	function resetForm(form: HTMLFormElement) {
		form.reset();
		newTodoText = '';
	}
</script>

<main class="container">
	<h1>Todo List</h1>

	<form
		method="POST"
		action="?/create"
		class="todo-form"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				newTodoText = '';
			};
		}}
	>
		<div class="form-group">
			<input
				name="title"
				type="text"
				bind:value={newTodoText}
				placeholder="Add a new todo..."
				class="todo-input"
			/>
			<button type="submit" class="add-button"> Add Todo </button>
		</div>
	</form>

	<ul class="todo-list">
		{#each todos as todo (todo.id)}
			<li class="todo-item">
				<form
					method="POST"
					action="?/toggle"
					use:enhance={({ formElement }) => {
						const formData = new FormData(formElement);
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<input type="hidden" name="id" value={todo.id} />
					<input type="hidden" name="completed" value={todo.completed ? 'false' : 'true'} />
					<button type="submit" class="todo-toggle">
						<label class="todo-label">
							<input
								type="checkbox"
								checked={todo.completed}
								class="todo-checkbox"
								readonly
								aria-label="Toggle todo completion"
							/>
							<span class="todo-text" class:completed={todo.completed}>
								{todo.title}
							</span>
						</label>
					</button>
				</form>

				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={todo.id} />
					<button type="submit" class="delete-button"> Delete </button>
				</form>
			</li>
		{/each}
	</ul>
</main>

<style>
	.container {
		max-width: 42rem;
		margin: 0 auto;
		padding: 1rem;
	}

	h1 {
		font-size: 1.875rem;
		font-weight: bold;
		margin-bottom: 1.5rem;
	}

	.todo-form {
		margin-bottom: 1.5rem;
	}

	.form-group {
		display: flex;
		gap: 0.5rem;
	}

	.todo-input {
		flex: 1;
		padding: 0.5rem 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.add-button {
		padding: 0.5rem 1rem;
		background-color: #3b82f6;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.add-button:hover {
		background-color: #2563eb;
	}

	.todo-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.todo-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.todo-checkbox {
		width: 1.25rem;
		height: 1.25rem;
	}

	.todo-text {
		flex: 1;
	}

	.todo-text.completed {
		text-decoration: line-through;
	}

	.delete-button {
		padding: 0.25rem 0.5rem;
		color: #ef4444;
		border: none;
		background: none;
		cursor: pointer;
	}

	.delete-button:hover {
		color: #b91c1c;
	}

	.todo-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		width: 100%;
		text-align: left;
	}

	.todo-toggle:hover {
		background-color: #f3f4f6;
	}

	.todo-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		cursor: pointer;
	}
</style>
