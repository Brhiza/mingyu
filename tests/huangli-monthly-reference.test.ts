import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';

test('月恩、四相、月空、月厌、月煞覆盖十二月六十日原典表', () => {
  // 《协纪辨方书》月恩、《御定星历考原》四相、《三命通会》所载大统历三项月神。
  // https://www.shidianguji.com/zh/mid-page/7430936675263660082
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7e6n9
  // https://www.shidianguji.com/zh/mid-page/7426853297409146907
  const tables = {
    月恩: [...'丙丁庚己戊辛壬癸庚乙甲辛'],
    四相: [
      '丙丁',
      '丙丁',
      '丙丁',
      '戊己',
      '戊己',
      '戊己',
      '壬癸',
      '壬癸',
      '壬癸',
      '甲乙',
      '甲乙',
      '甲乙',
    ],
    月空: [...'壬庚丙甲壬庚丙甲壬庚丙甲'],
    月厌: [...'戌酉申未午巳辰卯寅丑子亥'],
    月煞: [...'丑戌未辰丑戌未辰丑戌未辰'],
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());
      for (const [name, targets] of Object.entries(tables)) {
        const input = ['月厌', '月煞'].includes(name) ? branches[day % 12] : stems[day % 10];
        assert.equal(
          names.includes(name),
          targets[month].includes(input),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('亥月己丑日择日结果应列月厌而非月空', () => {
  const day = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
  }).days[0];
  assert.equal(day.ganzhi.day, '己丑');
  assert.equal(day.gods.includes('月空'), false);
  assert.equal(day.gods.includes('六合'), false);
  assert.equal(day.gods.includes('金堂'), false);
  assert.equal(day.gods.includes('五合'), false);
  assert.equal(day.gods.includes('五虚'), false);
  assert.equal(day.gods.includes('天牢'), false);
  assert.equal(day.gods.includes('鸣吠对'), false);
  assert.equal(day.godFacts?.find((fact) => fact.name === '玉堂')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '玉宇')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '天巫')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '福德')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '月厌')?.classification, '凶神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '归忌')?.classification, '凶神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '地火')?.classification, '凶神');
  assert.equal(day.gods.includes('死神'), false);
  assert.equal(day.gods.includes('游祸'), false);
  assert.equal(day.gods.includes('不将'), false);
  assert.equal(day.godFacts?.find((fact) => fact.name === '大煞')?.classification, '凶神');
});
