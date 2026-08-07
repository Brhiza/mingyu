import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreDirectory = join(repositoryRoot, 'packages', 'core');
const pnpmEntry = process.env.npm_execpath;

if (!pnpmEntry) {
  throw new Error('请通过 pnpm package:check 运行 npm 包契约检查。');
}

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} 执行失败。\n${output}`);
  }
  return result.stdout.trim();
}

function runPnpm(args, cwd, env) {
  return run(process.execPath, [pnpmEntry, ...args], cwd, env);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath, relativePath) : [relativePath];
  });
}

const auditDirectory = mkdtempSync(join(tmpdir(), 'mingyu-package-contract-'));
const tarballDirectory = join(auditDirectory, 'tarballs');
const consumerDirectory = join(auditDirectory, 'consumer');

try {
  mkdirSync(tarballDirectory, { recursive: true });
  mkdirSync(consumerDirectory, { recursive: true });
  const coreManifest = readJson(join(coreDirectory, 'package.json'));
  const coreTarball = join(tarballDirectory, `${coreManifest.name}-${coreManifest.version}.tgz`);

  runPnpm(['pack', '--out', coreTarball], coreDirectory);

  assert.ok(statSync(coreTarball).size <= 1_200_000, 'mingyu-core 压缩包不应超过 1.2 MB');

  writeFileSync(
    join(consumerDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'mingyu-package-consumer',
        private: true,
        type: 'module',
        dependencies: {
          'mingyu-core': `file:${coreTarball}`,
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  runPnpm(['install', '--prefer-offline', '--ignore-scripts'], consumerDirectory, {
    npm_config_auto_install_peers: 'false',
  });

  const installedCoreDirectory = join(consumerDirectory, 'node_modules', 'mingyu-core');
  const installedCoreManifest = readJson(join(installedCoreDirectory, 'package.json'));
  assert.equal(existsSync(join(consumerDirectory, 'node_modules', 'mingyu-location-china')), false);
  assert.equal(existsSync(join(consumerDirectory, 'node_modules', 'iztro')), false);
  assert.equal(installedCoreManifest.sideEffects, false);
  assert.equal(installedCoreManifest.engines.node, '>=18');
  for (const [subpath, target] of Object.entries(installedCoreManifest.exports)) {
    assert.deepEqual(
      Object.keys(target).slice(0, 2),
      ['types', 'import'],
      `${subpath} 应优先声明 types 条件，再声明 import 条件`,
    );
  }

  const installedCoreFiles = listFiles(installedCoreDirectory);
  assert.equal(
    installedCoreFiles.some((path) => path.endsWith('.map')),
    false,
  );
  assert.equal(
    installedCoreFiles.some((path) => path.startsWith('src/')),
    false,
  );
  assert.equal(
    installedCoreFiles.some((path) => path.startsWith('scripts/')),
    false,
  );
  assert.equal(
    installedCoreFiles.includes('data/chinaBirthPlaceTree.sources.md'),
    true,
    '核心包应附带中国地点坐标的数据来源与许可说明',
  );

  const coreSpecifiers = Object.keys(installedCoreManifest.exports).map((subpath) =>
    subpath === '.' ? 'mingyu-core' : `mingyu-core${subpath.slice(1)}`,
  );
  const runtimeFixture = `
const specifiers = ${JSON.stringify(coreSpecifiers)};
for (const specifier of specifiers) await import(specifier);

const { createMingyuClient } = await import('mingyu-core/client');
const client = createMingyuClient();
const profile = {
  gender: 'female',
  calendarType: 'solar',
  year: 1992,
  month: 8,
  day: 18,
  timeIndex: 6,
};
const bazi = await client.safe.birth(profile);
if (!bazi.ok || !bazi.data.bazi) throw new Error('隔离安装后的默认八字计算失败。');

if (client.normalizeBirth(profile).timeIndex !== 6) {
  throw new Error('隔离安装后的出生资料标准化失败。');
}
const zodiac = client.safe.zodiac({ zodiac: '鼠', year: 2026 });
if (!zodiac.ok || zodiac.data.zodiacBranch !== '子') {
  throw new Error('隔离安装后的生肖流年便捷入口失败。');
}
const bazhai = client.safe.bazhai({ birthYear: 1992, gender: 'female', sitMountain: '子' });
if (!bazhai.ok || bazhai.data.houseGua !== '坎') {
  throw new Error('隔离安装后的八宅客户端入口失败。');
}
const astronomicalTime = client.astronomicalTime({
  year: 2026,
  month: 8,
  day: 6,
  hour: 12,
  timezone: 8,
});
  if (astronomicalTime.status !== '已计算') {
    throw new Error('隔离安装后的天文时间客户端入口失败。');
  }
  const solarTerms = client.solarTerms(2026);
  if (
    solarTerms.length !== 24 ||
    solarTerms[0]?.name !== '小寒' ||
    solarTerms.at(-1)?.name !== '冬至'
  ) {
    throw new Error('隔离安装后的全年节气客户端入口失败。');
  }
  const solarIllumination = client.solarIllumination({
    year: 2026,
    month: 8,
    day: 6,
    hour: 12,
    latitude: 39.9,
    longitude: 116.4,
    timezone: 8,
  });
  if (solarIllumination.status !== '已计算' || !solarIllumination.sunriseSunset.morningLocalDateTime) {
    throw new Error('隔离安装后的太阳光照客户端入口失败。');
  }
  const unknownCapability = client.safe.capability('unknown');
  if (unknownCapability.ok || unknownCapability.error.code !== 'CAPABILITY_NOT_FOUND') {
    throw new Error('隔离安装后的未知能力查询未返回结构化错误。');
  }
  const xuankong = client.xuankong({ year: 2026, sitMountain: '子' });
if (xuankong.sitMountain !== '子') {
  throw new Error('隔离安装后的玄空客户端入口失败。');
}

const ziwei = await client.safe.birth(profile, { systems: ['ziwei'] });
if (ziwei.ok || ziwei.error.code !== 'IZTRO_DEPENDENCY_REQUIRED') {
  throw new Error('缺少 iztro 时未返回明确的依赖错误。');
}

const location = await import('mingyu-core/location');
const dongcheng = location.resolveBirthPlace('110101');
const duplicatedGulou = location.searchBirthPlaces('鼓楼区', {
  levels: ['district'],
  limit: 20,
});
if (
  location.chinaBirthPlaceTree.length !== 34 ||
  location.resolveBirthPlaceLongitude('110101') !== 116.416334 ||
  dongcheng?.latitude !== 39.928359 ||
  dongcheng?.coordinateAccuracy !== 'administrative-center' ||
  duplicatedGulou.length !== 4 ||
  location.resolveBirthPlace('鼓楼区') !== null
) {
  throw new Error('隔离安装后的中国地点坐标或重名处理失败。');
}
const trueSolarBirth = client.trueSolarBirth({
  dateType: 'solar', year: 1992, month: 8, day: 18, hour: 12, minute: 0,
  longitude: location.resolveBirthPlaceLongitude('110101'), timezone: 8,
});
if (trueSolarBirth.longitude !== 116.416334) {
  throw new Error('隔离安装后的内置地点经度未能直接用于真太阳时。');
}
`;
  writeFileSync(join(consumerDirectory, 'runtime-check.mjs'), runtimeFixture.trimStart(), 'utf8');
  run(process.execPath, ['runtime-check.mjs'], consumerDirectory);

  const typeImports = coreSpecifiers
    .map((specifier, index) => `import * as coreExport${index} from '${specifier}';`)
    .join('\n');
  const typeUses = coreSpecifiers.map((_, index) => `coreExport${index}`).join(', ');
  const typeFixture = `${typeImports}
import {
  createMingyuClient,
  type BirthProfile,
  type SystemCapabilityId,
} from 'mingyu-core';
import {
  findBirthPlaceByRegionId,
  type BirthPlaceCascadePath,
} from 'mingyu-core/location';
import {
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
  formatZiweiTrueSolarEvidence,
  type CombinedZiweiCompatibilityPromptOptions,
  type CombinedZiweiPromptOptions,
} from 'mingyu-core/ziwei/prompt';

const profile: BirthProfile = {
  gender: 'female',
  calendarType: 'solar',
  year: 1992,
  month: 8,
  day: 18,
  timeIndex: 6,
};
const client = createMingyuClient();
const normalized = client.normalizeBirth(profile);
const trueSolarBirth = client.trueSolarBirth({
  dateType: 'solar', year: 1992, month: 8, day: 18, hour: 12, minute: 0,
  longitude: 116.4, timezone: 8,
});
const astronomicalTime = client.astronomicalTime({
  year: 1992, month: 8, day: 18, hour: 12, timezone: 8,
});
const moonPhase = client.moonPhase('2026-08-06T04:00:00.000Z');
const solarTerm = client.solarTerm(2026, 14);
const solarTerms = client.solarTerms(2026);
const solarIllumination = client.solarIllumination({
  year: 2026, month: 8, day: 6, hour: 12,
  latitude: 39.9, longitude: 116.4, timezone: 8,
});
const capabilityId: SystemCapabilityId = 'calendar.solarIllumination';
const capability = client.capability(capabilityId);
const bazhai = client.bazhai({ birthYear: 1992, gender: 'female', sitMountain: '子' });
const bazhaiByDoorDegree = client.bazhaiByDoorDegree({
  mingGua: '坎', doorToInteriorDegree: 0, northReference: 'true',
});
const zodiac = client.zodiac({ zodiac: '鼠', year: 2026 });
const taiyi = client.taiyi({ year: 2026, scope: 'year' });
const qizheng = client.qizheng({ year: 1992, month: 8, day: 18, hour: 12 });
const xuankong = client.xuankong({ year: 2026, sitMountain: '子' });
const residential = client.residentialFengshui({
  year: 2026, birthYear: 1992, gender: 'female', sitMountain: '子',
});
const safeZodiac = client.safe.zodiac({ zodiac: '子', year: 2026 });
const path: BirthPlaceCascadePath | null = findBirthPlaceByRegionId('110101');
const combinedPromptOptions: CombinedZiweiPromptOptions = { currentTime: new Date() };
let combinedCompatibilityOptions!: CombinedZiweiCompatibilityPromptOptions;
void [
  ${typeUses}, profile, client, normalized, trueSolarBirth, astronomicalTime,
  moonPhase, solarTerm, solarTerms, solarIllumination, capabilityId, capability,
  bazhai, bazhaiByDoorDegree, zodiac, taiyi, qizheng, xuankong, residential,
  safeZodiac, path, buildCombinedZiweiPrompt, buildCombinedZiweiCompatibilityPrompt,
  formatZiweiTrueSolarEvidence, combinedPromptOptions, combinedCompatibilityOptions,
];
`;
  writeFileSync(join(consumerDirectory, 'type-check.ts'), typeFixture, 'utf8');

  const tscEntry = join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  run(
    process.execPath,
    [
      tscEntry,
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--lib',
      'ES2022,DOM',
      'type-check.ts',
    ],
    consumerDirectory,
  );

  const browserFixture = `
import { createMingyuClient } from 'mingyu-core/client';

const client = createMingyuClient();
const result = client.safe.zodiac({ zodiac: '鼠', year: 2026 });
const target = document.querySelector('#app');
if (!target || !result.ok) throw new Error('浏览器消费入口执行失败。');
target.textContent = result.data.yearGanZhi;
`;
  writeFileSync(join(consumerDirectory, 'browser-entry.ts'), browserFixture.trimStart(), 'utf8');
  writeFileSync(
    join(consumerDirectory, 'index.html'),
    '<!doctype html><html><body><div id="app"></div><script type="module" src="/browser-entry.ts"></script></body></html>\n',
    'utf8',
  );
  const viteEntry = join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  run(
    process.execPath,
    [viteEntry, 'build', '--outDir', 'dist-browser', '--emptyOutDir'],
    consumerDirectory,
  );
  const browserOutput = join(consumerDirectory, 'dist-browser');
  assert.equal(existsSync(join(browserOutput, 'index.html')), true);
  const browserBytes = listFiles(browserOutput)
    .filter((path) => path.endsWith('.js'))
    .reduce((total, path) => total + statSync(join(browserOutput, path)).size, 0);
  assert.ok(browserBytes <= 2_500_000, `完整客户端浏览器产物不应超过 2.5 MB：${browserBytes} 字节`);

  const zodiacBrowserDirectory = join(consumerDirectory, 'zodiac-browser');
  mkdirSync(zodiacBrowserDirectory, { recursive: true });
  writeFileSync(
    join(zodiacBrowserDirectory, 'entry.ts'),
    "import { calculateZodiacYearFortune } from 'mingyu-core/zodiac';\ndocument.body.textContent = calculateZodiacYearFortune({ zodiac: '鼠', year: 2026 }).yearGanZhi;\n",
    'utf8',
  );
  writeFileSync(
    join(zodiacBrowserDirectory, 'index.html'),
    '<!doctype html><html><body><script type="module" src="/entry.ts"></script></body></html>\n',
    'utf8',
  );
  run(
    process.execPath,
    [viteEntry, 'build', 'zodiac-browser', '--outDir', '../dist-zodiac', '--emptyOutDir'],
    consumerDirectory,
  );
  const zodiacBrowserOutput = join(consumerDirectory, 'dist-zodiac');
  const zodiacBrowserBytes = listFiles(zodiacBrowserOutput)
    .filter((path) => path.endsWith('.js'))
    .reduce((total, path) => total + statSync(join(zodiacBrowserOutput, path)).size, 0);
  assert.ok(zodiacBrowserBytes > 0, '生肖子路径浏览器构建应生成 JavaScript');
  assert.ok(
    zodiacBrowserBytes < browserBytes * 0.75,
    `生肖子路径浏览器产物应明显小于完整客户端：${zodiacBrowserBytes}/${browserBytes} 字节`,
  );

  console.log(
    JSON.stringify(
      {
        core: {
          version: coreManifest.version,
          tarballBytes: statSync(coreTarball).size,
          files: installedCoreFiles.length,
          exports: coreSpecifiers.length,
          browserBuild: true,
          browserBytes,
          zodiacBrowserBytes,
        },
        chinaLocationIncluded: true,
        optionalIztroInstalled: false,
      },
      null,
      2,
    ),
  );
} finally {
  const resolvedAuditDirectory = resolve(auditDirectory);
  const resolvedTemporaryRoot = resolve(tmpdir());
  if (
    resolvedAuditDirectory.startsWith(`${resolvedTemporaryRoot}\\`) ||
    resolvedAuditDirectory.startsWith(`${resolvedTemporaryRoot}/`)
  ) {
    rmSync(resolvedAuditDirectory, { recursive: true, force: true });
  }
}
