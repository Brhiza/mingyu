import assert from 'node:assert/strict';
import test from 'node:test';
import { natalEvidence } from '../src/systems/astrology/natal-evidence';
import { calculate, reprompt } from '../src/core';

const ids = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const labels = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
const signs = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const extra = [10, 20, 32, 39, 45, 50, 52];
function fixture(longitudes: number[], edges: Array<[number, number, string]>) {
  const values = [...longitudes, ...extra].slice(0, 10);
  const points = values.map((longitude, index) => ({ id: ids[index], name: labels[index], longitude, sign: signs[Math.floor(longitude / 30)], signIndex: Math.floor(longitude / 30), house: index % 12 + 1, retrograde: index === 2 }));
  const aspects = edges.map(([a, b, type]) => ({ first: ids[a], second: ids[b], type, name: type, deviation: 0, allowedOrb: 3, strength: 100 }));
  return { points, aspects };
}
const cases: Array<{ type: string; values: number[]; edges: Array<[number, number, string]>; apex?: string }> = [
  { type: 't_square', values: [0, 180, 90], edges: [[0, 1, 'opposition'], [0, 2, 'square'], [1, 2, 'square']], apex: 'mercury' },
  { type: 'grand_trine', values: [0, 120, 240], edges: [[0, 1, 'trine'], [0, 2, 'trine'], [1, 2, 'trine']] },
  { type: 'yod', values: [0, 60, 210], edges: [[0, 1, 'sextile'], [0, 2, 'quincunx'], [1, 2, 'quincunx']], apex: 'mercury' },
  { type: 'grand_cross', values: [0, 90, 180, 270], edges: [[0, 1, 'square'], [0, 2, 'opposition'], [0, 3, 'square'], [1, 2, 'square'], [1, 3, 'opposition'], [2, 3, 'square']] },
  { type: 'kite', values: [0, 120, 240, 180], edges: [[0, 1, 'trine'], [0, 2, 'trine'], [0, 3, 'opposition'], [1, 2, 'trine'], [1, 3, 'sextile'], [2, 3, 'sextile']] },
  { type: 'mystic_rectangle', values: [0, 60, 180, 240], edges: [[0, 1, 'sextile'], [0, 2, 'opposition'], [0, 3, 'trine'], [1, 2, 'trine'], [1, 3, 'opposition'], [2, 3, 'sextile']] },
];

test('六类相位格局保留成员、焦点与全部必要相位，缺一条不得成立', () => {
  for (const item of cases) {
    const { points, aspects } = fixture(item.values, item.edges), target = ids.slice(0, item.values.length).sort().join(',');
    const result = natalEvidence(points, aspects);
    const found = result.patterns.find((pattern) => pattern.type === item.type && pattern.members.map((member) => member.id).sort().join(',') === target);
    assert.ok(found, item.type); assert.equal(found.aspects.length, item.edges.length);
    if (item.apex) assert.equal(found.apex?.id, item.apex);
    const incomplete = natalEvidence(points, aspects.slice(1));
    assert.ok(!incomplete.patterns.some((pattern) => pattern.type === item.type && pattern.members.map((member) => member.id).sort().join(',') === target), item.type);
  }
});

test('元素、模式、逆行只统计十大星体，同座同宫星群不伪称合相', () => {
  const { points, aspects } = fixture([0, 12, 29], []);
  points[0].house = points[1].house = points[2].house = 5;
  const result = natalEvidence([...points, { id: 'ceres', name: '谷神星', longitude: 0, sign: '白羊', signIndex: 0, house: 5, retrograde: true }], aspects);
  assert.equal(result.distributions.elements.reduce((sum, item) => sum + item.members.length, 0), 10);
  assert.equal(result.distributions.modalities.reduce((sum, item) => sum + item.members.length, 0), 10);
  assert.deepEqual(result.distributions.retrograde.map((point) => point.id), ['mercury']);
  const signGroup = result.patterns.find((pattern) => pattern.type === 'stellium_sign' && pattern.sign === '白羊')!;
  const houseGroup = result.patterns.find((pattern) => pattern.type === 'stellium_house' && pattern.house === 5)!;
  assert.ok(signGroup); assert.ok(houseGroup); assert.deepEqual(signGroup.aspects, []); assert.deepEqual(houseGroup.aspects, []);
  assert.equal(signGroup.maxOrb, null); assert.equal(houseGroup.maxOrb, null);
  assert.ok(!signGroup.members.some((item) => item.id === 'ceres'));
  assert.throws(() => natalEvidence(points.slice(0, 9), aspects), /不完整/);
});

test('真实盘格局证据均可回溯本命相位，追问重算并拒绝篡改', async () => {
  for (const year of [1900, 1950, 1990, 2024, 2050, 2100]) {
    const result = await calculate('astrolabe', { question: '解读格局', birth: { year, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 } });
    assert.equal(result.data.distributions.elements.reduce((sum, item) => sum + item.members.length, 0), 10);
    for (const pattern of result.data.patterns) for (const edge of pattern.aspects) assert.ok(result.data.aspects.some((a) => a.first === edge.first && a.second === edge.second && a.type === edge.type));
    assert.match(result.prompt.text, /十大星体分布/); assert.match(result.prompt.text, /十大星体格局/);
    if (result.data.patterns.some((pattern) => pattern.type.startsWith('stellium'))) assert.match(result.prompt.text, /不要求各星体形成合相/);
    const saved = JSON.parse(JSON.stringify(result));
    assert.match((await reprompt({ method: 'astrolabe', result: saved, question: '再看一次' })).prompt.text, /再看一次/);
    saved.data.distributions.elements[0].members.push({ id: 'fake', name: '伪造' });
    await assert.rejects(() => reprompt({ method: 'astrolabe', result: saved, question: '追问' }), /不一致/);
  }
});
