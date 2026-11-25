import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateZiweiSchoolAlgorithms,
  evaluateQimenSchoolAlgorithms,
  evaluateLiurenSchoolAlgorithms,
  evaluateMeihuaSchoolAlgorithms,
  evaluateTaiyiSchoolAlgorithms,
  evaluateTarotSchoolAlgorithms,
  formatSchoolAlgorithmSection,
} from '../src/systems/school-algorithms';
import { ziweiIndependent } from '../src/systems/ziwei';
import { qimen } from '../src/systems/qimen';
import { liuyao } from '../src/systems/liuyao';
import { liuren } from '../src/systems/liuren';
import { meihua } from '../src/systems/meihua';

test('紫微斗数四流派深度推演：三合强弱救应、飞星离心向心、钦天我他宫与运限叠宫，且无待核占位', async () => {
  const result = await ziweiIndependent({
    birth: {
      year: 1992,
      month: 8,
      day: 15,
      calendar: 'solar',
      timezone: 8,
      clock: { kind: 'exact', hour: 10, minute: 30, second: 0 },
    },
    gender: 'male',
    referenceTime: '2026-06-15T10:00:00+08:00',
    question: '综合评估事业与财运结构及流年走势',
    prompt: {
      schools: ['sanhe', 'feixing', 'sihua', 'zhongzhou'],
      scope: 'full',
    },
  });

  assert.ok(!('unknown' in result.data));
  const evals = evaluateZiweiSchoolAlgorithms(result.data, ['sanhe', 'feixing', 'sihua', 'zhongzhou']);
  assert.equal(evals.length, 4);

  const sanhe = evals.find((e) => e.school === 'sanhe')!;
  assert.ok(sanhe.findings.some((f) => f.includes('吉煞与四化配置')));
  assert.ok(sanhe.findings.some((f) => f.includes('成败裁定')));
  assert.ok(sanhe.findings.some((f) => f.includes('运限叠宫裁定')));

  const feixing = evals.find((e) => e.school === 'feixing')!;
  assert.ok(feixing.findings.some((f) => f.includes('离心自化')));
  assert.ok(feixing.findings.some((f) => f.includes('对宫冲照（向心）')));
  assert.ok(feixing.findings.some((f) => f.includes('飞星裁定')));
  assert.ok(feixing.findings.some((f) => f.includes('运限叠宫飞化')));

  const sihua = evals.find((e) => e.school === 'sihua')!;
  assert.ok(sihua.findings.some((f) => f.includes('我宫') && f.includes('他宫')));
  assert.ok(sihua.findings.some((f) => f.includes('四化裁定')));

  const zhongzhou = evals.find((e) => e.school === 'zhongzhou')!;
  assert.ok(zhongzhou.findings.some((f) => f.includes('邻宫夹辅')));
  assert.ok(zhongzhou.findings.some((f) => f.includes('运限叠宫')));

  const rendered = formatSchoolAlgorithmSection(evals);
  assert.doesNotMatch(rendered, /待核|待判/);
});

test('奇门遁甲三流派深度推演：盘式、值符值使、日干时干生克、门迫击刑入墓空亡与应期指向', async () => {
  const result = await qimen(
    {
      datetime: '2026-06-15T10:30:00+08:00',
      qimen: { method: 'zhuanpan', scope: 'hour', juMethod: 'chaibu' },
      question: '此次合作推进是否顺利？',
      prompt: { schools: ['gongwei', 'geju', 'zhuke'] },
    },
    '2026-06-15T10:30:00+08:00',
  );

  assert.ok(!('kind' in result.data));
  const evals = evaluateQimenSchoolAlgorithms(result.data, ['gongwei', 'geju', 'zhuke']);
  assert.equal(evals.length, 3);

  const gongwei = evals.find((e) => e.school === 'gongwei')!;
  assert.ok(gongwei.findings.some((f) => f.includes('转盘法')));
  assert.ok(gongwei.findings.some((f) => f.includes('日干') && f.includes('时干')));
  assert.ok(gongwei.findings.some((f) => f.includes('成败裁定') && f.includes('应期指向')));

  const geju = evals.find((e) => e.school === 'geju')!;
  assert.ok(geju.findings.some((f) => f.includes('关键弊病核验')));

  const zhuke = evals.find((e) => e.school === 'zhuke')!;
  assert.ok(zhuke.findings.some((f) => f.includes('值符') && f.includes('值使')));

  const rendered = formatSchoolAlgorithmSection(evals);
  assert.doesNotMatch(rendered, /待核|待判/);
});

test('六爻《增删卜易》深化推演：月建日辰生克冲合、动变回头生克/进退、暗动日破旬空与吉凶应期', async () => {
  const result = await liuyao(
    {
      datetime: '2026-06-15T10:30:00+08:00',
      liuyao: { method: 'manual', yaos: [7, 8, 9, 7, 6, 8], usefulGodRelative: '妻财' },
      question: '这笔投资近期能否见利？',
      prompt: { schools: ['zengshanbuyi', 'bushizhengzong', 'huozhulin'] },
    },
    '2026-06-15T10:30:00+08:00',
  );

  assert.ok(!('kind' in result.data));
  const algos = result.data.evidenceAnalysis?.schoolAlgorithms ?? [];
  assert.equal(algos.length, 3);

  const zengshan = algos.find((a) => a.school === 'zengshanbuyi')!;
  assert.ok(zengshan.findings.some((f) => f.includes('月建') && f.includes('日辰')));
  assert.ok(zengshan.findings.some((f) => f.includes('动变')));
  assert.ok(zengshan.findings.some((f) => f.includes('吉凶倾向') && f.includes('应期条件')));
  assert.doesNotMatch(result.prompt.text, /待核实|待核|待判/);
});

test('大六壬与梅花易数流派深度推演：三传初末走势、体用生克比和与互变转折', async () => {
  const lr = await liuren(
    {
      datetime: '2026-06-15T10:30:00+08:00',
      question: '此事后续发展如何？',
      prompt: { schools: ['keti', 'bifafu', 'leishen'] },
    },
    '2026-06-15T10:30:00+08:00',
  );
  assert.ok(!('kind' in lr.data));
  const lrEvals = evaluateLiurenSchoolAlgorithms(lr.data, ['keti', 'bifafu', 'leishen']);
  assert.equal(lrEvals.length, 3);
  assert.ok(lrEvals[0].findings.some((f) => f.includes('初末走势')));
  assert.ok(lrEvals[0].findings.some((f) => f.includes('断语要点')));
  assert.ok(lrEvals[1].findings.some((f) => f.includes('干上') && f.includes('支上')));
  assert.ok(lrEvals[2].findings.some((f) => f.includes('三传天将权重')));

  const mh = await meihua(
    {
      datetime: '2026-06-15T10:30:00+08:00',
      meihua: { method: 'time' },
      question: '项目能否按期落地？',
      prompt: { schools: ['tiyong', 'xiangshu', 'yaoci'] },
    },
    '2026-06-15T10:30:00+08:00',
  );
  const mhEvals = evaluateMeihuaSchoolAlgorithms(mh.data, ['tiyong', 'xiangshu', 'yaoci']);
  assert.equal(mhEvals.length, 3);
  assert.ok(mhEvals[0].findings.some((f) => f.includes('过程与终局') && f.includes('互卦')));
  assert.ok(mhEvals[0].findings.some((f) => f.includes('综合裁定')));
  assert.ok(mhEvals[1].findings.some((f) => f.includes('转折要点')));
  assert.ok(mhEvals[2].findings.some((f) => f.includes('动变指向')));
});

test('太乙与塔罗流派兜底不再输出待核', () => {
  const taiyiText = formatSchoolAlgorithmSection(
    evaluateTaiyiSchoolAlgorithms({ scope: 'year' }, ['gongwei']),
  );
  const tarotText = formatSchoolAlgorithmSection(
    evaluateTarotSchoolAlgorithms({ spreadName: '三牌阵', cards: [] }, ['yuansu']),
  );
  assert.doesNotMatch(taiyiText, /待核|待判/);
  assert.doesNotMatch(tarotText, /待核|待判/);
});
