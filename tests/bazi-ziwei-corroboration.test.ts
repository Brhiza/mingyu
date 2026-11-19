import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import {
  evaluateBaziZiweiCorroboration,
  evaluateGuiRenCorroboration,
  evaluateShaYaoCorroboration,
  hasCompleteZiweiOrigin,
  type BaziCorroborationInput,
  type ZiweiCorroborationInput,
  type ZiweiCorroborationPalace,
} from '../src/systems/bazi-ziwei-corroboration';

const PALACE_NAMES = [
  '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
  '迁移', '交友', '官禄', '田宅', '福德', '父母',
] as const;

function makeZiwei(
  overrides: Partial<Record<string, Partial<ZiweiCorroborationPalace>>> = {},
  reference?: ZiweiCorroborationInput['reference'],
): ZiweiCorroborationInput {
  return {
    natal: {
      palaces: PALACE_NAMES.map((name, index) => ({
        index,
        name,
        isBodyPalace: name === '官禄',
        majorStars: [],
        minorStars: [],
        adjectiveStars: [],
        ...overrides[name],
      })),
    },
    ...(reference ? { reference } : {}),
  };
}

function makeBazi(
  entries: Array<{ name: string; position: 'year' | 'month' | 'day' | 'hour' }>,
  strengthStatus = '身强',
): BaziCorroborationInput {
  return {
    pillars: {
      year: { zhi: '子' },
      month: { zhi: '卯' },
      day: { zhi: '午' },
      hour: { zhi: '酉' },
    },
    shensha: { entries },
    strength: { status: strengthStatus },
  };
}

test('羊刃与紫微煞曜互证：身强同参、身弱不认定权柄相济、落陷/资料不足判定', () => {
  const baziStrong = makeBazi([{ name: '羊刃', position: 'month' }], '身强');
  const ziweiSha = makeZiwei(
    {
      命宫: {
        minorStars: [{ name: '擎羊', type: 'tough', scope: 'origin', brightness: '庙' }],
      },
    },
    {
      localDateTime: '2025-01-01T08:00:00',
      layers: {
        yearly: { index: 0, name: '流年', mutagenPlacements: [] },
      },
    },
  );

  const harmonized = evaluateShaYaoCorroboration(baziStrong, ziweiSha);
  assert.equal(harmonized.hasBaziYangRen, true);
  assert.equal(harmonized.isHarmonized, true);
  assert.equal(harmonized.ziweiCheckStatus, 'checked');
  assert.deepEqual(harmonized.ziweiShaStars, ['擎羊(命宫)']);
  assert.equal(harmonized.effectConditions.find((c) => c.key === 'ziwei.sha-star-state')?.status, '满足');
  assert.equal(harmonized.effectConditions.find((c) => c.key === 'timing.period')?.status, '满足');
  assert.match(harmonized.judgment, /权柄相济/);

  const baziWeak = makeBazi([{ name: '羊刃', position: 'month' }], '身弱');
  const notHarmonized = evaluateShaYaoCorroboration(baziWeak, ziweiSha);
  assert.equal(notHarmonized.isHarmonized, false);
  assert.match(notHarmonized.judgment, /未满足身强条件/);

  const ziweiFallen = makeZiwei({
    迁移: {
      minorStars: [{ name: '火星', type: 'tough', scope: 'origin', brightness: '陷' }],
    },
  });
  const fallen = evaluateShaYaoCorroboration(baziStrong, ziweiFallen);
  assert.equal(fallen.effectConditions.find((c) => c.key === 'ziwei.sha-star-state')?.status, '不满足');

  const incompleteZiwei: ZiweiCorroborationInput = { natal: { palaces: [] } };
  assert.equal(hasCompleteZiweiOrigin(incompleteZiwei), false);
  const missingOrigin = evaluateShaYaoCorroboration(baziStrong, incompleteZiwei);
  assert.equal(missingOrigin.ziweiCheckStatus, 'origin-missing');
  assert.equal(missingOrigin.isHarmonized, false);
  assert.equal(missingOrigin.effectConditions.find((c) => c.key === 'ziwei.origin')?.status, '资料不足');
});

test('天乙贵人与辅弼魁钺互证：双盘命中、无默认亮度不判缺失及运限四化引动', () => {
  const baziGui = makeBazi([{ name: '天乙贵人', position: 'year' }]);
  const ziweiGui = makeZiwei(
    {
      官禄: {
        minorStars: [{ name: '左辅', type: 'soft', scope: 'origin' }],
      },
    },
    {
      localDateTime: '2025-06-01T12:00:00',
      layers: {
        decadal: {
          index: 1,
          name: '大限',
          mutagenPlacements: [{ mutagen: '科', star: '左辅', targetIndex: 8, natalPalace: '官禄' }],
        },
      },
    },
  );

  const gui = evaluateGuiRenCorroboration(baziGui, ziweiGui);
  assert.equal(gui.hasBaziTianYi, true);
  assert.equal(gui.isDoubleBlessed, true);
  assert.equal(gui.ziweiCheckStatus, 'checked');
  assert.deepEqual(gui.ziweiGuiStars, ['左辅(官禄)']);
  assert.equal(gui.effectConditions.find((c) => c.key === 'ziwei.gui-star-state')?.status, '满足');
  assert.equal(gui.effectConditions.find((c) => c.key === 'timing.period')?.status, '满足');
  assert.match(gui.judgment, /双盘贵人结构线索/);

  const empty = evaluateBaziZiweiCorroboration(makeBazi([]), makeZiwei());
  assert.equal(empty.shaYao.isHarmonized, false);
  assert.equal(empty.guiRen.isDoubleBlessed, false);
  assert.equal(empty.corroborationPoints.length, 2);
  assert.match(empty.summary, /八字紫微互证/);
});

test('bazi-ziwei 精确盘与候选盘输出 corroboration，reprompt 校验且拒绝篡改', async () => {
  const exactInput = {
    question: '事业与贵人？',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'female',
    referenceTime: '2025-01-01T00:00:00Z',
  } as const;

  const exactResult = await calculate('bazi-ziwei', exactInput);
  assert.ok(exactResult.data.corroboration);
  assert.equal(exactResult.data.corroboration.shaYao.ziweiCheckStatus, 'checked');
  assert.equal(exactResult.data.corroboration.guiRen.ziweiCheckStatus, 'checked');
  assert.match(exactResult.prompt.text, /【跨盘互证条件】/);
  assert.match(exactResult.prompt.text, /煞曜同参（羊刃\/擎羊陀罗火铃）/);
  assert.match(exactResult.prompt.text, /贵人同参（天乙贵人\/辅弼魁钺）/);

  const savedExact = JSON.parse(JSON.stringify(exactResult));
  const repromptedExact = await reprompt({ method: 'bazi-ziwei', result: savedExact, question: '再追问？' });
  assert.match(repromptedExact.prompt.text, /【跨盘互证条件】/);

  const tamperedExact = JSON.parse(JSON.stringify(exactResult));
  tamperedExact.data.corroboration.shaYao.isHarmonized = !tamperedExact.data.corroboration.shaYao.isHarmonized;
  await assert.rejects(() => reprompt({ method: 'bazi-ziwei', result: tamperedExact, question: '追问' }), /不一致/);

  const candidateBirth = { year: 2024, month: 2, day: 4, clock: { kind: 'shichen', index: 8 }, timezone: 8 } as const;
  const unselected = await calculate('bazi-ziwei', { question: '问题', birth: candidateBirth, gender: 'female' });
  assert.equal('corroboration' in unselected.data, false);
  assert.match(unselected.prompt.text, /【跨盘互证条件】\n跨盘互证条件按各出生候选分别核验；选择候选后可展开。/);

  const selected = await calculate('bazi-ziwei', {
    question: '问题',
    birth: candidateBirth,
    gender: 'female',
    prompt: { candidateIndex: 0 },
  });
  assert.ok(selected.data.corroboration);
  assert.match(selected.prompt.text, /煞曜同参（羊刃\/擎羊陀罗火铃）/);

  const savedSelected = JSON.parse(JSON.stringify(selected));
  const repromptedSelected = await reprompt({
    method: 'bazi-ziwei',
    result: savedSelected,
    question: '追问候选？',
    prompt: { candidateIndex: 0, topic: 'career' },
  });
  assert.match(repromptedSelected.prompt.text, /【跨盘互证条件】/);

  savedSelected.data.corroboration.guiRen.judgment = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi-ziwei', result: savedSelected, question: '追问' }), /不一致/);
});
