/**
 * 可选的精简古籍依据，用于组装自包含提示词。
 * 来源链接保留在结构化数据与文档中，规则内容为转述而非原文引文。
 */
export type ClassicalReference = {
  id: string;
  book: string;
  chapter: string;
  summary: string;
  application: string;
  sourceUrl: string;
  textType: 'summary';
};

function freezeReferences(
  references: readonly ClassicalReference[],
): readonly ClassicalReference[] {
  return Object.freeze(references.map((reference) => Object.freeze({ ...reference })));
}

const baziReferences = freezeReferences([
  {
    id: 'bazi-ziping-month-command',
    book: '子平真诠评注',
    chapter: '卷三·论用神成败救应',
    summary: '格局用神以月令为纲，并结合四柱配置辨其成败与救应。',
    application: '适用于已由四柱确认月令格局的命盘；以原局干支为本，讨论运年时再合看相应干支。',
    sourceUrl: 'https://www.ncc.com.tw/fate/paleo/bg/bg_033.htm',
    textType: 'summary',
  },
  {
    id: 'bazi-ditiansui-stem-nature',
    book: '滴天髓',
    chapter: '天干论',
    summary: '本篇分论十干体性，并依各干所临季节与五行关系说明作用。',
    application: '适用于按具体天干条目考察原局；依条文所列季节、干支与五行条件解读。',
    sourceUrl: 'https://zh.wikisource.org/zh-hans/%E6%BB%B4%E5%A4%A9%E9%AB%93/02',
    textType: 'summary',
  },
]);

const ziweiReferences = freezeReferences([
  {
    id: 'ziwei-full-chart-context',
    book: '紫微斗数全书',
    chapter: '卷一·太微赋',
    summary: '星曜各有所属；庙旺失度、同宫分布与生克制化，须结合全盘关系分别推论。',
    application:
      '适用于已有宫位与星曜安置的紫微命盘；围绕所问事项查看相关宫位，并合看全盘星曜关系。',
    sourceUrl:
      'https://zh.wikisource.org/zh-hans/%E7%B4%AB%E5%BE%AE%E6%96%97%E6%95%B8%E5%85%A8%E6%9B%B8/%E5%8D%B7%E4%B8%80',
    textType: 'summary',
  },
  {
    id: 'ziwei-three-directions-and-four-cardinals',
    book: '紫微斗数全书',
    chapter: '卷一·斗数发微论',
    summary: '四正、三方与对照合照共同参与判断，星曜入垣、失地及其关系影响格局。',
    application:
      '适用于宫位与星曜配置完整的紫微盘；结合相关宫位的三方四正、对照会照和星曜状态分析。',
    sourceUrl:
      'https://zh.wikisource.org/zh-hans/%E7%B4%AB%E5%BE%AE%E6%96%97%E6%95%B8%E5%85%A8%E6%9B%B8/%E5%8D%B7%E4%B8%80',
    textType: 'summary',
  },
]);

const liuyaoReferences = freezeReferences([
  {
    id: 'liuyao-select-use-deity',
    book: '增删卜易',
    chapter: '卷一·八宫图第三',
    summary: '六亲、世应与五行依八宫装卦；用神随所问事项选取，世爻标示占者。',
    application: '适用于纳甲六爻盘；先依据所问事项确定用神，再结合世应与六亲位置分析。',
    sourceUrl: 'https://zh.wikisource.org/zh-hans/%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93',
    textType: 'summary',
  },
  {
    id: 'liuyao-strength-and-change',
    book: '增删卜易',
    chapter: '卷一·八宫图第三及用神诸例',
    summary: '用神的判断合看旬空、月破、日月生克、冲刑、动爻与变爻关系。',
    application: '适用于已排出纳甲、世应、六亲和动变信息的卦；按本次占问的用神核对月日与动变。',
    sourceUrl: 'https://zh.wikisource.org/zh-hans/%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93',
    textType: 'summary',
  },
]);

const meihuaReferences = freezeReferences([
  {
    id: 'meihua-trigger-and-numbering',
    book: '梅花易数',
    chapter: '卷一·为人占、自己占、物卦起例',
    summary:
      '起卦可取言语、人物、身物、服色、外物、年月日时或书写；后天物卦以物为上卦、方位为下卦，并加时取动爻。',
    application: '适用于能够明确本次触机资料和起卦取数法的梅花卦；按该资料对应的章法立卦。',
    sourceUrl:
      'https://zh.wikisource.org/zh-hans/%E6%A2%85%E8%8A%B1%E6%98%93%E6%95%B8/%E5%8D%B7%E4%B8%80',
    textType: 'summary',
  },
  {
    id: 'meihua-body-use',
    book: '梅花易数',
    chapter: '卷二·体用总诀',
    summary: '体卦为主、用卦为事，结合互卦、变卦及卦气生克察事势。',
    application: '适用于已定体用、互变关系的梅花卦；围绕所问之事考察体用旺衰和卦间生克。',
    sourceUrl:
      'https://zh.wikisource.org/wiki/%E6%A2%85%E8%8A%B1%E6%98%93%E6%95%B8/%E5%8D%B7%E4%BA%8C',
    textType: 'summary',
  },
]);

const qimenReferences = freezeReferences([
  {
    id: 'qimen-yin-yang-dun-and-palaces',
    book: '遁甲演义',
    chapter: '卷一·烟波钓叟赋',
    summary: '依节气与阴阳遁定局，在九宫布列三奇六仪，并结合九星、八门等盘层取象。',
    application:
      '适用于起局时间、阴阳遁与九宫盘层已明确的奇门盘；按该盘式的星、门、神、仪关系解读。',
    sourceUrl: 'https://www.shidianguji.com/book/SK1616/chapter/1l9lop9pxu33o',
    textType: 'summary',
  },
]);

const liurenReferences = freezeReferences([
  {
    id: 'liuren-generals-and-relations',
    book: '六壬大全',
    chapter: '天将总论',
    summary:
      '篇中说明壬课以天地盘布贵神，天将随盘运转；断吉凶须合看天盘乘神与日干、所加地盘神之间的生克旺衰。',
    application:
      '适用于已给出天地盘、日辰、四课三传与天将的大六壬盘；围绕所问事项合看乘神与日干、所加地盘神的关系。',
    sourceUrl: 'https://www.shidianguji.com/book/SK1599/chapter/1k1lqkhebd2cy',
    textType: 'summary',
  },
]);

const jinkoujueReferences = freezeReferences([
  {
    id: 'jinkoujue-four-positions-and-five-movements',
    book: '六壬神课金口诀古本',
    chapter: '卷之上·消息妙论、入式歌解',
    summary:
      '课式由地分、月将、贵神、人元四位组成；入式歌取大象，五动察大意，再按格局、神煞、空亡月破与四位生克考察事体。',
    application:
      '适用于按该书四位法排出的金口诀课；以四位及本次所问事项为依据，配合课式中的五动和生克关系。',
    sourceUrl:
      'https://simplelits.com/books/classical/classical-08347-%E5%85%AD%E5%A3%AC%E7%A5%9E%E8%AF%BE%E9%87%91%E5%8F%A3%E8%AF%80/3',
    textType: 'summary',
  },
]);

const almanacReferences = freezeReferences([
  {
    id: 'almanac-jianchu-cycle',
    book: '钦定协纪辨方书',
    chapter: '卷四·义例二·建除十二神',
    summary:
      '建除十二日从月建起建，依十二辰顺行；书中汇列不同家法，并以事项、阴阳五行与诸神煞参合定宜忌。',
    application:
      '适用于按年、月、日择事的黄历语境；先明确月建和所择事项，再合看对应建除日与盘面所列宜忌。',
    sourceUrl:
      'https://zh.wikisource.org/zh-hans/%E6%AC%BD%E5%AE%9A%E5%8D%94%E7%B4%80%E8%BE%A8%E6%96%B9%E6%9B%B8_%28%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC%29/%E5%8D%B704',
    textType: 'summary',
  },
]);

const taiyiReferences = freezeReferences([
  {
    id: 'taiyi-five-generals-host-guest',
    book: '太乙金镜式经',
    chapter: '推五将所主法',
    summary: '以五将及主客关系组织太乙式中的观察框架；该法原篇以军旅胜负为主要占例。',
    application: '适用于已给出太乙局式、五将与主客位置的占盘；按该盘配置和原篇所论占事范围取象。',
    sourceUrl: 'https://www.shidianguji.com/zh/book/SK1615/chapter/1l9lir7w2l5ay',
    textType: 'summary',
  },
]);

const wuyunLiuqiReferences = freezeReferences([
  {
    id: 'wuyun-year-stem-and-six-qi',
    book: '黄帝内经素问',
    chapter: '天元纪大论',
    summary: '篇中以岁干配五运，并以司天、在泉及左右间气构成年度气化框架。',
    application: '适用于明确岁干、岁支及所用运气历法的年度运气盘；依当年五运六气配置讨论时令气化。',
    sourceUrl: 'https://www.shidianguji.com/book/DZ1018/chapter/1k85j5ct44fmu',
    textType: 'summary',
  },
]);

const huangjiReferences = freezeReferences([
  {
    id: 'huangji-yuanhui-coordinate',
    book: '皇极经世书（四库全书本）',
    chapter: '卷一上·观物篇一·以元经会一',
    summary: '本篇以元、会、运、世及年月日时层级记数，展示由大周期逐层推至细部的时间坐标。',
    application:
      '适用于已按本书纪数法给出的元会运世与年月日时盘面；先确定所用起算纪元，再据盘中坐标释读。',
    sourceUrl:
      'https://zh.wikisource.org/zh-hans/%E7%9A%87%E6%A5%B5%E7%B6%93%E4%B8%96%E6%9B%B8_%28%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC%29/%E5%8D%B701%E4%B8%8A',
    textType: 'summary',
  },
]);

const bazhaiReferences = freezeReferences([
  {
    id: 'bazhai-palace-star-relations',
    book: '阳宅大全',
    chapter: '八宅四书卷首卷二·八宅四',
    summary: '以八方为地、八卦为宫、九星为星，按宫星与宅方的五行生克判断宅位关系，并随游年布星。',
    application: '适用于已明确坐向、八方宫位和游年九星的八宅盘；围绕门、房与所问方位考察宫星生克。',
    sourceUrl: 'https://www.shidianguji.com/zh/book/CADAL02094260/chapter/1laxwz09awkz6',
    textType: 'summary',
  },
]);

const residentialReferences = freezeReferences([
  {
    id: 'residential-door-master-stove',
    book: '阳宅三要',
    chapter: '卷一·阳宅三要论',
    summary: '本篇以门、主、灶为阳宅三要，合看三者所在宫方的五行生克及相生、比和关系。',
    application:
      '适用于已明确大门、主房、灶所在方位及宅主命卦的居宅盘；围绕门、主、灶及方位关系解读。',
    sourceUrl: 'https://fs.qqqs.org/fssj/308.html',
    textType: 'summary',
  },
]);

const qizhengReferences = freezeReferences([
  {
    id: 'qizheng-star-configuration',
    book: '张果星宗',
    chapter: '卷十一·续论七政四余分布宜忌及入格真伪',
    summary: '篇中按星曜宫度、昼夜、月相及星体之间的生克、先后与会合条件辨析格局。',
    application:
      '适用于提供七政四余宫度、行度、昼夜与相关会合信息的星命盘；依具体格局条目核对盘面条件。',
    sourceUrl: 'https://guolaoxing.com/archives/4926',
    textType: 'summary',
  },
]);

const xiaoliurenReferences = freezeReferences([
  {
    id: 'xiaoliuren-month-day-hour-counting',
    book: '多能鄙事',
    chapter: '卷八·小六壬课时',
    summary:
      '本篇按月下起日、日上起时递推大安、留连、速喜、赤口、小吉、空亡六宫，并给出各月起宫次序。',
    application: '适用于按本篇月日时递推法建立的六宫课；结合盘面采用的计数口径与当前宫序解读。',
    sourceUrl: 'https://www.shidianguji.com/zh/book/CADAL02097181/chapter/1lco8m1j7ucyw',
    textType: 'summary',
  },
]);

const REFERENCES_BY_METHOD: Readonly<Record<string, readonly ClassicalReference[]>> = Object.freeze(
  {
    bazi: baziReferences,
    ziwei: ziweiReferences,
    'bazi-ziwei': freezeReferences([baziReferences[0], ziweiReferences[0]]),
    liuyao: liuyaoReferences,
    meihua: meihuaReferences,
    jinkoujue: jinkoujueReferences,
    qimen: qimenReferences,
    liuren: liurenReferences,
    almanac: almanacReferences,
    taiyi: taiyiReferences,
    'wuyun-liuqi': wuyunLiuqiReferences,
    'huangji-jingshi': huangjiReferences,
    bazhai: bazhaiReferences,
    residential: residentialReferences,
    qizheng: qizhengReferences,
    xiaoliuren: xiaoliurenReferences,
  },
);

const METHOD_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  huangji: 'huangji-jingshi',
  wuyun: 'wuyun-liuqi',
  'qimen-lifetime': 'qimen',
  'bazi-compatibility': 'bazi',
  'ziwei-compatibility': 'ziwei',
});

function resolveMethod(method: string): string | undefined {
  const canonicalMethod = Object.prototype.hasOwnProperty.call(METHOD_ALIASES, method)
    ? METHOD_ALIASES[method]
    : method;

  return Object.prototype.hasOwnProperty.call(REFERENCES_BY_METHOD, canonicalMethod)
    ? canonicalMethod
    : undefined;
}

export function getClassicalReferences(method: string): ClassicalReference[] {
  const canonicalMethod = resolveMethod(method);
  if (canonicalMethod === undefined) return [];

  return REFERENCES_BY_METHOD[canonicalMethod].map((reference) => ({ ...reference }));
}

export function supportsClassicalReferences(method: string): boolean {
  return resolveMethod(method) !== undefined;
}
