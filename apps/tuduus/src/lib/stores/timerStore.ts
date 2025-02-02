import { persisted } from 'svelte-persisted-store';
import { WORK_TIME } from '$lib/config/timerConfig';

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
    isRest: boolean;
    currentSession: number;
}

const initialState: TimerState = {
    currentTodo: null,
    timeLeft: WORK_TIME,
    isPaused: true,
    isRest: false,
    currentSession: 0
};

export const timerStore = persisted('timer-state', initialState); 
