import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import { generateJinkoujue } from 'mingyu-core/divination/jinkoujue';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { getDivinationSummaryBlocks } from '../src/lib/divination/summary';

test('黄历择日摘要应展示候选状态与限制，不暴露内部数字评分', () => {
  const data = generateAlmanacSelection({
    topic: 'contract',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
  });

  const summary = getDivinationSummaryBlocks('almanac', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.match(text, /可用候选|条件候选|慎用候选/);
  assert.doesNotMatch(text, /评分\s*-?\d|成功率|匹配率/);
});

test('奇门摘要应把已校勘组合规则标为传统分类且不等于现实吉凶', () => {
  const data = generateQimen(new Date('2025-01-01T08:00:00+08:00'));
  const summary = getDivinationSummaryBlocks('qimen', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.match(text, /已校勘组合规则：/);
  assert.match(text, /传统分类：mixed，不等于现实吉凶/);
  assert.doesNotMatch(text, /已校勘组合规则：[^\n]*（-?\d+）/);
  assert.doesNotMatch(text, /建除[^\n]*[吉凶]/);
});

test('奇门摘要应统一重建派生资料，不复活旧缓存污染', () => {
  const data = generateQimen(new Date('2025-01-01T08:00:00+08:00'));
  const clean = getDivinationSummaryBlocks('qimen', data);
  const polluted = {
    ...data,
    patternTags: ['伪造现实大吉'],
    patternCombos: [
      {
        key: 'polluted-combo',
        name: '伪造必胜组合',
        tone: 'super-good',
        summary: '保证现实成功',
        sources: ['伪造来源'],
      },
    ],
    voidBranches: ['伪'],
    voidPalaces: [{ branch: '伪', palace: 9, name: '伪造空亡宫' }],
    horseStar: { sourceBranch: '伪', branch: '造', palace: 9, name: '伪造马星宫' },
    specialConditions: { description: '伪造固定应期' },
    seasonality: {
      ...data.seasonality!,
      currentJieQi: '伪造节气',
      dayOfficer: '伪造建除',
      dayOfficerFortuneLabel: '大吉',
    },
  } as typeof data;

  const rebuilt = getDivinationSummaryBlocks('qimen', polluted);
  assert.deepEqual(rebuilt, clean);
  assert.doesNotMatch(
    [...rebuilt.tags, ...rebuilt.lines].join('\n'),
    /伪造|现实大吉|必胜|保证现实成功|固定应期/,
  );
});

test('小六壬摘要只展示原始时间事实和待校状态', () => {
  const data = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-29T08:00:00+08:00'),
  });
  const summary = getDivinationSummaryBlocks('xiaoliuren', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.match(text, /时辰：辰时|时辰序号5/);
  assert.match(text, /来源状态：证据链有缺口/);
  assert.match(text, /零点换日|闰月沿用同名月序/);
  assert.doesNotMatch(text, /占得宫|顺数轨迹|留连事难成|五行推进|月令旺衰|六亲|旬空|驿马|桃花/);

  const polluted = structuredClone(data);
  polluted.methodLabel = '伪造起课法';
  Object.assign(polluted, {
    sequence: { month: '伪造月宫', day: '伪造日宫', hour: '伪造时宫' },
    primary: { name: '伪造占得宫', verse: '伪造主证歌诀' },
  });

  const rebuilt = getDivinationSummaryBlocks('xiaoliuren', polluted);
  assert.deepEqual(rebuilt, summary);
  assert.doesNotMatch(
    [...rebuilt.tags, ...rebuilt.lines].join('\n'),
    /伪造起课法|伪造时宫歌诀|伪造主证歌诀|伪造旧主证/,
  );
});

test('梅花摘要应从原始起卦资料重建，不复活旧盘派生字段污染', () => {
  const data = generateMeihua(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'number',
    number: 123,
  });
  const clean = getDivinationSummaryBlocks('meihua', data);
  const polluted = structuredClone(data);
  polluted.originalName = '伪造主卦';
  polluted.interName = '伪造互卦';
  polluted.changedName = '伪造变卦';
  polluted.tiGua.name = '伪造体卦';
  polluted.yongGua.name = '伪造用卦';
  polluted.movingYao.position = 6;
  polluted.analysis.tiYongRelation = '伪造必胜关系';
  polluted.analysis.inter1Relation = '伪造过程关系';
  polluted.analysis.changedRelation = '伪造结果关系';

  const rebuilt = getDivinationSummaryBlocks('meihua', polluted);
  assert.deepEqual(rebuilt, clean);
  assert.doesNotMatch(
    [...rebuilt.tags, ...rebuilt.lines].join('\n'),
    /伪造主卦|伪造互卦|伪造变卦|伪造体卦|伪造用卦|伪造必胜|伪造过程|伪造结果/,
  );
});

test('六爻摘要应从原始摇卦资料重建，不复活旧盘派生字段污染', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 7, 8, 8, 7, 6],
  });
  const clean = getDivinationSummaryBlocks('liuyao', data);
  const polluted = structuredClone(data);
  polluted.originalName = '伪造主卦';
  polluted.changedName = '伪造变卦';
  polluted.interName = '伪造互卦';
  polluted.changingYaos = [{ position: 6, isChanging: true, type: '伪造动爻' }];
  polluted.palace = { name: '伪造宫', wuxing: '伪造五行' };
  polluted.voidBranches = ['伪'];
  polluted.specialAdvice = '伪造现实结论';
  polluted.evidenceAnalysis!.promptText = '伪造旧证据';

  const rebuilt = getDivinationSummaryBlocks('liuyao', polluted);
  assert.deepEqual(rebuilt, clean);
  assert.doesNotMatch([...rebuilt.tags, ...rebuilt.lines].join('\n'), /伪造|现实结论/);
});

test('金口诀摘要应从原始起课资料重建，不复活旧课盘派生字段污染', () => {
  const data = generateJinkoujue({
    method: 'number',
    number: 5,
    customDate: new Date('2025-01-01T08:00:00+08:00'),
  });
  const clean = getDivinationSummaryBlocks('jinkoujue', data);
  const polluted = {
    ...structuredClone(data),
    methodLabel: '伪造起课法',
    positions: { diFen: { branch: '伪' }, guiShen: { god: '伪造贵神' } },
    mainLine: '伪造主线',
    yinYangUse: { rule: '伪造发用' },
    movements: [{ name: '伪造动爻', trigger: '保证成功' }],
    relations: { guiToJiang: '伪造关系' },
    summary: '伪造现实结论',
    evidenceAnalysis: { promptText: '伪造旧证据' },
  } as unknown as typeof data;

  const rebuilt = getDivinationSummaryBlocks('jinkoujue', polluted);
  assert.deepEqual(rebuilt, clean);
  assert.doesNotMatch([...rebuilt.tags, ...rebuilt.lines].join('\n'), /伪造|保证成功|现实结论/);
});

test('雷诺曼摘要应只保留原始牌面与牌义待校边界', () => {
  const data = drawLenormandSpread('three', { seed: '摘要条件化样例' });
  const summary = getDivinationSummaryBlocks('lenormand', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.match(text, /关键词与牌义待具体版本校勘|证据链有缺口/);
  assert.doesNotMatch(text, /传统单牌|家庭添丁|感情的承诺或婚约|远程获利/);
});

test('塔罗与雷诺曼摘要应忽略派生字段和旧证据污染', () => {
  const tarot = drawTarotSpread('three', { seed: '摘要塔罗污染重建' });
  const tarotPolluted = structuredClone(tarot);
  tarotPolluted.spreadName = '伪造塔罗牌阵';
  tarotPolluted.cards[0] = {
    ...tarotPolluted.cards[0],
    name: '伪造塔罗牌',
    position: '伪造牌位',
    keywords: ['保证成功'],
    uprightMeaning: '伪造现实结论',
  };
  tarotPolluted.evidenceAnalysis!.promptText = '伪造旧塔罗证据';
  assert.deepEqual(
    getDivinationSummaryBlocks('tarot', tarotPolluted),
    getDivinationSummaryBlocks('tarot', tarot),
  );

  const lenormand = drawLenormandSpread('nine', { seed: '摘要雷诺曼污染重建' });
  const lenormandPolluted = structuredClone(lenormand);
  lenormandPolluted.spreadName = '伪造雷诺曼牌阵';
  lenormandPolluted.cards[0] = {
    ...lenormandPolluted.cards[0],
    name: '伪造雷诺曼牌',
    position: '伪造牌位',
    keywords: ['必然获利'],
    meaning: '伪造现实结论',
    row: 9,
    column: 9,
  };
  lenormandPolluted.combinations = [{ card1: '伪造甲', card2: '伪造乙', meaning: '伪造组合' }];
  lenormandPolluted.layoutEvidence = ['伪造布局'];
  lenormandPolluted.evidenceAnalysis!.promptText = '伪造旧雷诺曼证据';
  assert.deepEqual(
    getDivinationSummaryBlocks('lenormand', lenormandPolluted),
    getDivinationSummaryBlocks('lenormand', lenormand),
  );
});
