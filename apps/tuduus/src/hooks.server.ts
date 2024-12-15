import { validateSessionToken } from '$lib/server/session';
import { deleteSessionTokenCookie } from '$lib/server/cookie';

import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session') ?? null;
	const publicRoutes = ['/', '/login', '/register', '/reset-password'];
	const isPublicRoute = publicRoutes.some((route) => event.url.pathname.startsWith(route));

	if (token === null) {
		event.locals.user = null;
		event.locals.session = null;

		if (!isPublicRoute) {
			throw redirect(303, '/login');
		}
		return resolve(event);
	}

	const { session, user } = await validateSessionToken(token);
	if (session === null) {
		deleteSessionTokenCookie(event);
		if (!isPublicRoute) {
			throw redirect(303, '/login');
		}
	}

	event.locals.session = session;
	event.locals.user = user;
	return resolve(event);
};
