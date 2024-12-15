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

<div class="container">
	<main class="main">
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
</div>

<style lang="scss">
	.container {
		h1 {
			color: var(--primary-color);
		}
	}
</style>
