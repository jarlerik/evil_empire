import type { Actions } from './$types';
import { register } from '$lib/server/register';

export const actions = {
	register: async ({ request }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const name = data.get('name') as string;
		const confirmPassword = data.get('confirmPassword');

		// Basic validation
		if (!email || !password || !confirmPassword) {
			return {
				error: 'All fields are required'
			};
		}

		if (password !== confirmPassword) {
			return {
				error: 'Passwords do not match'
			};
		}

		try {
			register({ email, password, name });
			return {
				success: 'Registration successful!'
			};
		} catch (err) {
			console.error(err);
			return {
				error: 'An error occurred during registration'
			};
		}
	}
} satisfies Actions;
