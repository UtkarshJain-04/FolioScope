import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const envPaths = [
  resolve(serverDirectory, '.env'),
  resolve(serverDirectory, '..', '.env'),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
