import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const generatedPaths = [
  fileURLToPath(new URL('../dist', import.meta.url)),
  fileURLToPath(new URL('../src/location/china-data.js', import.meta.url)),
];

for (const generatedPath of generatedPaths) {
  rmSync(generatedPath, { recursive: true, force: true });
}
