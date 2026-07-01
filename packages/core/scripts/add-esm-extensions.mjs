/**
 * Post-build script: add .js or /index.js extensions to relative import/export paths in dist/.
 *
 * TypeScript with moduleResolution "bundler" does NOT add .js extensions during compilation.
 * For ESM (type: "module" in package.json), Node.js requires explicit extensions on
 * relative imports.
 *
 * This script walks dist/ and rewrites:
 *   import { x } from './foo'       →  import { x } from './foo.js'        (when ./foo.js exists)
 *   import { x } from './baziShenSha'  →  import { x } from './baziShenSha/index.js'  (when dir)
 *   export * from './bar'           →  export * from './bar.js'
 *   import './side-effect'          →  import './side-effect.js'
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, extname, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, '..', 'dist');

/** Check if a path already has a recognized file extension */
function hasExtension(p) {
  const ext = extname(p);
  return ['.js', '.mjs', '.cjs', '.json', '.node'].includes(ext);
}

/** Resolve the correct ESM import path: prefer .js file, then /index.js */
function resolveESMPath(importPath, sourceFileDir) {
  // Try <path>.js
  const asFile = resolve(sourceFileDir, importPath + '.js');
  if (existsSync(asFile)) {
    // Return the relative path with .js
    const rel = relative(sourceFileDir, asFile).replace(/\\/g, '/');
    return rel.startsWith('.') ? rel : './' + rel;
  }

  // Try <path>/index.js
  const asIndex = resolve(sourceFileDir, importPath, 'index.js');
  if (existsSync(asIndex)) {
    const rel = relative(sourceFileDir, asIndex).replace(/\\/g, '/');
    return rel.startsWith('.') ? rel : './' + rel;
  }

  // Fallback: just append .js
  console.warn(`  ⚠  Cannot resolve: ${importPath} from ${sourceFileDir} — appending .js as fallback`);
  return importPath + '.js';
}

/** Walk a directory recursively, returning all .js file paths */
function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const files = walkDir(distDir);
let fixedCount = 0;

// Matches:
//   from '<relative-path>'
//   from "<relative-path>"
//   import '<relative-path>'
//   import "<relative-path>"
// where relative-path starts with ./ or ../
const IMPORT_PATTERN = /(from\s+['"])(\.\.?\/[^'"]+)(['"])|((?:^|\n)\s*import\s+['"])(\.\.?\/[^'"]+)(['"])/g;

for (const filePath of files) {
  const sourceFileDir = dirname(filePath);
  const content = readFileSync(filePath, 'utf-8');
  let modified = false;

  const newContent = content.replace(IMPORT_PATTERN, (match, fromQuote, fromPath, fromEnd, importPre, importPath, importEnd) => {
    const rawPath = fromPath || importPath || '';

    if (!rawPath || hasExtension(rawPath)) {
      return match; // already has extension, skip
    }

    const resolved = resolveESMPath(rawPath, sourceFileDir);
    if (resolved === rawPath) {
      return match; // no change needed
    }

    modified = true;

    // Reconstruct the match using the correct quote
    if (fromQuote) {
      const quote = fromQuote.endsWith('"') ? '"' : "'";
      return `${fromQuote}${resolved}${fromEnd}`;
    } else {
      const quote = importPre.endsWith('"') ? '"' : "'";
      return `${importPre}${resolved}${importEnd}`;
    }
  });

  if (modified) {
    writeFileSync(filePath, newContent, 'utf-8');
    fixedCount++;
  }
}

console.log(`Fixed ${fixedCount} dist files (added missing ESM extensions)`);
