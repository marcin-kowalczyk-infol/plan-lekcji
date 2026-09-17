import {sqliteTable,integer,text} from 'drizzle-orm/sqlite-core';
export const plan=sqliteTable('plan',{id:integer('id').primaryKey(),version:integer('version').notNull(),data:text('data').notNull(),updated:text('updated').notNull()});
export const attempts=sqliteTable('attempts',{id:integer('id').primaryKey(),count:integer('count').notNull(),until_ms:integer('until_ms').notNull()});
export const sessions=sqliteTable('sessions',{token:text('token').primaryKey(),expires:integer('expires').notNull()});
