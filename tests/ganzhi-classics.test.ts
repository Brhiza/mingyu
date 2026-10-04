import * as relationTables from '../packages/core/src/ganzhi/relations.ts';
import { describeGanZhi } from '../packages/core/src/ganzhi/index.ts';
import { getNayin, getNayinWuxing } from '../packages/core/src/ganzhi/index.ts';
import { NAYIN_MAP } from '../packages/core/src/ganzhi/data.ts';
import { TIME_MAP } from '../packages/core/src/bazi/baziDisplayData.ts';
import { SEASON_STATUS } from '../packages/core/src/bazi/baziElementData.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getStemWuxing, getBranchWuxing, isLiuhe } from '../packages/core/src/ganzhi/index.ts';
import { isValidGanZhi } from '../packages/core/src/ganzhi/validation.ts';
import {
  BRANCH_HIDDEN_STEMS,
  getHiddenMainStem,
  SANXING_MAP,
  isSanxing,
  isLiuchong,
  isLiuhai,
} from '../packages/core/src/ganzhi/relations.ts';

test('十二支递刑方向与星历考原一致，相刑关系与六冲六害覆盖全部配对', () => {
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const punishments = [...'卯戌巳子辰申午丑寅酉未亥'];
  const clashes = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
  const harms = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
  for (let i = 0; i < branches.length; i++) {
    const a = branches[i];
    assert.equal(SANXING_MAP[a], punishments[i]);
    for (let j = 0; j < branches.length; j++) {
      const b = branches[j];
      assert.equal(isSanxing(a, b), punishments[i] === b || punishments[j] === a, `${a}${b}刑`);
      assert.equal(
        isLiuchong(a, b),
        clashes.includes(a + b) || clashes.includes(b + a),
        `${a}${b}冲`,
      );
      assert.equal(isLiuhai(a, b), harms.includes(a + b) || harms.includes(b + a), `${a}${b}害`);
    }
  }

  const captureRelations = () => ({
    profiles: [describeGanZhi('甲子'), describeGanZhi('甲寅')],
    season: relationTables.getSeasonState('水', '子'),
    sanhe: relationTables.isCompleteSanhe(['申', '子', '辰']),
    halfSanhe: relationTables.isHalfSanhe(['申', '子']),
    sanhui: relationTables.isCompleteSanhui(['亥', '子', '丑']),
    sheng: relationTables.isSheng('水', '木'),
    ke: relationTables.isKe('水', '火'),
    liuhe: relationTables.isLiuhe('子', '丑'),
    liuchong: relationTables.isLiuchong('子', '午'),
    liuhai: relationTables.isLiuhai('子', '未'),
    liupo: relationTables.isLiupo('子', '酉'),
    tianganHe: relationTables.isTianGanHe('甲', '己'),
  });
  const baselineRelations = structuredClone(captureRelations());
  assert.equal(baselineRelations.profiles[0].branch.wuxing, '水');
  assert.deepEqual(baselineRelations.profiles[0].branch.hiddenStems, ['癸']);
  assert.deepEqual(baselineRelations.profiles[0].branch.sanhe?.partners, ['申', '辰']);
  assert.equal(baselineRelations.profiles[0].stem.combine, '己');
  assert.equal(baselineRelations.season, '旺');
  assert.equal(baselineRelations.sanhe, '水局');
  assert.equal(baselineRelations.sanhui, '北方水');
  const edits = [
    [relationTables.BRANCH_WUXING, '子', '木'],
    [relationTables.MONTH_LING_WUXING, '子', '木'],
    [relationTables.LIUHE_MAP, '子', '未'],
    [relationTables.LIUHE_WUXING, '子', '木'],
    [relationTables.SANHE_GROUPS.水局, 0, '卯'],
    [relationTables.BRANCH_SANHE.子.partners, 0, '卯'],
    [relationTables.SANHUI_GROUPS.北方水, 0, '巳'],
    [relationTables.LIUHAI_MAP, '子', '丑'],
    [relationTables.LIUCHONG_MAP, '子', '丑'],
    [relationTables.LIUPO_MAP, '子', '丑'],
    [relationTables.ANHE_MAP, '寅', '辰'],
    [relationTables.SANXING_MAP, '子', '辰'],
    [relationTables.BRANCH_SANXING.子, 0, '辰'],
    [relationTables.BRANCH_HIDDEN_STEMS.子, 0, '壬'],
    [relationTables.TIAN_GAN_HE.甲, 'partner', '乙'],
    [relationTables.TIAN_GAN_CHONG, '甲', '乙'],
    [relationTables.SHENG_MAP, '水', '土'],
    [relationTables.KE_MAP, '水', '木'],
  ] as const;
  const saved = edits.map(([target, key]) => Reflect.get(target, key));
  try {
    for (const [target, key, value] of edits) {
      assert.equal(Reflect.set(target, key, value), true);
      assert.equal(Reflect.get(target, key), value);
    }
    assert.deepEqual(captureRelations(), baselineRelations);
  } finally {
    edits.forEach(([target, key], index) => Reflect.set(target, key, saved[index]));
  }
  assert.deepEqual(captureRelations(), baselineRelations);
});

test('十二支藏干集合与选择天镜支神藏干表一致，主气单独核验', () => {
  const rows = [
    ['子', '癸', '癸'],
    ['丑', '己癸辛', '己'],
    ['寅', '丙戊甲', '甲'],
    ['卯', '乙', '乙'],
    ['辰', '乙癸戊', '戊'],
    ['巳', '丙戊庚', '丙'],
    ['午', '丁己', '丁'],
    ['未', '乙己丁', '己'],
    ['申', '戊庚壬', '庚'],
    ['酉', '辛', '辛'],
    ['戌', '辛丁戊', '戊'],
    ['亥', '壬甲', '壬'],
  ];
  for (const [branch, stems, main] of rows) {
    assert.deepEqual([...BRANCH_HIDDEN_STEMS[branch]].sort(), [...stems].sort(), branch);
    assert.equal(getHiddenMainStem(branch), main, `${branch}主气`);
  }
});

test('干支五行与六合逐项对应《渊海子平》基础表', () => {
  assert.deepEqual(
    TIME_MAP.map(({ index, name, range, hour, minute }) => [index, name, range, hour, minute]),
    [
      [0, '早子时', '00:00-01:00', 0, 30],
      [1, '丑时', '01:00-03:00', 2, 0],
      [2, '寅时', '03:00-05:00', 4, 0],
      [3, '卯时', '05:00-07:00', 6, 0],
      [4, '辰时', '07:00-09:00', 8, 0],
      [5, '巳时', '09:00-11:00', 10, 0],
      [6, '午时', '11:00-13:00', 12, 0],
      [7, '未时', '13:00-15:00', 14, 0],
      [8, '申时', '15:00-17:00', 16, 0],
      [9, '酉时', '17:00-19:00', 18, 0],
      [10, '戌时', '19:00-21:00', 20, 0],
      [11, '亥时', '21:00-23:00', 22, 0],
      [12, '晚子时', '23:00-24:00', 23, 30],
    ],
  );
  assert.deepEqual(SEASON_STATUS, {
    寅: { 木: '旺', 火: '相', 土: '死', 金: '囚', 水: '休' },
    卯: { 木: '旺', 火: '相', 土: '死', 金: '囚', 水: '休' },
    辰: { 土: '旺', 金: '相', 水: '死', 木: '囚', 火: '休' },
    巳: { 火: '旺', 土: '相', 金: '死', 水: '囚', 木: '休' },
    午: { 火: '旺', 土: '相', 金: '死', 水: '囚', 木: '休' },
    未: { 土: '旺', 金: '相', 水: '死', 木: '囚', 火: '休' },
    申: { 金: '旺', 水: '相', 木: '死', 火: '囚', 土: '休' },
    酉: { 金: '旺', 水: '相', 木: '死', 火: '囚', 土: '休' },
    戌: { 土: '旺', 金: '相', 水: '死', 木: '囚', 火: '休' },
    亥: { 水: '旺', 木: '相', 火: '死', 土: '囚', 金: '休' },
    子: { 水: '旺', 木: '相', 火: '死', 土: '囚', 金: '休' },
    丑: { 土: '旺', 金: '相', 水: '死', 木: '囚', 火: '休' },
  });
  const groups = {
    木: '甲乙寅卯',
    火: '丙丁巳午',
    土: '戊己辰戌丑未',
    金: '庚辛申酉',
    水: '壬癸亥子',
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  for (const [element, characters] of Object.entries(groups))
    for (const character of characters) {
      assert.equal(
        stems.includes(character) ? getStemWuxing(character) : getBranchWuxing(character),
        element,
      );
    }
  const pairs = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
  for (const a of branches)
    for (const b of branches) {
      assert.equal(isLiuhe(a, b), pairs.includes(a + b) || pairs.includes(b + a), a + b);
    }
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 12; j++) {
      const expected = i % 2 === j % 2;
      assert.equal(isValidGanZhi(stems[i] + branches[j]), expected);
    }
});

test('六十甲子纳音五行逐对符合《碎金》乾象篇', () => {
  const pairs =
    '甲子乙丑 丙寅丁卯 戊辰己巳 庚午辛未 壬申癸酉 甲戌乙亥 丙子丁丑 戊寅己卯 庚辰辛巳 壬午癸未 甲申乙酉 丙戌丁亥 戊子己丑 庚寅辛卯 壬辰癸巳 甲午乙未 丙申丁酉 戊戌己亥 庚子辛丑 壬寅癸卯 甲辰乙巳 丙午丁未 戊申己酉 庚戌辛亥 壬子癸丑 甲寅乙卯 丙辰丁巳 戊午己未 庚申辛酉 壬戌癸亥'.split(
      ' ',
    );
  const elements = [...'金火木土金火水土金木水土火木水金火木土金火水土金木水土火木水'];
  const names =
    '海中金 炉中火 大林木 路旁土 剑锋金 山头火 涧下水 城头土 白蜡金 杨柳木 泉中水 屋上土 霹雳火 松柏木 长流水 沙中金 山下火 平地木 壁上土 金箔金 覆灯火 天河水 大驿土 钗钏金 桑柘木 大溪水 沙中土 天上火 石榴木 大海水'.split(
      ' ',
    );
  assert.equal(pairs.length, 30);
  assert.equal(elements.length, 30);
  const covered = new Set<string>();
  pairs.forEach((pair, index) => {
    for (const ganZhi of [pair.slice(0, 2), pair.slice(2)]) {
      assert.equal(getNayin(ganZhi), names[index], ganZhi);
      assert.equal(NAYIN_MAP[ganZhi], names[index]);
      assert.equal(getNayinWuxing(ganZhi), elements[index], ganZhi);
      assert.equal(NAYIN_MAP[ganZhi].slice(-1), elements[index], `${ganZhi}备用表`);
      covered.add(ganZhi);
    }
  });
  assert.equal(covered.size, 60);
  assert.equal(Object.keys(NAYIN_MAP).length, 60);
});
