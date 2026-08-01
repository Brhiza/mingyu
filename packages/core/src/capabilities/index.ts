import {
  ALMANAC_TOPIC_OPTIONS,
  LENORMAND_SPREAD_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
  XIAOLIUREN_METHOD_OPTIONS,
  JINKOUJUE_METHOD_OPTIONS,
} from '../divination/config';
import { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from '../shared/version';

export { MINGYU_CORE_VERSION, MINGYU_SCHEMA_VERSION } from '../shared/version';

export type CapabilityInputType =
  'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'array' | 'object';

export interface CapabilityOption {
  value: string;
  label: string;
}

export interface CapabilityInput {
  id: string;
  label: string;
  type: CapabilityInputType;
  required: boolean;
  description?: string;
  options?: CapabilityOption[];
  requiredWhen?: Record<string, string | boolean>;
}

export interface SystemCapability {
  id: string;
  name: string;
  category: 'chart' | 'divination' | 'calendar' | 'environment';
  /** 省略或为 true 表示可计算；false 表示只保留兼容入口并明确失败关闭。 */
  available?: boolean;
  methods?: CapabilityOption[];
  defaultMethod?: string;
  inputs: CapabilityInput[];
  outputs: string[];
  supports: {
    seed: boolean;
    customRandomSource: boolean;
    replay?: boolean;
    trueSolarTime: boolean;
    birthTimeRequired: boolean;
    birthTimeModes?: Array<'traditional-shichen' | 'precise-clock-time'>;
    batch: boolean;
  };
  optionalDependencies?: string[];
  notes?: string[];
}

export interface MingyuCapabilities {
  package: 'mingyu-core';
  version: string;
  schemaVersion: string;
  systems: SystemCapability[];
}

const birthProfileInput: CapabilityInput = {
  id: 'profile',
  label: '出生档案',
  type: 'object',
  required: true,
  description:
    '推荐使用统一 BirthProfile；时辰级算法可提供明确传统时辰，真太阳时、星盘和七政四余必须提供精准时分及所需地点资料。',
};

const questionInput: CapabilityInput = {
  id: 'question',
  label: '问题',
  type: 'text',
  required: false,
};

const randomSupports = {
  seed: true,
  customRandomSource: true,
  replay: true,
  trueSolarTime: false,
  birthTimeRequired: false,
  batch: false,
};

function options(items: ReadonlyArray<{ value: string; label: string }>): CapabilityOption[] {
  return items.map(({ value, label }) => ({ value, label }));
}

const systems: SystemCapability[] = [
  {
    id: 'calendar.trueSolarBirth',
    name: '出生真太阳时',
    category: 'calendar',
    inputs: [birthProfileInput],
    outputs: [
      '标准时间',
      '真太阳时',
      '经度修正',
      '均时差',
      '跨日状态',
      '时辰索引',
      '真太阳时结构化计算链与校正事实',
      '真太阳时证据汇总、来源与限制',
      'UTC与儒略日时间尺度证据',
      'ΔT与近似TT儒略日',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['precise-clock-time'],
      batch: false,
    },
  },
  {
    id: 'calendar.astronomicalTime',
    name: '天文时间尺度',
    category: 'calendar',
    inputs: [
      { id: 'localDateTime', label: '当地钟表时间', type: 'datetime', required: true },
      { id: 'timezone', label: '固定时区偏移', type: 'number', required: false },
      { id: 'timeZoneId', label: 'IANA历史时区', type: 'text', required: false },
    ],
    outputs: [
      '历史时区诊断',
      'UTC时间与Unix毫秒',
      'JD(UTC)与近似JD(UT1)',
      'ΔT与近似JD(TT)',
      '结构化计算链与假设',
      '近似反证、证据汇总与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: ['timezone 与 timeZoneId 至少提供一项；同时提供时会保留历史偏移冲突诊断。'],
  },
  {
    id: 'calendar.moonPhase',
    name: '月相与朔弦望',
    category: 'calendar',
    inputs: [{ id: 'utcDateTime', label: 'UTC时刻', type: 'datetime', required: true }],
    outputs: [
      '日月地心黄经',
      '月相角与最小距角',
      '八分月相与盈亏',
      '几何照明比例与近似月龄',
      '前后朔弦望求根事件',
      '结构化计算链、证据汇总与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    optionalDependencies: ['celestine'],
  },
  {
    id: 'calendar.solarTerm',
    name: '二十四节气交接证据',
    category: 'calendar',
    inputs: [
      { id: 'year', label: '年份', type: 'number', required: true },
      { id: 'index', label: '节气索引', type: 'number', required: true },
    ],
    outputs: [
      '采用历表交接时刻',
      '目标太阳回归黄经',
      '低阶视黄经独立求根',
      '历表与模型差值核验',
      '结构化计算链、证据汇总与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
  },
  {
    id: 'bazi',
    name: '八字',
    category: 'chart',
    inputs: [birthProfileInput],
    outputs: [
      '四柱',
      '十神',
      '藏干',
      '五行强度',
      '格局',
      '用神',
      '本命四柱与核心判断结构化证据',
      '真太阳时结构化计算链、校正事实与限制',
      '大运',
      '流年',
      '大运流年流月流日逐层触发证据',
      '岁运天干、地支与藏干分层喜忌候选',
      '岁运藏干透出对应候选',
      '岁运并临与天克地冲',
      '岁运补全三合、三会或三刑完整成员证据',
      '节气历表边界与太阳视黄经独立核验',
      '神煞',
      '固定刑冲合害破与三支完整结构',
      '双盘日主与十神映射',
      '双盘固定合冲刑害破及跨盘三支完整结构',
      '双盘喜忌覆盖',
      '双盘结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['traditional-shichen', 'precise-clock-time'],
      batch: false,
    },
    notes: [
      '未启用真太阳时时可直接使用明确的时辰索引；启用真太阳时时需提供完整小时、分钟和出生地。输入为空或非法时会在计算前拒绝。',
    ],
  },
  {
    id: 'ziwei',
    name: '紫微斗数',
    category: 'chart',
    inputs: [birthProfileInput],
    outputs: [
      '十二宫',
      '星曜',
      '四化',
      '大限',
      '流年',
      '结构化证据',
      '真太阳时结构化计算链、校正事实与限制',
      '双盘宫位叠盘',
      '双盘生年四化落点',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['traditional-shichen', 'precise-clock-time'],
      batch: false,
    },
    optionalDependencies: ['iztro'],
  },
  {
    id: 'astrolabe',
    name: '西洋星盘',
    category: 'chart',
    inputs: [birthProfileInput],
    outputs: [
      '行星',
      '宫位',
      '相位',
      '完整相位角距、偏差与采用容许度',
      '本命与行运作用域',
      '返照',
      '太阳返照求根过程与黄经残差',
      'IANA历史时区与夏令时诊断',
      '次限',
      '太阳弧',
      '双盘相位',
      '双盘相位完整角距与容许度',
      '跨盘落宫',
      '双盘结构化证据',
      '真太阳时结构化计算链、校正事实与限制',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['precise-clock-time'],
      batch: false,
    },
    optionalDependencies: ['celestine'],
  },
  {
    id: 'qimen',
    name: '奇门遁甲',
    category: 'divination',
    methods: options([
      { value: 'zhuanpan', label: '转盘' },
      { value: 'feipan', label: '飞盘' },
    ]),
    defaultMethod: 'zhuanpan',
    inputs: [
      {
        id: 'scope',
        label: '盘式周期',
        type: 'select',
        required: false,
        options: options([
          { value: 'hour', label: '时家' },
          { value: 'month', label: '月家' },
          { value: 'year', label: '年家' },
        ]),
      },
      {
        id: 'juMethod',
        label: '定局方法',
        type: 'select',
        required: false,
        options: options([
          { value: 'chaibu', label: '拆补法' },
          { value: 'zhirun', label: '置闰法' },
        ]),
        description: '拆补法与置闰法仅对时家生效；月家、年家自动使用各自三元定局法。',
      },
      { id: 'date', label: '起局时间', type: 'datetime', required: false },
      questionInput,
    ],
    outputs: [
      '九宫',
      '值符值使',
      '定局方法',
      '符头与超神接气',
      '用神宫候选',
      '门星神干证据',
      '天地盘干81种结构事实',
      '11项已校勘固定十干格',
      '时家完整上下文下已校勘的伏干格、飞干格、岁格、六庚值符临丙格勃中性结构事实',
      '时家天盘乙到震三、丙到离九、丁到兑七的三奇升殿中性位置结构',
      '时家天盘三奇、开休生门与太阴九地六合同宫的三诈中性位置结构',
      '时家天假、严格地假、鬼假三项条件一致的奇仪门神同宫中性结构',
      '时家六个固定时柱且值使门临地盘丁的玉女守门中性结构',
      '九遁各版本的奇仪门神、天地盘干与落宫冲突边界',
      '三奇得使与三奇游六仪的定义冲突及失败关闭边界',
      '天辅时主表与《太白阴经》同条异说的冲突及失败关闭边界',
      '五合时名称及其与天辅时混称的失败关闭边界',
      '天网与天网四张多套条件冲突的失败关闭边界',
      '三奇入墓、时干入墓与十干落宫入墓的版本冲突及失败关闭边界',
      '三奇受制条件层级冲突与三奇会甲原文不足的失败关闭边界',
      '六仪击刑六组时家固定落宫及月家年家外推关闭边界',
      '星门伏吟反吟时家实际位置规则及六甲时、天禽寄宫边界',
      '八门与九宫72种五行组合的门克宫中性结构及迫名冲突边界',
      '时家六十时柱固定六组时旬空及月家年家旬空外推关闭边界',
      '日马与时马起例层级未闭合、所有自动马星定位关闭边界',
      '月格、时格与普通勃格的版本冲突及失败关闭边界',
      '已审核时旬空与格局反证',
      '宫位关系',
      '八门余气（《奇门遁甲统宗》五态月令版）与十干迫制年命、旺衰条件不足时的失败关闭边界',
      '方位条件',
      '时间触发条件',
      '射覆、地私门、亭亭白奸及兵事主客、迷路、下营专项规则失败关闭边界',
      '节气历表边界与太阳视黄经独立核验',
      '节令背景只保留实际节气、旺相休囚死、精确月相与建除名称；正式三元仅采用甲己符头或置闰定局结果',
      '四柱关系以六十甲子两两穷举校验固定支对；半合、拱局与二支三刑条件不足时失败关闭',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
  },
  {
    id: 'liuyao',
    name: '六爻',
    category: 'divination',
    methods: options([
      { value: 'time', label: '时间种子模拟三钱（兼容方法名）' },
      { value: 'manual', label: '手工六爻' },
      { value: 'coins', label: '模拟三钱投掷' },
    ]),
    defaultMethod: 'time',
    inputs: [
      {
        id: 'yaos',
        label: '六次爻值',
        type: 'array',
        required: false,
        description: '按初爻至上爻传入 6、7、8、9。',
      },
      {
        id: 'coinThrows',
        label: '逐爻三钱记录',
        type: 'array',
        required: false,
        description: '按初爻至上爻传入六组三枚铜钱及合计，字面记 2、背面记 3。',
      },
      {
        id: 'template',
        label: '断卦模板',
        type: 'select',
        required: false,
        options: options(LIUYAO_TEMPLATE_OPTIONS),
      },
      questionInput,
    ],
    outputs: [
      '主卦',
      '变卦',
      '互卦',
      '动爻',
      '纳甲',
      '六亲',
      '六神',
      '旬空',
      '反吟伏吟',
      '月日固定相刑与卦内完整三刑结构',
      '用神候选与原神忌神仇神作用链',
      '逐爻支持证据与反证限制',
    ],
    supports: {
      seed: true,
      customRandomSource: true,
      replay: true,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '`time` 是兼容方法名，实际为时间戳固定种子的三钱模拟，并非传统历数起卦。',
      '现实投掷可传入六次爻值或逐爻三钱记录。',
      '公开证据只保留时间戳与时间种子、六个手工爻值、六组实投三钱或18个可重放样本之一，全部派生盘面统一重建。',
      '原始来源缺失、夹带、矛盾或随机轨迹无法复算时失败关闭。',
      '爻支与单个月日支只登记子卯固定相刑和辰午酉亥重复自刑；寅巳申、丑戌未须卦内三支齐见并满足发动条件。',
    ],
  },
  {
    id: 'meihua',
    name: '梅花易数',
    category: 'divination',
    methods: options(MEIHUA_METHOD_OPTIONS),
    defaultMethod: 'time',
    inputs: [
      {
        id: 'number',
        label: '起卦数字',
        type: 'number',
        required: false,
        requiredWhen: { method: 'number' },
      },
      questionInput,
    ],
    outputs: [
      '主卦',
      '互卦',
      '变卦',
      '体用',
      '动爻',
      '五行关系',
      '主互变体用推进链',
      '逐阶段月令支持与限制',
      '现场坐端应兆资料边界',
      '成卦前后耳目外应资料边界',
      '饮食专项适用与版本资料边界',
      '观物专项、占物类例、物数为体、变爻取象、现场克应、趣时、历史用易实例与手中物规则边界',
      '诸事响应专项情境与高风险边界',
      '占卜十应目录、内部三应复用与七应资料边界',
      '论事十大应目录、现场资料与日辰口径边界',
      '卦应八卦目录、说卦对照与版本资料边界',
      '反对性情综错卦、抽象卦义与版本边界',
      '全卦克应候选与事项情境边界',
    ],
    supports: randomSupports,
    notes: [
      '公开证据、提示词、摘要和辅助分析只保留起卦时间、方法、用户数字或可重放随机轨迹，主互变、动爻、体用、旺衰和旧证据全部重新计算。',
      '随机轨迹缺失、两份轨迹矛盾、样本数不为3、seeded 缺少种子或种子无法逐样本复算时失败关闭；非随机方法禁止携带随机轨迹。',
    ],
  },
  {
    id: 'xiaoliuren',
    name: '小六壬',
    category: 'divination',
    methods: options(XIAOLIUREN_METHOD_OPTIONS),
    defaultMethod: 'time',
    inputs: [{ id: 'date', label: '起课时间', type: 'datetime', required: false }, questionInput],
    outputs: [
      '起课时间与干支',
      '农历月日',
      '时辰及序号',
      '历法边界说明',
      '版本待校说明',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      replay: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '只保留可复核的时间、干支、农历月日与时辰序号；固定底本、版本和页码未校定前，不自动顺数、落宫或提供六宫歌诀。',
      '证据入口只保留时间起课标识与时间戳，所有历法事实和待校边界重新生成；不信任旧缓存派生字段。',
    ],
  },
  {
    id: 'jinkoujue',
    name: '金口诀',
    category: 'divination',
    methods: options(JINKOUJUE_METHOD_OPTIONS),
    defaultMethod: 'time',
    inputs: [
      {
        id: 'number',
        label: '起课数字',
        type: 'number',
        required: false,
        requiredWhen: { method: 'number' },
      },
      { id: 'date', label: '起课时间', type: 'datetime', required: false },
      questionInput,
    ],
    outputs: [
      '地分',
      '将神与将干',
      '贵神与神干',
      '人元',
      '阴阳发用',
      '五动三动',
      '四位生克',
      '月令与旬空',
      '结构化证据',
    ],
    supports: randomSupports,
    notes: [
      '金口诀采用《六壬神课金口诀古本》的四位、贵神本属、阴阳发用与五动三动口径，不与大六壬天将表或小六壬六宫混用。',
      '证据入口只保留起课方式、时间、用户数字或可重放随机样本，四位与证据均重新计算；随机轨迹缺失或矛盾时明确拒绝。',
    ],
  },
  {
    id: 'liuren',
    name: '大六壬',
    category: 'divination',
    methods: options(LIUREN_TEMPLATE_OPTIONS),
    defaultMethod: 'general',
    inputs: [{ id: 'date', label: '起课时间', type: 'datetime', required: false }, questionInput],
    outputs: [
      '天地盘',
      '四课',
      '三传',
      '天将',
      '月将、昼夜贵人及天将顺逆版本边界',
      '四课与九宗门取传主版本、异说及边界',
      '课体',
      '神煞',
      '四课取传依据与初传发用',
      '逐传日干六亲、有方向生克、相邻关系、旺衰与条件化旬空',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
  },
  {
    id: 'tarot',
    name: '塔罗',
    category: 'divination',
    methods: options(TAROT_SPREAD_OPTIONS),
    defaultMethod: 'single',
    inputs: [
      {
        id: 'spread',
        label: '牌阵',
        type: 'select',
        required: false,
        options: options(TAROT_SPREAD_OPTIONS),
      },
      questionInput,
    ],
    outputs: ['抽牌顺序', '牌位', '正逆位', '关键词', '结构化证据'],
    supports: randomSupports,
  },
  {
    id: 'lenormand',
    name: '雷诺曼',
    category: 'divination',
    methods: options(LENORMAND_SPREAD_OPTIONS),
    defaultMethod: 'single',
    inputs: [
      {
        id: 'spread',
        label: '牌阵',
        type: 'select',
        required: false,
        options: options(LENORMAND_SPREAD_OPTIONS),
      },
      questionInput,
    ],
    outputs: ['抽牌顺序', '牌位', '固定组合与相邻合读分层', '布局证据', '结构化证据'],
    supports: randomSupports,
  },
  {
    id: 'ssgw',
    name: '三山国王灵签',
    category: 'divination',
    inputs: [questionInput],
    outputs: ['签号', '签诗原文', '典故辅证', '分类解读', '掷筊记录', '随机轨迹', '结构化证据'],
    supports: randomSupports,
    notes: [
      '签文数据治理独立于通用接口，本能力清单不改变权威签文内容。',
      '签诗为文本主证，典故为辅证；seed或replay只证明过程可重放，不证明预测有效性。',
    ],
  },
  {
    id: 'almanac',
    name: '黄历择日',
    category: 'calendar',
    methods: options(ALMANAC_TOPIC_OPTIONS),
    inputs: [
      {
        id: 'topic',
        label: '事项',
        type: 'select',
        required: true,
        options: options(ALMANAC_TOPIC_OPTIONS),
      },
      { id: 'startDate', label: '开始日期', type: 'date', required: true },
      { id: 'endDate', label: '结束日期', type: 'date', required: true },
      { id: 'participants', label: '参与人', type: 'array', required: false },
    ],
    outputs: [
      '可用候选',
      '条件候选',
      '慎用候选',
      '事项宜忌证据',
      '参与人关系参考',
      '参与人冲、固定刑、害、破逐项事实',
      '候选时辰条件',
      '传统与现实约束',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: true,
      birthTimeModes: ['traditional-shichen', 'precise-clock-time'],
      batch: true,
    },
    notes: ['参与人双支相刑只保留子卯固定支对与辰午酉亥重复自刑；寅巳申、丑戌未任意二支失败关闭。'],
  },
  {
    id: 'bazhai',
    name: '八宅',
    category: 'environment',
    inputs: [
      birthProfileInput,
      {
        id: 'doorToInteriorDegree',
        label: '大门朝屋内角度',
        type: 'number',
        required: true,
        description: '站在大门处面向屋内测量，范围 0° 至小于 360°。',
      },
    ],
    outputs: [
      '二十四山',
      '坐向',
      '宅卦',
      '命卦',
      '命宅关系',
      '八宫',
      '磁北真北换算',
      '测量误差',
      '候选坐向',
      '边界稳定性',
      '命宅逐方重合与异判',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
  },
  {
    id: 'zodiac',
    name: '生肖流年',
    category: 'chart',
    inputs: [
      { id: 'zodiac', label: '生肖或年支', type: 'text', required: true },
      { id: 'year', label: '流年年份', type: 'number', required: false },
      { id: 'yearGanZhi', label: '流年干支', type: 'text', required: false },
    ],
    outputs: [
      '值冲固定刑害破关系',
      '六合固定支对与三合三会成员事实',
      '年干五行辅助关系',
      '计算链',
      '主证辅证反证',
      '信息量限制',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '生肖流年是只使用出生年支的轻量关系模型，不替代完整八字或现实资料；寅巳申、丑戌未任意二支不命名刑太岁，三合三会两支同组只记录成员事实。',
    ],
  },
  {
    id: 'taiyi',
    name: '太乙神数',
    category: 'divination',
    methods: options([{ value: 'year', label: '年计' }]),
    defaultMethod: 'year',
    inputs: [
      {
        id: 'year',
        label: '公历年份',
        type: 'number',
        required: true,
        description: '年计必须提供。',
      },
      {
        id: 'scope',
        label: '计式范围',
        type: 'select',
        required: false,
        options: options([{ value: 'year', label: '年计' }]),
      },
    ],
    outputs: ['七十二局', '阴阳遁', '太乙', '文昌', '始击', '主客定算', '十六神', '结构化证据'],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '当前只开放完成积年与七十二局立成校勘的年计；月、日、时计等待完整古籍历法链校勘。',
      '公开证据、提示词和摘要只凭原始公历年份审核重建；旧派生盘面不可信，缺少合法年份时失败关闭。',
    ],
  },
  {
    id: 'qizheng',
    name: '七政四余',
    category: 'chart',
    available: true,
    inputs: [
      birthProfileInput,
      {
        id: 'standardMeridian',
        label: '真太阳时标准经线',
        type: 'number',
        required: false,
        description: '使用 IANA 历史时区且启用真太阳时时必须明确提供。',
      },
    ],
    outputs: [
      '七政四余十一星',
      '二十八宿真实距星边界',
      '五项已校勘命身十二职宫规则',
      '宿度与十二宫落点',
      '十一星55组星对实际夹角',
      '八项已校勘传统神煞起例目标支',
      '庙旺与吊照未采用边界',
      '位置来源与精度分层',
      '月相与出生时刻光照',
      '结构化证据',
      '真太阳时命宫时辰与传统年界校正证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: true,
      birthTimeRequired: true,
      birthTimeModes: ['precise-clock-time'],
      batch: false,
    },
    notes: [
      '七政、罗睺、计都与月孛采用现代天文位置；紫炁采用《七政算内篇》古法均速模型，结果明确区分精度层级。',
      '二十八宿以SIMBAD距星J2000坐标、自行和目标日期黄道转换形成真实宿界；宫支、命宫、十二职宫和命主按《张果星宗》校勘，身宫按《五行精纪》《灵台经》取太阴所在宫。',
      '真太阳时只校正命宫所用生时与可能跨日的传统年界，不改变现代天体计算时刻，也不另行改算身宫。',
      '十一星的55组无序星对完整保留实际最小夹角；固定容许度吊照与简化庙旺表因缺少闭合原典依据而不自动判定。',
      '天乙昼贵与玉堂夜贵分开按生年干起例，驿马、华盖、劫煞、咸池、孤辰、寡宿按生年支起例；目标支不代表盘面命中或吉凶。',
      '农历年干支与立春年柱不一致时不自动选择岁首；使用 IANA 时区且未明确标准经线时，真太阳时失败关闭。',
    ],
  },
  {
    id: 'xuankong',
    name: '玄空飞星',
    category: 'environment',
    inputs: [
      {
        id: 'year',
        label: '建造或起运年',
        type: 'number',
        required: true,
        description: '独立玄空飞星排盘必须提供。',
      },
      {
        id: 'sitMountain',
        label: '坐山',
        type: 'text',
        required: false,
        description: '二十四山；可与朝向或度数二选一。',
      },
      {
        id: 'facingMountain',
        label: '朝向',
        type: 'text',
        required: false,
      },
      {
        id: 'facingDegree',
        label: '朝向度数',
        type: 'number',
        required: false,
        description: '正北 0°，顺时针；可与二十四山二选一。',
      },
      {
        id: 'sitDegree',
        label: '坐山度数',
        type: 'number',
        required: false,
      },
      {
        id: 'measurementUncertaintyDegrees',
        label: '测量误差',
        type: 'number',
        required: false,
      },
      {
        id: 'guaType',
        label: '卦型',
        type: 'select',
        required: false,
        options: options([
          { value: '下卦', label: '下卦' },
          { value: '替卦', label: '替卦' },
        ]),
      },
      questionInput,
    ],
    outputs: [
      '三元九运',
      '山向',
      '下卦与替卦',
      '运盘',
      '山盘',
      '向盘',
      '当运星位置结构',
      '到山到向',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '玄空飞星只输出可复现的下卦或兼向替卦三盘、替星过程、当运星位置比较与证据；不输出来源未闭合的特殊组合，也不覆盖形峦、玄空大卦或其他门派替卦口诀。',
      '可明确指定下卦或替卦；未指定时，偏离山中心不超过3°自动下卦、达到4.5°自动替卦，3°至4.5°异说区间及误差跨阈值情形会拒绝强判。',
    ],
  },
  {
    id: 'residential',
    name: '住宅风水',
    category: 'environment',
    inputs: [
      birthProfileInput,
      { id: 'year', label: '建造或起运年', type: 'number', required: false },
      {
        id: 'sitMountain',
        label: '坐山',
        type: 'text',
        required: false,
        description: '二十四山；可与朝向或度数二选一。',
      },
      { id: 'facingMountain', label: '朝向', type: 'text', required: false },
      {
        id: 'facingDegree',
        label: '朝向度数',
        type: 'number',
        required: false,
        description: '正北 0°，顺时针；可与二十四山二选一。',
      },
      { id: 'sitDegree', label: '坐山度数', type: 'number', required: false },
      {
        id: 'doorToInteriorDegree',
        label: '大门朝屋内角度',
        type: 'number',
        required: false,
        description: '站在大门处面向屋内测量，范围 0° 至小于 360°。',
      },
      {
        id: 'northReference',
        label: '北向基准',
        type: 'select',
        required: false,
        options: options([
          { value: 'unspecified', label: '未指定' },
          { value: 'magnetic', label: '磁北' },
          { value: 'true', label: '真北' },
        ]),
      },
      {
        id: 'magneticDeclinationDegrees',
        label: '磁偏角',
        type: 'number',
        required: false,
      },
      {
        id: 'measurementUncertaintyDegrees',
        label: '测量误差',
        type: 'number',
        required: false,
      },
      {
        id: 'guaType',
        label: '玄空卦型',
        type: 'select',
        required: false,
        options: options([
          { value: '下卦', label: '下卦' },
          { value: '替卦', label: '替卦' },
        ]),
      },
      questionInput,
    ],
    outputs: [
      '宅运结构',
      '人宅适配',
      '八宅命卦宅卦',
      '玄空下卦或替卦运盘山盘向盘',
      '合参要点',
      '行动建议',
      '结构化证据',
    ],
    supports: {
      seed: false,
      customRandomSource: false,
      trueSolarTime: false,
      birthTimeRequired: false,
      batch: false,
    },
    notes: [
      '住宅风水为产品统一入口：后台分别计算八宅与玄空飞星后合参，不生成综合吉凶总分，也不互相改写两套规则。',
      '至少提供山向/门向度数，或居住人出生年与性别/命卦之一；玄空宅运层还必须提供住宅建造年或起运年，缺年时不得用当前年份代替。底层 bazhai 与 xuankong 能力仍保留。',
    ],
  },
];

/** 返回可安全序列化的能力清单，供网站、App、API 或 MCP 自动生成入口。 */
export function getCapabilities(): MingyuCapabilities {
  return {
    package: 'mingyu-core',
    version: MINGYU_CORE_VERSION,
    schemaVersion: MINGYU_SCHEMA_VERSION,
    systems: structuredClone(systems),
  };
}

export function getSystemCapability(id: string): SystemCapability | undefined {
  const capability = systems.find((item) => item.id === id);
  return capability ? structuredClone(capability) : undefined;
}
