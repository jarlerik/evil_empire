import { Plus, Edit, Trash2, Play, Minus } from 'lucide-svelte';
import type { MenuItem } from '$lib/types/menu';
import type { Todo } from '$lib/server/db/schema';

export function getTaskBucketMenuItems(
	addToDailyTodos: (id: number) => void,
	handleDelete: (id: number) => void
): MenuItem[] {
	return [
		{
			icon: Plus,
			label: 'Add to daily todos',
			onClick: addToDailyTodos
		},
		{
			icon: Edit,
			label: 'Edit',
			onClick: (id) => console.log('Edit', id)
		},
		{
			icon: Trash2,
			label: 'Delete',
			onClick: handleDelete,
			class: 'delete'
		}
	];
}

export function getDailyTodoMenuItems(
	setCurrentTask: (todo: Todo) => void,
	removeFromDailyTodos: (id: number) => void,
	todos: Todo[]
): MenuItem[] {
	return [
		{
			icon: Play,
			label: 'Work on task',
			onClick: (id) => setCurrentTask(todos.find((t) => t.id === id)!)
		},
		{
			icon: Minus,
			label: 'Move to task bucket',
			onClick: removeFromDailyTodos
		}
	];
}
