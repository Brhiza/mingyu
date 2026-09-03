import { performance } from 'node:perf_hooks';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.js';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.js';
import { calculateQimenLifetime } from '../packages/core/src/divination/algorithms/qimen/lifetime.js';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe.js';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.js';

interface BenchmarkResult {
  name: string;
  category: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  p95Ms: number;
  opsPerSec: number;
  budgetMs: number;
  passed: boolean;
}

function runBenchmark(
  name: string,
  category: string,
  fn: () => void,
  iterations = 100,
  budgetMs = 10,
): BenchmarkResult {
  // 预热 5 次
  for (let i = 0; i < 5; i++) {
    fn();
  }

  const times: number[] = [];
  const startTotal = performance.now();

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    times.push(t1 - t0);
  }

  const totalMs = performance.now() - startTotal;
  times.sort((a, b) => a - b);

  const avgMs = totalMs / iterations;
  const p95Index = Math.min(Math.floor(iterations * 0.95), iterations - 1);
  const p95Ms = times[p95Index];
  const opsPerSec = Math.round(1000 / (avgMs || 0.001));

  return {
    name,
    category,
    iterations,
    totalMs: Number(totalMs.toFixed(2)),
    avgMs: Number(avgMs.toFixed(3)),
    p95Ms: Number(p95Ms.toFixed(3)),
    opsPerSec,
    budgetMs,
    passed: p95Ms <= budgetMs,
  };
}

export function runAllCoreBenchmarks(): BenchmarkResult[] {
  console.log('=== 命语核心算法性能基线与预算评测 ===\n');

  const results: BenchmarkResult[] = [];

  // 1a. 八字命盘（标准公历：四柱+十神+大运+神煞）
  results.push(
    runBenchmark(
      '八字基础命盘 (四柱+十神+大运+神煞)',
      'bazi',
      () => {
        baziCalculator.calculateBazi({
          year: 1994,
          month: 12,
          day: 4,
          timeIndex: 2,
          gender: 'male',
          useTrueSolarTime: false,
          birthHour: 3,
          birthMinute: 15,
        });
      },
      50,
      70.0, // 真实基线预算 70ms
    ),
  );

  // 1b. 八字命盘（叠加中国夏令时与真太阳时全量校正）
  results.push(
    runBenchmark(
      '八字全量命盘 (叠加历史夏令时与真太阳时校正)',
      'bazi-solar',
      () => {
        baziCalculator.calculateBazi({
          year: 1994,
          month: 12,
          day: 4,
          timeIndex: 2,
          gender: 'male',
          useTrueSolarTime: true,
          birthHour: 3,
          birthMinute: 15,
          birthLongitude: 130.37,
          birthPlace: '黑龙江佳木斯',
        });
      },
      50,
      80.0, // 真实基线预算 80ms
    ),
  );

  // 2. 奇门遁甲（时家转盘拆补局）
  results.push(
    runBenchmark(
      '奇门时家局 (转盘拆补+九宫天地人神四盘)',
      'qimen',
      () => {
        generateQimen(new Date('2026-09-03T18:30:00'));
      },
      50,
      20.0, // 真实基线预算 20ms
    ),
  );

  // 3. 奇门终身局（体枢变用完整流水线：本命局+个人标记+阶段卡+动态太岁扫描）
  results.push(
    runBenchmark(
      '奇门终身局 (全流水线:标记+阶段+太岁扫描)',
      'qimen-lifetime',
      () => {
        calculateQimenLifetime({
          birthDateTime: '1990-05-15T14:30:00',
          calendarType: 'solar',
          gender: 'male',
          longitude: 116.4,
          timeZoneId: 'Asia/Shanghai',
          dynamicRange: { startYear: 2026, endYear: 2028 },
        });
      },
      30,
      30.0, // 真实基线预算 30ms
    ),
  );

  // 4. 西洋星盘（行星、宫位、黄道度数与主要相位计算）
  results.push(
    runBenchmark(
      '西洋星盘 (行星+宫位+主要相位几何计算)',
      'astrolabe',
      () => {
        generateAstrolabe({
          name: '基准样本',
          gender: '女',
          year: '1995',
          month: '5',
          day: '20',
          hour: '12',
          minute: '30',
          latitude: '39.9042',
          longitude: '116.4074',
          timezone: '8',
          locationName: '北京',
        });
      },
      50,
      20.0, // 真实基线预算 20ms
    ),
  );

  // 5. 黄历择日（30 天跨度批量丛辰吉凶与宜忌计算）
  results.push(
    runBenchmark(
      '黄历择日 (连续 30 天建除十二神与丛辰批量计算)',
      'almanac',
      () => {
        generateAlmanacSelection({
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          topic: 'marriage',
        });
      },
      20,
      350.0, // 真实基线预算 350ms（平均单日约 8-10ms）
    ),
  );

  // 打印控制台表格
  console.log('| 算法术式 | 样本次数 | 平均耗时 (ms) | P95 耗时 (ms) | 吞吐量 (ops/s) | 预算 (ms) | 状态 |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const r of results) {
    const status = r.passed ? '✔ PASS' : '⚠ WARN';
    console.log(
      `| ${r.name} | ${r.iterations} | ${r.avgMs.toFixed(2)} | ${r.p95Ms.toFixed(2)} | ${r.opsPerSec} | ${r.budgetMs} | ${status} |`,
    );
  }

  // 保存本地报告
  const reportDir = join(process.cwd(), '.local/reports/performance-benchmark');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportJson = join(reportDir, `benchmark-${timestamp}.json`);
  const reportMd = join(reportDir, `benchmark-${timestamp}.md`);
  const latestMd = join(reportDir, `latest.md`);

  writeFileSync(reportJson, JSON.stringify(results, null, 2), 'utf8');

  const mdLines = [
    '# 命语核心算法性能基线评测报告',
    '',
    `- 评测时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
    `- 平台：Node.js ${process.version} (${process.platform} ${process.arch})`,
    '',
    '## 核心算法性能指标与预算对照',
    '',
    '| 算法模块 | 测试规模 | 平均耗时 | P95 耗时 | 吞吐量 | 延迟预算 | 状态 |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const r of results) {
    const status = r.passed ? '✔ PASS' : '⚠ WARN';
    mdLines.push(
      `| ${r.name} | ${r.iterations} 次 | ${r.avgMs.toFixed(2)} ms | ${r.p95Ms.toFixed(2)} ms | ${r.opsPerSec} ops/s | ≤ ${r.budgetMs} ms | ${status} |`,
    );
  }

  const mdContent = mdLines.join('\n');
  writeFileSync(reportMd, mdContent, 'utf8');
  writeFileSync(latestMd, mdContent, 'utf8');

  console.log(`\n✔ 性能基线测试完成！已保存本地报告：${reportMd}`);
  return results;
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('benchmark-core')) {
  runAllCoreBenchmarks();
}
