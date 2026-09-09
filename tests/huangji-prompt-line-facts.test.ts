import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHuangjiJingshi } from '@core/huangji-jingshi';

test('皇极值年同人与鼎卦按上下卦展开六爻且保留层级变爻', () => {
  const annual = calculateHuangjiJingshi({ year: 2026 });
  assert.match(
    annual.prompt,
    /值年卦爻象：天火同人，上卦乾、下卦离；自下而上为初爻阳、二爻阴、三爻阳、四爻阳、五爻阳、上爻阳/,
  );
  assert.match(annual.prompt, /由大过卦第6爻变得/);
  assert.match(annual.prompt, /由姤卦第5爻变得/);
  assert.match(
    annual.prompt,
    /值年取序：以公元1984年的六十年统卦火风鼎为起点.*已过42年，顺行42位，取得天火同人为本年静态值年卦/,
  );
  assert.match(
    annual.prompt,
    /十年取卦：以六十年统卦火风鼎第5爻变化，得到天风姤，统摄公元2024年至公元2033年/,
  );
  const ding = calculateHuangjiJingshi({ year: 1984 });
  assert.match(
    ding.prompt,
    /值年卦爻象：火风鼎，上卦离、下卦巽；自下而上为初爻阴、二爻阳、三爻阳、四爻阳、五爻阴、上爻阳/,
  );
  assert.match(ding.prompt, /已过0年，顺行0位，取得火风鼎为本年静态值年卦/);
});

test('皇极值年偏移在六十年末年归59且下一统卦重置为0，跨公元元年少计不存在的零年', () => {
  assert.match(calculateHuangjiJingshi({ year: 2043 }).prompt, /已过59年，顺行59位/);
  assert.match(calculateHuangjiJingshi({ year: 2044 }).prompt, /已过0年，顺行0位/);
  const before = calculateHuangjiJingshi({ year: -1 });
  const after = calculateHuangjiJingshi({ year: 1 });
  const start = before.forecast!.hexagrams.sixtyYear.startYear;
  assert.equal(after.forecast!.hexagrams.sixtyYear.startYear, start);
  assert.ok(start < 0);
  assert.ok(before.prompt.includes(`已过${-1 - start}年，顺行${-1 - start}位`));
  assert.ok(after.prompt.includes(`已过${-start}年，顺行${-start}位`));
});

test('皇极时点盘的四个近层各自保留卦体及实际推演爻位', () => {
  const result = calculateHuangjiJingshi({ date: new Date('2025-12-25T12:30:00+08:00') });
  const layers = result.dateTimeForecast!.hexagrams;
  for (const [label, layer] of [
    ['月经卦', layers.monthJing],
    ['旬纬卦', layers.xunWei],
    ['日卦', layers.daily],
    ['时经卦', layers.hourJing],
  ] as const) {
    assert.ok(
      result.prompt.includes(`${label}爻象：${layer.name}，上卦${layer.upper}、下卦${layer.lower}`),
    );
    if (layer.changedLine) {
      assert.ok(
        result.prompt.includes(
          `${label}：${layer.name}（由${layer.derivedFrom}卦第${layer.changedLine}爻变得`,
        ),
      );
    }
  }
  assert.doesNotMatch(result.prompt, /动爻0|六二爻动/);
});

test('皇极旬末与下一旬首的范围按皇极日序给出，当前日不被当作起日', () => {
  const last = calculateHuangjiJingshi({ date: new Date('2026-07-11T14:35:00+08:00') });
  assert.match(last.prompt, /皇极年内第200日；本节气实际第5日映射为皇极节气第5日/);
  assert.match(
    last.prompt,
    /月经统辖：风火家人统皇极年内第181至240日，共60个皇极日；当前为本月经卦内第20日/,
  );
  assert.match(
    last.prompt,
    /旬纬统辖：风天小畜统本月经卦内第11至20日，共10个皇极日；当前为本旬第10日/,
  );
  const next = calculateHuangjiJingshi({ date: new Date('2026-07-12T14:35:00+08:00') });
  assert.match(next.prompt, /统本月经卦内第21至30日，共10个皇极日；当前为本旬第1日/);
  const winter = calculateHuangjiJingshi({ date: new Date('2025-12-21T23:03:06+08:00') });
  assert.match(winter.prompt, /统皇极年内第1至60日，共60个皇极日；当前为本月经卦内第1日/);
  assert.match(winter.prompt, /统本月经卦内第1至10日，共10个皇极日；当前为本旬第1日/);
});
