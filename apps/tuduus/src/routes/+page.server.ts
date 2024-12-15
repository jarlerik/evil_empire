import { db } from '$lib/server/db';
import { todoTable } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const todos = await db.select().from(todoTable).where(eq(todoTable.userId, locals.user.id));

	return {
		todos
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		const data = await request.formData();
		const title = data.get('title');

		if (!title || typeof title !== 'string') {
			return fail(400, { error: 'Invalid todo text' });
		}

		const [todo] = await db
			.insert(todoTable)
			.values({
				title,
				userId: locals.user.id
			})
			.returning();

		return { todo };
	},

	toggle: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		const data = await request.formData();
		const id = data.get('id');
		const completed = data.get('completed');

		if (!id || typeof id !== 'string') {
			return fail(400, { error: 'Invalid todo id' });
		}

		const isCompleted = completed === 'true';

		const [todo] = await db
			.update(todoTable)
			.set({
				completed: isCompleted,
				updatedAt: new Date()
			})
			.where(eq(todoTable.id, parseInt(id)))
			.returning();
		return { todo };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		const data = await request.formData();
		const id = data.get('id');

		if (!id || typeof id !== 'string') {
			return fail(400, { error: 'Invalid todo id' });
		}

		await db.delete(todoTable).where(eq(todoTable.id, parseInt(id)));

		return { success: true };
	}
};
