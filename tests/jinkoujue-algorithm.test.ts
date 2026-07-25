import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  analyzeJinkoujueEvidence,
  generateJinkoujue,
} from '../packages/core/src/divination/algorithms/jinkoujue.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

test('金口诀：时间起课应形成地分将神贵神人元四位与取用主线', () => {
  const data = generateJinkoujue({ method: 'time', customDate: SAMPLE_DATE });

  assert.equal(data.method, 'time');
  assert.equal(data.diFenBranch, data.positions.diFen.branch);
  assert.ok(data.positions.jiangShen.branch);
  assert.ok(data.positions.guiShen.god);
  assert.ok(data.positions.renYuan.stem);
  assert.match(data.mainLine, /取用主线：以贵神/);
  assert.equal(data.calculation.yuanDunRule, '五子元遁求地分人元');
  assert.ok(data.evidenceAnalysis);
  assert.match(data.evidenceAnalysis?.promptText || '', /【金口诀取用主线结构化证据】/);
});

test('金口诀：数字起课 1-12 映射子至亥，大于 12 按 12 归一', () => {
  const zi = generateJinkoujue({ method: 'number', number: 1, customDate: SAMPLE_DATE });
  const hai = generateJinkoujue({ method: 'number', number: 12, customDate: SAMPLE_DATE });
  const wrap = generateJinkoujue({ method: 'number', number: 13, customDate: SAMPLE_DATE });

  assert.equal(zi.diFenBranch, '子');
  assert.equal(hai.diFenBranch, '亥');
  assert.equal(wrap.diFenBranch, '子');
});

test('金口诀：五子元遁应按日干起遁干', () => {
  const data = generateJinkoujue({ method: 'number', number: 1, customDate: SAMPLE_DATE });
  const dayStem = data.ganzhi.day.charAt(0);
  const startMap: Record<string, string> = {
    甲: '甲',
    己: '甲',
    乙: '丙',
    庚: '丙',
    丙: '戊',
    辛: '戊',
    丁: '庚',
    壬: '庚',
    戊: '壬',
    癸: '壬',
  };
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const start = startMap[dayStem];
  const expected = stems[(stems.indexOf(start) + 0) % 10]; // 地分子

  assert.ok(start);
  assert.equal(data.positions.renYuan.branch, '子');
  assert.equal(data.positions.renYuan.stem, expected);
});

test('金口诀：同种子随机起课可复现，并保留随机轨迹', () => {
  const a = generateJinkoujue({
    method: 'random',
    seed: 'jinkoujue-seed',
    customDate: SAMPLE_DATE,
  });
  const b = generateJinkoujue({
    method: 'random',
    seed: 'jinkoujue-seed',
    customDate: SAMPLE_DATE,
  });

  assert.equal(a.diFenBranch, b.diFenBranch);
  assert.ok(a.randomTrace?.samples.length);
  assert.deepEqual(a.randomTrace?.samples, b.randomTrace?.samples);
});

test('金口诀：证据层应覆盖四位、关系、焦点与主线', () => {
  const data = generateJinkoujue({ method: 'number', number: 5, customDate: SAMPLE_DATE });
  const evidence = analyzeJinkoujueEvidence(data);

  assert.equal(evidence.positions.length, 4);
  assert.ok(evidence.relations.length >= 4);
  assert.ok(evidence.focusFacts.length >= 3);
  assert.match(evidence.mainLine, /贵神/);
  assert.equal(evidence.calculationFact.status, '完整');
});

test('金口诀：十二地分的四位五行与天将必须完整，不得输出未定关系', () => {
  for (let number = 1; number <= 12; number += 1) {
    const data = generateJinkoujue({ method: 'number', number, customDate: SAMPLE_DATE });
    const positions = Object.values(data.positions);

    assert.ok(positions.every((item) => ['木', '火', '土', '金', '水'].includes(item.element)));
    assert.ok(data.positions.guiShen.god);
    assert.doesNotMatch(JSON.stringify(data.relations), /未定|未知|^$/);
  }
});
