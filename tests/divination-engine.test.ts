import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDivinationSession } from '../src/lib/divination/engine';

const source = readFileSync(new URL('../src/lib/divination/engine.ts', import.meta.url), 'utf8');
const srcRoot = fileURLToPath(new URL('../src', import.meta.url));

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(next));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(next);
    }
  }

  return files;
}

test('梅花数字起卦会在本地校验正整数输入', () => {
  assert.match(source, /if \(draft\.method === 'meihua' && draft\.meihuaMethod === 'number'\)/);
  assert.match(source, /throw new Error\('数字起卦需要填写正整数'\);/);
});

test('占卜引擎按卦种动态加载当前项目本地算法与工具模块', () => {
  assert.match(source, /await import\('\.\/algorithms\/liuyao'\)/);
  assert.match(source, /await import\('\.\/algorithms\/meihua'\)/);
  assert.match(source, /await import\('\.\/algorithms\/qimen'\)/);
  assert.match(source, /await import\('\.\/algorithms\/liuren'\)/);
  assert.match(source, /await import\('\.\/algorithms\/ssgw'\)/);
  assert.match(source, /await import\('\.\.\/\.\.\/utils\/tarot'\)/);
  assert.doesNotMatch(source, /sydf/);
});

test('随机模式会先解析成具体占卜类型再继续执行', () => {
  assert.match(source, /function resolveMethod\(method: DivinationMethodId\)/);
  assert.match(source, /if \(method !== 'random'\)/);
  assert.match(source, /Math\.floor\(Math\.random\(\) \* CONCRETE_DIVINATION_METHODS\.length\)/);
});

test('占卜引擎会在当前项目本地统一构建提示词骨架', () => {
  assert.match(source, /function buildRoleText\(method: Exclude<DivinationMethodId, 'random'>\)/);
  assert.match(source, /function formatDivinationInfo\(/);
  assert.match(source, /'【要求】'/);
  assert.match(source, /'【当前时间】'/);
  assert.match(source, /'【占卜信息】'/);
  assert.match(source, /'【问题】'/);
  assert.match(source, /'【任务】'/);
  assert.match(source, /'【输出要求】'/);
});

test('统一时间信息文本不再自带重复标题，而是交给最终提示词 section 包装', () => {
  assert.match(source, /return \[\s*display\.solar,/);
  assert.doesNotMatch(source, /return `\*\*时间信息\*\*：/);
  assert.doesNotMatch(source, /return `时间信息：/);
});

test('占卜提示词改为角色加信息加问题的标准架构，并精简重复要求', () => {
  assert.match(source, /你是资深六爻断卦师/);
  assert.match(source, /你是资深梅花易数解读师/);
  assert.match(source, /你是资深奇门遁甲分析师/);
  assert.match(source, /你是资深大六壬断课师/);
  assert.match(source, /你是资深塔罗解读师/);
  assert.match(source, /你是资深三山国王灵签解签师/);
  assert.match(source, /只基于提供的占卜信息与问题作答/);
  assert.match(source, /不写空话，不重复抄写原始信息/);
  assert.match(source, /先给核心结论，再展开最关键的 2 到 4 个重点/);
});

test('大六壬提示词会引入可选断课模板', () => {
  assert.match(source, /liurenTemplate: LiurenTemplateType/);
  assert.match(source, /function buildLiurenTemplateText/);
  assert.match(source, /'【断课模板】'/);
  assert.match(source, /模板选择：/);
  assert.match(source, /作答模板：/);
});

test('占卜引擎不再附带解读风格和输出长度参数', () => {
  assert.doesNotMatch(source, /interpretationStyle:/);
  assert.doesNotMatch(source, /outputLength:/);
});

test('当前项目源码中不再依赖 sydf 目录', () => {
  const files = collectSourceFiles(srcRoot);

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /sydf/, `源码仍包含 sydf 引用：${file}`);
  }
});

test('各占卜方式都可以直接使用当前项目本地算法生成会话', async () => {
  const methods = ['liuyao', 'meihua', 'qimen', 'liuren', 'tarot', 'ssgw'] as const;

  for (const method of methods) {
    const session = await generateDivinationSession({
      method,
      question: '这件事接下来该怎么推进？',
      gender: '男',
      birthYear: '1995',
      meihuaMethod: 'number',
      meihuaNumber: '123',
      liurenTemplate: 'general',
      tarotSpread: 'three',
    });

    assert.equal(session.method, method);
    assert.equal(typeof session.prompt, 'string');
    assert.ok(session.prompt.includes('【占卜信息】'));
    assert.ok(session.prompt.includes('【输出要求】'));
    assert.equal(typeof session.data.timestamp, 'number');
  }
});
