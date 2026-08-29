import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const generatedPaths = [
  fileURLToPath(new URL('../dist', import.meta.url)),
  fileURLToPath(new URL('../src/location/china-data.js', import.meta.url)),
];

for (const generatedPath of generatedPaths) {
  try {
    rmSync(generatedPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Ignore lock errors on busy windows filesystem
  }
}
