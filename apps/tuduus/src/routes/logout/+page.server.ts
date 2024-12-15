import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { deleteSessionTokenCookie } from '$lib/server/cookie';
import { invalidateSession } from '$lib/server/session';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeHexLowerCase } from '@oslojs/encoding';

export const load: PageServerLoad = async (event) => {
	const { cookies } = event;

	// Get the session token from cookie
	const sessionToken = cookies.get('session');

	if (sessionToken) {
		// Calculate session ID from token
		const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(sessionToken)));

		// Delete session from database
		await invalidateSession(sessionId);
	}

	// Delete the session cookie
	deleteSessionTokenCookie(event);

	// Redirect to login page
	redirect(302, '/login');
};
