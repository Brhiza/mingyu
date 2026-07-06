import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const srcDir = join(__dirname, '..', 'src');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.ts') && !entry.name.includes('.d.')) files.push(full);
  }
  return files;
}

// Count directory depth from project root to the file's parent dir
function dirDepth(filePath) {
  const relPath = relative(srcDir, filePath).replace(/\\/g, '/');
  return relPath.split('/').length; // e.g., "divination/algorithms/liuyao.ts" => 3
}

const files = walk(srcDir);
let fixed = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf-8');

  // Match common import patterns: from 'xxx' or from "xxx"
  const newContent = content.replace(
    /(from\s+['"])((?:\.\.\/)+)([^'"]+)(['"])/g,
    (match, pre, dots, path, end) => {
      const dotCount = (dots.match(/\.\.\//g) || []).length;
      const depth = dirDepth(file);
      // Depth 3 (e.g., divination/algorithms/X.ts): correct up-count to reach src/ is 2
      // So if dotCount >= depth, reduce by 1
      if (dotCount >= depth) {
        const newCount = depth - 1;
        if (newCount <= 0) return match;
        return `${pre}${'../'.repeat(newCount)}${path}${end}`;
      }
      return match;
    },
  );

  if (newContent !== content) {
    writeFileSync(file, newContent, 'utf-8');
    fixed++;
  }
}

console.log(`Fixed ${fixed} files`);
