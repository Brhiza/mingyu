import assert from 'node:assert/strict';
import test from 'node:test';
import { jinkoujue, analyzeJinkoujueRelations } from '../src/systems/jinkoujue';
import { taiyi, analyzeTaiyiRelations } from '../src/systems/taiyi';
import { calculateXiaoliuren, analyzeXiaoliurenRelations } from '../src/systems/xiaoliuren';
import { calculateTarot, analyzeTarotRelations } from '../src/systems/tarot';
import { calculateLenormand, analyzeLenormandRelations } from '../src/systems/lenormand';
import { chineseName } from '../src/systems/chinese-name';
import { chineseNaming, evaluateNamingHomophonePenalty } from '../src/systems/chinese-naming';

const NOW = '2026-06-15T08:00:00.000Z';

test('金口诀：输出【四位生克与主客制衡关系】覆盖上下递生/克战链、主客偏向与用爻旺衰空亡', async () => {
  const res = await jinkoujue(
    {
      question: '问近期合作推进是否顺利',
      divinationTime: '2026-06-15T04:00:00.000Z',
      jinkoujue: { method: 'branch', branch: '申' },
    },
    NOW,
  );
  assert.match(res.prompt.text, /【四位生克与主客制衡关系】/);
  assert.match(res.prompt.text, /上下递生与克战链：/);
  assert.match(res.prompt.text, /主客体用制衡：/);
  assert.match(res.prompt.text, /用爻旺衰与空亡受制：/);

  if ('positions' in res.data) {
    const rel = analyzeJinkoujueRelations(res.data);
    assert.equal(rel.verticalPairs.length, 3);
    assert.equal(rel.verticalPairs[0].upper, '人元');
    assert.equal(rel.verticalPairs[0].lower, '贵神');
    assert.equal(rel.verticalPairs[1].upper, '贵神');
    assert.equal(rel.verticalPairs[1].lower, '将神');
    assert.equal(rel.verticalPairs[2].upper, '将神');
    assert.equal(rel.verticalPairs[2].lower, '地分');
    assert.equal(rel.usePosition, res.data.yinYangUse.usePosition);
  } else {
    assert.fail('单课应返回完整课盘');
  }
});

test('太乙神数：输出【主客算与将神制衡关系】覆盖主客算力对比、格象叠加与受迫助势条件', async () => {
  const yearRes = await taiyi(
    {
      question: '问本年大势攻守格局',
      taiyi: { scope: 'year', year: 2026 },
    },
    NOW,
  );
  assert.match(yearRes.prompt.text, /【主客算与将神制衡关系】/);
  assert.match(yearRes.prompt.text, /主客算力对比：/);
  assert.match(yearRes.prompt.text, /将神落宫与中宫状态：/);
  assert.match(yearRes.prompt.text, /格象叠加：/);
  assert.match(yearRes.prompt.text, /受迫与助势条件：.*三门.*阴阳和/);

  const dayRes = await taiyi(
    {
      question: '问当日行动主客强弱',
      taiyi: { scope: 'day', date: '2026-06-15T04:00:00.000Z' },
    },
    NOW,
  );
  assert.match(dayRes.prompt.text, /【主客算与将神制衡关系】/);
  assert.match(dayRes.prompt.text, /二目五行与日纳音：/);

  if ('chart' in dayRes.data) {
    const rel = analyzeTaiyiRelations(dayRes.data.chart as Parameters<typeof analyzeTaiyiRelations>[0]);
    assert.equal(rel.diff, dayRes.data.chart.lordCount - dayRes.data.chart.guestCount);
    assert.equal(rel.fiveGeneralsLaunched, dayRes.data.chart.conditions.fiveGenerals.launched);
  }
});

test('小六壬：三宫递进与体用制衡关系精准分类，三数起课清晰标注起课数', () => {
  // 连环递生 + 全程顺畅：大安(木,吉) → 速喜(火,吉) → 留连(土,迟滞) => 先顺后阻 + 连环递生
  const chain1 = analyzeXiaoliurenRelations({ month: '大安', day: '速喜', hour: '留连', hourBranch: '午' });
  assert.equal(chain1.trend, '先顺后阻');
  assert.match(chain1.chainFlow, /连环递生/);
  assert.equal(chain1.tiYongCode, '用生体'); // 午火生留连土

  // 先阻后通 + 体用比和：空亡(土,凶阻) → 赤口(金,凶阻) → 小吉(水,吉)，子时(水)
  const chain2 = analyzeXiaoliurenRelations({ month: '空亡', day: '赤口', hour: '小吉', hourBranch: '子' });
  assert.equal(chain2.trend, '先阻后通');
  assert.match(chain2.chainFlow, /连环递生/); // 土生金、金生水
  assert.equal(chain2.tiYongCode, '体用比和');

  // 中段波折、末宫复通 + 用克体：大安(木,吉) → 赤口(金,凶阻) → 大安(木,吉)，申时(金)
  const chain3 = analyzeXiaoliurenRelations({ month: '大安', day: '赤口', hour: '大安', hourBranch: '申' });
  assert.equal(chain3.trend, '中段波折、末宫复通');
  assert.equal(chain3.tiYongCode, '用克体');
  assert.ok(chain3.repeats.some((r) => r.includes('初/末同落大安')));

  const numRes = calculateXiaoliuren(
    {
      question: '问近期出行是否顺利',
      divinationTime: '2026-06-15T04:00:00.000Z',
      xiaoliuren: { numbers: [1, 3, 2] },
    },
    NOW,
  );
  assert.match(numRes.prompt.text, /起课方式：三数起课（1、3、2）/);
  assert.match(numRes.prompt.text, /【三宫递进与体用制衡关系】/);
  assert.match(numRes.prompt.text, /三宫递进走势：/);
  assert.match(numRes.prompt.text, /三宫五行传递：/);
  assert.match(numRes.prompt.text, /体用制衡：/);
});

test('塔罗：输出【牌阵结构与牌间呼应关系】覆盖元素失衡、大阿卡纳占比、正逆张力与首尾演变', () => {
  // 2 张火元素（权杖王牌#23、权杖二#24）+ 1 张大阿卡纳（愚者#1），正-逆-正
  const mixed = calculateTarot(
    {
      question: '问近期项目推进状态',
      tarot: {
        spread: 'three',
        manualCards: [
          { id: 23, reversed: false },
          { id: 24, reversed: true },
          { id: 1, reversed: false },
        ],
      },
    },
    NOW,
  );
  assert.match(mixed.prompt.text, /【牌阵结构与牌间呼应关系】/);
  assert.match(mixed.prompt.text, /元素分布与失衡：.*主导：火（各 2 张）；缺失：水、风、土/);
  assert.match(mixed.prompt.text, /牌阶与大阿卡纳占比：大阿卡纳 1\/3 张（33%/);
  assert.match(mixed.prompt.text, /正逆位张力：正位 2 张、逆位 1 张.*相邻正逆切换 2 次/);
  assert.match(mixed.prompt.text, /首尾演变：.*正位起手→正位收束/);

  const majorOnly = calculateTarot(
    {
      question: '问阶段核心课题',
      tarot: {
        deckScope: 'major',
        spread: 'three',
        manualCards: [
          { id: 1, reversed: true },
          { id: 2, reversed: true },
          { id: 3, reversed: true },
        ],
      },
    },
    NOW,
  );
  const rel = analyzeTarotRelations(majorOnly.data.cards);
  assert.equal(rel.majorCount, 3);
  assert.equal(rel.majorRatio, 100);
  assert.equal(rel.reversedCount, 3);
  assert.match(rel.text, /全为大阿卡纳/);
  assert.match(rel.text, /全逆位/);
});

test('雷诺曼：修复大桌宫位编号错用 card.id 的 bug，并输出【牌阵结构与牌间呼应关系】', () => {
  // 倒序 36 张牌：第 1 宫（骑士宫）落入 #36 十字架
  const reversedIds = Array.from({ length: 36 }, (_, i) => 36 - i);
  const grand = calculateLenormand(
    {
      question: '问整体局势与人物关系',
      lenormand: { spread: 'grandTableau', manualCardIds: reversedIds },
    },
    NOW,
  );
  assert.match(grand.prompt.text, /十字架（#36）[\s\S]*落第1宫（骑士宫）/, '第1宫落牌必须标为落第1宫，不能误标为落第36宫');
  assert.doesNotMatch(grand.prompt.text, /落第36宫（骑士宫）/);
  assert.match(grand.prompt.text, /【牌阵结构与牌间呼应关系】/);
  assert.match(grand.prompt.text, /核心人物指示牌：.*女士落第8宫.*男士落第9宫/);

  // 三牌阵：太阳(#31 顺畅) + 云(#6 阻滞) + 星星(#16 顺畅)
  const three = calculateLenormand(
    {
      question: '问合作进展',
      lenormand: { spread: 'three', manualCardIds: [31, 6, 16] },
    },
    NOW,
  );
  const rel = analyzeLenormandRelations('three', three.data.cards, three.data.combinations);
  assert.equal(rel.positiveCount, 2);
  assert.equal(rel.challengingCount, 1);
  assert.equal(rel.valenceTilt, '顺畅占优');
  assert.match(three.prompt.text, /【牌阵结构与牌间呼应关系】/);
  assert.match(three.prompt.text, /镜像呼应：首尾镜像：太阳↔星星（同向增益）/);
});

test('姓名学：修复多音姓氏谐音判定，并输出【音形义与三才喜忌制衡关系】', async () => {
  // 多音姓氏读音谐音判定：曾(zēng) 与 增(zēng) 完全同音 -50，与 层(céng) 无冲突 0
  assert.equal(evaluateNamingHomophonePenalty('zēng', 'zēng'), -50);
  assert.equal(evaluateNamingHomophonePenalty('zēng', 'céng'), 0);
  assert.equal(evaluateNamingHomophonePenalty('shàn', 'shān'), -30);

  // 单名分析（带出生资料）
  const nameRes = await chineseName({
    fullName: '曾增安',
    birth: { year: 1995, month: 6, day: 15, clock: { kind: 'exact', hour: 10, minute: 0, second: 0 }, timezone: 8 },
    question: '分析该姓名的音形义与三才喜忌配合',
  });
  assert.match(nameRes.prompt.text, /【音形义与三才喜忌制衡关系】/);
  assert.match(nameRes.prompt.text, /三才五格流通：/);
  assert.match(nameRes.prompt.text, /音形义与谐音检查：.*曾增（完全同音 zēng）/);
  assert.match(nameRes.prompt.text, /喜忌五行制衡：.*涉忌神冲突：/);

  // 起名推荐（带出生资料 + 50 候选仍保持紧凑）
  const namingRes = await chineseNaming({
    surname: '曾',
    birth: { year: 1995, month: 6, day: 15, clock: { kind: 'exact', hour: 10, minute: 0, second: 0 }, timezone: 8 },
    limit: 50,
    question: '为新生儿推荐合适名字',
  });
  assert.match(namingRes.prompt.text, /【音形义与三才喜忌制衡关系】/);
  assert.match(namingRes.prompt.text, /三才流通统计：/);
  assert.match(namingRes.prompt.text, /音形义与谐音检查：/);
  assert.match(namingRes.prompt.text, /喜忌五行制衡：/);
  assert.match(namingRes.prompt.text, /前列候选制衡速览：/);
  assert.ok(namingRes.prompt.text.length < 30000, `50 候选提示词应保持紧凑，实际长度 ${namingRes.prompt.text.length}`);
});
