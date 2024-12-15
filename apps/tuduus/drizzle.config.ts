import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: {
		url: process.env.DATABASE_URL
	},

	verbose: true,
	strict: true,
	dialect: 'postgresql'
});
