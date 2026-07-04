import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = fs.readFileSync(
  path.join(repoRoot, 'packages/core/src/bazi/baziTherapeuticRules.ts'),
  'utf-8',
);

const rules = [];
const blocks = content.split(/\n(?=\s*\{)/);
for (const block of blocks) {
  const idMatch = block.match(/id:\s*'([^']+)'/);
  const dayStemsMatch = block.match(/dayStems:\s*\[([^\]]*)\]/);
  const monthsMatch = block.match(/months:\s*\[([^\]]*)\]/);
  const usefulMatch = block.match(/usefulWuxing:\s*'([^']+)'/);
  const favorableMatch = block.match(/favorableOrder:\s*\[([^\]]*)\]/);
  const hintMatch = block.match(/hint:\s*'([^']*)'/);
  
  if (idMatch && dayStemsMatch && monthsMatch) {
    const ds = dayStemsMatch[1].replace(/'/g, '').split(',').map(s => s.trim()).filter(Boolean);
    const ms = monthsMatch[1].replace(/'/g, '').split(',').map(s => s.trim()).filter(Boolean);
    rules.push({
      id: idMatch[1],
      dayStems: ds,
      months: ms,
      usefulWuxing: usefulMatch ? usefulMatch[1] : '',
      favorableOrder: favorableMatch ? favorableMatch[1].replace(/'/g, '') : '',
      hint: hintMatch ? hintMatch[1] : ''
    });
  }
}

const allStems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const allMonths = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

// Build coverage map
const coverage = {};
for (const s of allStems) {
  coverage[s] = {};
  for (const m of allMonths) {
    coverage[s][m] = [];
  }
}

for (const rule of rules) {
  for (const s of rule.dayStems) {
    for (const m of rule.months) {
      if (coverage[s] && coverage[s][m] !== undefined) {
        coverage[s][m].push(rule);
      }
    }
  }
}

// Print coverage summary
console.log('=== 十日干×十二月令覆盖情况 ===\n');
for (const stem of allStems) {
  const covered = allMonths.filter(m => coverage[stem][m].length > 0);
  const missing = allMonths.filter(m => coverage[stem][m].length === 0);
  console.log(`${stem}日: 已覆盖[${covered.join(',')}] 缺失[${missing.join(',')}]`);
}

// Print detail for covered rules
console.log('\n=== 已有规则详情 ===\n');
for (const stem of allStems) {
  const stemRules = rules.filter(r => r.dayStems.includes(stem));
  console.log(`${stem}日 (${stemRules.length}条):`);
  for (const r of stemRules) {
    console.log(`  ${r.months.join('/')} | 用:${r.usefulWuxing} | 序:${r.favorableOrder} | ${r.hint.substring(0, 50)}`);
  }
  console.log();
}
