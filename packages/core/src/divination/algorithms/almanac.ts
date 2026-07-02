import { SolarDay } from 'tyme4ts';
import { baziCalculator } from '../../bazi/baziCalculator';
import { getBirthDateValidationMessage } from '../../calendar/date-validation';
import { getOppositeBranch, getSanxingType, isLiuhai, isLiupo, isSanxing } from './_shared';
import type {
  AlmanacAnnualDirectionGod,
  AlmanacData,
  AlmanacDayCandidate,
  AlmanacParticipantInput,
  AlmanacParticipantProfile,
  AlmanacTopic,
} from '../../types/divination';

export const ALMANAC_TOPIC_LABELS: Record<AlmanacTopic, string> = {
  move: '搬家入宅',
  marriage: '订婚结婚',
  opening: '开业启动',
  contract: '签约合作',
  travel: '出行赴任',
  medical: '就医手术',
  study: '考试学习',
  burial: '安葬修坟',
  renovation: '修造动土',
  custom: '自定义事项',
};

const TOPIC_RECOMMEND_KEYWORDS: Record<AlmanacTopic, string[]> = {
  move: ['入宅', '移徙', '安床', '修造', '动土'],
  marriage: ['嫁娶', '纳采', '订盟', '会亲友'],
  opening: ['开市', '交易', '立券', '纳财'],
  contract: ['交易', '立券', '纳财', '会亲友'],
  travel: ['出行', '赴任', '移徙'],
  medical: ['求医', '治病', '解除'],
  study: ['入学', '求嗣', '祭祀', '祈福'],
  burial: ['安葬', '修坟', '启钻', '立碑', '入殓', '移柩'],
  renovation: ['修造', '动土', '竖柱', '上梁', '盖屋', '起基'],
  custom: [],
};

const TOPIC_AVOID_KEYWORDS: Record<AlmanacTopic, string[]> = {
  move: ['入宅', '移徙', '安床'],
  marriage: ['嫁娶', '纳采', '订盟'],
  opening: ['开市', '交易', '立券'],
  contract: ['交易', '立券'],
  travel: ['出行', '赴任'],
  medical: ['求医', '治病'],
  study: ['入学', '求嗣'],
  burial: ['安葬', '修坟', '启钻'],
  renovation: ['修造', '动土', '竖柱', '上梁'],
  custom: [],
};

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const EARTH_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
type ParticipantBranchConflictType = '冲' | '刑' | '害' | '破';

const BRANCH_DIRECTIONS: Record<string, string> = {
  子: '正北',
  丑: '东北偏北',
  寅: '东北偏东',
  卯: '正东',
  辰: '东南偏东',
  巳: '东南偏南',
  午: '正南',
  未: '西南偏南',
  申: '西南偏西',
  酉: '正西',
  戌: '西北偏西',
  亥: '西北偏北',
};

const ANNUAL_DIRECTION_GOD_SEQUENCE: Array<
  Omit<AlmanacAnnualDirectionGod, 'branch' | 'direction'>
> = [
  { god: '太岁', fortune: '凶', meaning: '犯太岁防宅长大凶' },
  { god: '太阳', fortune: '吉', meaning: '修太阳能制诸煞，移床此方主添丁' },
  { god: '丧门', fortune: '凶', meaning: '犯丧门主死丧哭泣' },
  { god: '太阴', fortune: '吉', meaning: '修太阴主生女，散病患' },
  { god: '官符', fortune: '凶', meaning: '犯官符主口舌官讼' },
  { god: '死符', fortune: '凶', meaning: '犯死符主灾病死亡' },
  { god: '岁破', fortune: '凶', meaning: '犯岁破忧宅母' },
  { god: '龙德', fortune: '吉', meaning: '修龙德能散瘟疫官讼' },
  { god: '白虎', fortune: '凶', meaning: '犯白虎主哭泣死亡及小儿凶' },
  { god: '福德', fortune: '吉', meaning: '修福德主添丁生子' },
  { god: '吊客', fortune: '凶', meaning: '犯吊客主丧服' },
  { god: '病符', fortune: '凶', meaning: '犯病符主疾病' },
];

const PARTICIPANT_BRANCH_CONFLICT_PENALTY: Record<
  'year' | 'day',
  Record<ParticipantBranchConflictType, number>
> = {
  year: { 冲: 8, 刑: 6, 害: 5, 破: 5 },
  day: { 冲: 12, 刑: 10, 害: 8, 破: 8 },
};

function parseDateText(value: string, fieldName: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`${fieldName}需要使用 YYYY-MM-DD 格式`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) {
    throw new Error(`${fieldName}年份需在 1900-2100 之间`);
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`${fieldName}不是有效日期`);
  }

  return { year, month, day, date };
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hasAnyKeyword(values: string[], keywords: string[]) {
  if (keywords.length === 0) {
    return false;
  }

  return values.some((value) => keywords.some((keyword) => value.includes(keyword)));
}

function normalizeTaboos(items: Array<{ getName(): string }>) {
  return items.map((item) => item.getName()).filter(Boolean);
}

function shouldBuildParticipantProfile(item: AlmanacParticipantInput) {
  return Boolean(item.year && item.month && item.day && item.timeIndex !== '');
}

function readParticipantInteger(value: string, label: string, min: number, max: number) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`参与人${label}必须是 ${min}-${max} 的整数`);
  }

  const number = Number(text);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`参与人${label}必须是 ${min}-${max} 的整数`);
  }
  return number;
}

function readParticipantBirthInput(item: AlmanacParticipantInput) {
  const year = readParticipantInteger(item.year, '出生年份', 1900, 2100);
  const month = readParticipantInteger(item.month, '出生月份', 1, 12);
  const day = readParticipantInteger(item.day, '出生日期', 1, item.dateType === 'lunar' ? 30 : 31);
  const timeIndex = readParticipantInteger(item.timeIndex, '出生时辰', 0, 12);
  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType: item.dateType,
    isLeapMonth: Boolean(item.isLeapMonth),
  });

  if (validationMessage) {
    throw new Error(`参与人出生${validationMessage}`);
  }

  return { year, month, day, timeIndex };
}

function createParticipantProfiles(
  participants: AlmanacParticipantInput[],
): AlmanacParticipantProfile[] {
  return participants.filter(shouldBuildParticipantProfile).map((item) => {
    const birthInput = readParticipantBirthInput(item);
    const chart = baziCalculator.calculateBazi({
      year: birthInput.year,
      month: birthInput.month,
      day: birthInput.day,
      timeIndex: birthInput.timeIndex,
      gender: item.gender === '男' ? 'male' : item.gender === '女' ? 'female' : '',
      isLunar: item.dateType === 'lunar',
      isLeapMonth: Boolean(item.isLeapMonth),
      useTrueSolarTime: false,
    });

    return {
      id: item.id,
      name: item.name.trim() || '未命名参与人',
      gender: item.gender,
      solarDate: `${chart.solarDate.year}-${String(chart.solarDate.month).padStart(2, '0')}-${String(chart.solarDate.day).padStart(2, '0')}`,
      lunarDate: `${chart.lunarDate.monthName}${chart.lunarDate.dayName}`,
      zodiac: chart.zodiac,
      constellation: chart.constellation,
      dayMaster: chart.dayMaster.gan,
      dayMasterElement: chart.dayMaster.element,
      pillars: {
        year: chart.pillars.year.ganZhi,
        month: chart.pillars.month.ganZhi,
        day: chart.pillars.day.ganZhi,
        hour: chart.pillars.hour.ganZhi,
      },
      usefulGods: chart.analysis.usefulGod.favorableWuxing ?? chart.analysis.usefulGod.favorable,
      avoidGods: chart.analysis.usefulGod.unfavorableWuxing ?? chart.analysis.usefulGod.unfavorable,
    };
  });
}

// 建除十二神宜忌，按《选择要略》“建除宜忌”整理为择日事项关键词。
const JIANCHU_DUTIES: Record<string, { good: string[]; bad: string[]; advice: string }> = {
  建: {
    good: ['出行', '赴任', '祭祀', '入学', '冠带', '上任'],
    bad: ['修造', '动土', '开仓', '嫁娶', '栽种'],
    advice: '宜出行入学，忌修造动土嫁娶',
  },
  除: {
    good: ['祭祀', '祈福', '解除', '扫舍', '出行', '交易', '立券', '求医', '治病'],
    bad: ['移徙', '出财'],
    advice: '宜解除扫舍出行求医，忌移徙出财',
  },
  满: {
    good: ['扫舍', '出行', '栽种', '开市', '纳财', '祭祀', '祈福', '入宅'],
    bad: ['动土', '服药', '针灸'],
    advice: '宜开市纳财入宅，忌动土服药',
  },
  平: {
    good: ['祭祀', '修饰', '平治道路', '扫舍'],
    bad: ['开渠', '栽种', '经络'],
    advice: '宜修饰道路，忌开渠栽种',
  },
  定: {
    good: ['入学', '祈福', '祭祀', '嫁娶', '纳采', '问名', '求嗣', '冠带', '交易'],
    bad: ['词讼', '出行', '栽种', '立券'],
    advice: '宜入学嫁娶交易，忌词讼出行立券',
  },
  执: {
    good: ['祈福', '祭祀', '求嗣', '捕捉', '嫁娶', '立券'],
    bad: ['入宅', '移居', '移徙', '出行', '开仓', '纳财'],
    advice: '宜祭祀捕捉嫁娶，忌入宅移徙出行',
  },
  破: {
    good: ['求医', '治病', '破屋', '坏垣', '服药'],
    bad: ['动土', '修造', '出行', '嫁娶', '立券', '栽种', '纳畜'],
    advice: '宜求医破屋坏垣，忌动土出行嫁娶',
  },
  危: {
    good: ['祈福', '嫁娶', '纳采', '问名', '安床', '交易', '立券'],
    bad: ['登高', '行船', '伐木'],
    advice: '宜安床交易嫁娶，忌登高行船',
  },
  成: {
    good: [
      '祭祀',
      '祈福',
      '入学',
      '嫁娶',
      '纳采',
      '问名',
      '交易',
      '立券',
      '求医',
      '治病',
      '栽种',
      '出行',
      '入宅',
      '移居',
      '纳财',
      '冠带',
      '纳畜',
    ],
    bad: ['词讼'],
    advice: '宜开市交易嫁娶出行，忌词讼',
  },
  收: {
    good: ['收债', '纳财', '栽种', '祭祀', '入学', '嫁娶', '纳畜'],
    bad: ['出行', '针刺', '经络', '造坟', '安葬', '丧事'],
    advice: '宜收债纳财，忌出行安葬',
  },
  开: {
    good: [
      '祈福',
      '祭祀',
      '入学',
      '嫁娶',
      '交易',
      '立券',
      '栽种',
      '出行',
      '开库',
      '修造',
      '入宅',
      '移居',
      '治病',
    ],
    bad: ['破土', '安葬'],
    advice: '宜开市交易嫁娶出行入宅，忌破土安葬',
  },
  闭: {
    good: ['祈福', '祭祀', '求嗣', '交易', '立券', '收债', '修补', '安床'],
    bad: ['出行', '针刺', '出血', '灸火', '移徙', '动土'],
    advice: '宜收敛修补安床，忌出行动土移徙',
  },
};

/**
 * 二十八宿吉凶属性（《象吉通书》卷一二十八宿值日、清代《择日全纪》）：
 * 每宿含五行、吉凶、宜忌事项，用于黄历择日中辅助判断每日吉凶倾向。
 * 二十八宿轮流值日，每四星期（28日）一循环。
 *
 * 四灵七宿分布：
 * 东方苍龙七宿：角木蛟(吉) 亢金龙(凶) 氐土貉(吉) 房日兔(吉) 心月狐(凶) 尾火虎(吉) 箕水豹(凶)
 * 北方玄武七宿：斗木獬(吉) 牛金牛(凶) 女土蝠(凶) 虚日鼠(凶) 危月燕(凶) 室火猪(吉) 壁水貐(吉)
 * 西方白虎七宿：奎木狼(凶) 娄金狗(吉) 胃土雉(凶) 昴日鸡(凶) 毕月乌(吉) 觜火猴(凶) 参水猿(吉)
 * 南方朱雀七宿：井木犴(吉) 鬼金羊(凶) 柳土獐(凶) 星日马(吉) 张月鹿(吉) 翼火蛇(凶) 轸水蚓(吉)
 */
const TWENTY_EIGHT_STARS: Record<string, { wuxing: string; fortune: string; meaning: string }> = {
  角: { wuxing: '木', fortune: '吉', meaning: '角宿值日宜嫁娶、修造、出行，诸事可为' },
  亢: { wuxing: '金', fortune: '凶', meaning: '亢宿值日宜婚嫁，忌葬埋、开市' },
  氐: { wuxing: '土', fortune: '吉', meaning: '氐宿值日百事吉，宜嫁娶出行、修造动土' },
  房: { wuxing: '火', fortune: '吉', meaning: '房宿值日宜嫁娶、开市、入宅，忌安葬' },
  心: { wuxing: '火', fortune: '凶', meaning: '心宿值日宜嫁娶，忌安葬、出行、求财' },
  尾: { wuxing: '火', fortune: '吉', meaning: '尾宿值日诸事吉，宜嫁娶、开市、修造' },
  箕: { wuxing: '水', fortune: '凶', meaning: '箕宿值日宜造桥、修仓库，不宜嫁娶开市' },
  斗: { wuxing: '木', fortune: '吉', meaning: '斗宿值日百事吉，宜嫁娶、开市、修造、出行' },
  牛: { wuxing: '金', fortune: '凶', meaning: '牛宿值日宜祭祀，忌嫁娶、开市、修造' },
  女: { wuxing: '土', fortune: '凶', meaning: '女宿值日宜祭祀，忌嫁娶、出行、开市' },
  虚: { wuxing: '水', fortune: '凶', meaning: '虚宿值日百事不宜，诸事不吉' },
  危: { wuxing: '水', fortune: '凶', meaning: '危宿值日宜祭祀、安床，忌出行、开市' },
  室: { wuxing: '火', fortune: '吉', meaning: '室宿值日百事吉，宜修造、嫁娶、入宅' },
  壁: { wuxing: '水', fortune: '吉', meaning: '壁宿值日诸事吉，宜嫁娶、出行、开市' },
  奎: { wuxing: '木', fortune: '凶', meaning: '奎宿值日宜出行，忌修造、嫁娶、开市' },
  娄: { wuxing: '金', fortune: '吉', meaning: '娄宿值日诸事吉，宜婚嫁、修造、开市' },
  胃: { wuxing: '土', fortune: '凶', meaning: '胃宿值日宜祭祀，忌嫁娶、出行、开市' },
  昴: { wuxing: '火', fortune: '凶', meaning: '昴宿值日百事不宜，诸事不吉' },
  毕: { wuxing: '水', fortune: '吉', meaning: '毕宿值日宜修造、葬埋，忌嫁娶' },
  觜: { wuxing: '火', fortune: '凶', meaning: '觜宿值日宜祭祀，忌嫁娶、开市、出行' },
  参: { wuxing: '水', fortune: '吉', meaning: '参宿值日诸事吉，宜嫁娶、开市、修造' },
  井: { wuxing: '木', fortune: '吉', meaning: '井宿值日百事吉，宜修造、开市、出行' },
  鬼: { wuxing: '金', fortune: '凶', meaning: '鬼宿值日宜祭祀，忌嫁娶、修造、出行' },
  柳: { wuxing: '土', fortune: '凶', meaning: '柳宿值日宜祭祀，忌开市、出行' },
  星: { wuxing: '火', fortune: '吉', meaning: '星宿值日诸事吉，宜嫁娶、修造' },
  张: { wuxing: '木', fortune: '吉', meaning: '张宿值日百事吉，宜嫁娶、开市、出行' },
  翼: { wuxing: '火', fortune: '凶', meaning: '翼宿值日宜祭祀、出行，忌嫁娶' },
  轸: { wuxing: '水', fortune: '吉', meaning: '轸宿值日诸事吉，宜嫁娶、开市、修造' },
};

/**
 * 九星吉凶属性（《紫白九星》玄空飞星）：
 */
const NINE_STARS: Record<string, { wuxing: string; fortune: string; meaning: string }> = {
  一白: { wuxing: '水', fortune: '吉', meaning: '一白贪狼星，主官贵、文运、财禄' },
  二黑: { wuxing: '土', fortune: '凶', meaning: '二黑巨门星，主疾病、破财、是非' },
  三碧: { wuxing: '木', fortune: '凶', meaning: '三碧禄存星，主是非、争斗、官非' },
  四绿: { wuxing: '木', fortune: '吉', meaning: '四绿文曲星，主文昌、考试、名声' },
  五黄: { wuxing: '土', fortune: '凶', meaning: '五黄廉贞星，大凶，主凶灾、病患' },
  六白: { wuxing: '金', fortune: '吉', meaning: '六白武曲星，主财禄、武职、贵气' },
  七赤: { wuxing: '金', fortune: '凶', meaning: '七赤破军星，主破财、口舌、盗贼' },
  八白: { wuxing: '土', fortune: '吉', meaning: '八白左辅星，主财运、田宅、吉庆' },
  九紫: { wuxing: '火', fortune: '吉', meaning: '九紫右弼星，主喜事、婚姻、文书' },
};

const NINE_STAR_SHORT_NAME_MAP: Record<
  string,
  { wuxing: string; fortune: string; meaning: string }
> = Object.fromEntries(
  Object.entries(NINE_STARS).map(([name, detail]) => [name.slice(0, 1), detail]),
);

function getNineStarDetail(name: string) {
  return NINE_STARS[name] || NINE_STAR_SHORT_NAME_MAP[name.slice(0, 1)] || null;
}

function getAnnualDirectionGods(yearBranch: string): AlmanacAnnualDirectionGod[] {
  const startIndex = EARTH_BRANCHES.indexOf(yearBranch);
  if (startIndex < 0) return [];

  return ANNUAL_DIRECTION_GOD_SEQUENCE.map((item, index) => {
    const branch = EARTH_BRANCHES[(startIndex + index) % EARTH_BRANCHES.length];
    return {
      ...item,
      branch,
      direction: BRANCH_DIRECTIONS[branch] || '',
    };
  });
}

/**
 * 六曜历注（备查，tyme4ts 未直接提供六曜数据）：
 * 先胜(吉)、友引(吉)、先负(凶)、佛灭(凶)、大安(吉)、赤口(凶)
 */

/**
 * 彭祖百忌（每日天干地支对应的禁忌）：
 */
const PENGZU_DAY_GAN: Record<string, string> = {
  甲: '甲不开仓财物耗散',
  乙: '乙不栽植千株不长',
  丙: '丙不修灶必见灾殃',
  丁: '丁不剃头头必生疮',
  戊: '戊不受田田主不祥',
  己: '己不破券二比并亡',
  庚: '庚不经络织机虚张',
  辛: '辛不合酱主人不尝',
  壬: '壬不汲水更难提防',
  癸: '癸不词讼理弱敌强',
};

const PENGZU_DAY_ZHI: Record<string, string> = {
  子: '子不问卜自惹祸殃',
  丑: '丑不冠带主不还乡',
  寅: '寅不祭祀神鬼不尝',
  卯: '卯不穿井水泉不香',
  辰: '辰不哭泣必主重丧',
  巳: '巳不远行财物伏藏',
  午: '午不苫盖屋主更张',
  未: '未不服药毒气入肠',
  申: '申不安床鬼祟入房',
  酉: '酉不宴客醉坐颠狂',
  戌: '戌不吃狗作怪上床',
  亥: '亥不嫁娶不利新郎',
};

// 传统吉凶神煞清单（取自《协纪辨方书》，名称与 tyme4ts God.NAMES 对齐）。
// tyme4ts 的 getGods() 已返回每日临值神煞及其吉凶（getLuck），此处按传统
// 择日口径识别大吉神与大凶神，用于评分加权。
const SHENSHA_AUSPICIOUS = [
  '天德',
  '月德',
  '天德合',
  '月德合',
  '天赦',
  '天愿',
  '天恩',
  '岁德',
  '月恩',
  '月空',
  '母仓',
  '生气',
  '益后',
  '续世',
  '五富',
  '三合',
  '六合',
  '五合',
  '福德',
  '金匮',
  '玉堂',
  '司命',
  '青龙',
  '明堂',
  '金堂',
  '宝光',
];

const SHENSHA_INAUSPICIOUS = [
  '四废',
  '四离',
  '四穷',
  '四忌',
  '四击',
  '四耗',
  '五虚',
  '五离',
  '五墓',
  '劫煞',
  '灾煞',
  '月煞',
  '月刑',
  '月害',
  '月厌',
  '月破',
  '月建',
  '大煞',
  '大耗',
  '大败',
  '大时',
  '天火',
  '地火',
  '天贼',
  '天刑',
  '天牢',
  '朱雀',
  '白虎',
  '元武',
  '勾陈',
  '死神',
  '死气',
  '致死',
  '血支',
  '血忌',
  '游祸',
  '河魁',
  '土符',
  '土府',
  '往亡',
  '归忌',
  '厌对',
  '招摇',
  '九空',
  '九坎',
  '九焦',
  '天罡',
];

function getParticipantBranchConflict(
  candidateBranch: string,
  targetBranch: string,
): { type: ParticipantBranchConflictType; detail?: string } | null {
  if (!candidateBranch || !targetBranch) return null;

  if (candidateBranch === getOppositeBranch(targetBranch)) {
    return { type: '冲' };
  }

  if (isSanxing(candidateBranch, targetBranch)) {
    const sanxingType = getSanxingType(candidateBranch) || getSanxingType(targetBranch);
    return { type: '刑', detail: sanxingType || undefined };
  }

  if (isLiuhai(candidateBranch, targetBranch)) {
    return { type: '害' };
  }

  if (isLiupo(candidateBranch, targetBranch)) {
    return { type: '破' };
  }

  return null;
}

function getParticipantBranchConflictSummary(
  candidateBranch: string,
  participant: AlmanacParticipantProfile,
) {
  const targets: Array<{
    branch: string;
    label: string;
    scope: 'year' | 'day';
  }> = [
    { branch: participant.pillars.year.slice(-1), label: '生肖/年支', scope: 'year' },
    { branch: participant.pillars.day.slice(-1), label: '日支', scope: 'day' },
  ];

  const texts: string[] = [];
  let penalty = 0;

  targets.forEach((target) => {
    const conflict = getParticipantBranchConflict(candidateBranch, target.branch);
    if (!conflict) return;

    penalty += PARTICIPANT_BRANCH_CONFLICT_PENALTY[target.scope][conflict.type];
    const detail = conflict.detail ? `（${conflict.detail}）` : '';
    texts.push(`${conflict.type}${target.label}${target.branch}${detail}`);
  });

  return {
    penalty: Math.min(20, penalty),
    text: texts.length ? `候选日地支${candidateBranch}${texts.join('、')}，需谨慎` : '',
  };
}

function scoreDay(params: {
  topic: AlmanacTopic;
  dayBranch: string;
  dayDuty: string;
  recommends: string[];
  avoids: string[];
  gods: string[];
  participants: AlmanacParticipantProfile[];
}) {
  const highlights: string[] = [];
  const cautions: string[] = [];
  const participantNotes: string[] = [];
  let score = 60;

  const recommendKeywords = TOPIC_RECOMMEND_KEYWORDS[params.topic];
  const avoidKeywords = TOPIC_AVOID_KEYWORDS[params.topic];

  if (hasAnyKeyword(params.recommends, recommendKeywords)) {
    score += 18;
    highlights.push(`黄历宜项命中${ALMANAC_TOPIC_LABELS[params.topic]}`);
  }
  if (hasAnyKeyword(params.avoids, avoidKeywords)) {
    score -= 24;
    cautions.push(`黄历忌项触及${ALMANAC_TOPIC_LABELS[params.topic]}`);
  }

  // 建除十二神评分
  const duty = JIANCHU_DUTIES[params.dayDuty];
  if (duty) {
    if (hasAnyKeyword(recommendKeywords, duty.good)) {
      score += 8;
      highlights.push(`执日${params.dayDuty}宜${ALMANAC_TOPIC_LABELS[params.topic]}`);
    }
    if (hasAnyKeyword(avoidKeywords, duty.bad)) {
      score -= 15;
      cautions.push(`执日${params.dayDuty}${duty.advice}`);
    }
  }

  // 传统吉凶神煞评分（tyme4ts God 已含天德/月德/天赦/天愿/岁德等大吉神与四废/劫煞/灾煞等大凶神）。
  // 按《协纪辨方书》口径：大吉神临值宜趋吉，大凶神临值宜避忌。
  // 天赦：百无禁忌，+15；天德/月德为众神之首，+12；天恩天愿等次之+6。
  const bigAuspicious = SHENSHA_AUSPICIOUS.filter((name) => params.gods.includes(name));
  const bigInauspicious = SHENSHA_INAUSPICIOUS.filter((name) => params.gods.includes(name));
  if (bigAuspicious.length >= 2) {
    score += 6;
    highlights.push('吉神信息较多，可作为辅助加分');
  }
  for (const name of bigAuspicious) {
    if (name === '天赦') {
      score += 15;
      highlights.push(`天赦日：百无禁忌，诸事可为`);
    } else if (name === '天德' || name === '月德') {
      score += 12;
      highlights.push(`${name}临值：众神之首`);
    } else {
      score += 6;
    }
  }
  if (bigAuspicious.length > 1) {
    highlights.push(`吉神临值：${bigAuspicious.join('、')}`);
  }
  if (bigInauspicious.length > 0) {
    score -= bigInauspicious.length * 6;
    cautions.push(`凶神临值：${bigInauspicious.join('、')}，宜避忌`);
  }

  params.participants.forEach((participant) => {
    const branchConflict = getParticipantBranchConflictSummary(params.dayBranch, participant);

    if (branchConflict.text) {
      score -= branchConflict.penalty;
      participantNotes.push(`${participant.name}：${branchConflict.text}`);
      return;
    }

    participantNotes.push(
      `${participant.name}：日主${participant.dayMaster}${participant.dayMasterElement}，生肖${participant.zodiac}，未见直接刑冲破害提醒`,
    );
  });

  return {
    score: Math.max(0, Math.min(100, score)),
    highlights,
    cautions,
    participantNotes,
  };
}

// 地支刑冲破害判断已委托 _shared 模块。

function buildDayCandidate(
  date: Date,
  topic: AlmanacTopic,
  participants: AlmanacParticipantProfile[],
): AlmanacDayCandidate {
  const solarDay = SolarDay.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunarDay = solarDay.getLunarDay();
  const dayCycle = lunarDay.getSixtyCycle();
  const dayBranch = dayCycle.getEarthBranch();
  const recommends = normalizeTaboos(lunarDay.getRecommends());
  const avoids = normalizeTaboos(lunarDay.getAvoids());
  const gods = lunarDay.getGods().map((item: { getName(): string }) => item.getName());
  const dayDuty = lunarDay.getDuty().getName();
  const scoring = scoreDay({
    topic,
    dayBranch: dayBranch.getName(),
    dayDuty,
    recommends,
    avoids,
    gods,
    participants,
  });

  // 彭祖百忌完整：天干+地支
  const dayStemName = dayCycle.getHeavenStem().getName();
  const dayZhiName = dayCycle.getEarthBranch().getName();

  return {
    date: formatDate(date),
    weekday: WEEKDAYS[date.getDay()],
    lunarDate: lunarDay.toString(),
    ganzhi: {
      year: lunarDay.getYearSixtyCycle().getName(),
      month: lunarDay.getMonthSixtyCycle().getName(),
      day: dayCycle.getName(),
    },
    zodiac: dayBranch.getZodiac().getName(),
    dayOfficer: lunarDay.getDuty().getName(),
    twelveStar: lunarDay.getTwelveStar().getName(),
    twentyEightStar: lunarDay.getTwentyEightStar().getName(),
    twentyEightStarDetail: TWENTY_EIGHT_STARS[lunarDay.getTwentyEightStar().getName()] || null,
    nineStar: lunarDay.getNineStar().getName(),
    nineStarDetail: getNineStarDetail(lunarDay.getNineStar().getName()),
    gods,
    recommends,
    avoids,
    pengZu: dayCycle.getPengZu().getName(),
    // 彭祖百忌完整：天干+地支
    pengZuGan: PENGZU_DAY_GAN[dayStemName] || '',
    pengZuZhi: PENGZU_DAY_ZHI[dayZhiName] || '',
    clash: `冲${dayBranch.getOpposite().getName()}，煞${dayBranch.getOminous().getName()}`,
    annualDirectionGods: getAnnualDirectionGods(
      lunarDay.getYearSixtyCycle().getEarthBranch().getName(),
    ),
    score: scoring.score,
    highlights: scoring.highlights,
    cautions: scoring.cautions,
    participantNotes: scoring.participantNotes,
  };
}

/**
 * 生成黄历择日结果
 *
 * 对指定日期范围内逐日分析宜忌、神煞、冲煞、建除十二值、
 * 二十八宿、彭祖百忌等，并基于参与人八字进行刑冲破害校验。
 *
 * @param params 择日参数：
 *   - topic: 事项类型（marriage/move/opening/…）
 *   - startDate: 开始日期 (YYYY-MM-DD)
 *   - endDate: 结束日期 (YYYY-MM-DD)，最多比较 31 天
 *   - participants: 参与人信息（可选），含八字用于刑冲破害校验
 * @returns 黄历择日数据对象 AlmanacData。
 *
 * @example
 * ```ts
 * const result = generateAlmanacSelection({
 *   topic: 'marriage',
 *   startDate: '2025-06-01',
 *   endDate: '2025-06-30',
 * });
 * // result 包含 bestDate、goodDates、avoidDates 等字段
 * ```
 */
export function generateAlmanacSelection(params: {
  topic: AlmanacTopic;
  startDate: string;
  endDate: string;
  participants?: AlmanacParticipantInput[];
}): AlmanacData {
  const start = parseDateText(params.startDate, '开始日期');
  const end = parseDateText(params.endDate, '结束日期');
  const diffDays = Math.round((end.date.getTime() - start.date.getTime()) / 86400000);

  if (diffDays < 0) {
    throw new Error('结束日期不能早于开始日期');
  }
  if (diffDays > 30) {
    throw new Error('黄历择日一次最多比较 31 天，请缩小日期范围');
  }

  const participants = createParticipantProfiles(params.participants ?? []);
  const days = Array.from({ length: diffDays + 1 }, (_, index) => {
    const current = new Date(start.date);
    current.setDate(start.date.getDate() + index);
    return buildDayCandidate(current, params.topic, participants);
  }).sort((a, b) => b.score - a.score);

  return {
    topic: params.topic,
    topicLabel: ALMANAC_TOPIC_LABELS[params.topic],
    startDate: params.startDate,
    endDate: params.endDate,
    days,
    participants,
    timestamp: Date.now(),
  };
}
