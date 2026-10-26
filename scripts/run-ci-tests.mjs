import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCoreTestFiles } from '../packages/core/scripts/run-core-tests.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 仅省略已核对为同源码表示的文件；新领域文件默认保留编译后验证。
const sourceOnlyCoreTests = new Set(
  `
    almanac-evidence almanac-participant-relations almanac-topic-rules astrolabe-independent-reference
    astrolabe-interpretation-reliability astrology-engine-boundary astronomical-facts
    bazi-analysis-formatter bazi-analysis-pipeline bazi-calendar-conversion-reuse bazi-candidate-cost
    bazi-classic-candidate-contract bazi-classic-formation-consistency bazi-classic-pattern
    bazi-climate-condition-source bazi-clock-input bazi-compatibility-evidence bazi-conger-adjudication
    bazi-fire-climate-source bazi-follow-pattern-useful bazi-fortune-action-evidence
    bazi-fortune-action-roots bazi-fortune-text-batch bazi-fortune-trigger-evidence
    bazi-foundation-cycles bazi-global-time-basis bazi-harmony-control-boundaries
    bazi-harmony-display-contract bazi-harmony-transform bazi-kongwang bazi-month-boundary-seconds
    bazi-month-exposed-pattern bazi-natal-evidence bazi-path-conditions bazi-path-endpoints
    bazi-pattern-breaker-priority bazi-pattern-consumption bazi-pattern-fulfillment
    bazi-pattern-refinement bazi-pattern-useful-coordination bazi-pattern
    bazi-pillar-relations-formation-status bazi-qiongtong-climate-source bazi-quzhi-adjudication
    bazi-relation-boundaries bazi-reverse-pillar-options bazi-root-adjudication-consumers
    bazi-root-adjudication bazi-root-facts bazi-rule-evidence bazi-rule-matcher bazi-season-context
    bazi-season-shensha-facts bazi-shensha bazi-special-output-conditions bazi-special-useful-hints
    bazi-strength-analyzer bazi-strength-grounding bazi-strength-refinement-20260915 bazi-ten-god-flow
    bazi-ten-god-life-stage-profile bazi-ten-god-projection bazi-ten-god-prompt-contract
    bazi-therapeutic-rules-regression bazi-tongguan-relations bazi-transformed-pattern-strategy
    bazi-transformed-useful-god bazi-unknown-time-batch bazi-useful-god-consumers
    bazi-useful-god-decision bazi-useful-god-placement bazi-useful-god bazi-wood-metal-climate-source
    calendar-tool civil-moon-consumers classics core-birth-bundle core-birth-range
    core-compatibility-range core-new-systems core-object-keys core-profile-capabilities
    core-profile-china-dst core-profile-time-range core-profile-ziwei-precision core-synthesis-range
    core-validation divination-random-source fortune-modal-selection foundation-toolkit ganzhi-classics
    hexagram-invariants huangji-cardinal-daily-prompt huangji-prompt-line-facts
    huangji-scanned-reference huangji-six-day-cycle huangji-six-day-gregorian
    huangji-six-day-year-boundary huangji-standard-boundary huangji-trend huangli-reference
    instant-chart-boundary jinkoujue-algorithm jinkoujue-evidence-focus jinkoujue-prompt-facts
    kongming-interpretations liuren-template-locations liuyao-coin-source liuyao-najia-data
    luck-calculator luck-timing lunar-util meihua-algorithm meihua-evidence minggua-algorithm
    minglu-glossary-source minglu-luck-chronicle moon-phase-evidence name-number-location
    name-number-prompt-facts name-number-pronunciation-facts naming-birth-evidence naming-climate-scope
    naming-pronunciation non-eastern-prompt-facts number-energy-input number-energy-tradition
    prompt-evidence prompt-framework prompt-task-upgrade qimen-boundary qimen-chart
    qimen-classic-pattern-layers qimen-lifetime-birth-range qimen-lifetime-stage-boundaries
    qimen-lifetime-timezone qimen-lifetime-year-boundary qimen-lifetime qimen-palace-insight
    qimen-pattern-prompt-dedup qimen-reference qimen-term-second-boundary qimen-timezone
    qimen-true-solar-term qizheng-birth-range qizheng-period-crossings qizheng-period
    qizheng-station-timing session-card-layout-facts session-judgment-facts session-oracle-sign-facts
    session-remaining-fact-completeness shensha-evidence solar-illumination-evidence ssgw-prompt-facts
    synthesis-corroboration taiyi-derived-board-facts taiyi-prompt-time taiyi-reference
    taiyi-yin-board-source traditional-relations wuxing-classics wuyun-prompt-directions wuyun-reference
    xuankong-board xuankong-period-stars yarrow-reference ziwei-age-cycle ziwei-algorithm-boundaries
    ziwei-fortune-options ziwei-origin-prompt-date ziwei-palace-facts ziwei-palace-relation-reuse
    ziwei-runtime-integrity-next zodiac-evidence zodiac-time-identity
  `
    .trim()
    .split(/\s+/)
    .map((name) => `tests/${name}.test.ts`),
);

export function getCiTestFiles({ applicationOnly = false } = {}) {
  const files = ['', 'integration', 'api', 'mcp']
    .flatMap((directory) =>
      readdirSync(join(repositoryRoot, 'tests', directory), { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() && (directory ? /\.test\.ts$/u : /\.test\.tsx?$/u).test(entry.name),
        )
        .map((entry) => ['tests', directory, entry.name].filter(Boolean).join('/')),
    )
    .sort();
  if (!applicationOnly) return files;

  const core = new Set(getCoreTestFiles());
  for (const file of sourceOnlyCoreTests) {
    if (!core.has(file) || !files.includes(file)) {
      throw new Error(`源码专属测试已不在领域集合，请更新应用职责清单：${file}`);
    }
  }
  return files.filter((file) => !sourceOnlyCoreTests.has(file));
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const files = getCiTestFiles({ applicationOnly: process.argv.includes('--application') });
  if (process.argv.includes('--list')) {
    console.log(files.join('\n'));
  } else {
    const result = spawnSync(
      process.execPath,
      [
        join(repositoryRoot, 'node_modules/tsx/dist/cli.mjs'),
        '--tsconfig',
        join(repositoryRoot, 'tsconfig.app.json'),
        '--test',
        '--test-concurrency=2',
        ...files,
      ],
      { cwd: repositoryRoot, stdio: 'inherit' },
    );
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status ?? 1;
  }
}
