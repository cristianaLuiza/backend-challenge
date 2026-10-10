import 'reflect-metadata';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'jungle',
  password: process.env.DATABASE_PASSWORD ?? 'jungle',
  database: process.env.DATABASE_NAME ?? 'jungle',

  entities: [],

  migrations: ['src/database/migrations/*.ts'],
});