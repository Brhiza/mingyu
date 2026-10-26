import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCoreSource } from '../../../scripts/run-core-source.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// 按领域职责登记文件名，不根据 import、注释或测试正文猜测归属。
// 页面、AI、HTTP/MCP、脚本和构建契约继续由 test:unit:run / test:ci:run 覆盖。
const domainTests = {
  bazi: `
    bazi-analysis-formatter bazi-analysis-pipeline bazi-calendar-conversion-reuse
    bazi-candidate-cost bazi-classic-candidate-contract bazi-classic-formation-consistency
    bazi-classic-pattern bazi-climate-condition-source bazi-clock-input bazi-compatibility-evidence
    bazi-conger-adjudication bazi-fire-climate-source bazi-follow-pattern-useful
    bazi-fortune-action-evidence bazi-fortune-action-roots bazi-fortune-text-batch
    bazi-fortune-trigger-evidence bazi-foundation-cycles bazi-global-time-basis
    bazi-harmony-control-boundaries bazi-harmony-display-contract bazi-harmony-transform
    bazi-kongwang bazi-month-boundary-seconds bazi-month-exposed-pattern bazi-natal-evidence
    bazi-path-conditions bazi-path-endpoints bazi-pattern-breaker-priority bazi-pattern-consumption
    bazi-pattern-fulfillment bazi-pattern-refinement bazi-pattern-useful-coordination bazi-pattern
    bazi-pillar-relations-formation-status bazi-qiongtong-climate-source bazi-quzhi-adjudication
    bazi-relation-boundaries bazi-reverse-pillar-options bazi-reverse
    bazi-root-adjudication-consumers bazi-root-adjudication bazi-root-facts bazi-rule-evidence
    bazi-rule-matcher bazi-season-context bazi-season-shensha-facts bazi-shensha
    bazi-special-output-conditions bazi-special-useful-hints bazi-strength-analyzer
    bazi-strength-grounding bazi-strength-refinement-20260915 bazi-ten-god-flow
    bazi-ten-god-life-stage-profile bazi-ten-god-projection bazi-ten-god-prompt-contract
    bazi-therapeutic-rules-regression bazi-tongguan-relations bazi-transformed-pattern-strategy
    bazi-transformed-useful-god bazi-unknown-time-batch bazi-useful-god-consumers
    bazi-useful-god-decision bazi-useful-god-placement bazi-useful-god bazi-wood-metal-climate-source
    fortune-modal-selection fortune-selection luck-calculator luck-timing
    minglu-glossary-source minglu-luck-chronicle
  `,
  calendar: `
    astronomical-facts astronomical-time calendar-tool civil-moon-consumers civil-time date-utils
    foundation-toolkit historical-timezone huangli-reference lunar-util
    month-leader-second-boundary moon-phase-evidence solar-illumination-evidence
    solar-term-evidence terms true-solar-time
  `,
  astrology: `
    astrolabe-advanced-point-facts astrolabe-algorithm astrolabe-dynamic-range
    astrolabe-independent-reference astrolabe-interpretation-reliability astrolabe-native-reference
    astrolabe-period-events astrolabe-period-structured-facts astrolabe-scope-facts astrolabe-scope
    astrolabe-synastry astrology-engine-boundary qizheng-birth-range qizheng-period-crossings
    qizheng-period qizheng-station-timing
  `,
  qimen: `
    qimen-boundary qimen-chart qimen-classic-pattern-layers qimen-evidence
    qimen-lifetime-birth-range qimen-lifetime-decadal qimen-lifetime-performance
    qimen-lifetime-stage-boundaries qimen-lifetime-timezone qimen-lifetime-year-boundary
    qimen-lifetime qimen-palace-insight qimen-pattern-prompt-dedup qimen-reference
    qimen-term-second-boundary qimen-timezone qimen-true-solar-term
  `,
  ziwei: `
    ziwei-age-cycle ziwei-algorithm-boundaries ziwei-compatibility-evidence ziwei-fortune-batch
    ziwei-fortune-options ziwei-fortune-range ziwei-origin-prompt-date ziwei-palace-facts
    ziwei-palace-relation-reuse ziwei-relationship-focus ziwei-runtime-integrity-next
  `,
  birth: `
    core-birth-bundle core-birth-range core-client core-compatibility-bundle core-compatibility-range
    core-input-location core-location-china core-new-systems core-object-keys
    core-profile-capabilities core-profile-china-dst core-profile-time-range
    core-profile-ziwei-precision core-prompt core-result-protocol core-session core-synthesis-range
    core-validation instant-chart-boundary instant-chart synthesis-corroboration
  `,
  culture: `
    kongming-interpretations name-number-explicit-variant-coverage name-number-location
    name-number-prompt-facts name-number-pronunciation-facts name-number-tools
    name-number-variant-facts naming-birth-evidence naming-character-rules naming-climate-scope
    naming-pronunciation number-energy-input number-energy-tradition zhuge-interpretations
  `,
  prompt: `
    classical-prompt-options classics ganzhi-classics prompt-evidence prompt-framework
    prompt-schools prompt-task-upgrade shensha-evidence traditional-relations wuxing-classics
  `,
  divination: `
    almanac-algorithm almanac-evidence almanac-participant-relations almanac-topic-rules
    divination-random-source hexagram-invariants huangji-cardinal-daily-prompt huangji-jingshi
    huangji-prompt-line-facts huangji-reference-tables huangji-scanned-reference
    huangji-six-day-cycle huangji-six-day-gregorian huangji-six-day-year-boundary
    huangji-standard-boundary huangji-trend jinkoujue-algorithm jinkoujue-evidence-focus
    jinkoujue-prompt-facts lenormand-algorithm liuren-algorithm liuren-evidence
    liuren-template-locations liuyao-coin-source liuyao-evidence liuyao-najia-data
    liuyao-prompt-reference liuyao-strength-change meihua-algorithm meihua-evidence minggua-algorithm
    non-eastern-prompt-facts paipan-boundary session-card-layout-facts session-judgment-facts
    session-oracle-sign-facts session-remaining-fact-completeness session-taskbook-fact-completeness
    ssgw-prompt-facts taiyi-derived-board-facts taiyi-prompt-time taiyi-reference taiyi-yin-board-source
    wuyun-liuqi wuyun-prompt-directions wuyun-reference xiaoliuren-algorithm xuankong-board
    xuankong-period-stars yarrow-reference zodiac-classics zodiac-evidence zodiac-time-identity
  `,
};

const files = Object.values(domainTests)
  .flatMap((names) =>
    names
      .trim()
      .split(/\s+/)
      .map((name) => `tests/${name}.test.ts`),
  )
  .sort();
for (const file of files) {
  if (!existsSync(join(repositoryRoot, file))) {
    throw new Error(`核心领域测试不存在，请更新职责清单：${file}`);
  }
}

if (process.argv.includes('--list')) {
  console.log(files.join('\n'));
} else {
  if (!process.argv.includes('--prepared')) {
    for (const script of [
      'generate-china-location-data.mjs',
      'generate-astrology-vendor-data.mjs',
    ]) {
      execFileSync(
        process.execPath,
        [join(repositoryRoot, 'packages/core/scripts', script), '--source-only'],
        {
          cwd: repositoryRoot,
          stdio: 'inherit',
        },
      );
    }
  }
  console.log(`运行 ${files.length} 个核心源码领域测试文件，无需构建 dist。`);
  console.log('应用与跨层契约：pnpm test；隔离发布包契约：pnpm package:check。');
  process.exitCode = runCoreSource(['--test', '--test-concurrency=2', ...files]);
}
