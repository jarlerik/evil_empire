import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { createSession, generateSessionToken } from '$lib/server/session';
import { setSessionTokenCookie } from '$lib/server/cookie';
import bcrypt from 'bcryptjs';

// Redirect if user is already logged in
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		redirect(302, '/');
	}
};

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6)
});

export const actions: Actions = {
	default: async ({ cookies, request }) => {
		const formData = Object.fromEntries(await request.formData());

			const { email, password } = loginSchema.parse(formData);

			const user = await db.query.userTable.findFirst({
				where: (users, { eq }) => eq(users.email, email),
			});

			if (!user) {
				return fail(400, {
					error: 'Invalid credentials'
				});
			}

			const validPassword = await bcrypt.compare(password, user.password);
			if (!validPassword) {
				return fail(400, {
					error: 'Invalid credentials'
				});
			}

			const token = generateSessionToken();
			const session = await createSession(token, user.id);	
			setSessionTokenCookie(cookies, token, session.expiresAt )


			redirect(302, '/');
		}
		
};
