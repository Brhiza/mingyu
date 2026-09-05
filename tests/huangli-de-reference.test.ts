import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods, getHuangliShensha } from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';
import { formatAlmanacGods } from '../packages/core/src/divination/almanac-evidence';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail';

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
  for (const text of [
    formatAlmanacGods(result.days[0]).join('；'),
    formatEnhancedDivinationInfo('almanac', result),
    formatDetailedDivinationInfo('almanac', result),
  ]) {
    assert.match(text, /吉神：[\s\S]*天德/);
    for (const name of result.days[0].gods) assert.ok(text.includes(name), name);
  }
});

test('黄历旧记录只有神煞名称时完整保留且不推定吉凶', () => {
  assert.deepEqual(formatAlmanacGods({ gods: ['天德', '月破', '天德'] }), ['神煞：天德、月破']);
  assert.deepEqual(formatAlmanacGods({ gods: [] }), []);
  const result = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2024-04-08',
    endDate: '2024-04-08',
  });
  const day = result.days[0];
  day.godFacts = undefined;
  const expected = `神煞：${day.gods.join('、')}`;
  assert.ok(formatEnhancedDivinationInfo('almanac', result).includes(expected));
  assert.ok(formatDetailedDivinationInfo('almanac', result).includes(expected));
});

test('黄历天恩与天赦按时宪历笺释覆盖十二月六十日', () => {
  // 《大清时宪历笺释》天恩十五日及四季天赦起例。
  // https://www.shidianguji.com/zh/book/NA06367/chapter/1m3q9g2tzjd4i
  const graceDays = new Set([
    '甲子',
    '乙丑',
    '丙寅',
    '丁卯',
    '戊辰',
    '己卯',
    '庚辰',
    '辛巳',
    '壬午',
    '癸未',
    '己酉',
    '庚戌',
    '辛亥',
    '壬子',
    '癸丑',
  ]);
  const pardonDays = ['戊寅', '甲午', '戊申', '甲子'];
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const pillar = (index: number) => stems[index % 10] + [...'子丑寅卯辰巳午未申酉戌亥'][index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const names = getHuangliDayGods(pillar(month + 2), dayPillar).map((god) => god.getName());
      assert.equal(
        names.includes('天恩'),
        graceDays.has(dayPillar),
        `${month + 1}月/${dayPillar}/天恩`,
      );
      assert.equal(
        names.includes('天赦'),
        dayPillar === pardonDays[Math.floor(month / 3)],
        `${month + 1}月/${dayPillar}/天赦`,
      );
    }
});

test('申月壬午日天恩贯通查询、择日与提示词', () => {
  assert.ok(
    getHuangliShensha(2026, 9, 5).shensha.some((god) => god.name === '天恩' && god.luck === '吉'),
  );
  const result = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-09-05',
    endDate: '2026-09-05',
  });
  assert.ok(result.days[0].gods.includes('天恩'));
  assert.equal(
    result.days[0].godFacts?.find((fact) => fact.name === '天恩')?.classification,
    '吉神',
  );
  assert.ok(formatEnhancedDivinationInfo('almanac', result).includes('天恩'));
});
