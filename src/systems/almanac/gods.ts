import { SolarDay, SolarTime } from 'tyme4ts';
import { EARTHLY_BRANCHES } from '../calendar';
import { getBranchIndex, getSixtyCycleIndex } from '../ganzhi-foundation';
import { getBaseDayGods, getGodLuck } from './rules';

export type AlmanacGodSource = 'xiejibianfang' | 'tongshu-folk';

export interface AlmanacGodEntry {
  name: string;
  luck: '吉' | '凶';
  source?: AlmanacGodSource;
}

const SHIE_DABAI_DAYS = new Set(['甲辰', '乙巳', '丙申', '丁亥', '戊戌', '己丑', '庚辰', '辛巳', '壬申', '癸亥']);
const SANIANG_SHA_DAYS = new Set([3, 7, 13, 18, 22, 27]);
const YANG_GONG_JI_DAYS = new Set(['1-13', '2-11', '3-9', '4-7', '5-5', '6-3', '7-1', '7-29', '8-27', '9-25', '10-23', '11-21', '12-19']);

/** 民俗常见忌日神煞（十恶大败、三娘煞、杨公忌）。 */
export function collectFolkTabooGods(lunarMonth: number, lunarDay: number, dayGanZhi: string): AlmanacGodEntry[] {
  const month = Math.abs(lunarMonth);
  const items: AlmanacGodEntry[] = [];
  if (SHIE_DABAI_DAYS.has(dayGanZhi)) items.push({ name: '十恶大败', luck: '凶', source: 'tongshu-folk' });
  if (SANIANG_SHA_DAYS.has(lunarDay)) items.push({ name: '三娘煞', luck: '凶', source: 'tongshu-folk' });
  if (YANG_GONG_JI_DAYS.has(`${month}-${lunarDay}`)) items.push({ name: '杨公忌', luck: '凶', source: 'tongshu-folk' });
  return items;
}

const FOLK_TABOO_GOD_NAMES = new Set(['十恶大败', '三娘煞', '杨公忌']);

/** 区分《协纪辨方书》正统值日神煞与民间通书补充忌神，默认全量返回，供流派分层展示。 */
export function classifyAlmanacGodSource(name: string): 'xiejibianfang' | 'tongshu-folk' {
  return FOLK_TABOO_GOD_NAMES.has(name) ? 'tongshu-folk' : 'xiejibianfang';
}

/** 黄历神煞按月日干支自研规则表与修正起例计算；不用于判定现实结果。 */
export function getAlmanacDayGods(monthGanZhi: string, dayGanZhi: string): AlmanacGodEntry[] {
  const monthBranchIndex = getBranchIndex(monthGanZhi[1]);
  if (monthBranchIndex < 0) throw new Error(`月柱无效：${monthGanZhi}`);
  const monthIndex = (monthBranchIndex - 2 + 12) % 12;
  const dayIndex = getSixtyCycleIndex(dayGanZhi);
  const dayStem = dayGanZhi[0];
  const dayBranch = dayGanZhi[1];
  const dayBranchIndex = getBranchIndex(dayBranch);
  const rules: Record<string, string | null> = {
    天德: ['丁', null, '壬', '辛', null, '甲', '癸', null, '丙', '乙', null, '庚'][monthIndex],
    天德合: ['壬', null, '丁', '丙', null, '己', '戊', null, '辛', '庚', null, '乙'][monthIndex],
    月德: ['丙', '甲', '壬', '庚'][monthIndex % 4],
    月德合: ['辛', '己', '丁', '乙'][monthIndex % 4],
    月恩: ['丙', '丁', '庚', '己', '戊', '辛', '壬', '癸', '庚', '乙', '甲', '辛'][monthIndex],
    月空: ['壬', '庚', '丙', '甲'][monthIndex % 4],
  };
  const matches: Record<string, boolean> = Object.fromEntries(
    Object.entries(rules).map(([name, stem]) => [name, dayStem === stem]),
  );
  const seasonIndex = Math.floor(monthIndex / 3);
  const branchRules: Record<string, string> = {
    时德: '午辰子寅'[seasonIndex],
    守日: '辰未戌丑'[seasonIndex],
    相日: '巳申亥寅'[seasonIndex],
    四击: '戌丑辰未'[seasonIndex],
    九空: '辰丑戌未'[monthIndex % 4],
    五富: '亥寅巳申'[monthIndex % 4],
    生气: EARTHLY_BRANCHES[monthIndex],
    普护: '申寅酉卯戌辰亥巳子午丑未'[monthIndex],
    福生: '酉卯戌辰亥巳子午丑未寅申'[monthIndex],
    玉宇: '卯酉辰戌巳亥午子未丑申寅'[monthIndex],
    金堂: '辰戌巳亥午子未丑申寅酉卯'[monthIndex],
    天仓: '寅丑子亥戌酉申未午巳辰卯'[monthIndex],
    天巫: EARTHLY_BRANCHES[(monthIndex + 4) % 12],
    福德: EARTHLY_BRANCHES[(monthIndex + 4) % 12],
    阳德: '戌子寅辰午申'[monthIndex % 6],
    阴德: '酉未巳卯丑亥'[monthIndex % 6],
    解神: '申戌子寅辰午'[Math.floor(monthIndex / 2)],
    时阳: EARTHLY_BRANCHES[monthIndex],
    时阴: EARTHLY_BRANCHES[(monthIndex + 6) % 12],
    玉堂: '未酉亥丑卯巳'[monthIndex % 6],
    金匮: '辰午申戌子寅'[monthIndex % 6],
    血支: EARTHLY_BRANCHES[(monthIndex + 1) % 12],
    血忌: '丑未寅申卯酉辰戌巳亥午子'[monthIndex],
    天刑: '寅辰午申戌子'[monthIndex % 6],
    白虎: '午申戌子寅辰'[monthIndex % 6],
    天牢: '申戌子寅辰午'[monthIndex % 6],
    朱雀: '卯巳未酉亥丑'[monthIndex % 6],
    勾陈: '亥丑卯巳未酉'[monthIndex % 6],
    天贼: '丑子亥戌酉申未午巳辰卯寅'[monthIndex],
    致死: '酉午卯子'[monthIndex % 4],
    月虚: '丑戌未辰'[monthIndex % 4],
    小耗: EARTHLY_BRANCHES[(monthIndex + 7) % 12],
    归忌: '丑寅子'[monthIndex % 3],
    土符: '丑巳酉寅午戌卯未亥辰申子'[monthIndex],
    土府: monthGanZhi[1],
    地火: '戌酉申未午巳辰卯寅丑子亥'[monthIndex],
    天吏: '酉午卯子'[monthIndex % 4],
    小时: monthGanZhi[1],
    大煞: '戌巳午未寅卯辰亥子丑申酉'[monthIndex],
    劫煞: '亥申巳寅'[monthIndex % 4],
    死神: EARTHLY_BRANCHES[(monthIndex + 5) % 12],
    游祸: '巳寅亥申'[monthIndex % 4],
    天火: '子酉午卯'[monthIndex % 4],
    灾煞: '子酉午卯'[monthIndex % 4],
    三丧: '辰未戌丑'[seasonIndex],
    天符: '戌子寅辰午申'[monthIndex % 6],
    河魁: '亥午丑申卯戌巳子未寅酉辰'[monthIndex],
  };
  for (const [name, branch] of Object.entries(branchRules)) {
    matches[name] = dayBranch === branch;
  }
  matches.月厌 = dayBranchIndex === (10 - monthIndex + 12) % 12;
  matches.六合 = (13 - monthBranchIndex) % 12 === dayBranchIndex;
  matches.五合 = '寅卯'.includes(dayBranch);
  matches.除神 = '申酉'.includes(dayBranch);
  matches.五虚 = ['巳酉丑', '申子辰', '亥卯未', '寅午戌'][seasonIndex].includes(dayBranch);
  matches.鸣吠 =
    dayBranch === '酉' || ('午申'.includes(dayBranch) && '甲丙庚壬'.includes(dayStem));
  matches.鸣吠对 =
    (dayBranch === '子' && '丙庚壬'.includes(dayStem)) ||
    (dayBranch === '寅' && '甲丙庚壬'.includes(dayStem)) ||
    (dayBranch === '卯' && '乙丁辛癸'.includes(dayStem));
  matches.月刑 = dayBranch === [...'巳子辰申午丑寅酉未亥卯戌'][monthIndex];
  matches.天恩 =
    dayIndex < 5 || (dayIndex >= 15 && dayIndex < 20) || (dayIndex >= 45 && dayIndex < 50);
  const nonGeneralStems = [
    '丙丁己庚辛',
    '乙丙丁己庚',
    '甲乙丙丁己',
    '甲乙丙丁戊',
    '甲乙丙戊癸',
    '甲乙戊壬癸',
    '甲乙戊壬癸',
    '甲戊辛壬癸',
    '戊庚辛壬癸',
    '己庚辛壬癸',
    '丁己庚辛壬',
    '丙丁己庚辛',
  ];
  matches.不将 =
    nonGeneralStems[monthIndex].includes(dayStem) &&
    (dayBranchIndex + monthIndex + 1) % 12 < 5;
  matches.大会 =
    ['甲戌', '乙酉', '', '', '丙午', '丁巳', '庚辰', '辛卯', '', '', '壬子', '癸亥'][monthIndex] ===
    dayGanZhi;
  matches.阳破阴冲 =
    (monthIndex === 5 && dayGanZhi === '癸丑') ||
    (monthIndex === 11 && dayGanZhi === '丁未');
  matches.八专 = ['甲寅', '丁未', '己未', '庚申', '癸丑'].includes(dayGanZhi);
  matches.重日 = '巳亥'.includes(dayBranch);
  matches.四离 = false;
  matches.阳错阴冲 = false;
  matches.成日 = false;
  matches.解除 = false;
  matches.孤辰 = [
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
  ][monthIndex].includes(dayGanZhi);
  const gods = getBaseDayGods(monthIndex, dayGanZhi).filter(
    (god) => !Object.hasOwn(matches, god.name) || matches[god.name],
  );
  for (const [name, matched] of Object.entries(matches)) {
    if (matched && !gods.some((god) => god.name === name)) {
      gods.push({ name, luck: getGodLuck(name) });
    }
  }
  return gods;
}

/** 日期查询以中国标准时间正午取月令；土王用事取四立前十八日。 */
export function getAlmanacSolarDayGods(
  solarDay: SolarDay,
  referenceTime = SolarTime.fromYmdHms(
    solarDay.getYear(),
    solarDay.getMonth(),
    solarDay.getDay(),
    12,
    0,
    0,
  ),
): AlmanacGodEntry[] {
  if (referenceTime.getSolarDay().toString() !== solarDay.toString()) {
    throw new Error('黄历参考时刻与查询日期必须是同一天。');
  }
  const cycleDay = referenceTime.getSixtyCycleHour().getSixtyCycleDay();
  const month = cycleDay.getMonth();
  const day = cycleDay.getSixtyCycle();
  const term = referenceTime.getTerm();
  const nextSeason = term.next((3 - term.getIndex() + 24) % 6 || 6);
  const secondsToNextSeason = nextSeason.getJulianDay().getSolarTime().subtract(referenceTime);
  const earthPeriod = secondsToNextSeason > 0 && secondsToNextSeason <= 18 * 86400;
  const season = Math.floor(month.getEarthBranch().next(-2).getIndex() / 3);
  const motherBranches = earthPeriod ? '巳午' : ['亥子', '寅卯', '辰戌丑未', '申酉'][season];
  const gods = getAlmanacDayGods(month.getName(), day.getName()).filter(
    (god) => god.name !== '母仓',
  );
  if (motherBranches.includes(day.getEarthBranch().getName())) {
    gods.push({ name: '母仓', luck: '吉' });
  }
  const dayTerm = solarDay.getTerm();
  const nextPrincipalTerm = dayTerm.next((24 - dayTerm.getIndex()) % 6 || 6);
  if (nextPrincipalTerm.getJulianDay().getSolarTime().getSolarDay().subtract(solarDay) === 1) {
    gods.push({ name: '四离', luck: '凶' });
  }
  return gods;
}

