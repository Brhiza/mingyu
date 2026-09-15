import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assessStemHarmonyTransform,
  type HarmonyPillarInput,
} from '../packages/core/src/bazi/harmonyTransform';
import {
  getBaziHourPillarOptions,
  getBaziMonthPillarOptions,
  isGanZhiPair,
} from '../packages/core/src/ganzhi/validation';

// 新增边界输入均校验六十甲子及五虎遁、五鼠遁关系；旧测试中的其他 fixture 仍只隔离结构条件。

function pillar(
  label: string,
  gan: string,
  zhi: string,
  hiddenStems: string[],
): HarmonyPillarInput {
  return { label, gan, zhi, hiddenStems };
}

function assertLegalFourPillars(pillars: HarmonyPillarInput[]): void {
  assert.equal(pillars.length, 4);
  for (const item of pillars) {
    assert.ok(isGanZhiPair(item.gan, item.zhi), `${item.gan}${item.zhi}`);
  }
  assert.ok(
    getBaziMonthPillarOptions(`${pillars[0].gan}${pillars[0].zhi}`).includes(
      `${pillars[1].gan}${pillars[1].zhi}`,
    ),
  );
  assert.ok(
    getBaziHourPillarOptions(`${pillars[2].gan}${pillars[2].zhi}`).includes(
      `${pillars[3].gan}${pillars[3].zhi}`,
    ),
  );
}

test('合干原干在参与支见本根时不能继续判为成化', () => {
  const pillars = [
    pillar('年柱', '戊', '辰', ['戊', '乙', '癸']),
    pillar('月柱', '庚', '申', ['庚', '壬', '戊']),
    pillar('日柱', '乙', '卯', ['乙']),
    pillar('时柱', '丁', '丑', ['己', '癸', '辛']),
  ];
  assertLegalFourPillars(pillars);

  const profile = assessStemHarmonyTransform('庚', '月柱', '乙', '日柱', '申', pillars);

  assert.equal(profile.monthSupported, true);
  assert.equal(profile.level, '合而不化');
  assert.equal(profile.isTransformed, false);
  assert.ok(profile.evidence.some((item) => item.includes('合干原干乙在日柱卯藏乙')));
});

test('没有原干本根且只有外支中气控制时仍保留成化门槛', () => {
  const pillars = [
    pillar('年柱', '戊', '辰', ['戊', '乙', '癸']),
    pillar('月柱', '己', '未', ['己', '丁', '乙']),
    pillar('日柱', '甲', '子', ['癸']),
    pillar('时柱', '戊', '辰', ['戊', '乙', '癸']),
  ];
  assertLegalFourPillars(pillars);

  const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '未', pillars);

  assert.equal(profile.hasControllingElement, false);
  assert.equal(profile.level, '成化');
  assert.ok(profile.evidence.some((item) => item.includes('外支时柱辰藏乙')));
  assert.ok(profile.evidence.some((item) => item.includes('仅作木克制旁证，不直接阻断化神土')));
});

test('参与支本气仍按现有控制门槛计入，藏干不另升格为控制', () => {
  const pillars = [
    pillar('年柱', '乙', '巳', ['丙', '戊', '庚']),
    pillar('月柱', '己', '丑', ['己', '癸', '辛']),
    pillar('日柱', '甲', '寅', ['甲', '丙', '戊']),
    pillar('时柱', '丙', '寅', ['甲', '丙', '戊']),
  ];
  assertLegalFourPillars(pillars);

  const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '丑', pillars);

  assert.equal(profile.hasControllingElement, true);
  assert.equal(profile.level, '合而不化');
  assert.equal(profile.isTransformed, false);
  assert.ok(profile.evidence.includes('有木克制化神土'));
});

test('外部地支本气克制化神时仍判为有效控制', () => {
  const pillars = [
    pillar('年柱', '乙', '巳', ['丙', '戊', '庚']),
    pillar('月柱', '己', '丑', ['己', '癸', '辛']),
    pillar('日柱', '甲', '子', ['癸']),
    pillar('时柱', '丁', '卯', ['乙']),
  ];
  assertLegalFourPillars(pillars);

  const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '丑', pillars);

  assert.equal(profile.hasControllingElement, true);
  assert.equal(profile.level, '合而不化');
  assert.ok(profile.evidence.includes('有木克制化神土'));
});

test('甲己化土在丑、未月见己根时不把化神根误当日干阻化根', () => {
  const cases = [
    ['丑', '乙', ['己', '癸', '辛']],
    ['未', '戊', ['己', '丁', '乙']],
  ] as const;

  for (const [monthBranch, yearStem, monthHiddenStems] of cases) {
    const yearBranch = yearStem === '乙' ? '巳' : '辰';
    const pillars = [
      pillar('年柱', yearStem, yearBranch, ['戊', '乙', '癸']),
      pillar('月柱', '己', monthBranch, [...monthHiddenStems]),
      pillar('日柱', '甲', '子', ['癸']),
      pillar('时柱', '癸', '酉', ['辛']),
    ];
    assertLegalFourPillars(pillars);
    const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', monthBranch, pillars);

    assert.equal(profile.monthSupported, true, monthBranch);
    // 己丑月的合法年柱乙巳会透乙木，合局仍因外部控制而合而不化；
    // 己未月用戊辰年无该控制，才可单独观察化神根气不阻化。
    assert.equal(profile.hasControllingElement, monthBranch === '丑', monthBranch);
    if (monthBranch === '未') {
      assert.equal(profile.level, '成化', monthBranch);
      assert.equal(profile.isTransformed, true, monthBranch);
    }
    assert.ok(
      !profile.evidence.some((item) => item.includes('合干原干己') && item.includes('阻化')),
      monthBranch,
    );
  }
});

test('合法盘中日干丙坐午的丁同气强根保留阻化证据', () => {
  const pillars = [
    pillar('年柱', '丁', '卯', ['乙']),
    pillar('月柱', '辛', '亥', ['壬', '甲']),
    pillar('日柱', '丙', '午', ['丁', '己']),
    pillar('时柱', '丁', '酉', ['辛']),
  ];
  assertLegalFourPillars(pillars);

  const profile = assessStemHarmonyTransform('辛', '月柱', '丙', '日柱', '亥', pillars);

  assert.equal(profile.hasControllingElement, false);
  assert.equal(profile.level, '合而不化');
  assert.ok(profile.evidence.some((item) => item.includes('日干丙见日柱午藏丁')));
  assert.ok(profile.evidence.some((item) => item.includes('同气强根，作为阻化证据')));
});

test('合法五合正例满足月令、紧贴且无根阻时才标记已成化', () => {
  const pillars = [
    pillar('年柱', '戊', '辰', ['戊', '乙', '癸']),
    pillar('月柱', '己', '未', ['己', '丁', '乙']),
    pillar('日柱', '甲', '子', ['癸']),
    pillar('时柱', '癸', '酉', ['辛']),
  ];
  assertLegalFourPillars(pillars);

  const profile = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '未', pillars);

  assert.equal(profile.hasControllingElement, false);
  assert.equal(profile.level, '成化');
  assert.equal(profile.isTransformed, true);
});

test('合法盘中的长生同气根与冠带同气根按层次分别处理', () => {
  const rootedPillars = [
    pillar('年柱', '戊', '子', ['癸']),
    pillar('月柱', '庚', '申', ['庚', '壬', '戊']),
    pillar('日柱', '乙', '亥', ['壬', '甲']),
    pillar('时柱', '癸', '未', ['己', '丁', '乙']),
  ];
  const lighterPillars = [
    pillar('年柱', '戊', '辰', ['戊', '乙', '癸']),
    pillar('月柱', '己', '未', ['己', '丁', '乙']),
    pillar('日柱', '甲', '辰', ['戊', '乙', '癸']),
    pillar('时柱', '癸', '酉', ['癸']),
  ];
  assertLegalFourPillars(rootedPillars);
  assertLegalFourPillars(lighterPillars);

  const rooted = assessStemHarmonyTransform('庚', '月柱', '乙', '日柱', '申', rootedPillars);
  const lighter = assessStemHarmonyTransform('己', '月柱', '甲', '日柱', '未', lighterPillars);

  assert.equal(rooted.level, '合而不化');
  assert.ok(rooted.evidence.some((item) => item.includes('日干乙见日柱亥藏甲')));
  assert.equal(lighter.level, '成化');
  assert.ok(lighter.evidence.some((item) => item.includes('日干甲见日柱辰藏乙')));
  assert.ok(lighter.evidence.some((item) => item.includes('同气根，仅作根气旁证')));
});
