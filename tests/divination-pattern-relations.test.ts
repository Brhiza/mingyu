import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyLiuyaoVoidStatus,
  evaluateLiuyaoMonthBreakStatus,
  generateLiuyaoChart,
} from '../src/systems/liuyao/chart';
import { castLiuyao } from '../src/systems/liuyao/cast';
import { liuyao } from '../src/systems/liuyao';
import { liuren } from '../src/systems/liuren';
import {
  evaluateMeihuaTimelineTrend,
  getMeihuaTiYongSeasonEvaluation,
} from '../src/systems/meihua/chart';
import { meihua } from '../src/systems/meihua';

const NOW = '2026-06-15T08:00:00.000Z';

test('六爻：修复未成刑爻仍填充 sanxingType 的缺陷，并精准区分真空/假空与月破救应', () => {
  const date = new Date('2026-06-15T04:00:00.000Z'); // 丙午年 甲午月
  const cast = castLiuyao(date.getTime(), { method: 'manual', yaos: [7, 8, 7, 8, 7, 8] });
  const chart = generateLiuyaoChart(date, cast, 480);

  for (const yao of chart.yaosDetail) {
    if (!yao.isSanxing) {
      assert.equal(yao.sanxingType, undefined, `第${yao.position}爻未成刑时 sanxingType 必须为 undefined`);
    } else {
      assert.ok(yao.sanxingType, `第${yao.position}爻成刑时应给出三刑类型`);
    }
  }

  // 假空：月令旺相（午月巳火旺相）
  const falseVoidStrong = classifyLiuyaoVoidStatus({
    yao: {
      position: 2,
      najiaDizhi: '巳',
      wuxing: '火',
      isChanging: false,
      isHiddenMove: false,
      isMonthBreak: false,
      isDayClash: false,
      seasonState: '旺',
      changeRelations: [],
      changeDirection: null,
    },
    monthBranch: '午',
    dayBranch: '寅',
  });
  assert.equal(falseVoidStrong.status, '假空');
  assert.match(falseVoidStrong.condition, /出空|填实/);

  // 真空：月破兼空且无值日/日生/动生救应（午月子水月破兼空，日支申金生水？改用戌土克水）
  const trueVoidBroken = classifyLiuyaoVoidStatus({
    yao: {
      position: 1,
      najiaDizhi: '子',
      wuxing: '水',
      isChanging: false,
      isHiddenMove: false,
      isMonthBreak: true,
      isDayClash: false,
      seasonState: '囚',
      changeRelations: [],
      changeDirection: null,
    },
    monthBranch: '午',
    dayBranch: '戌',
  });
  assert.equal(trueVoidBroken.status, '真空');

  // 月破有救：午月子水月破，逢丑日六合解破
  const monthBreakRescued = evaluateLiuyaoMonthBreakStatus({
    yao: {
      position: 1,
      najiaDizhi: '子',
      wuxing: '水',
      isChanging: false,
      changeRelations: [],
      changeDirection: null,
    },
    dayBranch: '丑',
  });
  assert.equal(monthBreakRescued.hasRescue, true);
  assert.match(monthBreakRescued.condition, /日辰六合解破/);

  // 月破无救：午月子水月破，戌日无生合无动生
  const monthBreakUnrescued = evaluateLiuyaoMonthBreakStatus({
    yao: {
      position: 1,
      najiaDizhi: '子',
      wuxing: '水',
      isChanging: false,
      changeRelations: [],
      changeDirection: null,
    },
    dayBranch: '戌',
  });
  assert.equal(monthBreakUnrescued.hasRescue, false);
});

test('六爻：提示词原生输出【卦象组合与生克制衡关系】覆盖静卦、动变通关与救应条件', async () => {
  // 1. 静卦（天地否，六合静卦）
  const staticRes = await liuyao(
    {
      question: '问近期求财进展如何',
      divinationTime: '2026-06-15T04:00:00.000Z',
      liuyao: { method: 'manual', yaos: [8, 8, 8, 7, 7, 7], timezoneOffsetMinutes: 480 },
      prompt: { liuyaoTemplate: 'caifu' },
    },
    NOW,
  );
  assert.match(staticRes.prompt.text, /【卦象组合与生克制衡关系】/);
  assert.match(staticRes.prompt.text, /主线格局与世应：.*静卦/);
  assert.match(staticRes.prompt.text, /主卦六合卦/);
  assert.match(staticRes.prompt.text, /成事链（生扶与助力/);
  assert.match(staticRes.prompt.text, /阻力链（克制与损耗/);
  assert.match(staticRes.prompt.text, /救应与转化条件：.*静卦无明动与暗动爻/);

  // 2. 多动卦：天地否（下坤乙未乙巳乙卯，上乾壬午壬申壬戌；妻财卯木在三爻，忌神兄弟申金在五爻，原神子孙/水？乾宫金，妻财木，原神水，忌神金）
  // 换乾为天：初子(子孙水)、二寅(妻财木)、三辰(父母土)、四午(官鬼火)、五申(兄弟金)、上戌(父母土)
  // 初爻子水(原神)发动 + 五爻申金(忌神)发动，用神妻财寅木 -> 构成忌神申金发动但原神子水同动通关（贪生忘克）
  const movingRes = await liuyao(
    {
      question: '问近期财运与投资收益',
      divinationTime: '2026-06-15T04:00:00.000Z',
      liuyao: { method: 'manual', yaos: [9, 7, 7, 7, 9, 7], timezoneOffsetMinutes: 480 },
      prompt: { liuyaoTemplate: 'caifu' },
    },
    NOW,
  );
  assert.match(movingRes.prompt.text, /【卦象组合与生克制衡关系】/);
  assert.match(movingRes.prompt.text, /主卦六冲卦/);
  assert.match(movingRes.prompt.text, /原神第1爻子孙子水明动生扶/);
  assert.match(movingRes.prompt.text, /忌神第5爻兄弟申金明动克制/);
  assert.match(movingRes.prompt.text, /贪生忘克通关/);
});

test('大六壬：修复己日日德错位（己德在寅而非亥），并输出【课传组合与干支制衡关系】', async () => {
  // 2026-06-18 北京时间中午为己日，先动态验证确实是己日
  let jiDayIso = '';
  for (let day = 1; day <= 15; day++) {
    const iso = `2026-06-${String(day).padStart(2, '0')}T04:00:00.000Z`;
    const probe = await liuren({ question: '问事业合作', divinationTime: iso }, NOW);
    if ('ganzhi' in probe.data && probe.data.ganzhi.day.startsWith('己')) {
      jiDayIso = iso;
      assert.match(probe.prompt.text, /日德寅/, '己日日德必须为寅（甲己寅），不能错标为亥');
      assert.doesNotMatch(probe.prompt.text, /日德亥/);
      assert.match(probe.prompt.text, /【课传组合与干支制衡关系】/);
      assert.match(probe.prompt.text, /课体与干支体用格局：/);
      assert.match(probe.prompt.text, /三传阶段演变与生克链：/);
      assert.match(probe.prompt.text, /关键制衡因子：/);
      break;
    }
  }
  assert.ok(jiDayIso, '应能在 15 天内找到己日样例并完成校验');
});

test('梅花易数：修复体克用阶段走势判定，并输出【体用阶段演变与制衡关系】与党众对比', async () => {
  // 1. 修复验证：本卦体克用（体木克用土），互卦水木生比，变卦水生木（用生体） -> 始末顺畅
  const trend1 = evaluateMeihuaTimelineTrend({
    tiElement: '木',
    originalYongElement: '土',
    interTiElement: '水',
    interYongElement: '木',
    changedYongElement: '水',
  });
  assert.equal(trend1.trend, '始末顺畅');

  // 2. 修复验证：本卦体克用 -> 变卦用克体 -> 先顺后阻
  const trend2 = evaluateMeihuaTimelineTrend({
    tiElement: '木',
    originalYongElement: '土',
    interTiElement: '木',
    interYongElement: '火',
    changedYongElement: '金',
  });
  assert.equal(trend2.trend, '先顺后阻');

  // 3. 修复验证：本卦用克体 -> 变卦体克用 -> 先难后易
  const trend3 = evaluateMeihuaTimelineTrend({
    tiElement: '木',
    originalYongElement: '金',
    interTiElement: '水',
    interYongElement: '木',
    changedYongElement: '土',
  });
  assert.equal(trend3.trend, '先难后易');

  // 4. 月令体用衡定细化：体生用区分体旺承泄 vs 体衰泄重
  assert.match(getMeihuaTiYongSeasonEvaluation('体生用', '旺', '休'), /尚可承泄/);
  assert.match(getMeihuaTiYongSeasonEvaluation('体生用', '囚', '旺'), /消耗偏重/);
  assert.match(getMeihuaTiYongSeasonEvaluation('用克体', '旺', '相'), /体用皆旺，克抗相持/);

  // 5. 集成提示词验证
  const res = await meihua(
    {
      question: '问合作项目推进结果',
      divinationTime: '2026-06-15T04:00:00.000Z',
      meihua: { method: 'number', number: 38 },
    },
    NOW,
  );
  assert.match(res.prompt.text, /【体用阶段演变与制衡关系】/);
  assert.match(res.prompt.text, /三阶段体用轨迹：.*走势定性：(全程顺势|先顺后阻|先阻后通|全程受制|波动拉锯)/);
  assert.match(res.prompt.text, /体用党众对比：/);
  assert.match(res.prompt.text, /月令旺衰与体用制衡：/);
});
