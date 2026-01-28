import { config } from 'dotenv';
import path from 'path';
import { defineConfig } from 'prisma/config';

if (!process.env.DATABASE_URL) {
  config({ path: path.join(process.cwd(), '.env') });
}

export default defineConfig({
  schema: 'prisma/schema.prisma'
});
