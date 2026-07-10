import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as core from '../packages/core/src/index.ts';

test('ganzhi: 纳音/十二长生/六十甲子序号', () => {
  assert.equal(core.ganzhi.getNayin('甲子'), '海中金');
  assert.equal(core.ganzhi.getChangShengState('木', '亥'), '长生');
  assert.equal(core.ganzhi.getChangShengState('火', '寅'), '长生');
  assert.equal(core.ganzhi.getSixtyCycleIndex('甲子'), 0);
  assert.equal(core.ganzhi.getSixtyCycleIndex('甲戌'), 10);
  assert.equal(core.ganzhi.getSixtyCycleIndex('癸亥'), 59);
  assert.equal(core.ganzhi.diffGanZhi('甲子', '乙丑'), 1);
  assert.equal(core.ganzhi.diffGanZhi('癸亥', '甲子'), 1);
});

test('ganzhi: 干支关系复用', () => {
  assert.equal(core.ganzhi.isLiuhe('子', '丑'), true);
  assert.equal(core.ganzhi.isLiuchong('子', '午'), true);
  assert.equal(core.ganzhi.getWuxingChangSheng('水'), '申');
});

test('wuxing: 五行统计', () => {
  // 甲(木) 子(水+藏癸水) 丙(火) 午(火+藏丁火+藏己土)
  const counts = core.wuxing.tallyWuxing(['甲', '子', '丙', '午'], { weightHidden: true });
  assert.equal(counts['木'], 1);
  assert.equal(counts['水'], 2);
  assert.equal(counts['火'], 3);
});

test('ganzhi: 十二长生（土长生在寅，与八字/奇门一致）', () => {
  // 木长生在亥、火长生在寅、金长生在巳、水长生在申（不变）
  assert.equal(core.ganzhi.getChangShengState('木', '亥'), '长生');
  assert.equal(core.ganzhi.getChangShengState('火', '寅'), '长生');
  assert.equal(core.ganzhi.getChangShengState('金', '巳'), '长生');
  assert.equal(core.ganzhi.getChangShengState('水', '申'), '长生');
  // 土：统一为「土长生在寅」流派（火土同宫），与八字/奇门所用 tyme4ts 一致
  assert.equal(core.ganzhi.getChangShengState('土', '寅'), '长生');
  assert.equal(core.ganzhi.getChangShengState('土', '申'), '病'); // 寅派：土在申为病
  assert.equal(core.ganzhi.getWuxingChangSheng('土'), '寅');
});

test('direction: 八宅大游年', () => {
  const r = core.direction.getEightMansion('坎');
  assert.equal(r.group, '东四命');
  assert.equal(r.lucky.length, 4);
  assert.equal(r.unlucky.length, 4);
  assert.equal(core.direction.getHouseTrigram('子'), '坎');
  assert.equal(r.unlucky.find((item) => item.gua === '艮')?.label, '五鬼');
  assert.equal(r.unlucky.find((item) => item.gua === '兑')?.label, '祸害');
  assert.equal(r.unlucky.find((item) => item.gua === '乾')?.label, '六煞');
  assert.equal(core.direction.NINE_STARS[0].name, '一白水');
  assert.deepEqual(core.direction.FOUR_ZONES, ['东', '北', '西', '南']);
});

test('shensha: 可扩展 registry（不破坏既有系统）', () => {
  const list = core.shensha.listShensha();
  assert.ok(list.some((d) => d.id === 'kongwang'));
  const r = core.shensha.computeShensha(['kongwang'], {
    yearGanZhi: '甲子',
    monthGanZhi: '丙寅',
    dayGanZhi: '戊辰',
    hourGanZhi: '丁巳',
  });
  assert.deepEqual(r[0].value, ['戌', '亥']);
  const jiaXu = core.shensha.computeShensha(['kongwang'], {
    yearGanZhi: '甲子',
    monthGanZhi: '乙丑',
    dayGanZhi: '甲戌',
    hourGanZhi: '丁卯',
  });
  const jiaShen = core.shensha.computeShensha(['kongwang'], {
    yearGanZhi: '甲子',
    monthGanZhi: '乙丑',
    dayGanZhi: '甲申',
    hourGanZhi: '丁卯',
  });
  assert.deepEqual(jiaXu[0].value, ['申', '酉']);
  assert.deepEqual(jiaShen[0].value, ['午', '未']);
  // 自定义神煞可自由注册（地基可继续拓展）
  core.shensha.registerShensha({
    id: 'demo',
    name: '示例',
    scope: 'bazhai',
    compute: () => ({ id: 'demo', name: '示例', value: 'ok' }),
  });
  assert.ok(core.shensha.listShensha('bazhai').some((d) => d.id === 'demo'));
});

test('bazhai: 命宅配合', () => {
  const r = core.bazhai.analyzeBaZhai({ birthYear: 1990, gender: 'male', sitMountain: '子' });
  assert.equal(r.mingGua, '坎');
  assert.equal(r.houseGua, '坎');
  assert.equal(r.match, '相合');
  assert.ok(r.prompt.includes('八宅风水'));
});

test('zodiac: 犯太岁与流年运程', () => {
  const conflicts = core.zodiac.getTaiSuiConflicts('午', '子');
  assert.ok(conflicts.some((c) => c.type === '冲太岁'));
  const r = core.zodiac.getZodiacYearFortune('午', '甲辰');
  assert.equal(r.zodiac, '马');
  assert.ok(['大吉', '吉', '平', '凶', '大凶'].includes(r.level));
  assert.ok(r.prompt.includes('生肖流年运程'));
});

test('taiyi: 三式补齐（年家，依古籍72局表校订）', () => {
  // 公元2004（甲申）：积年 10153917+2004=10155921，入纪元 321，局33 阳遁
  // 太乙落三宫、文昌(客目)二宫、始击(主目)八宫 —— 与《太乙金镜式经》72局表第33局吻合
  const r = core.taiyi.generateTaiyi({ year: 2004, scope: 'year' });
  assert.equal(r.accumulatedYears, 10155921);
  assert.equal(r.bureau, 33);
  assert.equal(r.yinYang, '阳遁');
  assert.equal(r.taiyiPalace, 3);
  assert.equal(r.wenChangPalace, 2);
  assert.equal(r.shiJiPalace, 8);
  assert.equal(r.sixteenGods.length, 12);
  assert.ok(r.prompt.includes('太乙神数'));
});

test('tieban: 铁板神数（太玄数 + 先天卦，依太玄配数诀与先天数成卦）', () => {
  // 甲子乙丑丙寅丁卯：太玄 9+9+8+8+7+7+6+6=60；先天卦 离(日丙寅7+4=11%8=3)艮(时丁卯2+5=7%8=7)=离艮，卦序23，动爻(7+4+2+5)%6=6
  const r = core.tieban.generateTieban({
    pillars: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
    gender: 'male',
  });
  assert.equal(r.taiXuan, 60);
  assert.equal(r.xianTianGua, '离艮');
  assert.equal(r.guaIndex, 23);
  assert.equal(r.movingYao, 6);
  assert.equal(r.houTianGua, '震艮');
  assert.equal(r.clauses.length, 18);
  assert.equal(r.clauses[0].code, '1000');
  assert.ok(r.clauses[0].text.includes('父命属鼠'));
  assert.ok(r.prompt.includes('铁板神数'));
});

test('qizheng: 七政四余（命宫/身宫/庙旺，依果老星宗安命法）', () => {
  // 2024-06-15 12:00 北京：太阳约在寅宫，午时生 → 命宫亥(11)、命主木（亥→木）；七政7、四余4
  const r = core.qizheng.generateQizheng({ year: 2024, month: 6, day: 15, hour: 12 });
  const qi = r.stars.filter((s) => s.kind === '七政');
  const yu = r.stars.filter((s) => s.kind === '四余');
  assert.equal(qi.length, 7);
  assert.equal(yu.length, 4);
  assert.equal(r.mingGong, 11);
  assert.equal(r.mingZhu, '木');
  assert.ok(r.stars.every((star) => star.sevenStar.length === 1));
  assert.ok(Math.abs(core.qizheng.getPrecessionOffset(2024) - 0.3353) < 0.001);
  assert.equal(r.shensha.find((item) => item.name === '孤辰')?.value, '巳');
  assert.equal(r.shensha.find((item) => item.name === '寡宿')?.value, '丑');
  assert.ok(r.prompt.includes('七政四余'));
});

test('ganzhi: tyme4ts 权威后端（纳音/干支五行/合冲害/十神）', () => {
  // 纳音委托 tyme4ts（与《纳音歌》一致）
  assert.equal(core.ganzhi.getNayin('甲子'), '海中金');
  assert.equal(core.ganzhi.getNayin('庚午'), '路旁土');
  // 干支五行委托 tyme4ts
  assert.equal(core.ganzhi.getStemWuxing('甲'), '木');
  assert.equal(core.ganzhi.getBranchWuxing('子'), '水');
  // 地支六合/六冲委托 tyme4ts
  assert.equal(core.ganzhi.isLiuhe('子', '丑'), true);
  assert.equal(core.ganzhi.isLiuchong('子', '午'), true);
  assert.equal(core.ganzhi.isLiuhai('子', '未'), true);
  // 天干五合委托 tyme4ts
  assert.equal(core.ganzhi.isTianGanHe('甲', '己'), true);
  // 十神（新增，委托 tyme4ts）
  assert.equal(core.ganzhi.getTenStar('甲', '甲'), '比肩');
  assert.equal(core.ganzhi.getTenStar('甲', '乙'), '劫财');
});

test('shensha: 黄历神煞层（委托 tyme4ts 151 神煞）', () => {
  const names = core.shensha.listHuangliShenshaNames();
  assert.ok(names.length >= 100, `黄历神煞应≥100，实为 ${names.length}`);
  const info = core.shensha.getHuangliShensha(2026, 7, 10);
  assert.ok(info.shensha.length > 0, '应命中若干黄历神煞');
  assert.ok(['吉', '凶', '平'].includes(info.shensha[0].luck), '神煞应带吉凶分类');
  assert.ok(info.duty.length > 0, '应有十二建除');
  assert.ok(info.nineStar.length > 0, '应有九星');
  // 命理注册表仍可用（空亡/驿马/桃花）
  const ctx = {
    yearGanZhi: '甲子',
    monthGanZhi: '乙丑',
    dayGanZhi: '丙寅',
    hourGanZhi: '丁卯',
  };
  const kw = core.shensha.computeShensha(['kongwang'], ctx);
  assert.equal(kw[0].name, '空亡');
});
