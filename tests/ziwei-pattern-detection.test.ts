import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { detectPatterns } from '../packages/core/src/ziwei/iztro/pattern-detection.ts';
import type { PalaceFact, StarFact } from '../packages/core/src/types/analysis.ts';

const branches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

function star(name: string, birthMutagen?: StarFact['birth_mutagen']): StarFact {
  return {
    name,
    kind: 'major',
    scope: 'origin',
    birth_mutagen: birthMutagen,
  };
}

function createPalaces(mingBranch: string, mingStars: StarFact[]): PalaceFact[] {
  const mingIndex = branches.indexOf(mingBranch);
  if (mingIndex < 0) {
    throw new Error(`未知地支：${mingBranch}`);
  }

  return branches.map((branch, index) => {
    const isMing = index === mingIndex;
    const oppositeIndex = (index + 6) % 12;
    const surroundedIndexes = Array.from(
      new Set([index, oppositeIndex, (index + 4) % 12, (index + 8) % 12]),
    );

    return {
      index,
      name: isMing ? '命宫' : `宫${index}`,
      is_body_palace: false,
      is_original_palace: false,
      heavenly_stem: '',
      earthly_branch: branch,
      major_stars: isMing ? mingStars : [],
      minor_stars: [],
      other_stars: [],
      scope_stars: [],
      changsheng12: '',
      boshi12: '',
      base_jiangqian12: '',
      base_suiqian12: '',
      decadal_range: [0, 0],
      ages: [],
      scope_hits: [],
      empty_state: mingStars.length === 0,
      opposite_palace_index: oppositeIndex,
      surrounded_palace_indexes: surroundedIndexes,
      summary_tags: [],
    };
  });
}

test('紫微格局：按实际地支和昼夜判断月朗天门和日照雷门，不依赖宫位数字索引', () => {
  const yueLang = detectPatterns({ palaces: createPalaces('亥', [star('太阴')]) });
  assert.ok(yueLang.some((item) => item.name === '月朗天门'));

  const wrongYueLang = detectPatterns({ palaces: createPalaces('丑', [star('太阴')]) });
  assert.equal(
    wrongYueLang.some((item) => item.name === '月朗天门'),
    false,
  );

  const riZhaoMao = detectPatterns({
    palaces: createPalaces('卯', [star('太阳')]),
    birthTimeLabel: '午时',
  });
  assert.ok(riZhaoMao.some((item) => item.name === '日照雷门'));

  const riZhaoChen = detectPatterns({
    palaces: createPalaces('辰', [star('太阳')]),
    birthTimeLabel: '卯时',
  });
  assert.ok(riZhaoChen.some((item) => item.name === '日照雷门'));

  const riZhaoZiByRange = detectPatterns({
    palaces: createPalaces('子', [star('太阳')]),
    birthTimeRange: '09:00-10:59',
  });
  assert.ok(riZhaoZiByRange.some((item) => item.name === '日照雷门'));

  const nightRiZhao = detectPatterns({
    palaces: createPalaces('卯', [star('太阳')]),
    birthTimeLabel: '酉时',
  });
  assert.equal(
    nightRiZhao.some((item) => item.name === '日照雷门'),
    false,
  );

  const unknownTimeRiZhao = detectPatterns({ palaces: createPalaces('卯', [star('太阳')]) });
  assert.equal(
    unknownTimeRiZhao.some((item) => item.name === '日照雷门'),
    false,
  );

  const wrongRiZhao = detectPatterns({
    palaces: createPalaces('巳', [star('太阳')]),
    birthTimeLabel: '午时',
  });
  assert.equal(
    wrongRiZhao.some((item) => item.name === '日照雷门'),
    false,
  );
});

test('紫微格局：金灿光辉日出扶桑月生沧海按古籍限定宫位判断', () => {
  const jinCan = createPalaces('午', [star('太阳')]);
  jinCan[4].minor_stars.push(star('文昌'));
  assert.ok(detectPatterns({ palaces: jinCan }).some((item) => item.name === '金灿光辉'));

  const notSingleSun = createPalaces('午', [star('太阳'), star('天梁')]);
  assert.equal(
    detectPatterns({ palaces: notSingleSun }).some((item) => item.name === '金灿光辉'),
    false,
  );

  const fuSangMing = createPalaces('卯', [star('太阳')]);
  assert.ok(detectPatterns({ palaces: fuSangMing }).some((item) => item.name === '日出扶桑'));

  const fuSangGuanLu = createPalaces('寅', []);
  fuSangGuanLu[1].name = '官禄';
  fuSangGuanLu[1].major_stars.push(star('太阳'));
  assert.ok(detectPatterns({ palaces: fuSangGuanLu }).some((item) => item.name === '日出扶桑'));

  const wrongFuSangBranch = createPalaces('辰', [star('太阳')]);
  assert.equal(
    detectPatterns({ palaces: wrongFuSangBranch }).some((item) => item.name === '日出扶桑'),
    false,
  );

  const cangHai = createPalaces('寅', []);
  cangHai[10].name = '田宅';
  cangHai[10].major_stars.push(star('太阴'));
  assert.ok(detectPatterns({ palaces: cangHai }).some((item) => item.name === '月生沧海'));

  const wrongCangHaiBranch = createPalaces('寅', []);
  wrongCangHaiBranch[9].name = '田宅';
  wrongCangHaiBranch[9].major_stars.push(star('太阴'));
  assert.equal(
    detectPatterns({ palaces: wrongCangHaiBranch }).some((item) => item.name === '月生沧海'),
    false,
  );
});

test('紫微格局：水澄桂萼按太阴子宫守命判断', () => {
  const shuiChengGuiE = createPalaces('子', [star('太阴')]);
  assert.ok(detectPatterns({ palaces: shuiChengGuiE }).some((item) => item.name === '水澄桂萼'));

  const wrongBranch = createPalaces('亥', [star('太阴')]);
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name === '水澄桂萼'),
    false,
  );
});

test('紫微格局：魁钺同行按天魁天钺同守命宫判断', () => {
  const kuiYueTongXing = createPalaces('辰', [star('天魁'), star('天钺')]);
  assert.ok(detectPatterns({ palaces: kuiYueTongXing }).some((item) => item.name === '魁钺同行'));

  const kuiYueJiaMing = createPalaces('辰', []);
  kuiYueJiaMing[1].minor_stars.push(star('天魁'));
  kuiYueJiaMing[3].minor_stars.push(star('天钺'));
  assert.equal(
    detectPatterns({ palaces: kuiYueJiaMing }).some((item) => item.name === '魁钺同行'),
    false,
  );
});

test('紫微格局：天梁居午按天梁午宫守命判断', () => {
  const tianLiangJuWu = createPalaces('午', [star('天梁')]);
  assert.ok(detectPatterns({ palaces: tianLiangJuWu }).some((item) => item.name === '天梁居午'));

  const wrongBranch = createPalaces('子', [star('天梁')]);
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name === '天梁居午'),
    false,
  );
});

test('紫微格局：玉袖天香按文昌文曲同居福德宫判断', () => {
  const yuXiuTianXiang = createPalaces('寅', []);
  yuXiuTianXiang[4].name = '福德';
  yuXiuTianXiang[4].minor_stars.push(star('文昌'), star('文曲'));
  assert.ok(detectPatterns({ palaces: yuXiuTianXiang }).some((item) => item.name === '玉袖天香'));

  const missingWenQu = createPalaces('寅', []);
  missingWenQu[4].name = '福德';
  missingWenQu[4].minor_stars.push(star('文昌'));
  assert.equal(
    detectPatterns({ palaces: missingWenQu }).some((item) => item.name === '玉袖天香'),
    false,
  );

  const changQuInMing = createPalaces('寅', [star('文昌'), star('文曲')]);
  assert.equal(
    detectPatterns({ palaces: changQuInMing }).some((item) => item.name === '玉袖天香'),
    false,
  );
});

test('紫微格局：皇殿朝班按太阳文昌同居官禄宫判断', () => {
  const huangDianChaoBan = createPalaces('寅', []);
  huangDianChaoBan[4].name = '官禄';
  huangDianChaoBan[4].major_stars.push(star('太阳'));
  huangDianChaoBan[4].minor_stars.push(star('文昌'));
  assert.ok(
    detectPatterns({ palaces: huangDianChaoBan }).some((item) => item.name === '皇殿朝班'),
  );

  const missingWenChang = createPalaces('寅', []);
  missingWenChang[4].name = '官禄';
  missingWenChang[4].major_stars.push(star('太阳'));
  assert.equal(
    detectPatterns({ palaces: missingWenChang }).some((item) => item.name === '皇殿朝班'),
    false,
  );

  const inMing = createPalaces('寅', [star('太阳'), star('文昌')]);
  assert.equal(
    detectPatterns({ palaces: inMing }).some((item) => item.name === '皇殿朝班'),
    false,
  );
});

test('紫微格局：财居财位按武曲守财帛且不坐空亡判断', () => {
  const caiJuCaiWei = createPalaces('寅', []);
  caiJuCaiWei[4].name = '财帛';
  caiJuCaiWei[4].major_stars.push(star('武曲'));
  assert.ok(detectPatterns({ palaces: caiJuCaiWei }).some((item) => item.name === '财居财位'));

  const wuQuInMing = createPalaces('寅', [star('武曲')]);
  assert.equal(
    detectPatterns({ palaces: wuQuInMing }).some((item) => item.name === '财居财位'),
    false,
  );

  const sitsVoid = createPalaces('寅', []);
  sitsVoid[4].name = '财帛';
  sitsVoid[4].major_stars.push(star('武曲'));
  sitsVoid[4].other_stars.push(star('空亡'));
  assert.equal(
    detectPatterns({ palaces: sitsVoid }).some((item) => item.name === '财居财位'),
    false,
  );
});

test('紫微格局：左辅文昌按左辅文昌同守命宫判断', () => {
  const zuoFuWenChang = createPalaces('寅', [star('左辅'), star('文昌')]);
  assert.ok(detectPatterns({ palaces: zuoFuWenChang }).some((item) => item.name === '左辅文昌'));

  const separated = createPalaces('寅', [star('左辅')]);
  separated[4].minor_stars.push(star('文昌'));
  assert.equal(
    detectPatterns({ palaces: separated }).some((item) => item.name === '左辅文昌'),
    false,
  );
});

test('紫微格局：文昌武曲按文昌武曲同在命宫或身宫判断', () => {
  const mingWenChangWuQu = createPalaces('寅', [star('文昌'), star('武曲')]);
  assert.ok(
    detectPatterns({ palaces: mingWenChangWuQu }).some((item) => item.name === '文昌武曲'),
  );

  const shenWenChangWuQu = createPalaces('寅', []);
  shenWenChangWuQu[4].is_body_palace = true;
  shenWenChangWuQu[4].major_stars.push(star('文昌'), star('武曲'));
  assert.ok(
    detectPatterns({ palaces: shenWenChangWuQu }).some((item) => item.name === '文昌武曲'),
  );

  const separated = createPalaces('寅', [star('文昌')]);
  separated[4].major_stars.push(star('武曲'));
  assert.equal(
    detectPatterns({ palaces: separated }).some((item) => item.name === '文昌武曲'),
    false,
  );
});

test('紫微格局：蟾宫折桂按太阴同昌曲居夫妻宫判断', () => {
  const wenQuInSpouse = createPalaces('寅', []);
  wenQuInSpouse[4].name = '夫妻';
  wenQuInSpouse[4].major_stars.push(star('太阴'));
  wenQuInSpouse[4].minor_stars.push(star('文曲'));
  assert.ok(detectPatterns({ palaces: wenQuInSpouse }).some((item) => item.name === '蟾宫折桂'));

  const wenChangInSpouse = createPalaces('寅', []);
  wenChangInSpouse[4].name = '夫妻';
  wenChangInSpouse[4].major_stars.push(star('太阴'));
  wenChangInSpouse[4].minor_stars.push(star('文昌'));
  assert.ok(detectPatterns({ palaces: wenChangInSpouse }).some((item) => item.name === '蟾宫折桂'));

  const inMing = createPalaces('寅', [star('太阴'), star('文曲')]);
  assert.equal(
    detectPatterns({ palaces: inMing }).some((item) => item.name === '蟾宫折桂'),
    false,
  );

  const missingTaiYin = createPalaces('寅', []);
  missingTaiYin[4].name = '夫妻';
  missingTaiYin[4].minor_stars.push(star('文曲'));
  assert.equal(
    detectPatterns({ palaces: missingTaiYin }).some((item) => item.name === '蟾宫折桂'),
    false,
  );
});

test('紫微格局：泛水桃花按贪狼遇羊陀居亥子命宫判断', () => {
  const yangAtHai = createPalaces('亥', [star('贪狼'), star('擎羊')]);
  assert.ok(detectPatterns({ palaces: yangAtHai }).some((item) => item.name === '泛水桃花'));

  const tuoAtZi = createPalaces('子', [star('贪狼'), star('陀罗')]);
  assert.ok(detectPatterns({ palaces: tuoAtZi }).some((item) => item.name === '泛水桃花'));

  const wrongBranch = createPalaces('寅', [star('贪狼'), star('擎羊')]);
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name === '泛水桃花'),
    false,
  );

  const missingSha = createPalaces('亥', [star('贪狼')]);
  assert.equal(
    detectPatterns({ palaces: missingSha }).some((item) => item.name === '泛水桃花'),
    false,
  );
});

test('紫微格局：廉杀巳亥按廉贞七杀同守巳亥命宫判断', () => {
  const lianShaAtSi = createPalaces('巳', [star('廉贞'), star('七杀')]);
  assert.ok(detectPatterns({ palaces: lianShaAtSi }).some((item) => item.name === '廉杀巳亥'));

  const wrongBranch = createPalaces('申', [star('廉贞'), star('七杀')]);
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name === '廉杀巳亥'),
    false,
  );

  const miaoWang = createPalaces('巳', [
    { ...star('廉贞'), brightness: '庙' },
    { ...star('七杀'), brightness: '旺' },
  ]);
  assert.equal(
    detectPatterns({ palaces: miaoWang }).some((item) => item.name === '廉杀巳亥'),
    false,
  );
});

test('紫微格局：曲遇梁星按天梁文曲同守命宫且庙旺判断', () => {
  const quYuLiang = createPalaces('寅', [
    { ...star('天梁'), brightness: '庙' },
    { ...star('文曲'), brightness: '旺' },
  ]);
  assert.ok(detectPatterns({ palaces: quYuLiang }).some((item) => item.name === '曲遇梁星'));

  const missingBrightness = createPalaces('寅', [star('天梁'), star('文曲')]);
  assert.equal(
    detectPatterns({ palaces: missingBrightness }).some((item) => item.name === '曲遇梁星'),
    false,
  );

  const wenChangInstead = createPalaces('寅', [
    { ...star('天梁'), brightness: '庙' },
    { ...star('文昌'), brightness: '旺' },
  ]);
  assert.equal(
    detectPatterns({ palaces: wenChangInstead }).some((item) => item.name === '曲遇梁星'),
    false,
  );
});

test('紫微格局：机月同梁只按寅申命宫三方四正判断', () => {
  const jiYueYin = createPalaces('寅', [star('天同')]);
  jiYueYin[4].major_stars.push(star('天机'));
  jiYueYin[6].major_stars.push(star('太阴'));
  jiYueYin[8].major_stars.push(star('天梁'));
  assert.ok(detectPatterns({ palaces: jiYueYin }).some((item) => item.name === '机月同梁'));

  const jiYueShen = createPalaces('申', [star('太阴')]);
  jiYueShen[0].major_stars.push(star('天机'));
  jiYueShen[2].major_stars.push(star('天同'));
  jiYueShen[10].major_stars.push(star('天梁'));
  assert.ok(detectPatterns({ palaces: jiYueShen }).some((item) => item.name === '机月同梁'));

  const jiYueWrongBranch = createPalaces('辰', [star('天同')]);
  jiYueWrongBranch[6].major_stars.push(star('太阴'));
  jiYueWrongBranch[8].major_stars.push(star('天机'));
  jiYueWrongBranch[10].major_stars.push(star('天梁'));
  assert.equal(
    detectPatterns({ palaces: jiYueWrongBranch }).some((item) => item.name === '机月同梁'),
    false,
  );
});

test('紫微格局：禄马交驰只按禄存与天马判断，不用化禄代替禄存', () => {
  const onlyHuaLuAndMa = createPalaces('寅', [star('天机', '禄')]);
  onlyHuaLuAndMa[4].minor_stars.push(star('天马'));
  assert.equal(
    detectPatterns({ palaces: onlyHuaLuAndMa }).some((item) => item.name === '禄马交驰'),
    false,
  );

  const luCunAndMa = createPalaces('寅', []);
  luCunAndMa[4].minor_stars.push(star('禄存'));
  luCunAndMa[6].minor_stars.push(star('天马'));
  assert.ok(detectPatterns({ palaces: luCunAndMa }).some((item) => item.name === '禄马交驰'));
});

test('紫微格局：财禄夹马按天马守命武曲禄存前后夹命判断', () => {
  const caiLuJiaMa = createPalaces('丑', [star('天马')]);
  caiLuJiaMa[10].major_stars.push(star('武曲'));
  caiLuJiaMa[0].minor_stars.push(star('禄存'));
  assert.ok(detectPatterns({ palaces: caiLuJiaMa }).some((item) => item.name === '财禄夹马'));

  const caiLuReverse = createPalaces('丑', [star('天马')]);
  caiLuReverse[10].minor_stars.push(star('禄存'));
  caiLuReverse[0].major_stars.push(star('武曲'));
  assert.ok(detectPatterns({ palaces: caiLuReverse }).some((item) => item.name === '财禄夹马'));

  const caiLuSameSide = createPalaces('丑', [star('天马')]);
  caiLuSameSide[0].major_stars.push(star('武曲'));
  caiLuSameSide[0].minor_stars.push(star('禄存'));
  assert.equal(
    detectPatterns({ palaces: caiLuSameSide }).some((item) => item.name === '财禄夹马'),
    false,
  );
});

test('紫微格局：阳梁昌禄只按禄存判断，不用化禄代替禄存', () => {
  const onlyHuaLu = createPalaces('寅', [star('天机', '禄')]);
  onlyHuaLu[4].major_stars.push(star('太阳'));
  onlyHuaLu[6].major_stars.push(star('天梁'));
  onlyHuaLu[8].minor_stars.push(star('文昌'));
  assert.equal(
    detectPatterns({ palaces: onlyHuaLu }).some((item) => item.name === '阳梁昌禄'),
    false,
  );

  const withLuCun = createPalaces('寅', []);
  withLuCun[4].major_stars.push(star('太阳'));
  withLuCun[6].major_stars.push(star('天梁'));
  withLuCun[8].minor_stars.push(star('文昌'));
  withLuCun[8].minor_stars.push(star('禄存'));
  assert.ok(detectPatterns({ palaces: withLuCun }).some((item) => item.name === '阳梁昌禄'));
});

test('紫微格局：财荫夹印按武曲天梁夹命宫或田宅宫判断', () => {
  const mingJiaYin = createPalaces('寅', [star('天相')]);
  mingJiaYin[11].major_stars.push(star('武曲'));
  mingJiaYin[1].major_stars.push(star('天梁'));
  assert.ok(detectPatterns({ palaces: mingJiaYin }).some((item) => item.name === '财荫夹印'));

  const tianZhaiJiaYin = createPalaces('寅', []);
  tianZhaiJiaYin[4].name = '田宅';
  tianZhaiJiaYin[4].major_stars.push(star('天相'));
  tianZhaiJiaYin[3].major_stars.push(star('天梁'));
  tianZhaiJiaYin[5].major_stars.push(star('武曲'));
  assert.ok(
    detectPatterns({ palaces: tianZhaiJiaYin }).some((item) => item.name === '财荫夹印'),
  );

  const tianFuJiaYin = createPalaces('寅', [star('天相')]);
  tianFuJiaYin[11].major_stars.push(star('天府'));
  tianFuJiaYin[1].major_stars.push(star('天梁'));
  assert.equal(
    detectPatterns({ palaces: tianFuJiaYin }).some((item) => item.name === '财荫夹印'),
    false,
  );
});

test('紫微格局：日月夹财按武曲守命宫或财帛宫日月前后夹判断', () => {
  const mingJiaCai = createPalaces('丑', [star('武曲')]);
  mingJiaCai[10].major_stars.push(star('太阳'));
  mingJiaCai[0].major_stars.push(star('太阴'));
  assert.ok(detectPatterns({ palaces: mingJiaCai }).some((item) => item.name === '日月夹财'));

  const caiBoJiaCai = createPalaces('寅', []);
  caiBoJiaCai[4].name = '财帛';
  caiBoJiaCai[4].major_stars.push(star('天府'));
  caiBoJiaCai[3].major_stars.push(star('太阴'));
  caiBoJiaCai[5].major_stars.push(star('太阳'));
  assert.ok(detectPatterns({ palaces: caiBoJiaCai }).some((item) => item.name === '日月夹财'));

  const sameSideSunMoon = createPalaces('丑', [star('武曲')]);
  sameSideSunMoon[0].major_stars.push(star('太阳'), star('太阴'));
  assert.equal(
    detectPatterns({ palaces: sameSideSunMoon }).some((item) => item.name === '日月夹财'),
    false,
  );
});

test('紫微格局：日月夹命按日月前后夹命且命宫有吉不坐空亡判断', () => {
  const riYueJiaMing = createPalaces('丑', [star('禄存')]);
  riYueJiaMing[10].major_stars.push(star('太阳'));
  riYueJiaMing[0].major_stars.push(star('太阴'));
  assert.ok(detectPatterns({ palaces: riYueJiaMing }).some((item) => item.name === '日月夹命'));

  const noJiXing = createPalaces('丑', []);
  noJiXing[10].major_stars.push(star('太阳'));
  noJiXing[0].major_stars.push(star('太阴'));
  assert.equal(
    detectPatterns({ palaces: noJiXing }).some((item) => item.name === '日月夹命'),
    false,
  );

  const mingSitsVoid = createPalaces('丑', [star('天魁')]);
  mingSitsVoid[10].major_stars.push(star('太阳'));
  mingSitsVoid[0].major_stars.push(star('太阴'));
  mingSitsVoid[11].other_stars.push(star('空亡'));
  assert.equal(
    detectPatterns({ palaces: mingSitsVoid }).some((item) => item.name === '日月夹命'),
    false,
  );

  const sameSideSunMoon = createPalaces('丑', [star('天魁')]);
  sameSideSunMoon[0].major_stars.push(star('太阳'), star('太阴'));
  assert.equal(
    detectPatterns({ palaces: sameSideSunMoon }).some((item) => item.name === '日月夹命'),
    false,
  );
});

test('紫微格局：日月照璧按太阳太阴同临田宅宫判断', () => {
  const riYueZhaoBi = createPalaces('寅', []);
  riYueZhaoBi[11].name = '田宅';
  riYueZhaoBi[11].major_stars.push(star('太阳'), star('太阴'));
  assert.ok(detectPatterns({ palaces: riYueZhaoBi }).some((item) => item.name === '日月照璧'));

  const onlySunInTianZhai = createPalaces('寅', []);
  onlySunInTianZhai[11].name = '田宅';
  onlySunInTianZhai[11].major_stars.push(star('太阳'));
  assert.equal(
    detectPatterns({ palaces: onlySunInTianZhai }).some((item) => item.name === '日月照璧'),
    false,
  );

  const sunMoonInOtherPalace = createPalaces('寅', [star('太阳'), star('太阴')]);
  assert.equal(
    detectPatterns({ palaces: sunMoonInOtherPalace }).some((item) => item.name === '日月照璧'),
    false,
  );
});

test('紫微格局：荫印拱身按身宫临田宅且梁相拱冲、不坐空亡判断', () => {
  const yinYinGongShen = createPalaces('寅', []);
  yinYinGongShen[4].name = '田宅';
  yinYinGongShen[4].is_body_palace = true;
  yinYinGongShen[8].major_stars.push(star('天梁'));
  yinYinGongShen[10].major_stars.push(star('天相'));
  assert.ok(
    detectPatterns({ palaces: yinYinGongShen }).some((item) => item.name === '荫印拱身'),
  );

  const bodyNotTianZhai = createPalaces('寅', []);
  bodyNotTianZhai[4].is_body_palace = true;
  bodyNotTianZhai[8].major_stars.push(star('天梁'));
  bodyNotTianZhai[10].major_stars.push(star('天相'));
  assert.equal(
    detectPatterns({ palaces: bodyNotTianZhai }).some((item) => item.name === '荫印拱身'),
    false,
  );

  const shenSitsVoid = createPalaces('寅', []);
  shenSitsVoid[4].name = '田宅';
  shenSitsVoid[4].is_body_palace = true;
  shenSitsVoid[4].other_stars.push(star('空亡'));
  shenSitsVoid[8].major_stars.push(star('天梁'));
  shenSitsVoid[10].major_stars.push(star('天相'));
  assert.equal(
    detectPatterns({ palaces: shenSitsVoid }).some((item) => item.name === '荫印拱身'),
    false,
  );
});

test('紫微格局：财印夹禄按禄存守命宫或财帛宫梁相前后夹判断', () => {
  const mingJiaLu = createPalaces('丑', [star('禄存')]);
  mingJiaLu[10].major_stars.push(star('天梁'));
  mingJiaLu[0].major_stars.push(star('天相'));
  assert.ok(detectPatterns({ palaces: mingJiaLu }).some((item) => item.name === '财印夹禄'));

  const caiBoJiaLu = createPalaces('寅', []);
  caiBoJiaLu[4].name = '财帛';
  caiBoJiaLu[4].minor_stars.push(star('禄存'));
  caiBoJiaLu[3].major_stars.push(star('天相'));
  caiBoJiaLu[5].major_stars.push(star('天梁'));
  assert.ok(detectPatterns({ palaces: caiBoJiaLu }).some((item) => item.name === '财印夹禄'));

  const sameSideLiangXiang = createPalaces('丑', [star('禄存')]);
  sameSideLiangXiang[0].major_stars.push(star('天梁'), star('天相'));
  assert.equal(
    detectPatterns({ palaces: sameSideLiangXiang }).some((item) => item.name === '财印夹禄'),
    false,
  );

  const huaLuInstead = createPalaces('丑', [star('天机', '禄')]);
  huaLuInstead[10].major_stars.push(star('天梁'));
  huaLuInstead[0].major_stars.push(star('天相'));
  assert.equal(
    detectPatterns({ palaces: huaLuInstead }).some((item) => item.name === '财印夹禄'),
    false,
  );
});

test('紫微格局：对面朝斗按子午命宫逢禄存判断', () => {
  const ziLuCun = createPalaces('子', [star('禄存')]);
  assert.ok(detectPatterns({ palaces: ziLuCun }).some((item) => item.name === '对面朝斗'));

  const wuLuCun = createPalaces('午', [star('禄存')]);
  assert.ok(detectPatterns({ palaces: wuLuCun }).some((item) => item.name === '对面朝斗'));

  const maoLuCun = createPalaces('卯', [star('禄存')]);
  assert.equal(
    detectPatterns({ palaces: maoLuCun }).some((item) => item.name === '对面朝斗'),
    false,
  );

  const ziWithoutLuCun = createPalaces('子', []);
  assert.equal(
    detectPatterns({ palaces: ziWithoutLuCun }).some((item) => item.name === '对面朝斗'),
    false,
  );
});

test('紫微格局：兼文武按文曲武曲同在命宫或身宫判断', () => {
  const mingWenWu = createPalaces('寅', [star('武曲'), star('文曲')]);
  assert.ok(detectPatterns({ palaces: mingWenWu }).some((item) => item.name === '兼文武'));

  const shenWenWu = createPalaces('寅', []);
  shenWenWu[3].is_body_palace = true;
  shenWenWu[3].major_stars.push(star('武曲'));
  shenWenWu[3].minor_stars.push(star('文曲'));
  assert.ok(detectPatterns({ palaces: shenWenWu }).some((item) => item.name === '兼文武'));

  const separatedWenWu = createPalaces('寅', [star('武曲')]);
  separatedWenWu[3].is_body_palace = true;
  separatedWenWu[3].minor_stars.push(star('文曲'));
  assert.equal(
    detectPatterns({ palaces: separatedWenWu }).some((item) => item.name === '兼文武'),
    false,
  );
});

test('紫微格局：禄马佩印按马前禄存天相同宫判断', () => {
  const luMaPeiYin = createPalaces('寅', []);
  luMaPeiYin[4].minor_stars.push(star('天马'));
  luMaPeiYin[5].minor_stars.push(star('禄存'));
  luMaPeiYin[5].major_stars.push(star('天相'));
  assert.ok(detectPatterns({ palaces: luMaPeiYin }).some((item) => item.name === '禄马佩印'));

  const luYinBehindMa = createPalaces('寅', []);
  luYinBehindMa[4].minor_stars.push(star('天马'));
  luYinBehindMa[3].minor_stars.push(star('禄存'));
  luYinBehindMa[3].major_stars.push(star('天相'));
  assert.equal(
    detectPatterns({ palaces: luYinBehindMa }).some((item) => item.name === '禄马佩印'),
    false,
  );

  const luYinNotSamePalace = createPalaces('寅', []);
  luYinNotSamePalace[4].minor_stars.push(star('天马'));
  luYinNotSamePalace[5].minor_stars.push(star('禄存'));
  luYinNotSamePalace[6].major_stars.push(star('天相'));
  assert.equal(
    detectPatterns({ palaces: luYinNotSamePalace }).some((item) => item.name === '禄马佩印'),
    false,
  );
});

test('紫微格局：贪火相逢按火星贪狼同守命宫且同居庙旺判断', () => {
  const tanHuoMiaoWang = createPalaces('寅', [
    { ...star('贪狼'), brightness: '庙' },
    { ...star('火星'), brightness: '旺' },
  ]);
  assert.ok(detectPatterns({ palaces: tanHuoMiaoWang }).some((item) => item.name === '贪火相逢'));

  const huoTanSanFang = createPalaces('寅', []);
  huoTanSanFang[4].major_stars.push({ ...star('贪狼'), brightness: '庙' });
  huoTanSanFang[4].minor_stars.push({ ...star('火星'), brightness: '旺' });
  assert.equal(
    detectPatterns({ palaces: huoTanSanFang }).some((item) => item.name === '贪火相逢'),
    false,
  );

  const tanHuoXian = createPalaces('寅', [
    { ...star('贪狼'), brightness: '庙' },
    { ...star('火星'), brightness: '陷' },
  ]);
  assert.equal(
    detectPatterns({ palaces: tanHuoXian }).some((item) => item.name === '贪火相逢'),
    false,
  );
});

test('紫微格局：权禄生逢按生年化权化禄同守命宫且庙旺判断', () => {
  const quanLuMiaoWang = createPalaces('寅', [
    { ...star('天机', '禄'), brightness: '庙' },
    { ...star('武曲', '权'), brightness: '旺' },
  ]);
  assert.ok(detectPatterns({ palaces: quanLuMiaoWang }).some((item) => item.name === '权禄生逢'));

  const quanLuSanFang = createPalaces('寅', [{ ...star('天机', '禄'), brightness: '庙' }]);
  quanLuSanFang[4].major_stars.push({ ...star('武曲', '权'), brightness: '旺' });
  assert.equal(
    detectPatterns({ palaces: quanLuSanFang }).some((item) => item.name === '权禄生逢'),
    false,
  );

  const quanLuXian = createPalaces('寅', [
    { ...star('天机', '禄'), brightness: '庙' },
    { ...star('武曲', '权'), brightness: '陷' },
  ]);
  assert.equal(
    detectPatterns({ palaces: quanLuXian }).some((item) => item.name === '权禄生逢'),
    false,
  );
});

test('紫微格局：羊刃入庙按辰戌丑未命宫擎羊遇吉判断', () => {
  const yangRenRuMiao = createPalaces('辰', [star('擎羊'), star('天魁')]);
  assert.ok(detectPatterns({ palaces: yangRenRuMiao }).some((item) => item.name === '羊刃入庙'));

  const yangRenWithHuaKe = createPalaces('戌', [star('擎羊'), star('文昌', '科')]);
  assert.ok(detectPatterns({ palaces: yangRenWithHuaKe }).some((item) => item.name === '羊刃入庙'));

  const yangRenNoJi = createPalaces('辰', [star('擎羊')]);
  assert.equal(
    detectPatterns({ palaces: yangRenNoJi }).some((item) => item.name === '羊刃入庙'),
    false,
  );

  const yangRenWrongBranch = createPalaces('子', [star('擎羊'), star('天魁')]);
  assert.equal(
    detectPatterns({ palaces: yangRenWrongBranch }).some((item) => item.name === '羊刃入庙'),
    false,
  );
});

test('紫微格局：左右夹命按左辅右弼前后夹命判断', () => {
  const zuoYouJiaMing = createPalaces('辰', []);
  zuoYouJiaMing[1].minor_stars.push(star('左辅'));
  zuoYouJiaMing[3].minor_stars.push(star('右弼'));
  assert.ok(detectPatterns({ palaces: zuoYouJiaMing }).some((item) => item.name === '左右夹命'));

  const zuoYouReverse = createPalaces('辰', []);
  zuoYouReverse[1].minor_stars.push(star('右弼'));
  zuoYouReverse[3].minor_stars.push(star('左辅'));
  assert.ok(detectPatterns({ palaces: zuoYouReverse }).some((item) => item.name === '左右夹命'));

  const zuoYouSameSide = createPalaces('辰', []);
  zuoYouSameSide[1].minor_stars.push(star('左辅'), star('右弼'));
  assert.equal(
    detectPatterns({ palaces: zuoYouSameSide }).some((item) => item.name === '左右夹命'),
    false,
  );
});

test('紫微格局：仰面朝斗按紫微子午守命且科权禄三方照判断', () => {
  const yangMianChaoDou = createPalaces('子', [star('紫微')]);
  yangMianChaoDou[2].major_stars.push(star('武曲', '科'));
  yangMianChaoDou[4].major_stars.push(star('天机', '禄'));
  yangMianChaoDou[6].major_stars.push(star('太阳', '权'));
  assert.ok(detectPatterns({ palaces: yangMianChaoDou }).some((item) => item.name === '仰面朝斗'));

  const noZiWei = createPalaces('子', []);
  noZiWei[2].major_stars.push(star('武曲', '科'));
  noZiWei[4].major_stars.push(star('天机', '禄'));
  noZiWei[6].major_stars.push(star('太阳', '权'));
  assert.equal(
    detectPatterns({ palaces: noZiWei }).some((item) => item.name === '仰面朝斗'),
    false,
  );

  const wrongBranch = createPalaces('卯', [star('紫微')]);
  wrongBranch[0].major_stars.push(star('武曲', '科'));
  wrongBranch[4].major_stars.push(star('天机', '禄'));
  wrongBranch[8].major_stars.push(star('太阳', '权'));
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name === '仰面朝斗'),
    false,
  );

  const missingHuaKe = createPalaces('午', [star('紫微')]);
  missingHuaKe[0].major_stars.push(star('天机', '禄'));
  missingHuaKe[2].major_stars.push(star('太阳', '权'));
  assert.equal(
    detectPatterns({ palaces: missingHuaKe }).some((item) => item.name === '仰面朝斗'),
    false,
  );
});

test('紫微格局：紫禄同宫按紫微禄存同守命且日月三方照判断', () => {
  const ziLuTongGong = createPalaces('寅', [star('紫微'), star('禄存')]);
  ziLuTongGong[4].major_stars.push(star('太阳'));
  ziLuTongGong[8].major_stars.push(star('太阴'));
  assert.ok(detectPatterns({ palaces: ziLuTongGong }).some((item) => item.name === '紫禄同宫'));

  const noSunMoon = createPalaces('寅', [star('紫微'), star('禄存')]);
  assert.equal(
    detectPatterns({ palaces: noSunMoon }).some((item) => item.name === '紫禄同宫'),
    false,
  );

  const noLuCun = createPalaces('寅', [star('紫微')]);
  noLuCun[4].major_stars.push(star('太阳'));
  noLuCun[8].major_stars.push(star('太阴'));
  assert.equal(
    detectPatterns({ palaces: noLuCun }).some((item) => item.name === '紫禄同宫'),
    false,
  );

  const sunMoonOutsideSanFang = createPalaces('寅', [star('紫微'), star('禄存')]);
  sunMoonOutsideSanFang[1].major_stars.push(star('太阳'));
  sunMoonOutsideSanFang[3].major_stars.push(star('太阴'));
  assert.equal(
    detectPatterns({ palaces: sunMoonOutsideSanFang }).some((item) => item.name === '紫禄同宫'),
    false,
  );
});

test('紫微格局：巨机居卯按天机巨门同守卯宫命判断', () => {
  const juJiJuMao = createPalaces('卯', [star('天机'), star('巨门')]);
  assert.ok(detectPatterns({ palaces: juJiJuMao }).some((item) => item.name === '巨机居卯'));

  const wrongBranch = createPalaces('辰', [star('天机'), star('巨门')]);
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name === '巨机居卯'),
    false,
  );

  const yangRenBreaks = createPalaces('卯', [star('天机'), star('巨门'), star('擎羊')]);
  assert.equal(
    detectPatterns({ palaces: yangRenBreaks }).some((item) => item.name === '巨机居卯'),
    false,
  );
});

test('紫微格局：左右朝垣按左辅右弼三方四正朝命判断', () => {
  const zuoYouChaoYuan = createPalaces('辰', []);
  zuoYouChaoYuan[6].minor_stars.push(star('左辅'));
  zuoYouChaoYuan[10].minor_stars.push(star('右弼'));
  assert.ok(detectPatterns({ palaces: zuoYouChaoYuan }).some((item) => item.name === '左右朝垣'));

  const missingYouBi = createPalaces('辰', []);
  missingYouBi[6].minor_stars.push(star('左辅'));
  assert.equal(
    detectPatterns({ palaces: missingYouBi }).some((item) => item.name === '左右朝垣'),
    false,
  );

  const onlyJiaMing = createPalaces('辰', []);
  onlyJiaMing[1].minor_stars.push(star('左辅'));
  onlyJiaMing[3].minor_stars.push(star('右弼'));
  assert.equal(
    detectPatterns({ palaces: onlyJiaMing }).some((item) => item.name === '左右朝垣'),
    false,
  );
});

test('紫微格局：文星朝命按文昌文曲三方四正朝命判断', () => {
  const wenXingChaoMing = createPalaces('辰', []);
  wenXingChaoMing[6].minor_stars.push(star('文昌'));
  wenXingChaoMing[10].minor_stars.push(star('文曲'));
  assert.ok(detectPatterns({ palaces: wenXingChaoMing }).some((item) => item.name === '文星朝命'));

  const missingWenQu = createPalaces('辰', []);
  missingWenQu[6].minor_stars.push(star('文昌'));
  assert.equal(
    detectPatterns({ palaces: missingWenQu }).some((item) => item.name === '文星朝命'),
    false,
  );

  const onlyJiaMing = createPalaces('辰', []);
  onlyJiaMing[1].minor_stars.push(star('文昌'));
  onlyJiaMing[3].minor_stars.push(star('文曲'));
  assert.equal(
    detectPatterns({ palaces: onlyJiaMing }).some((item) => item.name === '文星朝命'),
    false,
  );
});

test('紫微格局：紫破加吉按紫微破军四墓守命且同宫有吉判断', () => {
  const ziPoJiaJi = createPalaces('辰', [star('紫微'), star('破军'), star('天魁')]);
  assert.ok(detectPatterns({ palaces: ziPoJiaJi }).some((item) => item.name === '紫破加吉'));

  const noJiYao = createPalaces('辰', [star('紫微'), star('破军')]);
  assert.equal(
    detectPatterns({ palaces: noJiYao }).some((item) => item.name === '紫破加吉'),
    false,
  );

  const wrongBranch = createPalaces('子', [star('紫微'), star('破军'), star('天魁')]);
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name === '紫破加吉'),
    false,
  );
});

test('紫微格局：破军子午按破军子午守命且三方四正无四杀判断', () => {
  const poJunZiWu = createPalaces('子', [star('破军')]);
  assert.ok(detectPatterns({ palaces: poJunZiWu }).some((item) => item.name === '破军子午'));

  const wrongBranch = createPalaces('卯', [star('破军')]);
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name === '破军子午'),
    false,
  );

  const withSha = createPalaces('午', [star('破军')]);
  withSha[4].minor_stars.push(star('擎羊'));
  assert.equal(
    detectPatterns({ palaces: withSha }).some((item) => item.name === '破军子午'),
    false,
  );
});

test('紫微格局：雄宿朝元按廉贞申未守命且同宫无四杀判断', () => {
  const lianZhenShen = createPalaces('申', [star('廉贞')]);
  assert.ok(detectPatterns({ palaces: lianZhenShen }).some((item) => item.name === '雄宿朝元'));

  const lianZhenWei = createPalaces('未', [star('廉贞')]);
  assert.ok(detectPatterns({ palaces: lianZhenWei }).some((item) => item.name === '雄宿朝元'));

  const wrongBranch = createPalaces('亥', [star('廉贞')]);
  assert.equal(
    detectPatterns({ palaces: wrongBranch }).some((item) => item.name.includes('雄宿')),
    false,
  );

  const withSha = createPalaces('申', [star('廉贞'), star('擎羊')]);
  assert.equal(
    detectPatterns({ palaces: withSha }).some((item) => item.name === '雄宿朝元'),
    false,
  );
});

test('紫微格局：机梁加吉按天机天梁同守命且同宫有吉判断', () => {
  const jiLiangJiaJi = createPalaces('辰', [star('天机'), star('天梁'), star('天魁')]);
  assert.ok(detectPatterns({ palaces: jiLiangJiaJi }).some((item) => item.name === '机梁加吉'));

  const noJiYao = createPalaces('辰', [star('天机'), star('天梁')]);
  assert.equal(
    detectPatterns({ palaces: noJiYao }).some((item) => item.name === '机梁加吉'),
    false,
  );

  const withJi = createPalaces('辰', [star('天机'), star('天梁'), star('天魁'), star('廉贞', '忌')]);
  assert.equal(
    detectPatterns({ palaces: withJi }).some((item) => item.name === '机梁加吉'),
    false,
  );
});

test('紫微格局：梁昌庙旺按天梁文昌同守命且同居庙旺判断', () => {
  const liangChangMiaoWang = createPalaces('午', [
    { ...star('天梁'), brightness: '庙' },
    { ...star('文昌'), brightness: '旺' },
  ]);
  assert.ok(detectPatterns({ palaces: liangChangMiaoWang }).some((item) => item.name === '梁昌庙旺'));

  const wenChangXian = createPalaces('午', [
    { ...star('天梁'), brightness: '庙' },
    { ...star('文昌'), brightness: '陷' },
  ]);
  assert.equal(
    detectPatterns({ palaces: wenChangXian }).some((item) => item.name === '梁昌庙旺'),
    false,
  );
});

test('紫微格局：廉杀庙旺按廉贞七杀同守命且同居庙旺判断', () => {
  const lianShaMiaoWang = createPalaces('申', [
    { ...star('廉贞'), brightness: '庙' },
    { ...star('七杀'), brightness: '旺' },
  ]);
  assert.ok(detectPatterns({ palaces: lianShaMiaoWang }).some((item) => item.name === '廉杀庙旺'));

  const qiShaXian = createPalaces('申', [
    { ...star('廉贞'), brightness: '庙' },
    { ...star('七杀'), brightness: '陷' },
  ]);
  assert.equal(
    detectPatterns({ palaces: qiShaXian }).some((item) => item.name === '廉杀庙旺'),
    false,
  );
});

test('紫微格局：君臣庆会按紫微左右同守命判断，不用魁钺昌曲替代', () => {
  const ziWeiZuoYou = createPalaces('寅', [star('紫微'), star('左辅'), star('右弼')]);
  assert.ok(detectPatterns({ palaces: ziWeiZuoYou }).some((item) => item.name === '君臣庆会'));

  const kuiYueInstead = createPalaces('寅', [star('紫微')]);
  kuiYueInstead[4].minor_stars.push(star('天魁'));
  kuiYueInstead[8].minor_stars.push(star('天钺'));
  assert.equal(
    detectPatterns({ palaces: kuiYueInstead }).some((item) => item.name === '君臣庆会'),
    false,
  );

  const zuoYouGongZhao = createPalaces('寅', [star('紫微')]);
  zuoYouGongZhao[4].minor_stars.push(star('左辅'));
  zuoYouGongZhao[8].minor_stars.push(star('右弼'));
  assert.equal(
    detectPatterns({ palaces: zuoYouGongZhao }).some((item) => item.name === '君臣庆会'),
    false,
  );
});

test('紫微格局：辅弼拱主按紫微守命左右来拱或夹命判断', () => {
  const gongZhu = createPalaces('寅', [star('紫微')]);
  gongZhu[4].minor_stars.push(star('左辅'));
  gongZhu[8].minor_stars.push(star('右弼'));
  assert.ok(detectPatterns({ palaces: gongZhu }).some((item) => item.name === '辅弼拱主'));

  const jiaMing = createPalaces('寅', [star('紫微')]);
  jiaMing[11].minor_stars.push(star('左辅'));
  jiaMing[1].minor_stars.push(star('右弼'));
  assert.ok(detectPatterns({ palaces: jiaMing }).some((item) => item.name === '辅弼拱主'));

  const tongShouMing = createPalaces('寅', [star('紫微'), star('左辅'), star('右弼')]);
  assert.equal(
    detectPatterns({ palaces: tongShouMing }).some((item) => item.name === '辅弼拱主'),
    false,
  );

  const noZiWei = createPalaces('寅', []);
  noZiWei[4].minor_stars.push(star('左辅'));
  noZiWei[8].minor_stars.push(star('右弼'));
  assert.equal(
    detectPatterns({ palaces: noZiWei }).some((item) => item.name === '辅弼拱主'),
    false,
  );
});

test('紫微格局：魁钺夹命按天魁天钺前后夹命判断', () => {
  const kuiYueJia = createPalaces('辰', []);
  kuiYueJia[1].minor_stars.push(star('天魁'));
  kuiYueJia[3].minor_stars.push(star('天钺'));
  assert.ok(detectPatterns({ palaces: kuiYueJia }).some((item) => item.name === '魁钺夹命'));

  const kuiYueReverse = createPalaces('辰', []);
  kuiYueReverse[1].minor_stars.push(star('天钺'));
  kuiYueReverse[3].minor_stars.push(star('天魁'));
  assert.ok(detectPatterns({ palaces: kuiYueReverse }).some((item) => item.name === '魁钺夹命'));

  const kuiYueSameSide = createPalaces('辰', []);
  kuiYueSameSide[1].minor_stars.push(star('天魁'), star('天钺'));
  assert.equal(
    detectPatterns({ palaces: kuiYueSameSide }).some((item) => item.name === '魁钺夹命'),
    false,
  );
});

test('紫微格局：昌曲夹命按文昌文曲前后夹命判断', () => {
  const changQuJia = createPalaces('丑', []);
  changQuJia[10].minor_stars.push(star('文曲'));
  changQuJia[0].minor_stars.push(star('文昌'));
  assert.ok(detectPatterns({ palaces: changQuJia }).some((item) => item.name === '昌曲夹命'));

  const changQuReverse = createPalaces('丑', []);
  changQuReverse[10].minor_stars.push(star('文昌'));
  changQuReverse[0].minor_stars.push(star('文曲'));
  assert.ok(detectPatterns({ palaces: changQuReverse }).some((item) => item.name === '昌曲夹命'));

  const changQuSameSide = createPalaces('丑', []);
  changQuSameSide[0].minor_stars.push(star('文昌'), star('文曲'));
  assert.equal(
    detectPatterns({ palaces: changQuSameSide }).some((item) => item.name === '昌曲夹命'),
    false,
  );
});

test('紫微格局：紫府夹命按紫微天府前后夹命判断', () => {
  const ziFuJia = createPalaces('丑', []);
  ziFuJia[10].major_stars.push(star('紫微'));
  ziFuJia[0].major_stars.push(star('天府'));
  assert.ok(detectPatterns({ palaces: ziFuJia }).some((item) => item.name === '紫府夹命'));

  const ziFuReverse = createPalaces('丑', []);
  ziFuReverse[10].major_stars.push(star('天府'));
  ziFuReverse[0].major_stars.push(star('紫微'));
  assert.ok(detectPatterns({ palaces: ziFuReverse }).some((item) => item.name === '紫府夹命'));

  const ziFuSameSide = createPalaces('丑', []);
  ziFuSameSide[0].major_stars.push(star('紫微'), star('天府'));
  assert.equal(
    detectPatterns({ palaces: ziFuSameSide }).some((item) => item.name === '紫府夹命'),
    false,
  );
});

test('紫微格局：坐贵向贵按魁钺一坐命一拱照判断', () => {
  const kuiMingYueXiang = createPalaces('寅', []);
  kuiMingYueXiang[0].minor_stars.push(star('天魁'));
  kuiMingYueXiang[6].minor_stars.push(star('天钺'));
  assert.ok(
    detectPatterns({ palaces: kuiMingYueXiang }).some((item) => item.name === '坐贵向贵'),
  );

  const yueMingKuiXiang = createPalaces('寅', []);
  yueMingKuiXiang[0].minor_stars.push(star('天钺'));
  yueMingKuiXiang[6].minor_stars.push(star('天魁'));
  assert.ok(
    detectPatterns({ palaces: yueMingKuiXiang }).some((item) => item.name === '坐贵向贵'),
  );

  const kuiYueSanFang = createPalaces('寅', []);
  kuiYueSanFang[0].minor_stars.push(star('天魁'));
  kuiYueSanFang[4].minor_stars.push(star('天钺'));
  assert.equal(
    detectPatterns({ palaces: kuiYueSanFang }).some((item) => item.name === '坐贵向贵'),
    false,
  );
});

test('紫微格局：武曲守垣和金舆扶驾按古籍限定判断', () => {
  const wuQuMao = createPalaces('卯', [star('武曲')]);
  assert.ok(detectPatterns({ palaces: wuQuMao }).some((item) => item.name === '武曲守垣'));

  const wuQuChen = createPalaces('辰', [star('武曲')]);
  assert.equal(
    detectPatterns({ palaces: wuQuChen }).some((item) => item.name === '武曲守垣'),
    false,
  );

  const jinYu = createPalaces('寅', [star('紫微')]);
  jinYu[11].major_stars.push(star('太阳'));
  jinYu[1].major_stars.push(star('太阴'));
  assert.ok(detectPatterns({ palaces: jinYu }).some((item) => item.name === '金舆扶驾'));

  const jinYuReverse = createPalaces('寅', [star('紫微')]);
  jinYuReverse[11].major_stars.push(star('太阴'));
  jinYuReverse[1].major_stars.push(star('太阳'));
  assert.ok(detectPatterns({ palaces: jinYuReverse }).some((item) => item.name === '金舆扶驾'));

  const noZiWei = createPalaces('寅', []);
  noZiWei[11].major_stars.push(star('太阳'));
  noZiWei[1].major_stars.push(star('太阴'));
  assert.equal(
    detectPatterns({ palaces: noZiWei }).some((item) => item.name === '金舆扶驾'),
    false,
  );
});

test('紫微格局：刑囚夹印按天刑廉贞同临命宫或身宫判断', () => {
  const xingQiuMing = createPalaces('寅', [star('廉贞'), star('天刑')]);
  assert.ok(detectPatterns({ palaces: xingQiuMing }).some((item) => item.name === '刑囚夹印'));

  const xingQiuShen = createPalaces('寅', []);
  xingQiuShen[3].is_body_palace = true;
  xingQiuShen[3].major_stars.push(star('廉贞'));
  xingQiuShen[3].minor_stars.push(star('天刑'));
  assert.ok(detectPatterns({ palaces: xingQiuShen }).some((item) => item.name === '刑囚夹印'));

  const oldJiaYin = createPalaces('寅', [star('天相')]);
  oldJiaYin[11].major_stars.push(star('廉贞'));
  oldJiaYin[1].minor_stars.push(star('擎羊'));
  assert.equal(
    detectPatterns({ palaces: oldJiaYin }).some((item) => item.name === '刑囚夹印'),
    false,
  );
});

test('紫微格局：财与囚仇按武曲廉贞同守命宫或身宫判断', () => {
  const caiQiuMing = createPalaces('寅', [star('武曲'), star('廉贞')]);
  assert.ok(
    detectPatterns({ palaces: caiQiuMing }).some((item) => item.name === '财与囚仇'),
  );

  const caiQiuShen = createPalaces('寅', []);
  caiQiuShen[3].is_body_palace = true;
  caiQiuShen[3].major_stars.push(star('武曲'), star('廉贞'));
  assert.ok(
    detectPatterns({ palaces: caiQiuShen }).some((item) => item.name === '财与囚仇'),
  );

  const separatedCaiQiu = createPalaces('寅', [star('武曲')]);
  separatedCaiQiu[4].major_stars.push(star('廉贞'));
  assert.equal(
    detectPatterns({ palaces: separatedCaiQiu }).some((item) => item.name === '财与囚仇'),
    false,
  );
});

test('紫微格局：一生孤贫按破军陷地守命判断', () => {
  const poJunXian = createPalaces('寅', [{ ...star('破军'), brightness: '陷' }]);
  assert.ok(detectPatterns({ palaces: poJunXian }).some((item) => item.name === '一生孤贫'));

  const poJunMiao = createPalaces('寅', [{ ...star('破军'), brightness: '庙' }]);
  assert.equal(
    detectPatterns({ palaces: poJunMiao }).some((item) => item.name === '一生孤贫'),
    false,
  );

  const poJunXianOtherPalace = createPalaces('寅', []);
  poJunXianOtherPalace[4].major_stars.push({ ...star('破军'), brightness: '陷' });
  assert.equal(
    detectPatterns({ palaces: poJunXianOtherPalace }).some((item) => item.name === '一生孤贫'),
    false,
  );
});

test('紫微格局：君子在野按落陷四杀守命宫或身宫判断', () => {
  const huoXingXianMing = createPalaces('寅', [{ ...star('火星'), brightness: '陷' }]);
  assert.ok(detectPatterns({ palaces: huoXingXianMing }).some((item) => item.name === '君子在野'));

  const tuoLuoXianShen = createPalaces('寅', []);
  tuoLuoXianShen[3].is_body_palace = true;
  tuoLuoXianShen[3].minor_stars.push({ ...star('陀罗'), brightness: '陷' });
  assert.ok(detectPatterns({ palaces: tuoLuoXianShen }).some((item) => item.name === '君子在野'));

  const huoXingMiao = createPalaces('寅', [{ ...star('火星'), brightness: '庙' }]);
  assert.equal(
    detectPatterns({ palaces: huoXingMiao }).some((item) => item.name === '君子在野'),
    false,
  );

  const yangRenXianOtherPalace = createPalaces('寅', []);
  yangRenXianOtherPalace[4].minor_stars.push({ ...star('擎羊'), brightness: '陷' });
  assert.equal(
    detectPatterns({ palaces: yangRenXianOtherPalace }).some((item) => item.name === '君子在野'),
    false,
  );
});

test('紫微格局：马头带箭按天马擎羊同临命宫或身宫判断', () => {
  const maTouMing = createPalaces('寅', [star('天马'), star('擎羊')]);
  assert.ok(detectPatterns({ palaces: maTouMing }).some((item) => item.name === '马头带箭'));

  const maTouShen = createPalaces('寅', []);
  maTouShen[3].is_body_palace = true;
  maTouShen[3].minor_stars.push(star('天马'));
  maTouShen[3].minor_stars.push(star('擎羊'));
  assert.ok(detectPatterns({ palaces: maTouShen }).some((item) => item.name === '马头带箭'));

  const separatedMaTou = createPalaces('寅', [star('天马')]);
  separatedMaTou[4].minor_stars.push(star('擎羊'));
  assert.equal(
    detectPatterns({ palaces: separatedMaTou }).some((item) => item.name === '马头带箭'),
    false,
  );

  const oldWuGong = createPalaces('午', [star('天同')]);
  oldWuGong[0].minor_stars.push(star('擎羊'));
  assert.equal(
    detectPatterns({ palaces: oldWuGong }).some((item) => item.name === '马头带箭'),
    false,
  );
});

test('紫微格局：火铃夹命和空劫夹命必须前后夹命', () => {
  const huoLingFlanked = createPalaces('寅', []);
  huoLingFlanked[11].minor_stars.push(star('火星'));
  huoLingFlanked[1].minor_stars.push(star('铃星'));
  assert.ok(detectPatterns({ palaces: huoLingFlanked }).some((item) => item.name === '火铃夹命'));

  const huoLingSameSide = createPalaces('寅', []);
  huoLingSameSide[11].minor_stars.push(star('火星'), star('铃星'));
  assert.equal(
    detectPatterns({ palaces: huoLingSameSide }).some((item) => item.name === '火铃夹命'),
    false,
  );

  const kongJieFlanked = createPalaces('寅', []);
  kongJieFlanked[11].minor_stars.push(star('地劫'));
  kongJieFlanked[1].minor_stars.push(star('地空'));
  assert.ok(detectPatterns({ palaces: kongJieFlanked }).some((item) => item.name === '空劫夹命'));

  const kongJieSameSide = createPalaces('寅', []);
  kongJieSameSide[1].minor_stars.push(star('地空'), star('地劫'));
  assert.equal(
    detectPatterns({ palaces: kongJieSameSide }).some((item) => item.name === '空劫夹命'),
    false,
  );
});

test('紫微格局：两重华盖按禄存化禄坐命遇空劫判断', () => {
  const liangChongHuaGai = createPalaces('寅', [star('天机', '禄'), star('禄存')]);
  liangChongHuaGai[0].minor_stars.push(star('地空'));
  assert.ok(
    detectPatterns({ palaces: liangChongHuaGai }).some((item) => item.name === '两重华盖'),
  );

  const noHuaLu = createPalaces('寅', [star('禄存')]);
  noHuaLu[0].minor_stars.push(star('地空'));
  assert.equal(
    detectPatterns({ palaces: noHuaLu }).some((item) => item.name === '两重华盖'),
    false,
  );

  const kongJieNotInMing = createPalaces('寅', [star('天机', '禄'), star('禄存')]);
  kongJieNotInMing[4].minor_stars.push(star('地劫'));
  assert.equal(
    detectPatterns({ palaces: kongJieNotInMing }).some((item) => item.name === '两重华盖'),
    false,
  );
});

test('紫微格局：生不逢时按命宫空亡逢廉贞判断', () => {
  const lianZhenKongWang = createPalaces('寅', [star('廉贞')]);
  lianZhenKongWang[0].other_stars.push(star('空亡'));
  assert.ok(
    detectPatterns({ palaces: lianZhenKongWang }).some((item) => item.name === '生不逢时'),
  );

  const lianZhenXunKong = createPalaces('寅', [star('廉贞')]);
  lianZhenXunKong[0].other_stars.push(star('旬空'));
  assert.ok(
    detectPatterns({ palaces: lianZhenXunKong }).some((item) => item.name === '生不逢时'),
  );

  const lianZhenWithoutVoid = createPalaces('寅', [star('廉贞')]);
  assert.equal(
    detectPatterns({ palaces: lianZhenWithoutVoid }).some((item) => item.name === '生不逢时'),
    false,
  );

  const voidWithoutLianZhen = createPalaces('寅', []);
  voidWithoutLianZhen[0].other_stars.push(star('空亡'));
  assert.equal(
    detectPatterns({ palaces: voidWithoutLianZhen }).some((item) => item.name === '生不逢时'),
    false,
  );
});

test('紫微格局：禄逢两杀按禄存坐空亡又逢空劫判断', () => {
  const luCunVoidKongJie = createPalaces('寅', [star('禄存')]);
  luCunVoidKongJie[0].other_stars.push(star('空亡'));
  luCunVoidKongJie[0].minor_stars.push(star('地空'));
  assert.ok(
    detectPatterns({ palaces: luCunVoidKongJie }).some((item) => item.name === '禄逢两杀'),
  );

  const luCunVoidWithoutKongJie = createPalaces('寅', [star('禄存')]);
  luCunVoidWithoutKongJie[0].other_stars.push(star('空亡'));
  assert.equal(
    detectPatterns({ palaces: luCunVoidWithoutKongJie }).some((item) => item.name === '禄逢两杀'),
    false,
  );

  const luCunKongJieWithoutVoid = createPalaces('寅', [star('禄存')]);
  luCunKongJieWithoutVoid[0].minor_stars.push(star('地劫'));
  assert.equal(
    detectPatterns({ palaces: luCunKongJieWithoutVoid }).some(
      (item) => item.name === '禄逢两杀',
    ),
    false,
  );
});

test('紫微格局：马落空亡按命宫三方四正天马落空亡判断', () => {
  const maVoidInSanFang = createPalaces('寅', []);
  maVoidInSanFang[4].minor_stars.push(star('天马'));
  maVoidInSanFang[4].other_stars.push(star('空亡'));
  assert.ok(
    detectPatterns({ palaces: maVoidInSanFang }).some((item) => item.name === '马落空亡'),
  );

  const maXunKongInMing = createPalaces('寅', [star('天马')]);
  maXunKongInMing[0].other_stars.push(star('旬空'));
  assert.ok(
    detectPatterns({ palaces: maXunKongInMing }).some((item) => item.name === '马落空亡'),
  );

  const maWithoutVoid = createPalaces('寅', [star('天马')]);
  assert.equal(
    detectPatterns({ palaces: maWithoutVoid }).some((item) => item.name === '马落空亡'),
    false,
  );

  const maVoidOutsideSanFang = createPalaces('寅', []);
  maVoidOutsideSanFang[1].minor_stars.push(star('天马'));
  maVoidOutsideSanFang[1].other_stars.push(star('空亡'));
  assert.equal(
    detectPatterns({ palaces: maVoidOutsideSanFang }).some((item) => item.name === '马落空亡'),
    false,
  );
});

test('紫微格局：火贪格按火星与贪狼同宫三合照命判断', () => {
  const huoTanSanHe = createPalaces('寅', []);
  huoTanSanHe[4].major_stars.push(star('贪狼'));
  huoTanSanHe[4].minor_stars.push(star('火星'));
  assert.ok(detectPatterns({ palaces: huoTanSanHe }).some((item) => item.name === '火贪格'));

  const separatedHuoTan = createPalaces('寅', []);
  separatedHuoTan[4].major_stars.push(star('贪狼'));
  separatedHuoTan[8].minor_stars.push(star('火星'));
  assert.equal(
    detectPatterns({ palaces: separatedHuoTan }).some((item) => item.name === '火贪格'),
    false,
  );
});

test('紫微格局：铃贪格按铃星与贪狼同宫三合照命判断', () => {
  const lingTanSanHe = createPalaces('寅', []);
  lingTanSanHe[4].major_stars.push(star('贪狼'));
  lingTanSanHe[4].minor_stars.push(star('铃星'));
  assert.ok(detectPatterns({ palaces: lingTanSanHe }).some((item) => item.name === '铃贪格'));

  const separatedLingTan = createPalaces('寅', []);
  separatedLingTan[4].major_stars.push(star('贪狼'));
  separatedLingTan[8].minor_stars.push(star('铃星'));
  assert.equal(
    detectPatterns({ palaces: separatedLingTan }).some((item) => item.name === '铃贪格'),
    false,
  );
});

test('紫微格局：武贪同行兼取命宫守照身宫与财宅位', () => {
  const wuTanSanHe = createPalaces('寅', []);
  wuTanSanHe[4].major_stars.push(star('武曲'));
  wuTanSanHe[4].major_stars.push(star('贪狼'));
  assert.ok(detectPatterns({ palaces: wuTanSanHe }).some((item) => item.name === '武贪同行'));

  const wuTanBody = createPalaces('寅', []);
  wuTanBody[3].is_body_palace = true;
  wuTanBody[3].major_stars.push(star('武曲'));
  wuTanBody[3].major_stars.push(star('贪狼'));
  assert.ok(detectPatterns({ palaces: wuTanBody }).some((item) => item.name === '武贪同行'));

  const wuTanTianZhai = createPalaces('寅', []);
  wuTanTianZhai[2].name = '田宅';
  wuTanTianZhai[2].major_stars.push(star('武曲'));
  wuTanTianZhai[2].major_stars.push(star('贪狼'));
  assert.ok(detectPatterns({ palaces: wuTanTianZhai }).some((item) => item.name === '武贪同行'));

  const separatedWuTan = createPalaces('寅', []);
  separatedWuTan[4].major_stars.push(star('武曲'));
  separatedWuTan[8].major_stars.push(star('贪狼'));
  assert.equal(
    detectPatterns({ palaces: separatedWuTan }).some((item) => item.name === '武贪同行'),
    false,
  );
});

test('紫微格局：巨日同宫兼取三方四正同宫与拱照', () => {
  const juRiOpposite = createPalaces('寅', []);
  juRiOpposite[6].major_stars.push(star('巨门'));
  juRiOpposite[6].major_stars.push(star('太阳'));
  assert.ok(detectPatterns({ palaces: juRiOpposite }).some((item) => item.name === '巨日同宫'));

  const juRiGongZhao = createPalaces('寅', []);
  juRiGongZhao[4].major_stars.push(star('太阳'));
  juRiGongZhao[8].major_stars.push(star('巨门'));
  assert.ok(detectPatterns({ palaces: juRiGongZhao }).some((item) => item.name === '巨日同宫'));

  const onlyJuMen = createPalaces('寅', []);
  onlyJuMen[8].major_stars.push(star('巨门'));
  assert.equal(
    detectPatterns({ palaces: onlyJuMen }).some((item) => item.name === '巨日同宫'),
    false,
  );
});

test('紫微格局：天罗地网和日月反背按辰戌地支判断', () => {
  const tianLuo = detectPatterns({ palaces: createPalaces('辰', []) });
  assert.ok(tianLuo.some((item) => item.name === '天罗地网'));

  const diWang = detectPatterns({ palaces: createPalaces('戌', []) });
  assert.ok(diWang.some((item) => item.name === '天罗地网'));

  const riFanBei = detectPatterns({ palaces: createPalaces('戌', [star('太阳')]) });
  assert.ok(riFanBei.some((item) => item.name === '日月反背'));

  const yueFanBei = detectPatterns({ palaces: createPalaces('辰', [star('太阴')]) });
  assert.ok(yueFanBei.some((item) => item.name === '日月反背'));
});

test('紫微格局：日月藏辉按日月反背又逢巨门判断', () => {
  const sunFanBeiWithJuMen = createPalaces('戌', [star('太阳')]);
  sunFanBeiWithJuMen[4].major_stars.push(star('巨门'));
  assert.ok(
    detectPatterns({ palaces: sunFanBeiWithJuMen }).some((item) => item.name === '日月藏辉'),
  );

  const moonFanBeiWithJuMen = createPalaces('辰', [star('太阴')]);
  moonFanBeiWithJuMen[8].major_stars.push(star('巨门'));
  assert.ok(
    detectPatterns({ palaces: moonFanBeiWithJuMen }).some((item) => item.name === '日月藏辉'),
  );

  const fanBeiWithoutJuMen = createPalaces('戌', [star('太阳')]);
  assert.equal(
    detectPatterns({ palaces: fanBeiWithoutJuMen }).some((item) => item.name === '日月藏辉'),
    false,
  );

  const wrongSunBranchWithJuMen = createPalaces('辰', [star('太阳')]);
  wrongSunBranchWithJuMen[8].major_stars.push(star('巨门'));
  assert.equal(
    detectPatterns({ palaces: wrongSunBranchWithJuMen }).some((item) => item.name === '日月藏辉'),
    false,
  );
});

test('紫微格局：子午寅申亥未等地支规则不受 iztro 索引起点影响', () => {
  const shiZhong = createPalaces('子', [star('巨门')]);
  shiZhong[10].major_stars[0].birth_mutagen = '禄';
  assert.ok(detectPatterns({ palaces: shiZhong }).some((item) => item.name === '石中隐玉'));

  const maTou = createPalaces('午', [star('天马'), star('擎羊')]);
  assert.ok(detectPatterns({ palaces: maTou }).some((item) => item.name === '马头带箭'));

  const qiShaYin = detectPatterns({ palaces: createPalaces('寅', [star('七杀')]) });
  assert.ok(qiShaYin.some((item) => item.name === '七杀朝斗'));

  const qiShaChen = detectPatterns({ palaces: createPalaces('辰', [star('七杀')]) });
  assert.equal(
    qiShaChen.some((item) => item.name === '七杀朝斗'),
    false,
  );

  const mingZhu = createPalaces('未', []);
  mingZhu[11].name = '迁移';
  mingZhu[1].major_stars.push(star('太阳'));
  mingZhu[9].major_stars.push(star('太阴'));
  assert.ok(detectPatterns({ palaces: mingZhu }).some((item) => item.name === '明珠出海'));

  const mingZhuWrongSunMoon = createPalaces('未', []);
  mingZhuWrongSunMoon[1].major_stars.push(star('太阴'));
  mingZhuWrongSunMoon[9].major_stars.push(star('太阳'));
  assert.equal(
    detectPatterns({ palaces: mingZhuWrongSunMoon }).some((item) => item.name === '明珠出海'),
    false,
  );
});
