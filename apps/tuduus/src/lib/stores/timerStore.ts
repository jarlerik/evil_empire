import { persisted } from 'svelte-persisted-store';

export interface Todo {
    id: string;
    title: string;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface TimerState {
    currentTodo: Todo | null;
    timeLeft: number;
    isPaused: boolean;
}

const initialState: TimerState = {
    currentTodo: null,
    timeLeft: 25 * 60,
    isPaused: true
};

export const timerStore = persisted('timer-state', initialState); 
