import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { type InferSelectModel } from 'drizzle-orm';

export const userTable = pgTable('users', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 255 }),
	email: varchar('email', { length: 255 }),
	password: text('password').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const sessionTable = pgTable('session', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => userTable.id),
	expiresAt: timestamp('expires_at', {
		withTimezone: true,
		mode: 'date'
	}).notNull()
});

export type TodoState = 'undone' | 'doing' | 'done' | 'working';

export const todoTable = pgTable('todos', {
	id: serial('id').primaryKey(),
	title: varchar('title', { length: 255 }).notNull(),
	state: varchar('state', { length: 10 })
		.notNull()
		.default('undone' satisfies TodoState),
	userId: integer('user_id')
		.notNull()
		.references(() => userTable.id),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export type User = InferSelectModel<typeof userTable>;
export type Session = InferSelectModel<typeof sessionTable>;
export type Todo = InferSelectModel<typeof todoTable>;
