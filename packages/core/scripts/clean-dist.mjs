import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const generatedPaths = [
  fileURLToPath(new URL('../dist', import.meta.url)),
  fileURLToPath(new URL('../src/location/china-data.js', import.meta.url)),
  fileURLToPath(new URL('../src/astrology/vendor/caelus/embedded-data.js', import.meta.url)),
  fileURLToPath(new URL('../src/astrology/vendor/caelus/ceres_cheb.js', import.meta.url)),
  fileURLToPath(new URL('../src/astrology/vendor/caelus/juno_cheb.js', import.meta.url)),
  fileURLToPath(new URL('../src/astrology/vendor/caelus/pallas_cheb.js', import.meta.url)),
  fileURLToPath(new URL('../src/astrology/vendor/caelus/vesta_cheb.js', import.meta.url)),
];

for (const generatedPath of generatedPaths) {
  try {
    rmSync(generatedPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Ignore lock errors on busy windows filesystem
  }
}
