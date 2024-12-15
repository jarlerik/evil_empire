import { db } from '$lib/server/db';
import { userTable } from '$lib/server/db/schema';

export const load = async () => {
	
	const result = await db.select().from(userTable);	
	return {
		result
	};
};
