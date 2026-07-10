import { LunarHour, SolarTime } from 'tyme4ts';
import {
  assertBaziGender,
  getGanYinYang,
  getTenGod,
  getTenGodForBranch,
  getWuxing,
} from '../bazi/baziUtils';
import { getBirthDateValidationMessage } from '../calendar/date-validation';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;

export type BirthBaseInput = {
  gender: 'male' | 'female';
  dateType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  isLeapMonth: boolean;
};

export type ThreePillarDetail = {
  label: '年柱' | '月柱' | '日柱';
  gan: string;
  zhi: string;
  ganZhi: string;
  ganWuxing: string;
  zhiWuxing: string;
  tenGod: string;
  branchTenGod: string;
};

export type ThreePillarsProfile = {
  genderLabel: string;
  dateTypeLabel: string;
  solarDateLabel: string;
  lunarDateLabel: string;
  zodiac: string;
  timeBoundaryNotes: string[];
  dayMaster: {
    gan: string;
    element: string;
    yinYang: string;
  };
  pillars: {
    year: ThreePillarDetail;
    month: ThreePillarDetail;
    day: ThreePillarDetail;
  };
  wuxingCount: Record<string, number>;
  promptText: string;
};

function readBirthInteger(value: unknown, label: string) {
  if (typeof value !== 'string') {
    throw new Error(`${label}必须是整数。`);
  }
  const text = value.trim();
  if (!text) {
    throw new Error('请先填写完整的出生年月日。');
  }
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label}必须是整数。`);
  }
  return Number(text);
}

function assertDateType(value: string): asserts value is 'solar' | 'lunar' {
  if (value !== 'solar' && value !== 'lunar') {
    throw new Error(`日历类型无效：${value}`);
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') {
    throw new Error(`${label}必须是布尔值。`);
  }
}

function createBaseTime(input: BirthBaseInput) {
  const year = readBirthInteger(input.year, '出生年份');
  const month = readBirthInteger(input.month, '出生月份');
  const day = readBirthInteger(input.day, '出生日期');

  assertDateType(input.dateType);
  assertBoolean(input.isLeapMonth, 'isLeapMonth');

  if (year < 1900 || year > 2100) {
    throw new Error('出生年份需在 1900-2100 之间。');
  }
  if (month < 1 || month > 12) {
    throw new Error('出生月份需在 1-12 之间。');
  }
  if (day < 1) {
    throw new Error('出生日期不能小于 1。');
  }

  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType: input.dateType,
    isLeapMonth: input.isLeapMonth,
  });
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  if (input.dateType === 'lunar') {
    const lunarMonth = input.isLeapMonth ? -Math.abs(month) : month;
    const lunarHour = LunarHour.fromYmdHms(year, lunarMonth, day, 12, 0, 0);
    return {
      solarTime: lunarHour.getSolarTime(),
      lunarHour,
    };
  }

  const solarTime = SolarTime.fromYmdHms(year, month, day, 12, 0, 0);
  return {
    solarTime,
    lunarHour: solarTime.getLunarHour(),
  };
}

function buildPillarDetail(
  label: ThreePillarDetail['label'],
  gan: string,
  zhi: string,
  dayMasterGan: string,
): ThreePillarDetail {
  return {
    label,
    gan,
    zhi,
    ganZhi: `${gan}${zhi}`,
    ganWuxing: getWuxing(gan),
    zhiWuxing: getWuxing(zhi),
    tenGod: label === '日柱' ? '日主' : getTenGod(gan, dayMasterGan),
    branchTenGod: label === '日柱' ? '日支' : getTenGodForBranch(zhi, dayMasterGan),
  };
}

function buildWuxingCount(pillars: ThreePillarsProfile['pillars']) {
  const count: Record<string, number> = {
    木: 0,
    火: 0,
    土: 0,
    金: 0,
    水: 0,
  };

  Object.values(pillars).forEach((pillar) => {
    count[pillar.ganWuxing] += 1;
    count[pillar.zhiWuxing] += 1;
  });

  return count;
}

function formatWuxingCount(wuxingCount: Record<string, number>) {
  return Object.entries(wuxingCount)
    .map(([key, value]) => `${key}:${value}`)
    .join('  ');
}

function getPillarsAtSolarHour(solarTime: SolarTimeInstance, hour: number, minute = 0, second = 0) {
  const eightChar = SolarTime.fromYmdHms(
    solarTime.getYear(),
    solarTime.getMonth(),
    solarTime.getDay(),
    hour,
    minute,
    second,
  )
    .getLunarHour()
    .getEightChar();

  return {
    year: eightChar.getYear().getName(),
    month: eightChar.getMonth().getName(),
    day: eightChar.getDay().getName(),
  };
}

function buildTimeBoundaryNotes(solarTime: SolarTimeInstance) {
  const notes = [
    '因出生时辰未知，当前三柱以出生日期当天12:00计算；若实际出生在23:00-24:00，按子初换日口径日柱可能进入次日，反推时辰时必须单独验证。',
  ];
  const startPillars = getPillarsAtSolarHour(solarTime, 0, 0, 0);
  const noonPillars = getPillarsAtSolarHour(solarTime, 12, 0, 0);
  const endPillars = getPillarsAtSolarHour(solarTime, 23, 59, 59);

  if (
    startPillars.year !== noonPillars.year ||
    endPillars.year !== noonPillars.year ||
    startPillars.month !== noonPillars.month ||
    endPillars.month !== noonPillars.month
  ) {
    notes.push(
      '此日存在节气交接，年柱或月柱会随具体出生时刻改变；当前显示为12:00对应三柱，交节前后需分开校验。',
    );
  }

  return notes;
}

export function buildThreePillarsProfile(input: BirthBaseInput): ThreePillarsProfile {
  assertBaziGender(input.gender);
  const { solarTime, lunarHour } = createBaseTime(input);
  const eightChar = lunarHour.getEightChar();
  const yearPillar = eightChar.getYear();
  const monthPillar = eightChar.getMonth();
  const dayPillar = eightChar.getDay();
  const dayMasterGan = dayPillar.getHeavenStem().getName();

  const pillars = {
    year: buildPillarDetail(
      '年柱',
      yearPillar.getHeavenStem().getName(),
      yearPillar.getEarthBranch().getName(),
      dayMasterGan,
    ),
    month: buildPillarDetail(
      '月柱',
      monthPillar.getHeavenStem().getName(),
      monthPillar.getEarthBranch().getName(),
      dayMasterGan,
    ),
    day: buildPillarDetail(
      '日柱',
      dayPillar.getHeavenStem().getName(),
      dayPillar.getEarthBranch().getName(),
      dayMasterGan,
    ),
  };

  const wuxingCount = buildWuxingCount(pillars);
  const profile: ThreePillarsProfile = {
    genderLabel: input.gender === 'male' ? '男' : '女',
    dateTypeLabel: input.dateType === 'solar' ? '公历' : '农历',
    solarDateLabel: `${solarTime.getYear()}-${String(solarTime.getMonth()).padStart(2, '0')}-${String(
      solarTime.getDay(),
    ).padStart(2, '0')}`,
    lunarDateLabel: `${lunarHour.getLunarDay().getLunarMonth().getLunarYear().getYear()}年${lunarHour
      .getLunarDay()
      .getLunarMonth()
      .getName()}${lunarHour.getLunarDay().getName()}`,
    zodiac: lunarHour
      .getLunarDay()
      .getLunarMonth()
      .getLunarYear()
      .getSixtyCycle()
      .getEarthBranch()
      .getZodiac()
      .getName(),
    timeBoundaryNotes: buildTimeBoundaryNotes(solarTime),
    dayMaster: {
      gan: dayMasterGan,
      element: getWuxing(dayMasterGan),
      yinYang: getGanYinYang(dayMasterGan),
    },
    pillars,
    wuxingCount,
    promptText: '',
  };

  profile.promptText = formatThreePillarsForPrompt(profile);
  return profile;
}

export function formatThreePillarsForPrompt(profile: ThreePillarsProfile) {
  return [
    '【基础信息】',
    `性别：${profile.genderLabel}`,
    `输入日历：${profile.dateTypeLabel}`,
    `公历：${profile.solarDateLabel}`,
    `农历：${profile.lunarDateLabel}`,
    `时辰：未知（待反推）`,
    `生肖：${profile.zodiac}`,
    `日主：${profile.dayMaster.gan} ${profile.dayMaster.element}（${profile.dayMaster.yinYang}）`,
    ...(profile.timeBoundaryNotes.length > 0
      ? ['', '【时间边界】', ...profile.timeBoundaryNotes.map((note) => `- ${note}`)]
      : []),
    '',
    '【三柱】',
    `年柱：${profile.pillars.year.ganZhi} | 天干十神：${profile.pillars.year.tenGod} | 地支十神：${profile.pillars.year.branchTenGod} | 五行：${profile.pillars.year.ganWuxing}/${profile.pillars.year.zhiWuxing}`,
    `月柱：${profile.pillars.month.ganZhi} | 天干十神：${profile.pillars.month.tenGod} | 地支十神：${profile.pillars.month.branchTenGod} | 五行：${profile.pillars.month.ganWuxing}/${profile.pillars.month.zhiWuxing}`,
    `日柱：${profile.pillars.day.ganZhi} | 天干十神：${profile.pillars.day.tenGod} | 地支十神：${profile.pillars.day.branchTenGod} | 五行：${profile.pillars.day.ganWuxing}/${profile.pillars.day.zhiWuxing}`,
    '',
    '【五行统计】',
    formatWuxingCount(profile.wuxingCount),
    '',
    '【说明】',
    '当前排盘依据为年柱、月柱、日柱；凡是强依赖候选时柱的判断都先作保守比较。',
  ].join('\n');
}
