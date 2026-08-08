/**
 * 中国地点数据校验，按用途分两层：
 *
 * - `--source-only`：只解析 data/chinaBirthPlaceTree.json 并断言源数据质量
 *   （longitude 必须全量覆盖）。不比对 TARGET_PATHS。
 *   CI 在依赖安装后、构建前跑这一层，源数据本身有问题就尽早失败。
 * - 完整模式（默认）：在上述断言之外，额外用 sha256 比对 src/ 与 dist/ 两份
 *   生成产物是否等于由当前源数据重算出的期望内容。
 *   CI 在 core build 之后跑这一层，用于验证生成器仍挂在构建链上；
 *   本地开发者跳过 generate 直接改源数据时，这一层负责检出陈旧产物。
 *
 * 注意：生成产物 china-data.js 被 .gitignore 忽略、不入库，因此完整模式在 CI 中
 * 校验的是「构建链完整性」，而非仓库内产物与源的漂移。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SOURCE_PATH,
  TARGET_PATHS,
  buildChinaLocationSource,
} from './generate-china-location-data.mjs';

const sourceOnly = process.argv.slice(2).includes('--source-only');
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

function toRelative(absolutePath) {
  return relative(resolve(packageRoot), absolutePath).replace(/\\/g, '/');
}

function digest(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

function formatTime(absolutePath) {
  return statSync(absolutePath).mtime.toISOString();
}

function checkGeneratedTargets() {
  const expectedHash = digest(buildChinaLocationSource());
  const sourceMtime = statSync(SOURCE_PATH).mtime;

  console.log('校验生成产物 china-data.js 是否与 data/chinaBirthPlaceTree.json 一致。');
  console.log(`  源文件      ${toRelative(SOURCE_PATH)}`);
  console.log(`  源修改时间  ${sourceMtime.toISOString()}`);
  console.log(`  期望摘要    sha256:${expectedHash}`);

  const problems = [];

  for (const targetPath of TARGET_PATHS) {
    const relativeTarget = toRelative(targetPath);

    if (!existsSync(targetPath)) {
      problems.push(`${relativeTarget} 不存在，请先执行 pnpm --filter mingyu-core build。`);
      console.error(`  ✗ ${relativeTarget} 缺失`);
      continue;
    }

    const actualHash = digest(readFileSync(targetPath, 'utf8'));

    if (actualHash !== expectedHash) {
      const staleHint = statSync(targetPath).mtime < sourceMtime ? '（产物早于源文件）' : '';
      problems.push(
        `${relativeTarget} 与源数据不一致${staleHint}，实际摘要 sha256:${actualHash}，` +
          '请执行 node scripts/generate-china-location-data.mjs 重新生成。',
      );
      console.error(
        `  ✗ ${relativeTarget} 摘要 sha256:${actualHash} 修改时间 ${formatTime(targetPath)}`,
      );
      continue;
    }

    console.log(`  ✓ ${relativeTarget} 一致`);
  }

  if (problems.length > 0) {
    console.error('');
    console.error('生成产物已陈旧，生成器可能已脱离构建链：');
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }

  console.log('');
}

function checkSourceQuality() {
  const tree = JSON.parse(readFileSync(SOURCE_PATH, 'utf8'));
  let nodeCount = 0;
  let longitudeCount = 0;
  let latitudeCount = 0;

  const visit = (node) => {
    nodeCount += 1;
    if (typeof node.longitude === 'number') longitudeCount += 1;
    if (typeof node.latitude === 'number') latitudeCount += 1;
  };

  for (const province of tree) {
    visit(province);
    for (const city of province.cities ?? []) {
      visit(city);
      for (const district of city.districts ?? []) visit(district);
    }
  }

  const percent = (value) => `${((value / nodeCount) * 100).toFixed(2)}%`;

  console.log(`地点树节点 ${nodeCount} 个。`);
  console.log(
    `  longitude 覆盖 ${longitudeCount} 个（${percent(longitudeCount)}），真太阳时主线依赖此字段。`,
  );
  console.log(
    `  latitude  覆盖 ${latitudeCount} 个（${percent(latitudeCount)}），` +
      `缺口 ${nodeCount - latitudeCount} 个按 province-approximation 回退。`,
  );

  if (longitudeCount !== nodeCount) {
    console.error('');
    console.error(`longitude 必须全量覆盖，当前缺失 ${nodeCount - longitudeCount} 个节点。`);
    process.exit(1);
  }
}

if (sourceOnly) {
  console.log('仅校验源数据质量（--source-only），跳过生成产物比对。');
  console.log(`  源文件      ${toRelative(SOURCE_PATH)}`);
  console.log('');
  checkSourceQuality();
  console.log('');
  console.log('源数据校验通过。');
} else {
  checkGeneratedTargets();
  checkSourceQuality();
  console.log('');
  console.log('生成产物与源数据一致。');
}
