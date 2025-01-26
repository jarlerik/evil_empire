<script lang="ts">
	import { timerStore } from '$lib/stores/timerStore';
	import type { Todo } from '$lib/stores/timerStore';
	import Timer from './Timer.svelte';

	const { todo = null } = $props<{ todo: Todo | null }>();

	// Watch for changes in todo and update store
	$effect(() => {
		if (todo) {
			timerStore.update(state => ({
				...state,
				currentTodo: todo
			}));
		}
	});
</script>

<div class="current-task">
	<h1>
		{$timerStore.isRest ? 'Taking rest from' : 'Working on'}: 
		<span class="current-task-title">{$timerStore.currentTodo?.title || 'No task selected'}</span>
	</h1>
	<Timer />
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
</style>
