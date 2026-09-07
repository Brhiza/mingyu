import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWuyunLiuqi, evaluateWuyunLiuqiPathomechanism } from '@core/wuyun-liuqi';

test('六组司天所胜资料保留病本脏腑与治则条件，不混入在泉内淫段', () => {
  // 识典《素问·至真要大论》司天所胜段第10、11段。
  const rows = [
    ['乙巳', '厥阴司天，风淫所胜', '脾', '平以辛凉，佐以苦甘'],
    ['丙午', '少阴司天，热淫所胜', '肺', '平以咸寒，佐以苦甘'],
    ['丁未', '太阴司天，湿淫所胜', '肾', '平以苦热，佐以酸辛'],
    ['戊申', '少阳司天，火淫所胜', '肺', '平以酸冷，佐以苦甘'],
    ['己酉', '阳明司天，燥淫所胜', '肝', '平以苦湿，佐以酸辛'],
    ['庚戌', '太阳司天，寒淫所胜', '心', '平以辛热，佐以甘苦'],
  ];
  for (const [yearGanZhi, condition, organ, treatment] of rows) {
    const result = calculateWuyunLiuqi({ yearGanZhi }).pathomechanism!;
    assert.equal(result.classicalReference.condition, condition);
    assert.equal(result.classicalReference.conditionEstablished, null);
    assert.equal(result.affectedZangFu, `${condition}时，原文称“病本于${organ}”。`);
    assert.ok(result.climaticPathology.startsWith(`${condition}的病候摘录：`));
    assert.ok(result.treatmentGuideline.startsWith(`${condition}的传统治则摘录：`));
    assert.ok(result.treatmentGuideline.includes(treatment));
    assert.doesNotMatch(result.summary, /病本|温补|脏腑|失眠/);
  }
});

test('病机资料入口拒绝未知司天及与年份矛盾的资料', () => {
  const base = calculateWuyunLiuqi({ yearGanZhi: '庚午' });
  const input = {
    yearGanZhi: base.input.yearGanZhi,
    annualMovement: base.annualMovement,
    sitian: base.sitian,
    annualConformities: base.annualConformities,
  };
  assert.doesNotThrow(() => evaluateWuyunLiuqiPathomechanism(input));
  for (const field of ['name', 'element', 'phase', 'qi'] as const) {
    const bad = structuredClone(input);
    Object.assign(bad.sitian, { [field]: '未知' });
    assert.throws(() => evaluateWuyunLiuqiPathomechanism(bad), /司天/);
  }
  for (const field of ['stem', 'element', 'strength', 'yinYang'] as const) {
    const bad = structuredClone(input);
    Object.assign(bad.annualMovement, { [field]: '未知' });
    assert.throws(() => evaluateWuyunLiuqiPathomechanism(bad), /岁运/);
  }
  for (const field of ['suihui', 'tongSuihui'] as const) {
    const bad = structuredClone(input);
    bad.annualConformities[field] = !bad.annualConformities[field];
    assert.throws(() => evaluateWuyunLiuqiPathomechanism(bad), /符会/);
  }
  assert.throws(() => evaluateWuyunLiuqiPathomechanism({ ...input, yearGanZhi: 'constructor' }));
});
