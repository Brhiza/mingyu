import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods, getHuangliShensha } from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';

test('黄历四德按协纪日干起例覆盖十二月六十日', () => {
  // 《协纪辨方书》四仲天德居四维、无天德合；与将四维映射地支的起例分开。
  // https://www.shidianguji.com/zh/mid-page/7430936675263578162
  const tables: Record<string, Array<string | null>> = {
    天德: ['丁', null, '壬', '辛', null, '甲', '癸', null, '丙', '乙', null, '庚'],
    天德合: ['壬', null, '丁', '丙', null, '己', '戊', null, '辛', '庚', null, '乙'],
    月德: [...'丙甲壬庚丙甲壬庚丙甲壬庚'],
    月德合: [...'辛己丁乙辛己丁乙辛己丁乙'],
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const gods = getHuangliDayGods(pillar(month + 2), dayPillar).map((god) => god.getName());
      for (const [name, table] of Object.entries(tables)) {
        assert.equal(
          gods.includes(name),
          stems[day % 10] === table[month],
          `${month + 1}月/${dayPillar}/${name}`,
        );
      }
    }
});

test('辰月壬寅日天德贯通黄历查询与择日结果', () => {
  assert.ok(
    getHuangliShensha(2024, 4, 8).shensha.some((god) => god.name === '天德' && god.luck === '吉'),
  );
  const result = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2024-04-08',
    endDate: '2024-04-08',
  });
  assert.ok(result.days[0].gods.includes('天德'));
  assert.equal(
    result.days[0].godFacts?.find((fact) => fact.name === '天德')?.classification,
    '吉神',
  );
});
