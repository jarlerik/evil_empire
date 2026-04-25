import { redirect } from '@tanstack/react-router';
import { supabase } from './supabase';

// Used by `_app.tsx`'s beforeLoad. Throws a redirect to `/sign-in` when there
// is no Supabase session. Extracted so it's directly testable without a
// router context.
export async function requireSession(): Promise<void> {
  if (!supabase) {
    throw redirect({ to: '/sign-in' });
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw redirect({ to: '/sign-in' });
  }
}

// Used by `sign-in.tsx` / `sign-up.tsx` so an already-authed user lands on
// home rather than seeing the auth forms.
export async function redirectIfAuthed(): Promise<void> {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    throw redirect({ to: '/' });
  }
}
