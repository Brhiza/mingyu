import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const source = 'skills/mingyu';
const targets = ['public/skills/mingyu', 'public/skills/aov-mingyu-api'];
function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(root, entry.name)).map((name) => join(entry.name, name))
      : [entry.name],
  );
}
for (const name of files(source)) {
  const content = readFileSync(join(source, name));
  for (const target of targets) {
    const path = join(target, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}
console.log('已同步完整 Skill 至两个公开入口。');
