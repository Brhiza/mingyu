/**
 * @file 大运方向与小运（童限逐年）计算
 * @description
 *   - 大运顺逆：阳男阴女顺行，阴男阳女逆行（《渊海子平》起运法）
 *   - 小运（童限）：起运前的逐年干支，沿用 tyme4ts 的 ChildLimit.getStartFortune() 顺推
 *
 * @古籍依据 《渊海子平》"论行运"、《子平真诠》"论行运岁运"
 */
import { ChildLimit, Gender, SolarTime } from 'tyme4ts';
import type { XiaoYunItem, XiaoYunProfile, LuckDirectionProfile } from '../types/analysis';
import { assertBaziGender, assertHeavenlyStem } from './baziUtils';
import { HEAVENLY_STEMS } from '../ganzhi/data';
import { createChildLimit } from './childLimit';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
type LuckGender = Parameters<typeof ChildLimit.fromSolarTime>[1];
type FortuneInstance = ReturnType<ReturnType<typeof ChildLimit.fromSolarTime>['getStartFortune']>;

/**
 * 计算大运顺逆方向
 *
 * 法理：阳男阴女顺行，阴男阳女逆行
 *
 * @param gender 'male' | 'female'
 * @param yearStem 年柱天干
 * @returns 大运方向
 */
export function buildLuckDirectionProfile(gender: string, yearStem: string): LuckDirectionProfile {
  assertBaziGender(gender);
  assertHeavenlyStem(yearStem, '年干');

  const isMale = gender === 'male';
  const idx = HEAVENLY_STEMS.indexOf(yearStem as (typeof HEAVENLY_STEMS)[number]);
  const isYang = idx % 2 === 0;
  const direction: '顺行' | '逆行' = isMale === isYang ? '顺行' : '逆行';
  const rule = isMale
    ? isYang
      ? '阳男大运顺行'
      : '阴男大运逆行'
    : isYang
      ? '阳女大运逆行'
      : '阴女大运顺行';
  return { direction, summary: rule };
}

/**
 * 计算小运（童限逐年干支）
 *
 * 法理：以 tyme4ts 的 ChildLimit 取起运前的童限（getStartFortune），
 *   从起运岁向前逐年推算干支，直到第一步大运起运岁为止。
 *   逐年干支取 fortune.next(age - startAge)。
 *
 * @param solarTime 出生太阳时（已做真太阳时校正）
 * @param gender 性别
 * @param dayMasterGan 日主天干
 * @param getTenGod 十神取法
 * @returns 小运逐年列表
 */
export function calculateXiaoYunProfile(
  solarTime: SolarTimeInstance,
  gender: string,
  dayMasterGan: string,
  getTenGod: (gan: string, dayMaster: string) => string,
): XiaoYunProfile {
  assertBaziGender(gender);
  assertHeavenlyStem(dayMasterGan, '日主');

  const childLimit = createChildLimit(
    solarTime,
    (gender === 'male' ? Gender.MAN : Gender.WOMAN) as LuckGender,
  );
  const startFortune: FortuneInstance = childLimit.getStartFortune();
  const startAge = startFortune.getAge();
  const firstLuckAge = childLimit.getStartDecadeFortune().getStartAge();
  const endAge = Math.max(1, firstLuckAge);
  const birthYear = solarTime.getYear();

  const items: XiaoYunItem[] = [];
  for (let age = 1; age <= endAge; age += 1) {
    const fortune = startFortune.next(age - startAge);
    const ganZhi = fortune.getName();
    items.push({
      age,
      year: birthYear + age - 1,
      ganZhi,
      tenGod: getTenGod(ganZhi.charAt(0), dayMasterGan),
    });
  }

  return {
    startAge,
    startGanZhi: startFortune.getName(),
    firstLuckAge,
    items,
    summary: items.map((item) => `${item.age}岁${item.ganZhi}`).join('、'),
  };
}
