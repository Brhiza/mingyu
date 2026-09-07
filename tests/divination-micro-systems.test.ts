import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateXiaoliurenFlow,
  analyzeLenormandNineGrid,
  analyzeTarotArchetypeJourney,
} from 'mingyu-core/divination';

test('小六壬三宫流转应准确推导五行生克与终局定性断诀', () => {
  // 先滞后发：初宫留连（水），终局速喜（火）
  const flow1 = evaluateXiaoliurenFlow({
    monthName: '留连',
    dayName: '大安',
    hourName: '速喜',
  });
  assert.equal(flow1.trajectoryType, '先滞后发');
  assert.match(flow1.classicalJudgment, /先难后易|终见转机/);
  assert.match(flow1.summary, /【小六壬三宫流转】/);

  // 始吉终空：初宫大安（木），终局空亡（土）
  const flow2 = evaluateXiaoliurenFlow({
    monthName: '大安',
    dayName: '速喜',
    hourName: '空亡',
  });
  assert.equal(flow2.trajectoryType, '始吉终空');
  assert.match(flow2.classicalJudgment, /归于空亡|防范虎头蛇尾/);

  // 转折相克：终局赤口（金）
  const flow3 = evaluateXiaoliurenFlow({
    monthName: '大安',
    dayName: '小吉',
    hourName: '赤口',
  });
  assert.equal(flow3.trajectoryType, '转折相克');
  assert.match(flow3.classicalJudgment, /赤口金煞|口舌官非/);
});

test('雷诺曼九宫十字网格应准确推导核心牌十字邻牌与曼哈顿距离', () => {
  // 9张牌按九宫排列（4为核心牌）
  const cards = [
    { id: 1, name: '骑士' }, // 0: 左上
    { id: 2, name: '三叶草' }, // 1: 上方
    { id: 3, name: '船' }, // 2: 右上
    { id: 4, name: '房子' }, // 3: 左侧
    { id: 24, name: '心' }, // 4: 核心
    { id: 25, name: '戒指' }, // 5: 右侧
    { id: 7, name: '蛇' }, // 6: 左下
    { id: 8, name: '棺材' }, // 7: 下方
    { id: 9, name: '花束' }, // 8: 右下
  ];

  const grid = analyzeLenormandNineGrid(cards);
  assert.equal(grid.centerCard.name, '心');
  assert.equal(grid.topCard?.name, '三叶草');
  assert.equal(grid.bottomCard?.name, '棺材');
  assert.equal(grid.leftCard?.name, '房子');
  assert.equal(grid.rightCard?.name, '戒指');

  // 紧邻牌（曼哈顿距离为 1）共有 4 张（上下左右）
  const adjacent = grid.cardDistances.filter((d) => d.relationship === '紧邻');
  assert.equal(adjacent.length, 4);
  assert.deepEqual(
    adjacent.map((d) => d.card.name).sort(),
    ['三叶草', '房子', '棺材', '戒指'].sort(),
  );

  // 对角牌（曼哈顿距离为 2）共有 4 张
  const diagonal = grid.cardDistances.filter((d) => d.relationship === '近距');
  assert.equal(diagonal.length, 4);

  assert.match(grid.summary, /【雷诺曼九宫十字】/);
});

test('塔罗大阿卡那演进轴应准确计算愚人之旅三阶段分布与主导重心', () => {
  // 抽得 3 张大阿卡那（均在阶段一）+ 2 张小阿卡那
  const cards1 = [
    { id: 1, name: '魔术师', reversed: false }, // 阶段一
    { id: 4, name: '皇帝', reversed: false }, // 阶段一
    { id: 7, name: '战车', reversed: true }, // 阶段一
    { id: 35, name: '圣杯二', reversed: false }, // 小牌
    { id: 50, name: '宝剑三', reversed: true }, // 小牌
  ];

  const journey1 = analyzeTarotArchetypeJourney(cards1);
  assert.equal(journey1.majorCardCount, 3);
  assert.equal(journey1.minorCardCount, 2);
  assert.match(journey1.dominantStage ?? '', /个体成长阶段/);
  assert.match(journey1.summary, /【塔罗原型演进轴】/);

  // 灵性转化阶段（阶段三）主导
  const cards2 = [
    { id: 16, name: '高塔', reversed: false }, // 阶段三
    { id: 17, name: '星星', reversed: false }, // 阶段三
    { id: 21, name: '世界', reversed: false }, // 阶段三
    { id: 9, name: '隐士', reversed: false }, // 阶段二
  ];

  const journey2 = analyzeTarotArchetypeJourney(cards2);
  assert.equal(journey2.majorCardCount, 4);
  assert.match(journey2.dominantStage ?? '', /灵性转化阶段/);
});
