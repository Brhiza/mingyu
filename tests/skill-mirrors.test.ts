import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(join(root, entry.name)).map((name) => join(entry.name, name))
        : [entry.name],
    )
    .sort();
}
test('两个公开 Skill 入口的文件清单和完整内容必须与安装源一致', () => {
  const source = 'skills/mingyu';
  for (const target of ['public/skills/mingyu', 'public/skills/aov-mingyu-api']) {
    assert.deepEqual(files(target), files(source), `${target} 文件清单漂移`);
    for (const name of files(source)) {
      assert.equal(
        readFileSync(join(target, name), 'utf8'),
        readFileSync(join(source, name), 'utf8'),
        `${target}/${name} 内容漂移；运行 node scripts/sync-skill.mjs`,
      );
    }
  }
});

test('公开说明与 Skill 的本地资料链接必须有实际目标文件', () => {
  const paths = ['docs', 'skills/mingyu'].flatMap((root) =>
    files(root)
      .filter((name) => name.endsWith('.md'))
      .map((name) => join(root, name)),
  );
  paths.push('mcp/README.md');
  for (const path of paths) {
    const content = readFileSync(path, 'utf8');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:[a-z]+:|\/)/i.test(target)) continue;
      assert.ok(existsSync(join(dirname(path), target)), `${path} 引用了不存在的资料 ${target}`);
    }
  }
});
