import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { JinkoujueMovement } from 'mingyu-core/types';
import * as classics from '../packages/core/src/classics/index';
import * as qimen from '../packages/core/src/classics/qimen-patterns';
import * as qiongtong from '../packages/core/src/classics/bazi-qiongtong';
import * as ditiansui from '../packages/core/src/classics/bazi-ditiansui';
import * as ziping from '../packages/core/src/classics/bazi-ziping';
import * as liuyao from '../packages/core/src/classics/liuyao-rules';
import * as meihua from '../packages/core/src/classics/meihua-rules';
import * as zhouyi from '../packages/core/src/classics/zhouyi';
import * as jinkou from '../packages/core/src/classics/jinkoujue-rules';
import * as liuren from '../packages/core/src/classics/liuren-rules';
import * as ziwei from '../packages/core/src/classics/ziwei-classics';
import * as fengshui from '../packages/core/src/classics/fengshui-classics';
import * as taiyi from '../packages/core/src/classics/taiyi-classics';
import * as qizheng from '../packages/core/src/classics/qizheng-classics';
import * as almanac from '../packages/core/src/classics/almanac-classics';

import {
  getAlmanacOfficerClassic,
  getBaziDitiansuiAdvice,
  getBaziQiongtongAdvice,
  getBaziZipingPatternAdvice,
  getBazhaiStarClassic,
  getHuangjiCycleClassic,
  getJinkoujueMovementClassic,
  getLiurenBifaClassic,
  getLiurenGeneralClassic,
  getLiurenLessonPatternClassic,
  getLiurenTransmissionClassic,
  getLiuyaoChishiClassic,
  getLiuyaoMovementRule,
  getMeihuaBodyUseJudgement,
  getMeihuaTrigramClassic,
  getQimenDeityClassic,
  getQimenDoorClassic,
  getQimenStarClassic,
  getQimenStemPattern,
  getQimenYanboClassic,
  getQizhengStarClassic,
  getTaiyiGeneralClassic,
  getWuyunLiuqiClassic,
  getXiaoliurenClassic,
  getXuankongStarClassic,
  getZhouyiHexagramClassic,
  getZiweiFuClassic,
  getZiweiStarClassic,
} from '../packages/core/src/classics/index.ts';

test('奇门遁甲古典十干克应查询正确', () => {
  const qimenFanShou = getQimenStemPattern('戊', '丙');
  assert.ok(qimenFanShou);
  assert.equal(qimenFanShou.name, '青龙反首');
  assert.equal(qimenFanShou.auspice, '大吉');
  assert.ok(qimenFanShou.classicVerse.includes('动作大利'));

  const qimenTaoZou = getQimenStemPattern('乙', '辛');
  assert.ok(qimenTaoZou);
  assert.equal(qimenTaoZou.name, '青龙逃走');
  assert.equal(qimenTaoZou.auspice, '大凶');

  const qimenDieXue = getQimenStemPattern('丙', '戊');
  assert.ok(qimenDieXue);
  assert.equal(qimenDieXue.name, '飞鸟跌穴');
  assert.equal(qimenDieXue.auspice, '大吉');
});

test('奇门遁甲九星、八门、八神经典赋文查询正确', () => {
  const tianFu = getQimenStarClassic('天辅星');
  assert.ok(tianFu);
  assert.equal(tianFu.wuxing, '木');
  assert.equal(tianFu.auspice, '大吉');
  assert.ok(tianFu.verse.includes('天辅文星号大吉'));

  const kaiMen = getQimenDoorClassic('开门');
  assert.ok(kaiMen);
  assert.equal(kaiMen.auspice, '大吉');
  assert.ok(kaiMen.verse.includes('开门大吉利求谋'));

  const zhiFu = getQimenDeityClassic('值符');
  assert.ok(zhiFu);
  assert.equal(zhiFu.auspice, '大吉');
  assert.ok(zhiFu.verse.includes('值符九星之领袖'));
});

test('八字《滴天髓》十干体象摘录与静态释义正确', () => {
  const checkedVerses = {
    甲: '甲木参天，脱胎要火。',
    乙: '乙木虽柔，刲羊解牛。',
    丙: '丙火猛烈，欺霜侮雪。',
    丁: '丁火柔中，内性昭融。',
    戊: '戊土固重，既中且正。',
    己: '己土卑湿，中正蓄藏。',
    庚: '庚金带煞，刚强为最。',
    辛: '辛金软弱，温润而清。',
    壬: '壬水汪洋，能泄金气。',
    癸: '癸水至弱，达于天津。',
  };
  for (const [stem, verse] of Object.entries(checkedVerses)) {
    const entry = getBaziDitiansuiAdvice(stem);
    assert.equal(entry?.verse, verse);
    if (stem === '甲') assert.equal(entry?.wuxing, '木');
    if (stem === '丙') assert.equal(entry?.wuxing, '火');
    assert.doesNotMatch(`${entry?.nature}${entry?.modernAdvice}`, /性情|职业|适合|必然/);
  }
});

test('八字《子平真诠》八格取用与纯杂判定查询正确', () => {
  const zhengguan = getBaziZipingPatternAdvice('正官格');
  assert.ok(zhengguan);
  assert.equal(zhengguan.category, '正格');
  assert.ok(zhengguan.rule.includes('月令正官'));
  assert.ok(zhengguan.taboos.includes('官逢伤而无救应'));

  const qisha = getBaziZipingPatternAdvice('七杀格（身杀两停）');
  assert.ok(qisha);
  assert.equal(qisha.pattern, '七杀格');
  assert.ok(qisha.verse?.includes('煞重身轻，用食则身不能当，不若转而就印'));
});

test('八字《穷通宝鉴》调候喜忌与条目按日干月支精确查询', () => {
  const jiaYin = getBaziQiongtongAdvice('甲', '寅');
  assert.ok(jiaYin);
  assert.deepEqual(jiaYin.primaryGods, ['丙', '癸']);
  assert.ok(jiaYin.classicVerse.includes('正月甲木'));

  const gengShen = getBaziQiongtongAdvice('庚', '申');
  assert.ok(gengShen);
  assert.deepEqual(gengShen.primaryGods, ['丁', '甲']);
  assert.ok(gengShen.classicVerse.includes('七月庚金'));
  assert.equal(gengShen.monthBranch, '申');

  const renWu = getBaziQiongtongAdvice('壬', '午');
  assert.ok(renWu);
  assert.deepEqual(renWu.primaryGods, ['癸', '庚']);
  assert.ok(renWu.classicVerse.includes('五月壬水'));
  const yiChen = getBaziQiongtongAdvice('乙', '辰');
  assert.equal(yiChen?.monthBranch, '辰');
  assert.match(yiChen?.classicVerse ?? '', /^三月乙木，阳气愈炽，先癸后丙/u);
  const gengYou = getBaziQiongtongAdvice('庚', '酉');
  assert.equal(gengYou?.monthBranch, '酉');
  assert.match(gengYou?.classicVerse ?? '', /^八月庚金，刚锐未退，用丁用甲/u);
  assert.equal(getBaziQiongtongAdvice('乙', '寅')?.monthBranch, '寅');
});

test('六爻《卜筮正宗》六亲持世歌诀查询正确', () => {
  const fuMu = getLiuyaoChishiClassic('父母');
  assert.ok(fuMu);
  assert.ok(fuMu.verse.includes('父母持世主身劳'));

  const ziSun = getLiuyaoChishiClassic('子孙爻');
  assert.ok(ziSun);
  assert.ok(ziSun.verse.includes('世持子孙万事平'));
});

test('六爻《卜筮正宗》与《增删卜易》动变生克断语查询正确', () => {
  const childActive = getLiuyaoMovementRule('child_active');
  assert.ok(childActive);
  assert.equal(childActive.trigger, '子孙爻发动');
  assert.ok(childActive.originalVerse.includes('子孙发动伤官鬼'));
  assert.ok(childActive.topicSpecificAdvice.wealth?.includes('财源支持'));

  const advance = getLiuyaoMovementRule('change_advance');
  assert.ok(advance);
  assert.equal(advance.trigger, '动化进神');
  assert.equal(advance.sourceBook, '增删卜易');
});

test('梅花易数体用生克与八卦类象查询正确', () => {
  const bihe = getMeihuaBodyUseJudgement('体用比和');
  assert.ok(bihe);
  assert.equal(bihe.sourceBook, '梅花易数·体用总诀');
  assert.equal(bihe.classicSummary, '体用比和，则百事顺遂。');
  assert.match(bihe.context, /旺衰、互卦与变卦/);

  const yongKeTi = getMeihuaBodyUseJudgement('用克体');
  assert.ok(yongKeTi);
  assert.equal(yongKeTi.classicSummary, '用克体，诸事凶。');
  assert.equal('matterCategories' in yongKeTi, false);

  const qianTrigram = getMeihuaTrigramClassic('乾');
  assert.ok(qianTrigram);
  assert.equal(qianTrigram.wuxing, '金');
  assert.equal(qianTrigram.family, '父亲、长辈、君主、领袖');
  assert.ok(qianTrigram.verse.includes('乾者健也'));
});

test('紫微斗数十四正曜诸星问答论查询正确', () => {
  const ziwei = getZiweiStarClassic('紫微');
  assert.ok(ziwei);
  assert.equal(ziwei.type, '北斗');
  assert.ok(ziwei.verse.includes('紫微天中星'));

  const tianji = getZiweiStarClassic('天机');
  assert.ok(tianji);
  assert.equal(tianji.wuxing, '木');
  assert.ok(tianji.verse.includes('天机为智慧'));
});

test('八宅明镜四吉四凶星释义查询正确', () => {
  const shengQi = getBazhaiStarClassic('生气');
  assert.ok(shengQi);
  assert.equal(shengQi.auspice, '大吉');
  assert.ok(shengQi.verse.includes('生气贪狼木第一'));

  const jueMing = getBazhaiStarClassic('绝命');
  assert.ok(jueMing);
  assert.equal(jueMing.auspice, '大凶');
  assert.ok(jueMing.placementAdvice.includes('大忌大门与主卧'));
});

test('周易六十四卦全本经文与爻辞查询正确', () => {
  const qian = getZhouyiHexagramClassic(1);
  assert.ok(qian);
  assert.equal(qian.name, '乾为天');
  assert.equal(qian.yaos.length, 6);
  assert.equal(qian.yaos[0].yaoCi, '潜龙勿用');
  assert.ok(qian.tuanCi.includes('大哉乾元，万物资始'));
  assert.equal(qian.yaos[0].xiaoXiang, '象曰：潜龙勿用，阳在下也。');
  assert.ok(qian.daXiang.includes('自强不息'));

  const kun = getZhouyiHexagramClassic(2);
  assert.ok(kun);
  assert.equal(kun.name, '坤为地');
  assert.ok(kun.daXiang.includes('厚德载物'));
});

test('周易彖传与小象使用完整底本文字', () => {
  const tun = getZhouyiHexagramClassic(3);
  assert.ok(tun);
  assert.equal(tun.yaos[1].yaoCi, '屯如邅如，乘马班如，匪寇婚媾，女子贞不字，十年乃字');
  assert.equal(tun.yaos[1].xiaoXiang, '象曰：六二之难，乘刚也。十年乃字，反常也。');

  const lv = getZhouyiHexagramClassic(10);
  assert.ok(lv);
  assert.match(lv.tuanCi, /^彖曰：履，柔履刚也。/);
  assert.equal(
    lv.yaos[2].xiaoXiang,
    '象曰：眇能视，不足以有明也。跛能履，不足以与行也。咥人之凶，位不当也。武人为于大君，志刚也。',
  );

  for (let id = 1; id <= 64; id += 1) {
    const gua = getZhouyiHexagramClassic(id);
    assert.ok(gua);
    assert.equal(gua.yaos.length, 6);
    assert.doesNotMatch(gua.tuanCi, /刚柔顺应，时运亨通/);
    for (const yao of gua.yaos) {
      assert.notEqual(yao.xiaoXiang, `象曰：${yao.yaoCi}。`);
    }
  }
});

test('小六壬民国通书歌诀保留底本字句并隔离查询结果', () => {
  const daan = getXiaoliurenClassic('大安');
  assert.ok(daan);
  assert.equal(daan.wuxing, '木');
  assert.equal(daan.auspice, '大吉');
  assert.ok(daan.poem.includes('大安事事昌'));

  const kongwang = getXiaoliurenClassic('空亡');
  assert.ok(kongwang);
  assert.equal(kongwang.auspice, '凶');
  assert.ok(kongwang.poem.includes('空亡事不长'));
  assert.match(kongwang.sourceBook, /大杂字万事不求人.*1946/);
  const original = daan.poem;
  daan.poem = '已修改';
  assert.equal(getXiaoliurenClassic('大安')?.poem, original);
  for (const name of ['toString', '__proto__', 'constructor', '未知', ['大安'], null]) {
    assert.equal(getXiaoliurenClassic(name as never), undefined);
  }
  for (const name of ['大安', '留连', '速喜', '赤口', '小吉', '空亡']) {
    const item = getXiaoliurenClassic(name)!;
    assert.equal(item.bodyPart, undefined);
    assert.equal(item.direction, undefined);
    assert.doesNotMatch(item.modernAdvice, /即刻降临|必有收获|圆满|当前局势/);
  }
});

test('金口诀五动三动资料与算法名称、方位和卷上原文一致', () => {
  const expectedMovements: Array<{
    key: JinkoujueMovement['name'];
    category: JinkoujueMovement['category'];
    name: string;
    verse: string;
  }> = [
    {
      key: '妻动',
      category: '五动',
      name: '妻动（上克下）',
      verse:
        '妻动于妻妾；官财防损折；占人人在家；访人人不悦；外边来索取；卑下有口舌；论物多翻正；下旁或有缺。',
    },
    {
      key: '官动',
      category: '五动',
      name: '官动（下克上）',
      verse:
        '官动利求官；相逢禄位迁；常人公府事；有官望财难；合得官中物；休从外处干；得财防暗损；问病在喉咽。',
    },
    {
      key: '贼动',
      category: '五动',
      name: '贼动（上克下）',
      verse:
        '贼动内贼生；勾连诈不明；损财卑幼病；谋望必无成；架媾奸私意；偷攘宛转名；卦爻终暗昧；病恐亦非轻。',
    },
    {
      key: '财动',
      category: '五动',
      name: '财动（下克上）',
      verse:
        '财动利求财；占官定不谐；家中人出外；妻妾并身灾；疾病忧难瘥；营求喜自来；财物终有损；职位恐多乖。',
    },
    {
      key: '鬼动',
      category: '五动',
      name: '鬼动（下克上）',
      verse:
        '鬼动忧灾怪；官亨人出外；争讼带他人；乖戾因间外；口舌共喧争；冤仇皆损害；痊病物仰合；家宅未安泰。',
    },
    {
      key: '父母动',
      category: '三动',
      name: '父母动（下生上）',
      verse: '方生干为父母动：为印绶，凡占，小干尊，大吉。',
    },
    {
      key: '子孙动',
      category: '三动',
      name: '子孙动（上生下）',
      verse: '干生方为子孙动：凡占，主干子孙之事，小吉。',
    },
    {
      key: '兄弟动',
      category: '三动',
      name: '兄弟动（比和）',
      verse: '干方同为兄弟动：凡占，事在比肩朋友，小凶。',
    },
  ];

  for (const expected of expectedMovements) {
    const classic = getJinkoujueMovementClassic(expected.key);
    assert.ok(classic, `${expected.key} 应有与算法名称相同的典籍资料键`);
    assert.equal(classic.key, expected.key);
    assert.equal(classic.category, expected.category);
    assert.equal(classic.name, expected.name);
    assert.equal(classic.sourceBook, '《六壬神课金口诀》卷之上');
    assert.equal(classic.verse, expected.verse);
  }

  for (const fakeMovement of ['方主移动', '神主移动', '将主移动']) {
    assert.equal(getJinkoujueMovementClassic(fakeMovement), undefined);
  }
});

test('大六壬《大六壬大全》《六壬指南》九宗门与十二天将查询正确', () => {
  const chongShen = getLiurenTransmissionClassic('重审');
  assert.ok(chongShen);
  assert.equal(chongShen.rule, '重审');
  assert.ok(chongShen.verse?.includes('取课先从下贼呼'));

  const sheHai = getLiurenTransmissionClassic('涉害法');
  assert.ok(sheHai);
  assert.equal(sheHai.rule, '涉害');
  assert.equal(sheHai.sourceBook, '大六壬大全·九宗门');
  assert.equal(sheHai.verse, '涉害行来本家止，路逢多克为用取。孟深仲浅季当休，复等柔辰刚日宜。');

  const zhanGuan = getLiurenLessonPatternClassic('斩关');
  assert.ok(zhanGuan);
  assert.equal(zhanGuan.pattern, '斩关课');
  assert.ok(zhanGuan.verse.includes('斩关破塞任奔驰'));

  const guiRen = getLiurenGeneralClassic('贵人');
  assert.ok(guiRen);
  assert.equal(guiRen.auspice, '吉');
  assert.ok(guiRen.verse.includes('贵人尊贵至高明'));

  const bifa = getLiurenBifaClassic('前后引从');
  assert.ok(bifa);
  assert.ok(bifa.verse.includes('前后引从升迁吉'));
});

test('太乙神数《太乙金镜式经》八将主客算经文查询正确', () => {
  const wenChang = getTaiyiGeneralClassic('文昌');
  assert.ok(wenChang);
  assert.equal(wenChang.wuxing, '土');
  assert.ok(wenChang.verse.includes('受土德之正气'));

  const shiJi = getTaiyiGeneralClassic('始击');
  assert.ok(shiJi);
  assert.ok(shiJi.verse.includes('受火德之正气'));
});

test('皇极周期典籍按索隐原文查询并隔离结果', () => {
  const nian = getHuangjiCycleClassic('年');
  assert.ok(nian);
  assert.equal(nian.verse, '会之用至年，故以会经运，始书年。');

  const shi = getHuangjiCycleClassic('世');
  assert.ok(shi);
  assert.ok(shi.verse.includes('三十年为一世'));
  for (const cycle of ['元', '会', '运', '世', '年']) {
    const item = getHuangjiCycleClassic(cycle)!;
    assert.equal(item.sourceBook, '《皇极经世索隐·经世观物总要》');
    const original = item.verse;
    item.verse = '被修改';
    assert.equal(getHuangjiCycleClassic(cycle)!.verse, original);
  }
  for (const cycle of ['三十年', '元会', 'constructor', '未知', ['年'], null, 1]) {
    assert.equal(getHuangjiCycleClassic(cycle as never), undefined);
  }
  assert.match(getHuangjiCycleClassic('运')!.principle, /三百六十年/);
});

test('七政四余《果老星宗》日月五星与四余经解查询正确', () => {
  const sun = getQizhengStarClassic('太阳');
  assert.ok(sun);
  assert.equal(sun.category, '七政');
  assert.ok(sun.verse.includes('日为诸曜之尊'));

  const ziqi = getQizhengStarClassic('紫炁');
  assert.ok(ziqi);
  assert.equal(ziqi.category, '四余');
  assert.ok(ziqi.verse.includes('紫炁为木之余'));
});

test('五运六气《黄帝内经》大运司在经文查询正确', () => {
  const jiaJi = getWuyunLiuqiClassic('甲己化土');
  assert.ok(jiaJi);
  assert.equal(jiaJi.category, '大运');
  assert.ok(jiaJi.verse.includes('甲己之岁，土运统之'));

  const ziWu = getWuyunLiuqiClassic('少阴君火司天');
  assert.ok(ziWu);
  assert.equal(ziWu.category, '司天');
  assert.equal(ziWu.verse, '少阴司天，其化以热。');
});

test('五运六气典籍十一项逐项对应原句并保留太过不及区别', () => {
  for (const [key, verse, feature] of [
    ['甲己化土', '甲己之岁，土运统之。', '甲年为土运太过，己年为土运不及'],
    ['乙庚化金', '乙庚之岁，金运统之。', '乙年为金运不及，庚年为金运太过'],
    ['丙辛化水', '丙辛之岁，水运统之。', '丙年为水运太过，辛年为水运不及'],
    ['丁壬化木', '丁壬之岁，木运统之。', '丁年为木运不及，壬年为木运太过'],
    ['戊癸化火', '戊癸之岁，火运统之。', '戊年为火运太过，癸年为火运不及'],
  ]) {
    const result = getWuyunLiuqiClassic(key)!;
    assert.equal(result.verse, verse);
    assert.equal(result.sourceBook, '素问·天元纪大论');
    assert.ok(result.climateFeature.includes(feature));
    assert.equal(result.healthAdvice, undefined);
  }
  for (const [factor, phase, qi] of [
    ['少阴君火司天', '少阴', '热'],
    ['太阴湿土司天', '太阴', '湿'],
    ['少阳相火司天', '少阳', '火'],
    ['阳明燥金司天', '阳明', '燥'],
    ['太阳寒水司天', '太阳', '寒'],
    ['厥阴风木司天', '厥阴', '风'],
  ]) {
    const result = getWuyunLiuqiClassic(factor)!;
    assert.equal(result.verse, `${phase}司天，其化以${qi}。`);
    assert.equal(result.sourceBook, '素问·至真要大论');
    assert.equal(result.healthAdvice, undefined);
  }
});

test('五运六气典籍精确匹配完整名称并隔离返回资料', () => {
  for (const factor of ['', '司天', '少阴', '甲', '土', '说明甲己化土', 'constructor']) {
    assert.equal(getWuyunLiuqiClassic(factor), undefined);
  }
  const first = getWuyunLiuqiClassic('子午少阴君火司天')!;
  assert.deepEqual(first, getWuyunLiuqiClassic('少阴君火司天'));
  first.verse = '修改';
  assert.equal(getWuyunLiuqiClassic('少阴君火司天')!.verse, '少阴司天，其化以热。');
});

test('六组在泉气化资料与司天对应分别查询', () => {
  for (const [key, factor, phase, qi, taste] of [
    ['寅申厥阴风木在泉', '厥阴风木在泉', '厥阴', '风', '酸'],
    ['卯酉少阴君火在泉', '少阴君火在泉', '少阴', '热', '苦'],
    ['辰戌太阴湿土在泉', '太阴湿土在泉', '太阴', '湿', '甘'],
    ['巳亥少阳相火在泉', '少阳相火在泉', '少阳', '火', '苦'],
    ['子午阳明燥金在泉', '阳明燥金在泉', '阳明', '燥', '辛'],
    ['丑未太阳寒水在泉', '太阳寒水在泉', '太阳', '寒', '咸'],
  ]) {
    const result = getWuyunLiuqiClassic(key)!;
    assert.deepEqual(result, getWuyunLiuqiClassic(factor));
    assert.equal(result.category, '在泉');
    assert.equal(result.verse, `${phase}司天为${qi}化，在泉为${taste}化。`);
    assert.equal(result.sourceBook, '素问·至真要大论');
    assert.equal(result.healthAdvice, undefined);
  }
});

test('通胜择日《协纪辨方书》建除十二神歌诀查询正确', () => {
  const jian = getAlmanacOfficerClassic('建日');
  assert.ok(jian);
  assert.equal(jian.order, 1);
  assert.equal(jian.auspice, '吉');
  assert.ok(jian.verse.includes('建日相逢万事通'));

  const po = getAlmanacOfficerClassic('破日');
  assert.ok(po);
  assert.equal(po.auspice, '凶');
  assert.ok(po.verse.includes('破日逢冲万事休'));
});

test('玄空风水《紫白诀》九星经解查询正确', () => {
  const yiBai = getXuankongStarClassic(1);
  assert.ok(yiBai);
  assert.equal(yiBai.wuxing, '水');
  assert.ok(yiBai.verse.includes('一白为官星之应'));

  const jiuZi = getXuankongStarClassic(9);
  assert.ok(jiuZi);
  assert.equal(jiuZi.wuxing, '火');
  assert.ok(jiuZi.verse.includes('九紫右弼吉星'));
});

test('紫微斗数《太微赋》《骨髓赋》名句查询正确', () => {
  const huoTan = getZiweiFuClassic('huo_tan_heng_fa');
  assert.ok(huoTan);
  assert.equal(huoTan.sourceBook, '骨髓赋');
  assert.ok(huoTan.originalVerse.includes('贪狼遇火必英雄'));
});

test('奇门遁甲《烟波钓叟歌》精义查询正确', () => {
  const yanbo = getQimenYanboClassic('阴阳顺逆');
  assert.ok(yanbo);
  assert.ok(yanbo.verse.includes('阴阳顺逆妙难穷'));
});

test('典籍查询只认可登记键，直接模块与聚合入口保留合法别名', () => {
  const queries = [
    [ditiansui.getBaziDitiansuiAdvice, getBaziDitiansuiAdvice],
    [ziping.getBaziZipingPatternAdvice, getBaziZipingPatternAdvice],
    [qimen.getQimenStarClassic, getQimenStarClassic],
    [qimen.getQimenDoorClassic, getQimenDoorClassic],
    [qimen.getQimenDeityClassic, getQimenDeityClassic],
    [liuyao.getLiuyaoMovementRule, getLiuyaoMovementRule],
    [liuyao.getLiuyaoChishiClassic, getLiuyaoChishiClassic],
    [meihua.getMeihuaTrigramClassic, getMeihuaTrigramClassic],
    [meihua.getMeihuaBodyUseJudgement, getMeihuaBodyUseJudgement],
    [almanac.getAlmanacOfficerClassic, getAlmanacOfficerClassic],
  ];
  for (const pair of queries) {
    for (const query of pair) {
      for (const key of ['toString', 'constructor', '__proto__']) {
        assert.equal(query(key), undefined, query.name + '：' + key);
      }
    }
  }
  for (const query of [fengshui.getXuankongStarClassic, getXuankongStarClassic]) {
    for (const value of ['9e1', '9.5', '9abc', '', ' ', 0, 10, 9.5, NaN, Infinity]) {
      assert.equal(query(value), undefined, String(value));
    }
    for (const value of [9, '9', ' 9 ', '9.0']) {
      assert.equal(query(value)?.starNumber, 9);
    }
  }
  for (const module of [qimen, classics]) {
    assert.deepEqual(module.getQimenStarClassic('天芮'), module.getQimenStarClassic('天任星_芮'));
    assert.equal(module.getQimenDoorClassic('开')?.door, '开门');
  }
  for (const module of [ziping, classics]) {
    assert.equal(module.getBaziZipingPatternAdvice('建禄格')?.pattern, '建禄月劫格');
    assert.equal(module.getBaziZipingPatternAdvice('月刃格')?.pattern, '阳刃格');
  }
  assert.equal(meihua.getMeihuaTrigramClassic('乾卦')?.trigram, '乾');
  assert.equal(liuyao.getLiuyaoChishiClassic('父母爻')?.relation, '父母');
  assert.equal(almanac.getAlmanacOfficerClassic('建日')?.officer, '建日');
});

test('典籍getter与find及全集返回值隔离原表和嵌套资料', () => {
  const queries: Array<[string, () => unknown]> = [];
  for (const module of [ditiansui, classics])
    queries.push(['滴天髓', () => module.getBaziDitiansuiAdvice('甲')]);
  for (const module of [ziping, classics])
    queries.push(['子平', () => module.getBaziZipingPatternAdvice('正官格')]);
  for (const module of [qiongtong, classics])
    queries.push(['穷通', () => module.getBaziQiongtongAdvice('甲', '寅')]);
  for (const module of [qimen, classics])
    queries.push(
      ['奇门干', () => module.getQimenStemPattern('乙', '戊')],
      ['奇门星', () => module.getQimenStarClassic('天蓬')],
      ['奇门门', () => module.getQimenDoorClassic('开')],
      ['奇门神', () => module.getQimenDeityClassic('值符')],
      ['烟波find', () => module.getQimenYanboClassic('阴阳')],
      ['烟波all', () => module.getAllQimenYanboClassics()],
    );
  for (const module of [liuyao, classics])
    queries.push(
      [
        '六爻动变',
        () => module.getLiuyaoMovementRule(Object.keys(liuyao.LIUYAO_MOVEMENT_RULES)[0]),
      ],
      ['六爻持世', () => module.getLiuyaoChishiClassic('父母爻')],
      ['六爻all', () => module.getAllLiuyaoMovementRules()],
      [
        '六爻分类',
        () => module.getLiuyaoCategoryChapter(liuyao.LIUYAO_CATEGORY_CHAPTERS[0].category),
      ],
      ['六爻分类all', () => module.getAllLiuyaoCategoryChapters()],
    );
  for (const module of [meihua, classics])
    queries.push(
      ['梅花卦', () => module.getMeihuaTrigramClassic('乾卦')],
      ['梅花体用', () => module.getMeihuaBodyUseJudgement('体用比和')],
    );
  for (const module of [zhouyi, classics])
    queries.push(['周易六爻', () => module.getZhouyiHexagramClassic(1)]);
  for (const module of [jinkou, classics])
    queries.push(['金口诀', () => module.getJinkoujueMovementClassic('妻动')]);
  for (const module of [liuren, classics])
    queries.push(
      ['六壬将', () => module.getLiurenGeneralClassic('贵人')],
      ['六壬取传', () => module.getLiurenTransmissionClassic('伏吟兼贼克')],
      [
        '六壬课体',
        () =>
          module.getLiurenLessonPatternClassic(
            Object.keys(liuren.LIUREN_LESSON_PATTERN_CLASSICS)[0],
          ),
      ],
      ['毕法find', () => module.getLiurenBifaClassic(liuren.LIUREN_BIFA_CLASSICS[0].title)],
      ['毕法all', () => module.getAllLiurenBifaClassics()],
    );
  for (const module of [ziwei, classics])
    queries.push(
      ['紫微星', () => module.getZiweiStarClassic('紫微')],
      ['紫微赋find', () => module.getZiweiFuClassic('zi_fu_tong_gong')],
      ['紫微赋all', () => module.getAllZiweiFuClassics()],
    );
  for (const module of [fengshui, classics])
    queries.push(
      ['八宅', () => module.getBazhaiStarClassic('生气')],
      ['玄空', () => module.getXuankongStarClassic(9)],
    );
  for (const module of [taiyi, classics])
    queries.push(['太乙', () => module.getTaiyiGeneralClassic('文昌')]);
  for (const module of [qizheng, classics])
    queries.push(['七政', () => module.getQizhengStarClassic('太阳')]);
  for (const module of [almanac, classics])
    queries.push(['建除', () => module.getAlmanacOfficerClassic('建日')]);
  const mutate = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(mutate);
      value.push('返回值隔离控制');
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (typeof item === 'string') (value as Record<string, unknown>)[key] = '返回值隔离控制';
        else mutate(item);
      }
    }
  };
  for (const [label, query] of queries) {
    const returned = query();
    assert.ok(returned, label);
    const expected = structuredClone(returned);
    mutate(returned);
    assert.notDeepEqual(returned, expected, label + '应确实修改返回资料');
    assert.deepEqual(query(), expected, label + '后续查询应保留原文与嵌套资料');
  }
});
