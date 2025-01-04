<script lang="ts">
	import { MoreVertical } from 'lucide-svelte';
	import type { Todo } from '$lib/server/db/schema';

	type MenuItem = {
		icon: any; // Lucide icon component
		label: string;
		onClick: (todoId: number) => void;
		class?: string;
	};

	const { todos = [], menuItems = [] } = $props<{
		todos: Todo[];
		menuItems: MenuItem[];
	}>();

	let openMenuId = $state<number | null>(null);

	function toggleMenu(todoId: number, event: MouseEvent) {
		event.stopPropagation();
		openMenuId = openMenuId === todoId ? null : todoId;
	}
</script>

<ul class="todo-list">
	{#each todos as todo}
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
						{#each menuItems as item}
							<button
								class="menu-item {item.class || ''}"
								on:click={() => {
									item.onClick(todo.id);
									openMenuId = null;
								}}
							>
								<svelte:component this={item.icon} size={16} />
								{item.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</li>
	{/each}
</ul>

<style>
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

	.todo-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.todo-title {
		color: #ffffff;
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
