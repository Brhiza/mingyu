import { SolarDay, SolarTime } from 'tyme4ts';
import { findCivilSolarTermEvidence, type SolarTermName } from '../astronomy/solar-term-evidence';
import { calculateCivilMoonPhaseEvidence } from '../astronomy/moon-phase-evidence';
import type { QimenData } from './types';
import { getStemWuxing, isKe, isSheng } from '../calendar';
import { analyzeGanzhiInteractions } from './interactions';
import { lunarDateDiscrepancy } from '../birth-time';

const seasonalElements: Record<string, string> = Object.fromEntries([
  ['立春,雨水,惊蛰,春分', '木'], ['清明,谷雨,小暑,大暑,寒露,霜降,小寒,大寒', '土'],
  ['立夏,小满,芒种,夏至', '火'], ['立秋,处暑,白露,秋分', '金'], ['立冬,小雪,大雪,冬至', '水'],
].flatMap(([terms, element]) => terms.split(',').map((term) => [term, element])));
const officers: Record<string, { fortune: '吉' | '凶' | '平'; meaning: string }> = {
  建: { fortune: '凶', meaning: '建为岁君，宜不宜动土、开仓，出行上任尚可' },
  除: { fortune: '吉', meaning: '除为扫舍，宜解除、治病、扫舍，忌出行嫁娶' },
  满: { fortune: '凶', meaning: '满为福德，宜祭祀、祈福、进人口，忌栽种下葬' },
  平: { fortune: '凶', meaning: '平为六合，宜修造、动土，忌嫁娶出行' },
  定: { fortune: '吉', meaning: '定为官符，宜冠带、嫁娶、订盟，忌词讼出行' },
  执: { fortune: '吉', meaning: '执为小耗，宜祭祀、捕捉、修造，忌移徙出行' },
  破: { fortune: '凶', meaning: '破为大耗，诸事不宜，宜破屋坏垣' },
  危: { fortune: '吉', meaning: '危为极富，宜安床、祭祀，忌登高出行' },
  成: { fortune: '吉', meaning: '成为天府，宜开市、嫁娶、签约，忌词讼出行' },
  收: { fortune: '凶', meaning: '收为天仓，宜收债、纳财，忌开市出行' },
  开: { fortune: '吉', meaning: '开为文昌，宜开市、嫁娶，忌安葬出行' },
  闭: { fortune: '凶', meaning: '闭为天狱，宜安葬、收藏，忌开市出行' },
};

/** 北京时间的节气、日干、月相、建除与四柱背景。 */
export function buildSeasonality(ganzhi: { year: string; month: string; day: string; hour: string }, date: Date, referenceDate: Date = date, offsetMinutes = 480): NonNullable<QimenData['seasonality']> {
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  const year = local.getUTCFullYear(), month = local.getUTCMonth() + 1, day = local.getUTCDate();
  const reference = new Date(referenceDate.getTime() + 8 * 3_600_000);
  const time = SolarTime.fromYmdHms(reference.getUTCFullYear(), reference.getUTCMonth() + 1, reference.getUTCDate(), reference.getUTCHours(), reference.getUTCMinutes(), reference.getUTCSeconds());
  const term = time.getTerm(), currentJieQi = term.getName(), start = term.getJulianDay().getSolarTime();
  const diff = Math.floor(time.getJulianDay().getDay() - start.getJulianDay().getDay());
  const phaseIndex = Math.min(2, Math.floor(diff / 5));
  const phase = (['上元', '中元', '下元'] as const)[phaseIndex];
  const termYear = currentJieQi === '冬至' && start.getMonth() === 12 ? start.getYear() + 1 : start.getYear();
  const jieQiPhase = { jieQi: currentJieQi, phase, phaseIndex, solarTermEvidence: findCivilSolarTermEvidence(currentJieQi as SolarTermName, termYear) };
  const seasonalElement = seasonalElements[currentJieQi];
  if (!seasonalElement) throw new Error(`无法识别节气 "${currentJieQi}" 的五行属性。`);
  const dayStem = ganzhi.day[0], dayElement = getStemWuxing(dayStem);
  let seasonRelation: '得时' | '受生' | '受克' | '被耗' | '持平', seasonRelationDescription: string;
  if (dayElement === seasonalElement) { seasonRelation = '得时'; seasonRelationDescription = `${dayStem}属${dayElement}，与节令${seasonalElement}比和，当令而旺。`; }
  else if (isSheng(seasonalElement, dayElement)) { seasonRelation = '受生'; seasonRelationDescription = `节令${seasonalElement}生${dayStem}之${dayElement}，得令相助。`; }
  else if (isSheng(dayElement, seasonalElement)) { seasonRelation = '被耗'; seasonRelationDescription = `${dayStem}之${dayElement}生节令${seasonalElement}，泄气被耗。`; }
  else if (isKe(seasonalElement, dayElement)) { seasonRelation = '受克'; seasonRelationDescription = `节令${seasonalElement}克${dayStem}之${dayElement}，受制不吉。`; }
  else { seasonRelation = '持平'; seasonRelationDescription = `${dayStem}之${dayElement}克节令${seasonalElement}，虽能克令但亦耗力，持平。`; }
  if (reference.getUTCFullYear() < 1900 || reference.getUTCFullYear() > 2200) throw new Error('奇门月相证据当前支持 1900-2200 年的当地钟表。');
  const lunarDay = SolarDay.fromYmd(year, month, day).getLunarDay();
  const lunar = lunarDay.getPhase(), lunarPhaseDetail = lunar.getName();
  const lunarPhase = (['新月', '上弦', '上弦', '满月', '满月', '下弦', '下弦', '下弦'] as const)[lunar.getIndex()];
  const moonPhaseEvidence = calculateCivilMoonPhaseEvidence(referenceDate.getTime());
  const dayOfficer = lunarDay.getDuty().getName(), officer = officers[dayOfficer];
  if (!officer) throw new Error(`无法识别建除十二神 "${dayOfficer}"。`);
  return {
    currentJieQi, seasonalElement, jieQiPhase, dayStem, dayElement, seasonRelation, seasonRelationDescription,
    lunarPhase, lunarPhaseDetail, moonPhaseEvidence, lunarPhaseConsistency: lunarPhaseDetail === moonPhaseEvidence.eightPhaseName,
    ...(lunarDateDiscrepancy({ year, month, day }) ? { lunarDateWarning: lunarDateDiscrepancy({ year, month, day }) } : {}),
    dayOfficer, dayOfficerFortuneLabel: officer.fortune, dayOfficerAdvice: officer.meaning,
    ganzhiInteractions: analyzeGanzhiInteractions(ganzhi),
  };
}
