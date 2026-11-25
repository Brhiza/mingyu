import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import {
  analyzeZiweiPatternRelations,
  detectZiweiPatterns,
  formatZiweiPatternRelations,
  type ZiweiPatternPalace,
  type ZiweiPatternStar,
} from '../src/systems/ziwei-patterns';
import { arrangeJiuGongGe, checkSpecialHourConditions } from '../src/systems/qimen/layout';
import {
  analyzeQimenPatternRelations,
  formatQimenPatternRelations,
  getQimenPatternTags,
} from '../src/systems/qimen/patterns';
import type { QimenData } from '../src/systems/qimen/types';

const BRANCHES = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'] as const;
const PALACE_NAMES = [
  '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
  '迁移', '仆役', '官禄', '田宅', '福德', '父母',
] as const;

const zStar = (name: string, extra?: Partial<ZiweiPatternStar>): ZiweiPatternStar => ({
  name,
  ...extra,
});

function makeZiweiPalaces(
  soulIndex = 0,
  overrides: Record<number, Partial<ZiweiPatternPalace>> = {},
): ZiweiPatternPalace[] {
  return Array.from({ length: 12 }, (_, index) => {
    const nameIndex = (soulIndex - index + 12) % 12;
    const base: ZiweiPatternPalace = {
      index,
      name: PALACE_NAMES[nameIndex],
      isBodyPalace: index === soulIndex,
      earthlyBranch: BRANCHES[index],
      majorStars: [],
      minorStars: [],
      adjectiveStars: [],
    };
    return { ...base, ...overrides[index] };
  });
}

test('紫微修复：火贵格三合本宫见煞不成立，火铃夹命归为凶格', () => {
  // 火贵格：命宫（0）坐擎羊时，三合三宫已见凶杀，不应命中火贵格
  const blockedAtSoul = makeZiweiPalaces(0, {
    0: { minorStars: [zStar('擎羊')] },
    4: { majorStars: [zStar('贪狼')] },
    8: { minorStars: [zStar('火星')] },
  });
  assert.ok(!detectZiweiPatterns(blockedAtSoul).some((p) => p.id === 'huo-gui'));

  // 三合三宫皆无羊陀铃时命中火贵格
  const cleanHuoGui = makeZiweiPalaces(0, {
    4: { majorStars: [zStar('贪狼')] },
    8: { minorStars: [zStar('火星')] },
  });
  assert.ok(detectZiweiPatterns(cleanHuoGui).some((p) => p.id === 'huo-gui'));

  // 火铃夹命归为凶格
  const huoLing = makeZiweiPalaces(2, {
    1: { minorStars: [zStar('火星')] },
    3: { minorStars: [zStar('铃星')] },
  });
  const hit = detectZiweiPatterns(huoLing).find((p) => p.id === 'huo-ling-jia-ming');
  assert.ok(hit);
  assert.equal(hit.kind, 'inauspicious');
});

test('紫微格局互制：吉格叠加协同与火贪/杀破狼叠双禄辅弼', () => {
  // 命在午宫（index 4）：贪狼旺 + 火星庙（贪火相逢）+ 七杀/破军在三方（杀破狼）+ 双禄 + 辅弼
  const palaces = makeZiweiPalaces(4, {
    4: {
      majorStars: [zStar('贪狼', { brightness: '旺', mutagen: '禄' })],
      minorStars: [zStar('火星', { brightness: '庙' }), zStar('禄存'), zStar('左辅')],
    },
    8: {
      majorStars: [zStar('七杀', { brightness: '庙', mutagen: '权' })],
      minorStars: [zStar('右弼')],
    },
    0: {
      majorStars: [zStar('破军', { brightness: '得' })],
      minorStars: [zStar('文昌', { mutagen: '科' })],
    },
  });
  const patterns = detectZiweiPatterns(palaces);
  const relations = analyzeZiweiPatternRelations(palaces, patterns);
  assert.ok(relations.synergies.some((line) => line.includes('贪火相逢')));
  assert.ok(relations.synergies.some((line) => line.includes('杀破狼')));
  assert.ok(relations.synergies.some((line) => line.includes('双禄会照')));
  assert.ok(relations.synergies.some((line) => line.includes('辅弼齐会')));
  assert.ok(relations.synergies.some((line) => line.includes('三奇加会')));
  // 贪火相逢本身不把成格要件火星误报为破格因子
  assert.equal(relations.damagedAuspicious.length, 0);
});

test('紫微格局互制：吉格受破警示（同宫空劫/化忌 + 夹宫煞夹）', () => {
  // 命在寅（0）：紫府同宫，但命宫同见地空、廉贞化忌，且邻宫地空地劫夹命
  const palaces = makeZiweiPalaces(0, {
    0: {
      majorStars: [zStar('紫微', { brightness: '旺' }), zStar('天府', { brightness: '庙' })],
      minorStars: [zStar('地空')],
      adjectiveStars: [zStar('廉贞', { mutagen: '忌' })],
    },
    11: { minorStars: [zStar('地空')] },
    1: { minorStars: [zStar('地劫')] },
  });
  const patterns = detectZiweiPatterns(palaces);
  const relations = analyzeZiweiPatternRelations(palaces, patterns);
  const damaged = relations.damagedAuspicious.find((item) => item.patternId === 'ziwei-tianfu-tonggong');
  assert.ok(damaged);
  assert.equal(damaged.status, '成中有破');
  assert.ok(damaged.breakers.some((b) => b.includes('地空') && b.includes('廉贞化忌')));
  assert.ok(damaged.breakers.some((b) => b.includes('空劫夹命')));
});

test('紫微格局互制：凶格与日月反背/落陷格救应链（有救可转 vs 原局无明救）', () => {
  // 有救：日月反背（太阳戌8、太阴辰2，命在戌8）+ 命宫太阳陷，但三方四正见化禄、禄存、左辅
  const rescuedPalaces = makeZiweiPalaces(8, {
    8: {
      majorStars: [zStar('太阳', { brightness: '陷' })],
      minorStars: [zStar('禄存')],
    },
    2: {
      majorStars: [zStar('太阴', { brightness: '陷', mutagen: '禄' })],
    },
    0: {
      minorStars: [zStar('左辅')],
    },
  });
  const rescuedRel = analyzeZiweiPatternRelations(rescuedPalaces, detectZiweiPatterns(rescuedPalaces));
  const reverseItem = rescuedRel.inauspiciousRescues.find((item) => item.targetName.includes('日月反背'));
  assert.ok(reverseItem);
  assert.equal(reverseItem.status, '有救可转');
  assert.ok(reverseItem.rescues.some((r) => r.includes('太阴化禄')));
  assert.ok(reverseItem.rescues.some((r) => r.includes('禄存')));

  // 原局无明救：空劫夹命 + 破军陷（一生孤贫），三方四正无吉化/禄存/辅弼魁钺
  const unrescuedPalaces = makeZiweiPalaces(2, {
    1: { minorStars: [zStar('地空')] },
    2: { majorStars: [zStar('破军', { brightness: '陷' })] },
    3: { minorStars: [zStar('地劫')] },
  });
  const unrescuedPatterns = detectZiweiPatterns(unrescuedPalaces);
  const unrescuedText = formatZiweiPatternRelations(unrescuedPalaces, unrescuedPatterns);
  assert.match(unrescuedText, /空劫夹命（凶格）→ 原局无明救/);
  assert.match(unrescuedText, /一生孤贫（凶格）→ 原局无明救/);
});

test('紫微真实命盘提示词原生输出【格局叠合与成败制衡关系】且 reprompt 一致', async () => {
  const input = {
    question: '分析本命格局成败制衡',
    birth: {
      year: 1990,
      month: 5,
      day: 15,
      clock: { kind: 'exact', hour: 14, minute: 30, second: 0 },
      timezone: 8,
    },
    gender: 'female',
  } as const;
  const result = await calculate('ziwei', input);
  assert.match(result.prompt.text, /【本命格局】/);
  assert.match(result.prompt.text, /【格局叠合与成败制衡关系】/);
  assert.match(result.prompt.text, /吉格叠加协同：/);
  assert.match(result.prompt.text, /凶格\/落陷格救应链：/);

  const saved = JSON.parse(JSON.stringify(result));
  const followed = await reprompt({ method: 'ziwei', result: saved, question: '分析本命格局成败制衡' });
  assert.equal(followed.prompt.text, result.prompt.text);
});

test('奇门修复：时干入墓（戊戌/己丑）与阳遁寄艮八宫星伏吟/星反吟判定准确', () => {
  // 戊戌入乾6墓、己丑入艮8墓；戊辰不再误判时干入墓
  const wuXu = checkSpecialHourConditions('戊戌', '甲子');
  assert.equal(wuXu.isShiGanRuMu, true);
  assert.match(wuXu.description, /戊戌，戊入6宫/);

  const jiChou = checkSpecialHourConditions('己丑', '甲子');
  assert.equal(jiChou.isShiGanRuMu, true);
  assert.match(jiChou.description, /己丑，己入8宫/);

  const wuChen = checkSpecialHourConditions('戊辰', '甲子');
  assert.equal(wuChen.isShiGanRuMu, false);

  // 阳遁寄艮八宫（yang-gen8-yin-kun2）：星伏吟（天禽随天任落艮8宫）
  // 阳遁1局甲子戊时：值符天蓬在1宫，天盘九星归原位，天禽随天任寄艮8宫
  const fuyinBoard = arrangeJiuGongGe(true, 1, '天蓬', '休门', { hour: '甲子' }, 'zhuanpan', 'yang-gen8-yin-kun2');
  const fuyinTags = getQimenPatternTags({
    zhiFu: '天蓬',
    zhiShi: '休门',
    zhiFuLandingPalace: 1,
    zhiShiLandingPalace: 1,
    jiuGongGe: fuyinBoard,
    activeGanForFind: '戊',
    activeGanLabel: '时干',
  });
  assert.ok(fuyinTags.includes('星伏吟'), `预期识别星伏吟，实际：${fuyinTags.join('、')}`);
  assert.ok(fuyinTags.includes('门伏吟'));

  // 阳遁寄艮八宫：星反吟（阳遁1局戊落离9，天蓬落离9，天任+天禽落坤2）
  // 阳遁1局地盘：1戊 2己 3庚 4辛 5壬 6癸 7丁 8丙 9乙；时干乙（乙丑）时天蓬落离9宫
  const fanyinBoard = arrangeJiuGongGe(true, 1, '天蓬', '休门', { hour: '乙丑' }, 'zhuanpan', 'yang-gen8-yin-kun2');
  const fanyinTags = getQimenPatternTags({
    zhiFu: '天蓬',
    zhiShi: '休门',
    zhiFuLandingPalace: 9,
    zhiShiLandingPalace: 2,
    jiuGongGe: fanyinBoard,
    activeGanForFind: '乙',
    activeGanLabel: '时干',
  });
  assert.ok(fanyinTags.includes('星反吟'), `预期识别星反吟，实际：${fanyinTags.join('、')}`);
});

test('奇门格局互制：吉格折损/反凶、吉格逢空、凶格救应通关与全局约束', () => {
  const mockData: QimenData = {
    timezoneOffsetMinutes: 480,
    method: 'zhuanpan',
    scope: 'hour',
    juMethod: 'chaibu',
    timeInfo: { solarTerm: '冬至', epoch: '上元' },
    ganzhi: { year: '甲辰', month: '丙子', day: '甲子', hour: '庚午' },
    isYangDun: true,
    juShu: 1,
    zhiFu: '天蓬',
    zhiShi: '休门',
    patternTags: ['星伏吟', '门伏吟', '门迫（震三宫开门）', '击刑（时干戊落震三宫）'],
    voidBranches: ['戌', '亥'],
    voidPalaces: [{ branch: '戌', palace: 6, name: '乾六宫' }],
    specialConditions: {
      isLiuJiaHour: false,
      isLiuGuiHour: false,
      isShiGanRuMu: false,
      isWuBuYuShi: true,
      description: '五不遇时（日干甲遇时干庚克日干），事多不顺，不宜举事；',
    },
    jiuGongGe: [
      { gong: 1, name: '坎一宫', direction: '正北', element: '水', tianPan: { star: '天蓬', stem: '乙' }, diPan: { stem: '辛' }, renPan: { door: '休门' }, shenPan: { god: '值符' } },
      { gong: 2, name: '坤二宫', direction: '西南', element: '土', tianPan: { star: '天芮', stem: '辛' }, diPan: { stem: '乙' }, renPan: { door: '死门' }, shenPan: { god: '白虎' } },
      { gong: 3, name: '震三宫', direction: '正东', element: '木', tianPan: { star: '天冲', stem: '戊' }, diPan: { stem: '丙' }, renPan: { door: '开门' }, shenPan: { god: '六合' } },
      { gong: 4, name: '巽四宫', direction: '东南', element: '木', tianPan: { star: '天辅', stem: '丁' }, diPan: { stem: '己' }, renPan: { door: '杜门' }, shenPan: { god: '太阴' } },
      { gong: 5, name: '中五宫', direction: '中央', element: '土', tianPan: { star: '', stem: '' }, diPan: { stem: '壬' }, renPan: { door: '' }, shenPan: { god: '' } },
      { gong: 6, name: '乾六宫', direction: '西北', element: '金', tianPan: { star: '天心', stem: '丙' }, diPan: { stem: '戊' }, renPan: { door: '生门' }, shenPan: { god: '九天' } },
      { gong: 7, name: '兑七宫', direction: '正西', element: '金', tianPan: { star: '天柱', stem: '庚' }, diPan: { stem: '癸' }, renPan: { door: '惊门' }, shenPan: { god: '玄武' } },
      { gong: 8, name: '艮八宫', direction: '东北', element: '土', tianPan: { star: '天任', stem: '己' }, diPan: { stem: '丁' }, renPan: { door: '景门' }, shenPan: { god: '九地' } },
      { gong: 9, name: '离九宫', direction: '正南', element: '火', tianPan: { star: '天英', stem: '癸' }, diPan: { stem: '庚' }, renPan: { door: '伤门' }, shenPan: { god: '螣蛇' } },
    ],
    classicPatterns: [
      { name: '青龙返首', type: 'good', summary: '戊加丙', palaces: [3] },
      { name: '戊击刑', type: 'bad', summary: '戊落震三宫击刑', palaces: [3] },
      { name: '门迫', type: 'bad', summary: '开门克震三宫', palaces: [3] },
      { name: '飞鸟跌穴', type: 'good', summary: '丙加戊', palaces: [6] },
      { name: '青龙逃走', type: 'bad', summary: '乙加辛', palaces: [1] },
      { name: '白虎猖狂', type: 'bad', summary: '辛加乙', palaces: [2] },
    ],
    timestamp: Date.parse('2025-01-01T00:00:00Z'),
  };

  const relations = analyzeQimenPatternRelations(mockData);
  // 震三宫：青龙返首 + 戊击刑 + 门迫 -> 吉格折损/反凶
  const zhen = relations.damagedGoodPalaces.find((item) => item.gong === 3);
  assert.ok(zhen);
  assert.equal(zhen.verdict, '吉格折损/反凶');
  assert.ok(zhen.goodPatterns.includes('青龙返首'));
  assert.ok(zhen.negativeFactors.some((f) => f.includes('戊击刑')));
  assert.ok(zhen.negativeFactors.some((f) => f.includes('门迫')));

  // 乾六宫：飞鸟跌穴仅遇空亡 -> 吉格逢空（待填实/冲空）
  const qian = relations.damagedGoodPalaces.find((item) => item.gong === 6);
  assert.ok(qian);
  assert.equal(qian.verdict, '吉格逢空（待填实/冲空）');
  assert.ok(qian.negativeFactors.some((f) => f.includes('空亡')));

  // 坎一宫：青龙逃走得休门、天盘乙奇、值符神护持 -> 有救应
  const kan = relations.badRescuePalaces.find((item) => item.gong === 1);
  assert.ok(kan);
  assert.equal(kan.hasRescue, true);
  assert.ok(kan.rescueFactors.includes('吉门休门'));
  assert.ok(kan.rescueFactors.includes('天盘乙奇'));
  assert.ok(kan.rescueFactors.includes('值符神护持'));

  // 坤二宫：白虎猖狂配死门、白虎，无吉门/三奇/宫生门/值符 -> 无明救
  const kun = relations.badRescuePalaces.find((item) => item.gong === 2);
  assert.ok(kun);
  assert.equal(kun.hasRescue, false);

  // 全局约束：五不遇时 + 星伏吟/门伏吟
  assert.ok(relations.globalConstraints.some((c) => c.includes('五不遇时')));
  assert.ok(relations.globalConstraints.some((c) => c.includes('星伏吟') && c.includes('门伏吟')));

  const text = formatQimenPatternRelations(mockData);
  assert.match(text, /吉格折损\/反凶检查：/);
  assert.match(text, /凶格救应\/通关检查：/);
  assert.match(text, /全局约束：/);
});

test('奇门真实起局提示词原生输出【格局叠加与吉凶制衡关系】且 reprompt 一致', async () => {
  const input = {
    question: '此次合作能否推进',
    currentTime: '2025-01-01T00:00:00Z',
    qimen: { scope: 'hour', method: 'zhuanpan', juMethod: 'chaibu' },
  } as const;
  const result = await calculate('qimen', input);
  assert.match(result.prompt.text, /【格局叠加与吉凶制衡关系】/);
  assert.match(result.prompt.text, /吉格折损\/反凶检查：/);
  assert.match(result.prompt.text, /凶格救应\/通关检查：/);
  assert.match(result.prompt.text, /全局约束：/);

  const saved = JSON.parse(JSON.stringify(result));
  const followed = await reprompt({
    method: 'qimen',
    result: saved,
    question: '此次合作能否推进',
    currentTime: '2025-01-01T00:00:00Z',
  });
  assert.equal(followed.prompt.text, result.prompt.text);
});
