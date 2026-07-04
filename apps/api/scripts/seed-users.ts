import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { users } from '../src/db/schema';

const seedUsers = [
  {
    id: '7cf88eb2-8e2c-4a44-87d1-c001aacc32ec',
    supabaseUserId: '7cf88eb2-8e2c-4a44-87d1-c001aacc32ec',
    email: 'admin@distribio.com',
    name: 'Admin',
    role: 'ADMIN',
    isActive: true,
  },
  {
    id: '8ff2208b-c529-457a-9471-6a5a463299d9',
    supabaseUserId: '8ff2208b-c529-457a-9471-6a5a463299d9',
    email: 'sales@distribio.com',
    name: 'Sales Rep',
    role: 'SALES_REP',
    isActive: true,
  },
  {
    id: 'e90039b9-88b3-4164-a106-e3f8bd285b65',
    supabaseUserId: 'e90039b9-88b3-4164-a106-e3f8bd285b65',
    email: 'collector@distribio.com',
    name: 'Collector',
    role: 'COLLECTOR',
    isActive: true,
  },
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  try {
    for (const user of seedUsers) {
      await db
        .insert(users)
        .values(user)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            supabaseUserId: user.supabaseUserId,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
          },
        });
    }

    console.log(`Seeded ${seedUsers.length} Distribio users.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
