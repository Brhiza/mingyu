import { test } from 'node:test';
import { strict as assert } from 'node:assert';

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

test('八字《滴天髓》十干体象与性情查询正确', () => {
  const jiaMu = getBaziDitiansuiAdvice('甲');
  assert.ok(jiaMu);
  assert.equal(jiaMu.wuxing, '木');
  assert.ok(jiaMu.verse.includes('甲木参天，脱胎要火'));

  const bingHuo = getBaziDitiansuiAdvice('丙');
  assert.ok(bingHuo);
  assert.equal(bingHuo.wuxing, '火');
  assert.ok(bingHuo.verse.includes('丙火猛烈，欺霜傲雪'));

  const guiShui = getBaziDitiansuiAdvice('癸');
  assert.ok(guiShui);
  assert.ok(guiShui.verse.includes('癸水至弱，达于天津'));
});

test('八字《子平真诠》八格取用与纯杂判定查询正确', () => {
  const zhengguan = getBaziZipingPatternAdvice('正官格');
  assert.ok(zhengguan);
  assert.equal(zhengguan.category, '正格');
  assert.ok(zhengguan.rule.includes('月令正官'));
  assert.ok(zhengguan.taboos.includes('伤官见官'));

  const qisha = getBaziZipingPatternAdvice('七杀格（身杀两停）');
  assert.ok(qisha);
  assert.equal(qisha.pattern, '七杀格');
  assert.ok(qisha.verse?.includes('七杀有制化为权'));
});

test('八字《穷通宝鉴》月令调候喜忌查询正确', () => {
  const jiaYin = getBaziQiongtongAdvice('甲', '寅');
  assert.ok(jiaYin);
  assert.deepEqual(jiaYin.primaryGods, ['丙', '癸']);
  assert.ok(jiaYin.classicVerse.includes('初春甲木'));

  const gengShen = getBaziQiongtongAdvice('庚', '申');
  assert.ok(gengShen);
  assert.deepEqual(gengShen.primaryGods, ['丁', '甲']);
  assert.ok(gengShen.classicVerse.includes('七月庚金'));
});

test('六爻《卜筮正宗》六亲持世歌诀查询正确', () => {
  const fuMu = getLiuyaoChishiClassic('父母');
  assert.ok(fuMu);
  assert.ok(fuMu.verse.includes('父母持世主身劳'));

  const ziSun = getLiuyaoChishiClassic('子孙爻');
  assert.ok(ziSun);
  assert.ok(ziSun.verse.includes('世持子孙万事平'));
});

test('六爻《黄金策》与《增删卜易》动变生克断语查询正确', () => {
  const childActive = getLiuyaoMovementRule('child_active');
  assert.ok(childActive);
  assert.equal(childActive.trigger, '子孙爻发动');
  assert.ok(childActive.originalVerse.includes('子孙发动伤官鬼'));
  assert.ok(childActive.topicSpecificAdvice.wealth?.includes('求财第一吉神'));

  const advance = getLiuyaoMovementRule('change_advance');
  assert.ok(advance);
  assert.equal(advance.trigger, '动化进神');
  assert.equal(advance.sourceBook, '增删卜易');
});

test('梅花易数体用生克与八卦类象查询正确', () => {
  const bihe = getMeihuaBodyUseJudgement('体用比和');
  assert.ok(bihe);
  assert.equal(bihe.auspice, '大吉');
  assert.ok(bihe.matterCategories.seekingWealth.includes('利于合伙经商'));

  const yongKeTi = getMeihuaBodyUseJudgement('用克体');
  assert.ok(yongKeTi);
  assert.equal(yongKeTi.auspice, '大凶');

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
  assert.ok(qian.tuanCi.includes('乾为天'));
  assert.ok(qian.daXiang.includes('自强不息'));

  const kun = getZhouyiHexagramClassic(2);
  assert.ok(kun);
  assert.equal(kun.name, '坤为地');
  assert.ok(kun.daXiang.includes('厚德载物'));
});

test('小六壬《小六壬口诀》六神经典诗赋与断语查询正确', () => {
  const daan = getXiaoliurenClassic('大安');
  assert.ok(daan);
  assert.equal(daan.wuxing, '木');
  assert.equal(daan.auspice, '大吉');
  assert.ok(daan.poem.includes('大安事事昌'));

  const kongwang = getXiaoliurenClassic('空亡');
  assert.ok(kongwang);
  assert.equal(kongwang.auspice, '凶');
  assert.ok(kongwang.poem.includes('空亡事不祥'));
});

test('金口诀《金口诀大全》五动三动歌诀查询正确', () => {
  const qiDong = getJinkoujueMovementClassic('妻动');
  assert.ok(qiDong);
  assert.equal(qiDong.category, '五动');
  assert.ok(qiDong.verse.includes('妻动妻愁夫不宁'));

  const ziSunDong = getJinkoujueMovementClassic('子孙动');
  assert.ok(ziSunDong);
  assert.ok(ziSunDong.verse.includes('子孙动入喜事连'));
});

test('大六壬《大六壬大全》《六壬指南》九宗门与十二天将查询正确', () => {
  const chongShen = getLiurenTransmissionClassic('重审');
  assert.ok(chongShen);
  assert.equal(chongShen.rule, '重审');
  assert.ok(chongShen.verse?.includes('取课先从下贼呼'));

  const sheHai = getLiurenTransmissionClassic('涉害法');
  assert.ok(sheHai);
  assert.equal(sheHai.rule, '涉害');
  assert.ok(sheHai.verse?.includes('涉害深浅历万难'));

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
  assert.equal(wenChang.wuxing, '火');
  assert.ok(wenChang.verse.includes('文昌主将发机先'));

  const shiJi = getTaiyiGeneralClassic('始击');
  assert.ok(shiJi);
  assert.ok(shiJi.verse.includes('始击如雷震万山'));
});

test('皇极经世邵雍《皇极经世书》元会运世卦气查询正确', () => {
  const nian = getHuangjiCycleClassic('年');
  assert.ok(nian);
  assert.ok(nian.verse.includes('年卦司岁气之机'));

  const shi = getHuangjiCycleClassic('世');
  assert.ok(shi);
  assert.ok(shi.verse.includes('三十年为一世'));
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
  assert.ok(ziWu.verse.includes('少阴君火司天'));
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


