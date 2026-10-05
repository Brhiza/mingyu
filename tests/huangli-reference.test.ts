import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHuangliDayGods,
  getHuangliShensha,
  listHuangliShenshaNames,
} from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';
import { formatAlmanacGods } from '../packages/core/src/divination/almanac-evidence';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail';

const april2024TravelSelection = generateAlmanacSelection({
  topic: 'travel',
  startDate: '2024-04-08',
  endDate: '2024-04-08',
});
const november2026TravelSelection = generateAlmanacSelection({
  topic: 'travel',
  startDate: '2026-11-11',
  endDate: '2026-11-11',
});

// 所有完整月日表共用同一份确定性神煞结果缓存；断言仍按各自古籍起例独立执行。
const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const pillar = (index: number) => stems[index % 10] + branches[index % 12];
const huangliDayGodCache = new Map<string, ReturnType<typeof getHuangliDayGods>>();

const getCachedHuangliDayGods = (monthPillar: string, dayPillar: string) => {
  const cacheKey = `${monthPillar}|${dayPillar}`;
  const cached = huangliDayGodCache.get(cacheKey);
  if (cached) return cached;
  const gods = getHuangliDayGods(monthPillar, dayPillar);
  huangliDayGodCache.set(cacheKey, gods);
  return gods;
};

const getCachedDayGodNames = (month: number, day: number) =>
  getCachedHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());

// ===== 月令关系与建除、择日入口 =====

test('日期黄历查询与择日正午月建一致', () => {
  for (const [year, month, day, expectedDuty] of [
    [2024, 2, 4, '收'],
    [2026, 3, 5, '建'],
  ] as const) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const selection = generateAlmanacSelection({
      topic: 'move',
      startDate: date,
      endDate: date,
    }).days[0];
    const info = getHuangliShensha(year, month, day);
    assert.equal(info.duty, expectedDuty);
    assert.equal(info.duty, selection.dayOfficer);
    assert.deepEqual(
      info.shensha.map((god) => god.name),
      selection.gods,
    );
  }
});

test('黄历建破刑害合覆盖十二月六十日原典关系', () => {
  // 《星历考原》月建月破、《协纪辨方书》三合、《选择天镜》月刑月害。
  // https://www.shidianguji.com/book/SK1618/chapter/1jursttoszeh6
  // https://www.shidianguji.com/book/SK1618/chapter/1jursttoszr4a
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llrodh22w8
  // https://www.shidianguji.com/mid-page/7460251407561932809
  // 六合仅对照地支配对，不采用六壬天将六合的含义。
  const tables = {
    月建: [...'寅卯辰巳午未申酉戌亥子丑'],
    月破: [...'申酉戌亥子丑寅卯辰巳午未'],
    月刑: [...'巳子辰申午丑寅酉未亥卯戌'],
    月害: [...'巳辰卯寅丑子亥戌酉申未午'],
    六合: [...'亥戌酉申未午巳辰卯寅丑子'],
    三合: [
      '午戌',
      '亥未',
      '申子',
      '酉丑',
      '寅戌',
      '亥卯',
      '子辰',
      '巳丑',
      '寅午',
      '卯未',
      '申辰',
      '巳酉',
    ],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month].includes(branches[day % 12]),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('六项黄道神与五合除神覆盖十二月六十日起例', () => {
  // 《万年书》月吉神立成，五合寅卯日、除神申酉日。
  // https://www.shidianguji.com/book/HY1447/chapter/1l3wfewr9um1y
  const tables = {
    青龙: [...'子寅辰午申戌子寅辰午申戌'],
    明堂: [...'丑卯巳未酉亥丑卯巳未酉亥'],
    金匮: [...'辰午申戌子寅辰午申戌子寅'],
    宝光: [...'巳未酉亥丑卯巳未酉亥丑卯'],
    玉堂: [...'未酉亥丑卯巳未酉亥丑卯巳'],
    司命: [...'戌子寅辰午申戌子寅辰午申'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const branch = branches[day % 12];
      const names = getCachedDayGodNames(month, day);
      assert.equal(
        names.includes('五合'),
        '寅卯'.includes(branch),
        `${month + 1}月/${dayPillar}/五合`,
      );
      assert.equal(
        names.includes('除神'),
        '申酉'.includes(branch),
        `${month + 1}月/${dayPillar}/除神`,
      );
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branch,
          `${month + 1}月/${dayPillar}/${name}`,
        );
      }
    }
});

test('成日归入十二建除而非独立凶神', () => {
  // 《协纪辨方书》从月建起建，十二日顺行，成居第九位。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuhq2c
  assert.equal(listHuangliShenshaNames().includes('成日'), false);
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++)
      assert.equal(
        getCachedHuangliDayGods(pillar(month + 2), pillar(day)).some(
          (god) => god.getName() === '成日',
        ),
        false,
      );
  for (const [year, date] of [
    [2020, 23],
    [2021, 18],
    [2022, 13],
    [2023, 8],
  ]) {
    const info = getHuangliShensha(year, 9, date);
    assert.equal(info.duty, '成');
    assert.equal(
      info.shensha.some((god) => god.name === '成日'),
      false,
    );
    const dateKey = `${year}-09-${String(date).padStart(2, '0')}`;
    const day = generateAlmanacSelection({ topic: 'travel', startDate: dateKey, endDate: dateKey })
      .days[0];
    assert.equal(day.ganzhi.day, '己巳');
    assert.equal(day.gods.includes('成日'), false);
    assert.equal(
      day.godFacts?.some((fact) => fact.name === '成日'),
      false,
    );
  }
});

test('解除为择日事项而非独立吉神', () => {
  // 《御定星历考原》解除事项另以解神、除神、建除等判断。
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstvfxeof9
  const catalog = listHuangliShenshaNames();
  assert.equal(catalog.includes('解除'), false);
  assert.equal(catalog.includes('解神'), true);
  assert.equal(catalog.includes('除神'), true);
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++)
      assert.equal(
        getCachedHuangliDayGods(pillar(month + 2), pillar(day)).some(
          (god) => god.getName() === '解除',
        ),
        false,
      );
  for (const date of ['2020-12-17', '2021-12-12', '2022-12-07', '2029-12-30', '2030-12-25']) {
    const day = generateAlmanacSelection({ topic: 'travel', startDate: date, endDate: date })
      .days[0];
    assert.equal(day.ganzhi.day, '甲午');
    assert.equal(day.gods.includes('解除'), false);
    assert.equal(
      day.godFacts?.some((fact) => fact.name === '解除'),
      false,
    );
    assert.deepEqual(day.recommends, ['祭祀', '求医', '破屋', '坏垣', '馀事勿取']);
    assert.deepEqual(day.avoids, ['诸事不宜']);
  }
});

test('未月戊午日不将与逐阵同列时仍保留嫁娶避忌', () => {
  // 《协纪辨方书》阴阳不将条：六月戊午为逐阵不可用。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtui2pg
  const day = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2029-07-27',
    endDate: '2029-07-27',
  }).days[0];
  assert.equal(day.ganzhi.month, '辛未');
  assert.equal(day.ganzhi.day, '戊午');
  assert.ok(day.gods.includes('不将'));
  assert.ok(day.gods.includes('逐阵'));
  assert.ok(day.avoids.includes('嫁娶'));
  assert.equal(day.recommends.includes('嫁娶'), false);
  assert.ok(day.cautions.includes('黄历忌项触及订婚结婚'));
});

// ===== 吉神、福德与祈愿 =====

test('黄历四德按协纪日干起例覆盖十二月六十日', () => {
  // 《协纪辨方书》四仲天德居四维、无天德合；与将四维映射地支的起例分开。
  // https://www.shidianguji.com/zh/mid-page/7430936675263578162
  const tables: Record<string, Array<string | null>> = {
    天德: ['丁', null, '壬', '辛', null, '甲', '癸', null, '丙', '乙', null, '庚'],
    天德合: ['壬', null, '丁', '丙', null, '己', '戊', null, '辛', '庚', null, '乙'],
    月德: [...'丙甲壬庚丙甲壬庚丙甲壬庚'],
    月德合: [...'辛己丁乙辛己丁乙辛己丁乙'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const gods = getCachedDayGodNames(month, day);
      for (const [name, table] of Object.entries(tables)) {
        assert.equal(
          gods.includes(name),
          stems[day % 10] === table[month],
          `${month + 1}月/${dayPillar}/${name}`,
        );
      }
    }
});

test('辰月壬寅日天德贯通黄历查询与择日结果', () => {
  assert.ok(
    getHuangliShensha(2024, 4, 8).shensha.some((god) => god.name === '天德' && god.luck === '吉'),
  );
  const result = structuredClone(april2024TravelSelection);
  assert.ok(result.days[0].gods.includes('天德'));
  assert.equal(
    result.days[0].godFacts?.find((fact) => fact.name === '天德')?.classification,
    '吉神',
  );
  for (const text of [
    formatAlmanacGods(result.days[0]).join('；'),
    formatEnhancedDivinationInfo('almanac', result),
    formatDetailedDivinationInfo('almanac', result),
  ]) {
    assert.match(text, /吉神：[\s\S]*天德/);
    for (const name of result.days[0].gods) assert.ok(text.includes(name), name);
  }
});

test('黄历旧记录只有神煞名称时完整保留且不推定吉凶', () => {
  assert.deepEqual(formatAlmanacGods({ gods: ['天德', '月破', '天德'] }), ['神煞：天德、月破']);
  assert.deepEqual(formatAlmanacGods({ gods: [] }), []);
  const result = structuredClone(april2024TravelSelection);
  const day = result.days[0];
  day.godFacts = undefined;
  const expected = `神煞：${day.gods.join('、')}`;
  assert.ok(formatEnhancedDivinationInfo('almanac', result).includes(expected));
  assert.ok(formatDetailedDivinationInfo('almanac', result).includes(expected));
});

test('黄历天恩与天赦按时宪历笺释覆盖十二月六十日', () => {
  // 《大清时宪历笺释》天恩十五日及四季天赦起例。
  // https://www.shidianguji.com/zh/book/NA06367/chapter/1m3q9g2tzjd4i
  const graceDays = new Set([
    '甲子',
    '乙丑',
    '丙寅',
    '丁卯',
    '戊辰',
    '己卯',
    '庚辰',
    '辛巳',
    '壬午',
    '癸未',
    '己酉',
    '庚戌',
    '辛亥',
    '壬子',
    '癸丑',
  ]);
  const pardonDays = ['戊寅', '甲午', '戊申', '甲子'];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const names = getCachedDayGodNames(month, day);
      assert.equal(
        names.includes('天恩'),
        graceDays.has(dayPillar),
        `${month + 1}月/${dayPillar}/天恩`,
      );
      assert.equal(
        names.includes('天赦'),
        dayPillar === pardonDays[Math.floor(month / 3)],
        `${month + 1}月/${dayPillar}/天赦`,
      );
    }
});

test('申月壬午日天恩贯通查询、择日与提示词', () => {
  assert.ok(
    getHuangliShensha(2026, 9, 5).shensha.some((god) => god.name === '天恩' && god.luck === '吉'),
  );
  const result = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-09-05',
    endDate: '2026-09-05',
  });
  assert.ok(result.days[0].gods.includes('天恩'));
  assert.equal(
    result.days[0].godFacts?.find((fact) => fact.name === '天恩')?.classification,
    '吉神',
  );
  assert.ok(formatEnhancedDivinationInfo('almanac', result).includes('天恩'));
});

test('月恩、四相、月空、月厌、月煞覆盖十二月六十日原典表', () => {
  // 《协纪辨方书》月恩、《御定星历考原》四相、《三命通会》所载大统历三项月神。
  // https://www.shidianguji.com/zh/mid-page/7430936675263660082
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7e6n9
  // https://www.shidianguji.com/zh/mid-page/7426853297409146907
  const tables = {
    月恩: [...'丙丁庚己戊辛壬癸庚乙甲辛'],
    四相: [
      '丙丁',
      '丙丁',
      '丙丁',
      '戊己',
      '戊己',
      '戊己',
      '壬癸',
      '壬癸',
      '壬癸',
      '甲乙',
      '甲乙',
      '甲乙',
    ],
    月空: [...'壬庚丙甲壬庚丙甲壬庚丙甲'],
    月厌: [...'戌酉申未午巳辰卯寅丑子亥'],
    月煞: [...'丑戌未辰丑戌未辰丑戌未辰'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        const input = ['月厌', '月煞'].includes(name) ? branches[day % 12] : stems[day % 10];
        assert.equal(
          names.includes(name),
          targets[month].includes(input),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('亥月己丑日择日结果应列月厌而非月空', () => {
  const day = structuredClone(november2026TravelSelection).days[0];
  assert.equal(day.ganzhi.day, '己丑');
  assert.equal(day.gods.includes('月空'), false);
  assert.equal(day.gods.includes('六合'), false);
  assert.equal(day.gods.includes('金堂'), false);
  assert.equal(day.gods.includes('五合'), false);
  assert.equal(day.gods.includes('五虚'), false);
  assert.equal(day.gods.includes('天牢'), false);
  assert.equal(day.gods.includes('鸣吠对'), false);
  assert.equal(day.godFacts?.find((fact) => fact.name === '玉堂')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '玉宇')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '天巫')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '福德')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '月厌')?.classification, '凶神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '归忌')?.classification, '凶神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '地火')?.classification, '凶神');
  assert.equal(day.gods.includes('死神'), false);
  assert.equal(day.gods.includes('游祸'), false);
  assert.equal(day.gods.includes('不将'), false);
  assert.equal(day.gods.includes('河魁'), false);
  assert.equal(day.godFacts?.find((fact) => fact.name === '大煞')?.classification, '凶神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '孤辰')?.classification, '凶神');
});

test('要安至续世九神逐月起例覆盖十二月六十日', () => {
  // 《御定星历考原》卷三分别列要安、敬安，二者起例不同。
  // https://www.shidianguji.com/zh/book/NGJ892412000003528227963/chapter/1lukjyerwxn9i
  // 玉宇、金堂、益后以完整逐月表互证。
  // https://www.shidianguji.com/mid-page/7619449118268588041
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7ao85
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7cffp
  const tables = {
    要安: [...'寅申卯酉辰戌巳亥午子未丑'],
    敬安: [...'未丑申寅酉卯戌辰亥巳子午'],
    普护: [...'申寅酉卯戌辰亥巳子午丑未'],
    福生: [...'酉卯戌辰亥巳子午丑未寅申'],
    圣心: [...'亥巳子午丑未寅申卯酉辰戌'],
    续世: [...'丑未寅申卯酉辰戌巳亥午子'],
    玉宇: [...'卯酉辰戌巳亥午子未丑申寅'],
    金堂: [...'辰戌巳亥午子未丑申寅酉卯'],
    益后: [...'子午丑未寅申卯酉辰戌巳亥'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('天后天巫福德吉期天仓覆盖十二月六十日起例', () => {
  // 《御定星历考原》卷三：天仓正月寅逆行；福德天巫建前二辰；吉期建前一辰。
  // https://www.shidianguji.com/book/NGJ892412000003528227963/chapter/1lukjyerwxn9i
  // 天后正月申逆行四孟，与驿马同例。
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7d4px
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7dhd1
  const tables = {
    天后: [...'申巳寅亥申巳寅亥申巳寅亥'],
    天巫: [...'辰巳午未申酉戌亥子丑寅卯'],
    福德: [...'辰巳午未申酉戌亥子丑寅卯'],
    吉期: [...'卯辰巳午未申酉戌亥子丑寅'],
    天仓: [...'寅丑子亥戌酉申未午巳辰卯'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('五富驿马天马天喜生死气按既定起例覆盖十二月六十日', () => {
  // 《大清会典》五富，《星历考原》天马驿马，《黄帝宅经》生死气。
  // https://www.shidianguji.com/zh/book/CADAL01021280/chapter/1lmtiwd6bv5e1
  // https://www.shidianguji.com/zh/book/NGJ892412000003528227963/chapter/1lukjyerwxn9i
  // https://www.shidianguji.com/zh/book/NGJ892411999023143141460/chapter/1loyv18ouqckz
  // 天喜沿用成日起例；《协纪》天狗条并载四季、成日、逆行三种，不混用。
  // https://www.shidianguji.com/zh/book/SK1619/chapter/1l9lm21xfma6n
  const tables = {
    五富: [...'亥寅巳申亥寅巳申亥寅巳申'],
    驿马: [...'申巳寅亥申巳寅亥申巳寅亥'],
    天马: [...'午申戌子寅辰午申戌子寅辰'],
    天喜: [...'戌亥子丑寅卯辰巳午未申酉'],
    生气: [...'子丑寅卯辰巳午未申酉戌亥'],
    死气: [...'午未申酉戌亥子丑寅卯辰巳'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('天愿采用协纪校正表，临日天医覆盖十二月六十日', () => {
  // 《协纪辨方书》先引天愿旧表，后按语明确校正传抄错误。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llq0wznv37
  // 《万年书》月吉神立成互证天愿，天医取成日，临日另列逐月表。
  // https://www.shidianguji.com/book/HY1447/chapter/1l3wfewr9um1y
  const wishes = [
    '乙亥',
    '甲戌',
    '乙酉',
    '丙申',
    '丁未',
    '戊午',
    '己巳',
    '庚辰',
    '辛卯',
    '壬寅',
    '癸丑',
    '甲子',
  ];
  const tables = {
    临日: [...'午亥申丑戌卯子巳寅未辰酉'],
    天医: [...'戌亥子丑寅卯辰巳午未申酉'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const names = getCachedDayGodNames(month, day);
      assert.equal(
        names.includes('天愿'),
        wishes[month] === dayPillar,
        `${month + 1}月/${dayPillar}/天愿`,
      );
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${dayPillar}/${name}`,
        );
      }
    }
});

test('阳德阴德解神六仪时阳时阴覆盖十二月六十日起例', () => {
  // 《御定星历考原》卷三，六仪以标点本补全正月起辰。
  // https://www.shidianguji.com/book/NGJ892412000003528227963/chapter/1lukjyerwxn9i
  // https://www.shidianguji.com/book/SK1618/chapter/1jurstsg7fxut
  const tables = {
    阳德: [...'戌子寅辰午申戌子寅辰午申'],
    阴德: [...'酉未巳卯丑亥酉未巳卯丑亥'],
    解神: [...'申申戌戌子子寅寅辰辰午午'],
    六仪: [...'辰卯寅丑子亥戌酉申未午巳'],
    时阳: [...'子丑寅卯辰巳午未申酉戌亥'],
    时阴: [...'午未申酉戌亥子丑寅卯辰巳'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('天符按正月戌顺行六阳辰覆盖完整月日组合', () => {
  // 《御定星历考原》天符正月起戌，与司命同起例。
  // https://www.shidianguji.com/mid-page/7352635351480975386
  const targets = [...'戌子寅辰午申戌子寅辰午申'];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const gods = getCachedHuangliDayGods(pillar(month + 2), pillar(day));
      const matches = gods.filter((god) => god.getName() === '天符');
      const expected = branches[day % 12] === targets[month];
      assert.equal(matches.length, expected ? 1 : 0, `${month + 1}月/${pillar(day)}`);
      assert.equal(
        gods.some((god) => god.getName() === '司命'),
        expected,
      );
      if (expected) assert.equal(matches[0].getLuck().getName(), '吉');
    }
});

// ===== 四时节气与日期边界 =====

test('四季七神及九空五墓按古籍覆盖全部月日组合', () => {
  // 《协纪辨方书》最终从历神原始校正：春辰夏未秋戌冬丑为守日。
  // https://www.shidianguji.com/zh/mid-page/7430936675263709234
  // https://www.shidianguji.com/zh/mid-page/7430936675263692850
  // https://www.shidianguji.com/zh/book/CADAL01021280/chapter/1lmtiwd6bv5e1
  const seasonTables = {
    时德: ['午', '辰', '子', '寅'],
    王日: ['寅', '巳', '申', '亥'],
    官日: ['卯', '午', '酉', '子'],
    守日: ['辰', '未', '戌', '丑'],
    相日: ['巳', '申', '亥', '寅'],
    民日: ['午', '酉', '子', '卯'],
    四击: ['戌', '丑', '辰', '未'],
  };
  const nineVoid = [...'辰丑戌未辰丑戌未辰丑戌未'];
  const fiveTombs = [
    '乙未',
    '乙未',
    '戊辰',
    '丙戌',
    '丙戌',
    '戊辰',
    '辛丑',
    '辛丑',
    '戊辰',
    '壬辰',
    '壬辰',
    '戊辰',
  ];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      const label = `${month + 1}月/${pillar(day)}`;
      for (const [name, targets] of Object.entries(seasonTables)) {
        assert.equal(
          names.includes(name),
          targets[Math.floor(month / 3)] === branches[day % 12],
          `${label}/${name}`,
        );
      }
      assert.equal(names.includes('九空'), nineVoid[month] === branches[day % 12], `${label}/九空`);
      assert.equal(names.includes('五墓'), fiveTombs[month] === pillar(day), `${label}/五墓`);
    }
});

test('亥月己丑日保留守日九空并去除时德相日误列', () => {
  const day = structuredClone(november2026TravelSelection).days[0];
  assert.ok(day.gods.includes('守日'));
  assert.ok(day.gods.includes('九空'));
  assert.equal(day.gods.includes('时德'), false);
  assert.equal(day.gods.includes('相日'), false);
  assert.equal(day.godFacts?.find((fact) => fact.name === '守日')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '九空')?.classification, '凶神');
});

test('母仓按四季生我之支及四立前十八日覆盖全年', () => {
  // 《协纪辨方书》母仓起例；《历事明原》卷五四立前十八日土王用事。
  // 2026年四立交节：2月4日04:02、5月5日19:48、8月7日19:42、11月7日17:52。
  // https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i4uxkra2
  const seasonInstants = [
    '2025-11-07T12:04:04+08:00',
    '2026-02-04T04:02:08+08:00',
    '2026-05-05T19:48:44+08:00',
    '2026-08-07T19:42:43+08:00',
    '2026-11-07T17:52:05+08:00',
    '2027-02-04T09:46:18+08:00',
  ].map(Date.parse);
  const noonSeasonStarts = [
    '2025-11-08',
    '2026-02-04',
    '2026-05-06',
    '2026-08-08',
    '2026-11-08',
    '2027-02-04',
  ].map(Date.parse);
  const branchesBySeason = ['申酉', '亥子', '寅卯', '辰戌丑未', '申酉'];
  const dayMs = 86400000;
  const anchor = Date.UTC(2000, 0, 7);
  for (let offset = 0; offset < 365; offset++) {
    const time = Date.UTC(2026, 0, 1) + offset * dayMs;
    const date = new Date(time);
    const season = noonSeasonStarts.findIndex(
      (start, index) => time >= start && time < noonSeasonStarts[index + 1],
    );
    const noonTime = time + 12 * 3600000 - 8 * 3600000;
    const nextSeason = seasonInstants.find((start) => start > noonTime)!;
    const earthPeriod = nextSeason - noonTime <= 18 * dayMs;
    const dayBranch = [...'子丑寅卯辰巳午未申酉戌亥'][((time - anchor) / dayMs) % 12];
    const expected = (earthPeriod ? '巳午' : branchesBySeason[season]).includes(dayBranch);
    const actual = getHuangliShensha(2026, date.getUTCMonth() + 1, date.getUTCDate()).shensha.some(
      (god) => god.name === '母仓',
    );
    assert.equal(actual, expected, date.toISOString().slice(0, 10));
  }
});

test('土王阶段母仓巳午日及原季节误列在择日结果中同步修正', () => {
  for (const [date, expected] of [
    ['2026-01-19', true],
    ['2026-01-20', true],
    ['2026-01-22', false],
    ['2026-04-20', false],
    ['2026-10-22', true],
    ['2027-01-17', false],
  ] as const) {
    const day = generateAlmanacSelection({ topic: 'travel', startDate: date, endDate: date })
      .days[0];
    assert.equal(day.gods.includes('母仓'), expected, date);
    assert.equal(
      day.godFacts?.some((fact) => fact.name === '母仓' && fact.classification === '吉神'),
      expected,
      date,
    );
  }
});

test('三丧覆盖春辰夏未秋戌冬丑的完整月日组合', () => {
  // 《时俗丧祭便览》卷一三丧诀及交节分季；秋季成字据地支读为戌。
  // https://www.shidianguji.com/zh/book/CADAL02030953/chapter/1l6ueatru9v6x
  const expected = [...'辰辰辰未未未戌戌戌丑丑丑'];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++)
      assert.equal(
        getCachedHuangliDayGods(pillar(month + 2), pillar(day)).some(
          (god) => god.getName() === '三丧',
        ),
        branches[day % 12] === expected[month],
        `${month + 1}月/${pillar(day)}`,
      );
});

test('三丧日期按四立分季而非农历初一', () => {
  // 香港天文台2026年四立日期；2026-11-11己丑作为日支锚点。
  // https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
  const anchor = Date.UTC(2026, 10, 11);
  for (let offset = 0; offset < 365; offset++) {
    const date = new Date(Date.UTC(2026, 0, 1) + offset * 86400000);
    const iso = date.toISOString().slice(0, 10);
    const target =
      iso < '2026-02-04' || iso >= '2026-11-07'
        ? 1
        : iso < '2026-05-05'
          ? 4
          : iso < '2026-08-07'
            ? 7
            : 10;
    const branch = (((Math.round((date.getTime() - anchor) / 86400000) + 1) % 12) + 12) % 12;
    const info = getHuangliShensha(2026, date.getUTCMonth() + 1, date.getUTCDate());
    assert.equal(
      info.shensha.some((god) => god.name === '三丧'),
      branch === target,
      iso,
    );
  }
});

test('四离按香港天文台分至日期前一日覆盖全年', () => {
  // 《协纪辨方书》四离为二分二至各前一日。
  // https://www.shidianguji.com/mid-page/7430936675339223090
  // https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
  const expected = new Set(['2026-03-19', '2026-06-20', '2026-09-22', '2026-12-21']);
  for (let offset = 0; offset < 365; offset++) {
    const date = new Date(Date.UTC(2026, 0, 1) + offset * 86400000);
    const actual = getHuangliShensha(2026, date.getUTCMonth() + 1, date.getUTCDate());
    const iso = date.toISOString().slice(0, 10);
    assert.equal(
      actual.shensha.some((god) => god.name === '四离'),
      expected.has(iso),
      iso,
    );
  }
});

test('四离需具体日期且择日入口保留凶神分类', () => {
  assert.equal(
    getCachedHuangliDayGods('甲子', '己丑').some((god) => god.getName() === '四离'),
    false,
  );
  const day = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-03-19',
    endDate: '2026-03-19',
  }).days[0];
  assert.equal(day.godFacts?.find((fact) => fact.name === '四离')?.classification, '凶神');
});

// ===== 凶煞、冲破与专日禁忌 =====

test('六项黑道神与天贼致死覆盖完整月日组合', () => {
  // 《历事明原》逐月黑道起例；玄武在项目中称元武。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    天刑: [...'寅辰午申戌子寅辰午申戌子'],
    白虎: [...'午申戌子寅辰午申戌子寅辰'],
    天牢: [...'申戌子寅辰午申戌子寅辰午'],
    朱雀: [...'卯巳未酉亥丑卯巳未酉亥丑'],
    元武: [...'酉亥丑卯巳未酉亥丑卯巳未'],
    勾陈: [...'亥丑卯巳未酉亥丑卯巳未酉'],
    天贼: [...'丑子亥戌酉申未午巳辰卯寅'],
    致死: [...'酉午卯子酉午卯子酉午卯子'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('大耗小时大煞劫煞死神游祸天火覆盖完整月日组合', () => {
  // 《历事明原》六项月神起例；天火依《协纪辨方书》三合对冲校正。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  // https://www.shidianguji.com/zh/mid-page/7430936655495921691
  const tables = {
    大耗: [...'申酉戌亥子丑寅卯辰巳午未'],
    小时: [...'寅卯辰巳午未申酉戌亥子丑'],
    大煞: [...'戌巳午未寅卯辰亥子丑申酉'],
    劫煞: [...'亥申巳寅亥申巳寅亥申巳寅'],
    死神: [...'巳午未申酉戌亥子丑寅卯辰'],
    游祸: [...'巳寅亥申巳寅亥申巳寅亥申'],
    天火: [...'子酉午卯子酉午卯子酉午卯'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('月虚小耗大时咸池覆盖完整月日组合', () => {
  // 《历事明原》月虚丑逆四季，小耗月建前五辰，大时咸池卯逆四仲。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    月虚: [...'丑戌未辰丑戌未辰丑戌未辰'],
    小耗: [...'未申酉戌亥子丑寅卯辰巳午'],
    大时: [...'卯子酉午卯子酉午卯子酉午'],
    咸池: [...'卯子酉午卯子酉午卯子酉午'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('土符土府地火大败天吏覆盖完整月日组合', () => {
  // 《历事明原》土符逐月表，土府随月建，地火戌逆十二，大败卯逆四仲，天吏酉逆四仲。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    土符: [...'丑巳酉寅午戌卯未亥辰申子'],
    土府: [...'寅卯辰巳午未申酉戌亥子丑'],
    地火: [...'戌酉申未午巳辰卯寅丑子亥'],
    大败: [...'卯子酉午卯子酉午卯子酉午'],
    天吏: [...'酉午卯子酉午卯子酉午卯子'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('归忌招摇往亡覆盖完整月日组合', () => {
  // 《历事明原》归忌孟丑仲寅季子，招摇辰逆十二支，往亡逐月历四孟、四仲、四季。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    归忌: [...'丑寅子丑寅子丑寅子丑寅子'],
    招摇: [...'辰卯寅丑子亥戌酉申未午巳'],
    往亡: [...'寅巳申亥卯午酉子辰未戌丑'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('行狠了戾孤辰灾煞天狗覆盖完整月日组合', () => {
  // 《协纪辨方书》四月建孤辰起例、灾煞逆四仲及天狗仅申建戌满。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtujtx0
  // https://www.shidianguji.com/mid-page/7430936675293003786
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuhq2c
  const pillarTables = {
    行狠: ['', '', '甲申', '乙未', '', '', '', '', '庚寅', '辛丑', '', ''],
    了戾: ['', '', '丙申', '丁未', '', '', '', '', '壬寅', '癸丑', '', ''],
    孤辰: [
      '',
      '',
      '戊申庚申壬申',
      '己未辛未癸未',
      '',
      '',
      '',
      '',
      '甲寅丙寅戊寅',
      '乙丑丁丑己丑',
      '',
      '',
    ],
  };
  const branchTables = {
    灾煞: [...'子酉午卯子酉午卯子酉午卯'],
    天狗: ['', '', '', '', '', '', '戌', '', '', '', '', ''],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [tables, input] of [
        [pillarTables, pillar(day)],
        [branchTables, branches[day % 12]],
      ] as const)
        for (const [name, targets] of Object.entries(tables))
          assert.equal(
            names.includes(name),
            targets[month].includes(input),
            `${month + 1}月/${pillar(day)}/${name}`,
          );
    }
});

test('血支顺行与血忌隔月相冲覆盖完整月日组合', () => {
  // 《历事明原》血支正月丑顺行；血忌阳月丑至午、阴月未至子。
  // https://www.shidianguji.com/zh/book/7435621765851643938/chapter/1lvu7i3piowfa
  const tables = {
    血支: [...'丑寅卯辰巳午未申酉戌亥子'],
    血忌: [...'丑未寅申卯酉辰戌巳亥午子'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('九坎九焦逐月逆行与五虚四季表覆盖完整月日组合', () => {
  // 《协纪》九坎九焦正月辰逆四季、五月卯逆四仲、九月寅逆四孟。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llq0wznv37
  const monthly = [...'辰丑戌未卯子酉午寅亥申巳'];
  const seasonal = ['巳酉丑', '申子辰', '亥卯未', '寅午戌'];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const name of ['九坎', '九焦']) {
        assert.equal(
          names.includes(name),
          monthly[month] === branches[day % 12],
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
      assert.equal(
        names.includes('五虚'),
        seasonal[Math.floor(month / 3)].includes(branches[day % 12]),
        `${month + 1}月/${pillar(day)}/五虚`,
      );
    }
});

test('五离与复日按申酉及逐月单干起例覆盖完整月日组合', () => {
  // 《协纪》所引《地理新书》复日单干表；五离为申酉日。
  // https://www.shidianguji.com/ens/book/SK1619/chapter/1l9llq0wzokdf
  const targets = [...'甲乙戊丙丁己庚辛戊壬癸己'];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      assert.equal(
        names.includes('五离'),
        '申酉'.includes(branches[day % 12]),
        `${month + 1}月/${pillar(day)}/五离`,
      );
      assert.equal(
        names.includes('复日'),
        targets[month] === stems[day % 10],
        `${month + 1}月/${pillar(day)}/复日`,
      );
    }
});

test('四耗四废四忌四穷按四季固定日覆盖完整月日组合', () => {
  // 《协纪辨方书》四耗、四废、四忌、四穷。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llq0wznv37
  const tables = {
    四耗: [['壬子'], ['乙卯'], ['戊午'], ['辛酉']],
    四废: [
      ['庚申', '辛酉'],
      ['壬子', '癸亥'],
      ['甲寅', '乙卯'],
      ['丙午', '丁巳'],
    ],
    四忌: [['甲子'], ['丙子'], ['庚子'], ['壬子']],
    四穷: [['乙亥'], ['丁亥'], ['辛亥'], ['癸亥']],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[Math.floor(month / 3)].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('阴阳错冲与岁薄逐阵等十七项覆盖完整月日组合', () => {
  // 《协纪辨方书》月厌条所列阴阳错冲等十七项起例。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llrodhgh7s
  const tables = {
    单阴: ['', '', '戊辰', '', '', '', '', '', '', '', '', ''],
    纯阳: ['', '', '', '己巳', '', '', '', '', '', '', '', ''],
    孤阳: ['', '', '', '', '', '', '', '', '戊戌', '', '', ''],
    纯阴: ['', '', '', '', '', '', '', '', '', '己亥', '', ''],
    阴位: ['', '', '庚辰', '', '', '', '', '', '甲戌', '', '', ''],
    阴阳交破: ['', '', '', '癸亥', '', '', '', '', '', '丁巳', '', ''],
    阴阳击冲: ['', '', '', '', '壬子', '', '', '', '', '', '丙午', ''],
    阳破阴冲: ['', '', '', '', '', '癸丑', '', '', '', '', '', '丁未'],
    阴道冲阳: ['', '己酉', '', '', '', '', '', '己卯', '', '', '', ''],
    岁薄: ['', '', '', '丙午戊午', '', '', '', '', '', '壬子戊子', '', ''],
    逐阵: ['', '', '', '', '', '丙午戊午', '', '', '', '', '', '壬子戊子'],
    三阴: ['辛酉', '', '', '', '', '', '乙卯', '', '', '', '', ''],
    阳错: [
      '甲寅',
      '乙卯',
      '甲辰',
      '丁巳己巳',
      '',
      '丁未己未',
      '庚申',
      '辛酉',
      '庚戌',
      '癸亥',
      '',
      '癸丑',
    ],
    阴错: [
      '庚戌',
      '辛酉',
      '庚申',
      '丁未己未',
      '',
      '丁巳己巳',
      '甲辰',
      '乙卯',
      '甲寅',
      '癸丑',
      '',
      '癸亥',
    ],
    阴阳俱错: ['', '', '', '', '丙午', '', '', '', '', '', '壬子', ''],
    绝阴: ['', '', '', '戊辰', '', '', '', '', '', '', '', ''],
    绝阳: ['', '', '', '', '', '', '', '', '', '戊戌', '', ''],
  };
  assert.equal(listHuangliShenshaNames().includes('阳错阴冲'), false);
  assert.equal(listHuangliShenshaNames().includes('阳破阴冲'), true);
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      assert.equal(names.includes('阳错阴冲'), false, `${month + 1}月/${pillar(day)}`);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('不将覆盖完整月日组合', () => {
  // 《协纪辨方书》阴阳不将十二月立成表。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtui2pg
  const tables = {
    不将: [
      '辛亥辛丑辛卯庚子庚寅己亥己丑己卯丁亥丁丑丁卯丙子丙寅',
      '庚戌庚子庚寅己亥己丑丁亥丁丑丙戌丙子丙寅乙亥乙丑',
      '己酉己亥己丑丁酉丁亥丁丑丙戌丙子乙酉乙亥乙丑甲戌甲子',
      '丁酉丁亥丙申丙戌丙子乙酉乙亥甲申甲戌甲子戊申戊戌戊子',
      '丙申丙戌乙未乙酉乙亥甲申甲戌戊申戊戌癸未癸酉癸亥',
      '乙未乙酉甲午甲申甲戌戊午戊申戊戌癸未癸酉壬午壬申壬戌',
      '乙巳乙未乙酉甲午甲申戊午戊申癸巳癸未癸酉壬午壬申',
      '甲辰甲午甲申戊辰戊午戊申癸巳癸未壬辰壬午壬申辛巳辛未',
      '戊辰戊午癸卯癸巳癸未壬辰壬午辛卯辛巳辛未庚辰庚午',
      '癸卯癸巳壬寅壬辰壬午辛卯辛巳庚寅庚辰庚午己卯己巳',
      '壬寅壬辰辛丑辛卯辛巳庚寅庚辰己丑己卯己巳丁丑丁卯丁巳',
      '辛丑辛卯庚子庚寅庚辰己丑己卯丁丑丁卯丙子丙寅丙辰',
    ],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('厌对按正月辰逆行十二辰', () => {
  const targets = [...'辰卯寅丑子亥戌酉申未午巳'];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      assert.equal(
        names.includes('厌对'),
        targets[month] === branches[day % 12],
        `${month + 1}月/${pillar(day)}`,
      );
    }
});

test('大会小会覆盖校正后的完整月日组合', () => {
  // 《协纪辨方书》大会八日；小会依后按语改正二月、八月互误。
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuifck
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuqi44
  const tables = {
    大会: ['甲戌', '乙酉', '', '', '丙午', '丁巳', '庚辰', '辛卯', '', '', '壬子', '癸亥'],
    小会: ['', '己卯', '戊辰', '己巳', '戊午', '', '', '己酉', '戊戌', '己亥', '戊子', ''],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('鸣吠十三日与鸣吠对十一日按协纪最终校正覆盖全部月日组合', () => {
  // 《协纪》先引十四日、十日旧表，末按语及图明确改为十三日、十一日。
  // https://www.shidianguji.com/ens/book/SK1619/chapter/1l9llq0wzokdf
  const tables = {
    鸣吠: [
      '甲午',
      '丙午',
      '庚午',
      '壬午',
      '甲申',
      '丙申',
      '庚申',
      '壬申',
      '乙酉',
      '丁酉',
      '己酉',
      '辛酉',
      '癸酉',
    ],
    鸣吠对: [
      '甲寅',
      '丙寅',
      '庚寅',
      '壬寅',
      '乙卯',
      '丁卯',
      '辛卯',
      '癸卯',
      '丙子',
      '庚子',
      '壬子',
    ],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const dayPillar = pillar(day);
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets.includes(dayPillar),
          `${month + 1}月/${dayPillar}/${name}`,
        );
      }
    }
});

test('重日天罡河魁覆盖完整月日组合', () => {
  // 《选择历书》巳亥重日；《协纪辨方书》阳月罡前三魁后三，阴月反之。
  // https://www.shidianguji.com/mid-page/7589028950699130890
  // https://www.shidianguji.com/book/SK1619/chapter/1l9llprtuhq2c
  const tables = {
    重日: Array<string>(12).fill('巳亥'),
    天罡: [...'巳子未寅酉辰亥午丑申卯戌'],
    河魁: [...'亥午丑申卯戌巳子未寅酉辰'],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month].includes(branches[day % 12]),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('八龙七鸟九虎六蛇八专触水龙覆盖完整月日组合', () => {
  // 《协纪辨方书》四季八龙等起例、八专五日及触水龙三日。
  // https://www.shidianguji.com/mid-page/7430936675263742002
  // https://www.shidianguji.com/mid-page/7430936675339223090
  const tables = {
    八龙: ['甲子乙亥', '甲子乙亥', '甲子乙亥', '', '', '', '', '', '', '', '', ''],
    七鸟: ['', '', '', '丙子丁亥', '丙子丁亥', '丙子丁亥', '', '', '', '', '', ''],
    九虎: ['', '', '', '', '', '', '庚子辛亥', '庚子辛亥', '庚子辛亥', '', '', ''],
    六蛇: ['', '', '', '', '', '', '', '', '', '壬子癸亥', '壬子癸亥', '壬子癸亥'],
    八专: Array(12).fill('甲寅丁未己未庚申癸丑'),
    触水龙: Array(12).fill('丙子癸未癸丑'),
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});

test('八风地囊覆盖完整月日组合', () => {
  // 《协纪辨方书》八风与地囊校正表。
  // https://www.shidianguji.com/zh/mid-page/7430936655495921691
  const tables = {
    八风: [
      '丁丑丁巳',
      '丁丑丁巳',
      '丁丑丁巳',
      '甲申甲辰',
      '甲申甲辰',
      '甲申甲辰',
      '丁亥丁未',
      '丁亥丁未',
      '丁亥丁未',
      '甲寅甲戌',
      '甲寅甲戌',
      '甲寅甲戌',
    ],
    地囊: [
      '庚子庚午',
      '乙未癸丑',
      '甲子壬午',
      '己卯己酉',
      '壬戌甲辰',
      '丙辰丙戌',
      '丁巳丁亥',
      '丙寅丙申',
      '辛丑辛未',
      '戊寅戊申',
      '辛卯辛酉',
      '癸酉乙卯',
    ],
  };
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getCachedDayGodNames(month, day);
      for (const [name, targets] of Object.entries(tables)) {
        assert.equal(
          names.includes(name),
          targets[month].includes(pillar(day)),
          `${month + 1}月/${pillar(day)}/${name}`,
        );
      }
    }
});
