import assert from 'node:assert/strict';
import test from 'node:test';

import { generateDivinationSession } from '../packages/core/src/divination/session';
import type { LenormandData, LiurenData, TarotData } from '../packages/core/src/types/divination';

test('六壬合作任务书保留十二位天地盘、四课三传与实际课体', () => {
  const session = generateDivinationSession({
    method: 'liuren',
    question: '四课三传与课体对这件合作有何提示？',
    divinationTime: '2024-01-02T12:00:00+08:00',
    currentTime: '2024-01-02T12:00:00+08:00',
  });
  const data = session.data as LiurenData;
  const prompt = session.aiPrompt;

  assert.equal(data.heavenlyPlate.length, 12);
  assert.equal(data.fourLessons.length, 4);
  assert.equal(data.threeTransmissions.length, 3);
  assert.match(prompt, /地盘：/);
  assert.match(prompt, /天盘：/);
  for (const item of data.heavenlyPlate) {
    assert.ok(prompt.includes(`地盘${item.under}上临天盘${item.branch}乘${item.god}`));
  }
  assert.ok(prompt.includes('地盘寅上临天盘酉乘六合'));
  for (const lesson of data.fourLessons) {
    assert.ok(prompt.includes(`${lesson.name}${lesson.upper}临${lesson.lower}乘${lesson.god}`));
  }
  for (const transmission of data.threeTransmissions) {
    assert.ok(prompt.includes(`${transmission.stage}${transmission.branch}乘${transmission.god}`));
  }
  assert.ok(data.guaTiFacts?.some((fact) => fact.name === '斫轮卦'));
  assert.match(prompt, /斫轮卦：初传卯加临地盘申发用/);
  assert.match(prompt, /初传取法：.*按比用取初传/);
  assert.match(prompt, /课传反证：/);
  assert.doesNotMatch(prompt, /sourceUrl|evidenceAnalysis/);
});

test('塔罗时间流任务书逐牌保留牌位、正逆位、关键词、元素与牌阶主题', () => {
  const session = generateDivinationSession({
    method: 'tarot',
    question: '工作转换的起因、现状与后续如何？',
    currentTime: '2026-09-28T00:00:00+08:00',
    tarot: {
      spread: 'three',
      manualCards: [
        { id: 1, reversed: false },
        { id: 2, reversed: true },
        { id: 23, reversed: false },
      ],
    },
  });
  const data = session.data as TarotData;
  const prompt = session.aiPrompt;

  assert.deepEqual(
    data.cards.map((card) => [card.position, card.name, card.reversed]),
    [
      ['过去', '愚者', false],
      ['现在', '魔术师', true],
      ['未来', '权杖王牌', false],
    ],
  );
  let previousIndex = -1;
  for (const card of data.cards) {
    const line = `${card.position}：${card.name}（${card.reversed ? '逆位' : '正位'}）；关键词：${card.keywords.join('、')}；牌组属性：${card.element}；基础牌义：${card.archetype}`;
    const index = prompt.indexOf(line);
    assert.ok(index > previousIndex, `${card.position}的牌面事实应按牌序出现`);
    previousIndex = index;
  }
  assert.match(prompt, /相邻牌元素关系：/);
  assert.match(prompt, /重复牌面主题：大阿卡纳2张/);
  assert.doesNotMatch(prompt, /主轴：过去愚者（正位）；现在魔术师（逆位）/);
});

test('雷诺曼九宫任务书按真实中心及行列路径组织牌面，保留固定组合', () => {
  const session = generateDivinationSession({
    method: 'lenormand',
    question: '九宫中核心牌和周边关系如何看？',
    currentTime: '2026-09-28T00:00:00+08:00',
    lenormand: { spread: 'nine', manualCardIds: [24, 1, 2, 25, 3, 4, 5, 6, 7] },
  });
  const data = session.data as LenormandData;
  const prompt = session.aiPrompt;
  const layout = data.evidenceAnalysis?.structuredLayoutFacts ?? [];
  const fixed =
    data.evidenceAnalysis?.traditionalFacts.filter((fact) => fact.kind === '固定组合') ?? [];

  assert.equal(data.cards[4]?.name, '船');
  assert.equal(layout.length, 9);
  assert.equal(fixed.length, 2);
  assert.match(prompt, /布局关系：/);
  for (const fact of layout) assert.ok(prompt.includes(fact.factText));
  assert.match(prompt, /九宫第2排第2列的中心位置为船/);
  assert.match(prompt, /中排依次为戒指→船→房子/);
  assert.match(prompt, /中列依次为骑士→船→云/);
  assert.match(prompt, /左上至右下对角线依次为心→船→蛇/);
  for (const fact of fixed) {
    assert.ok(prompt.includes(`${fact.cardNames.join('+')}：${fact.promptText.split('；')[0]}`));
  }
  assert.doesNotMatch(prompt, /主轴：左上心；上方骑士；右上三叶草/);
  assert.doesNotMatch(prompt, /相邻合读 [^：]+：/);
  assert.doesNotMatch(prompt, /sourceUrl|evidenceAnalysis/);
});

test('雷诺曼三牌仍保留正确牌位与实际相邻固定组合', () => {
  const session = generateDivinationSession({
    method: 'lenormand',
    question: '对方发来的消息与关系走向如何？',
    currentTime: '2026-09-28T00:00:00+08:00',
    lenormand: { spread: 'three', manualCardIds: [1, 24, 25] },
  });
  const data = session.data as LenormandData;
  const prompt = session.aiPrompt;

  assert.deepEqual(
    data.cards.map((card) => [card.position, card.name]),
    [
      ['起因', '骑士'],
      ['现状', '心'],
      ['走向', '戒指'],
    ],
  );
  for (const card of data.cards) {
    assert.ok(
      prompt.includes(`${card.position}：${card.name}；关键词：${card.keywords.join('、')}`),
    );
  }
  assert.match(prompt, /骑士\+心：.*起因与现状的牌序相邻/);
  assert.match(prompt, /心\+戒指：.*现状与走向的牌序相邻/);
});
