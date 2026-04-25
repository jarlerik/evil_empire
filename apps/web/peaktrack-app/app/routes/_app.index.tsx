import { createFileRoute, redirect } from '@tanstack/react-router';
import { format } from 'date-fns';

export const Route = createFileRoute('/_app/')({
  beforeLoad: () => {
    throw redirect({
      to: '/workouts/$date',
      params: { date: format(new Date(), 'yyyy-MM-dd') },
    });
  },
});
