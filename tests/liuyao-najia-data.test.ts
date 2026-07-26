import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getSixAnimals } from '../packages/core/src/calendar/lunar.ts';
import { generateLiuyao } from '../packages/core/src/divination/algorithms/liuyao.ts';
import { hexagramNaJia as coreHexagramNaJia } from '../packages/core/src/divination/divination-data.ts';
import { hexagramsData } from '../packages/core/src/divination/hexagram-data.ts';

/**
 * 六爻纳甲回归：下三爻按下经卦所属八纯卦纳支，上三爻按上经卦所属八纯卦纳支。
 * 旧实现曾把部分四世、五世、游魂、归魂卦的外卦纳支套错。
 */

// 八纯卦内卦 / 外卦纳甲地支（阳四宫顺行、阴四宫逆行）
const pureNaJia: Record<string, { inner: string[]; outer: string[] }> = {
  乾: { inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
  坎: { inner: ['寅', '辰', '午'], outer: ['申', '戌', '子'] },
  艮: { inner: ['辰', '午', '申'], outer: ['戌', '子', '寅'] },
  震: { inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
  巽: { inner: ['丑', '亥', '酉'], outer: ['未', '巳', '卯'] },
  离: { inner: ['卯', '丑', '亥'], outer: ['酉', '未', '巳'] },
  坤: { inner: ['未', '巳', '卯'], outer: ['丑', '亥', '酉'] },
  兑: { inner: ['巳', '卯', '丑'], outer: ['亥', '酉', '未'] },
};

const trigramLinesBottomUp: Record<string, number[]> = {
  乾: [1, 1, 1],
  兑: [1, 1, 0],
  离: [1, 0, 1],
  震: [0, 0, 1],
  巽: [0, 1, 1],
  坎: [0, 1, 0],
  艮: [1, 0, 0],
  坤: [0, 0, 0],
};

const trigramSymbols: Record<string, string> = {
  乾: '☰',
  兑: '☱',
  离: '☲',
  震: '☳',
  巽: '☴',
  坎: '☵',
  艮: '☶',
  坤: '☷',
};

// 与下方独立六十四卦表一致：每宫连续 8 卦，依次为本宫、一至五世、游魂、归魂。
const palaceOrder = ['乾', '坎', '艮', '震', '巽', '离', '坤', '兑'];

// 64 卦 → [上经卦, 下经卦]（所属八纯卦）。按八宫顺序列出。
const trigrams: Record<string, [string, string]> = {
  // 乾宫（金）
  乾为天: ['乾', '乾'],
  天风姤: ['乾', '巽'],
  天山遁: ['乾', '艮'],
  天地否: ['乾', '坤'],
  风地观: ['巽', '坤'],
  山地剥: ['艮', '坤'],
  火地晋: ['离', '坤'],
  火天大有: ['离', '乾'],
  // 坎宫（水）
  坎为水: ['坎', '坎'],
  水泽节: ['坎', '兑'],
  水雷屯: ['坎', '震'],
  水火既济: ['坎', '离'],
  泽火革: ['兑', '离'],
  雷火丰: ['震', '离'],
  地火明夷: ['坤', '离'],
  地水师: ['坤', '坎'],
  // 艮宫（土）
  艮为山: ['艮', '艮'],
  山火贲: ['艮', '离'],
  山天大畜: ['艮', '乾'],
  山泽损: ['艮', '兑'],
  火泽睽: ['离', '兑'],
  天泽履: ['乾', '兑'],
  风泽中孚: ['巽', '兑'],
  风山渐: ['巽', '艮'],
  // 震宫（木）
  震为雷: ['震', '震'],
  雷地豫: ['震', '坤'],
  雷水解: ['震', '坎'],
  雷风恒: ['震', '巽'],
  地风升: ['坤', '巽'],
  水风井: ['坎', '巽'],
  泽风大过: ['兑', '巽'],
  泽雷随: ['兑', '震'],
  // 巽宫（木）
  巽为风: ['巽', '巽'],
  风天小畜: ['巽', '乾'],
  风火家人: ['巽', '离'],
  风雷益: ['巽', '震'],
  天雷无妄: ['乾', '震'],
  火雷噬嗑: ['离', '震'],
  山雷颐: ['艮', '震'],
  山风蛊: ['艮', '巽'],
  // 离宫（火）
  离为火: ['离', '离'],
  火山旅: ['离', '艮'],
  火风鼎: ['离', '巽'],
  火水未济: ['离', '坎'],
  山水蒙: ['艮', '坎'],
  风水涣: ['巽', '坎'],
  天水讼: ['乾', '坎'],
  天火同人: ['乾', '离'],
  // 坤宫（土）
  坤为地: ['坤', '坤'],
  地雷复: ['坤', '震'],
  地泽临: ['坤', '兑'],
  地天泰: ['坤', '乾'],
  雷天大壮: ['震', '乾'],
  泽天夬: ['兑', '乾'],
  水天需: ['坎', '乾'],
  水地比: ['坎', '坤'],
  // 兑宫（金）
  兑为泽: ['兑', '兑'],
  泽水困: ['兑', '坎'],
  泽地萃: ['兑', '坤'],
  泽山咸: ['兑', '艮'],
  水山蹇: ['坎', '艮'],
  地山谦: ['坤', '艮'],
  雷山小过: ['震', '艮'],
  雷泽归妹: ['震', '兑'],
};

const trigramByBottomUpLines = new Map(
  Object.entries(trigramLinesBottomUp).map(([name, lines]) => [lines.join(''), name]),
);

const hexagramByTrigrams = new Map(
  Object.entries(trigrams).map(([name, [upper, lower]]) => [`${upper}/${lower}`, name]),
);

test('六十四卦底表：卦名、上下卦、爻序、符号和八宫应与独立规则表完全一致', () => {
  assert.equal(hexagramsData.length, 64, '六十四卦底表必须恰好有 64 项');
  assert.equal(new Set(hexagramsData.map((item) => item.id)).size, 64, '卦序不得重复');
  assert.equal(new Set(hexagramsData.map((item) => item.name)).size, 64, '卦名不得重复');
  assert.equal(new Set(hexagramsData.map((item) => item.symbol)).size, 64, '卦符不得重复');
  assert.equal(
    new Set(hexagramsData.map((item) => item.binarySymbol)).size,
    64,
    '六爻二进制不得重复',
  );
  assert.deepEqual(
    hexagramsData.map((item) => item.id).sort((left, right) => left - right),
    Array.from({ length: 64 }, (_, index) => index + 1),
    '卦序必须完整覆盖文王六十四卦的 1 至 64',
  );

  const dataByName = new Map(hexagramsData.map((item) => [item.name, item]));
  assert.deepEqual(
    [...dataByName.keys()].sort(),
    Object.keys(trigrams).sort(),
    '底表卦名必须与独立六十四卦表完全相同',
  );

  Object.entries(trigrams).forEach(([name, [upper, lower]], index) => {
    const item = dataByName.get(name);
    assert.ok(item, `缺少${name}`);
    assert.equal(item.upper, upper, `${name}上卦`);
    assert.equal(item.lower, lower, `${name}下卦`);
    assert.equal(
      item.binarySymbol,
      [...trigramLinesBottomUp[upper], ...trigramLinesBottomUp[lower]].join(''),
      `${name}六爻二进制应按“上卦、下卦”存储，且每个经卦内部自下而上`,
    );
    assert.equal(item.symbol, `${trigramSymbols[upper]}${trigramSymbols[lower]}`, `${name}卦符`);
    assert.equal(item.palace, palaceOrder[Math.floor(index / 8)], `${name}所属八宫`);
    assert.equal(item.yaoCi?.length, 6, `${name}必须包含从初爻到上爻的 6 条爻辞`);
  });
});

test('六爻排盘：全六十四卦每爻发动时主卦、互卦、变卦应与自下而上爻序一致', () => {
  const sampleDate = new Date('2026-07-25T23:30:00+08:00');

  for (const [originalName, [upper, lower]] of Object.entries(trigrams)) {
    const mainLines = [...trigramLinesBottomUp[lower], ...trigramLinesBottomUp[upper]];
    const interLower = trigramByBottomUpLines.get(mainLines.slice(1, 4).join(''));
    const interUpper = trigramByBottomUpLines.get(mainLines.slice(2, 5).join(''));
    const expectedInterName = hexagramByTrigrams.get(`${interUpper}/${interLower}`);

    for (let movingYao = 1; movingYao <= 6; movingYao += 1) {
      const changedLines = [...mainLines];
      changedLines[movingYao - 1] = 1 - changedLines[movingYao - 1];
      const changedLower = trigramByBottomUpLines.get(changedLines.slice(0, 3).join(''));
      const changedUpper = trigramByBottomUpLines.get(changedLines.slice(3, 6).join(''));
      const expectedChangedName = hexagramByTrigrams.get(`${changedUpper}/${changedLower}`);
      const yaos = mainLines.map((line, index) => {
        if (index === movingYao - 1) return line === 1 ? 9 : 6;
        return line === 1 ? 7 : 8;
      });
      const data = generateLiuyao(sampleDate, { method: 'manual', yaos });
      const label = `${originalName}第${movingYao}爻`;

      assert.equal(data.originalName, originalName, `${label}主卦`);
      assert.equal(data.interName, expectedInterName, `${label}互卦`);
      assert.equal(data.changedName, expectedChangedName, `${label}变卦`);
      assert.deepEqual(
        data.yaosDetail.map((yao) => (yao.yaoType === '阳' ? 1 : 0)),
        mainLines,
        `${label}逐爻阴阳`,
      );
      assert.deepEqual(
        data.changingYaos.map((yao) => yao.position),
        [movingYao],
        `${label}动爻位置`,
      );
    }
  }
});

test('六爻纳甲：核心包全 64 卦按上下经卦所属纯卦分别纳甲', () => {
  for (const [name, [upper, lower]] of Object.entries(trigrams)) {
    const expected = [...pureNaJia[lower].inner, ...pureNaJia[upper].outer];
    assert.deepEqual(
      coreHexagramNaJia[name],
      expected,
      `${name} 纳甲不符规则（上${upper}下${lower}）：应为 ${expected.join('')}，实际 ${coreHexagramNaJia[name].join('')}`,
    );
  }
});

test('六爻六神：按日干从初爻起六神，使用螣蛇标准写法', () => {
  const expectedByDayStem: Record<string, string[]> = {
    甲: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'],
    乙: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'],
    丙: ['朱雀', '勾陈', '螣蛇', '白虎', '玄武', '青龙'],
    丁: ['朱雀', '勾陈', '螣蛇', '白虎', '玄武', '青龙'],
    戊: ['勾陈', '螣蛇', '白虎', '玄武', '青龙', '朱雀'],
    己: ['螣蛇', '白虎', '玄武', '青龙', '朱雀', '勾陈'],
    庚: ['白虎', '玄武', '青龙', '朱雀', '勾陈', '螣蛇'],
    辛: ['白虎', '玄武', '青龙', '朱雀', '勾陈', '螣蛇'],
    壬: ['玄武', '青龙', '朱雀', '勾陈', '螣蛇', '白虎'],
    癸: ['玄武', '青龙', '朱雀', '勾陈', '螣蛇', '白虎'],
  };

  for (const [dayStem, expected] of Object.entries(expectedByDayStem)) {
    assert.deepEqual(getSixAnimals(dayStem), expected, `${dayStem}日六神起法不正确`);
  }
});
