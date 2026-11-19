import { LunarDay, SolarDay } from 'tyme4ts';
import { calculate } from '../core';
import { applyGlobalRulesToPayload } from '../web-settings';
import {
  BIRTH_TIME_OPTIONS,
  getTimeIndexFromClock,
  type PersonalCase,
} from './cases-store';

export interface TimeReverseKnownInfo {
  name: string;
  gender: '' | 'male' | 'female';
  calendar: 'solar' | 'lunar';
  isLeapMonth: boolean;
  year: string;
  month: string;
  day: string;
  birthPlace: string;
  longitude?: number;
  latitude?: number;
  timezone?: number;
  timeZoneId?: string;
  fuzzyTimeSlot: string;
  fuzzyHourFrom: string;
  fuzzyHourTo: string;
  birthMemory: string;
}

export interface TimeReverseProfileInfo {
  bodyBuild: string;
  appearanceFeature: string;
  firstImpression: string;
  innerSelf: string;
  healthWeakness: string;
  siblingRank: string;
  parentsRelation: string;
}

export interface TimeReverseCustomMilestone {
  id: string;
  when: string;
  event: string;
  impact: string;
}

export interface TimeReverseMilestones {
  studyWhen: string;
  studyResult: string;
  studyMajor: string;
  careerStartWhen: string;
  careerChangeWhen: string;
  careerChangeEvent: string;
  careerField: string;
  loveWhen: string;
  marriageWhen: string;
  marriageStatus: string;
  partnerTraits: string;
  wealthGoodWhen: string;
  wealthGoodReason: string;
  wealthBadWhen: string;
  wealthBadReason: string;
  propertyWhen: string;
  propertyEvent: string;
  healthWhen: string;
  healthType: string;
  healthDetail: string;
  moveWhen: string;
  moveDirection: string;
  helperWhen: string;
  disputeWhen: string;
  disputeType: string;
  recentTrend: string;
  recentEvent: string;
  customMilestones: TimeReverseCustomMilestone[];
}

export interface TimeReverseDraft {
  known: TimeReverseKnownInfo;
  profile: TimeReverseProfileInfo;
  milestones: TimeReverseMilestones;
  extraNote: string;
}

export interface TimeReverseCandidateItem {
  shichenIndex: number;
  shichenLabel: string;
  timeWindow: string;
  pillarsText: string;
  hourPillar: string;
  baziNote: string;
  ziweiNote: string;
}

export interface TimeReverseCandidatesResult {
  solarDate: string;
  calendarNote: string;
  candidates: TimeReverseCandidateItem[];
  error?: string;
}

export const FUZZY_TIME_SLOTS: readonly string[] = [
  '凌晨天未亮（约 00:00–05:00）',
  '清晨天刚亮（约 05:00–07:00）',
  '上午（约 07:00–11:00）',
  '中午饭点前后（约 11:00–13:00）',
  '下午（约 13:00–17:00）',
  '傍晚天黑前后（约 17:00–19:00）',
  '晚上（约 19:00–23:00）',
  '半夜跨夜前后（约 23:00–01:00）',
  '完全没印象 / 说不清',
];

export const TIME_REVERSE_CHIPS = {
  birthMemory: ['顺产', '剖腹产（选过日子）', '刚吃过饭', '天快亮/刚黑', '下大雨/下雪', '差点跨过半夜', '早产或足月偏晚'],
  bodyBuild: ['高挑偏瘦', '中等匀称', '结实微胖', '娇小偏瘦'],
  appearanceFeature: ['圆脸有肉', '脸型偏方正或长', '眉眼有神深邃', '皮肤偏白', '皮肤偏黄或偏黑', '小时候易长痘或有胎记疤痕'],
  firstImpression: ['温和稳重', '热情开朗', '高冷慢热', '机灵敏锐', '认真较真', '随性佛系'],
  innerSelf: ['表面随和其实主意很硬', '容易想太多内耗', '性子其实很急', '重情念旧偏感性', '喜欢独处安静'],
  healthWeakness: ['肠胃消化', '鼻炎咽喉呼吸', '睡眠浅易失眠', '眼睛近视疲劳', '皮肤过敏湿疹', '颈肩腰椎', '气血偏虚怕冷'],
  siblingRank: ['独生子女', '家里老大', '排中间', '家里老幺'],
  parentsRelation: ['亲近受疼爱', '父母管教严格', '从小聚少离多/老人带大', '独立得比较早'],
  studyResult: ['高考/升学超常发挥', '考试失常或被调剂', '考研/考公/考证上岸', '出国留学或异地求学', '中途转专业或停学'],
  studyMajor: ['理工科技术', '文史法哲教育', '经管财会金融', '医学护理', '艺术设计传媒', '实操技能类'],
  careerChangeEvent: ['升职加薪', '裸辞跳槽', '创业起步', '被裁或公司倒闭', '跨行转赛道'],
  careerField: ['体制内/国企公职', '互联网/技术研发', '销售/市场/运营', '财务/金融', '教育/医疗/咨询', '自由职业/个体生意'],
  marriageStatus: ['领证结婚', '订婚或稳定同居', '经历重大分手', '离异或关系破裂', '至今单身或晚婚'],
  partnerTraits: ['年龄差较大', '脾气直爽或偏强势', '性格温和体贴', '异地或聚少离多', '同行/同乡/经人介绍'],
  wealthGoodReason: ['工资奖金大涨', '副业或生意爆单', '投资理财/买房盈利', '家里或贵人资助'],
  wealthBadReason: ['投资亏损被套', '被骗或借钱难收回', '创业生意赔钱', '买房装修掏空积蓄', '家人突发大额开销'],
  propertyEvent: ['买房置业', '买车', '大修/装修', '跨城长途搬家'],
  healthType: ['住院或手术', '骨折外伤/扭伤', '车祸或交通惊险', '突发急症', '至亲重病或离世'],
  moveDirection: ['南方', '北方', '东方沿海', '西方', '省外大城市', '海外'],
  disputeType: ['合同或官司纠纷', '职场严重口舌是非', '被朋友或合伙人背刺', '被误会或背锅'],
  recentTrend: ['事业卡顿想换方向', '感情波动分合不定', '财运大起大落', '身体疲惫精力下滑', '迎来新转机或贵人'],
} as const;

export function createEmptyTimeReverseDraft(person?: Partial<PersonalCase>): TimeReverseDraft {
  const calendar: 'solar' | 'lunar' =
    person && (person.calendar === 'lunar' || person.dateType === 'lunar') ? 'lunar' : 'solar';
  return {
    known: {
      name: person?.name?.trim() ?? '',
      gender: person?.gender === 'male' || person?.gender === 'female' ? person.gender : '',
      calendar,
      isLeapMonth: calendar === 'lunar' ? Boolean(person?.isLeapMonth) : false,
      year: person?.year?.trim() ?? '',
      month: person?.month?.trim() ?? '',
      day: person?.day?.trim() ?? '',
      birthPlace: person?.birthPlace?.trim() ?? '',
      ...(person?.longitude !== undefined ? { longitude: person.longitude } : {}),
      ...(person?.latitude !== undefined ? { latitude: person.latitude } : {}),
      ...(person?.timezone !== undefined ? { timezone: person.timezone } : {}),
      ...(person?.timeZoneId ? { timeZoneId: person.timeZoneId } : {}),
      fuzzyTimeSlot: '',
      fuzzyHourFrom: '',
      fuzzyHourTo: '',
      birthMemory: '',
    },
    profile: {
      bodyBuild: '',
      appearanceFeature: '',
      firstImpression: '',
      innerSelf: '',
      healthWeakness: '',
      siblingRank: '',
      parentsRelation: '',
    },
    milestones: {
      studyWhen: '',
      studyResult: '',
      studyMajor: '',
      careerStartWhen: '',
      careerChangeWhen: '',
      careerChangeEvent: '',
      careerField: '',
      loveWhen: '',
      marriageWhen: '',
      marriageStatus: '',
      partnerTraits: '',
      wealthGoodWhen: '',
      wealthGoodReason: '',
      wealthBadWhen: '',
      wealthBadReason: '',
      propertyWhen: '',
      propertyEvent: '',
      healthWhen: '',
      healthType: '',
      healthDetail: '',
      moveWhen: '',
      moveDirection: '',
      helperWhen: '',
      disputeWhen: '',
      disputeType: '',
      recentTrend: '',
      recentEvent: '',
      customMilestones: [],
    },
    extraNote: '',
  };
}

export function countFilledTimeReverseClues(draft: TimeReverseDraft): number {
  let count = 0;
  const check = (val: string | undefined) => {
    if (val && val.trim()) count += 1;
  };
  if (draft.known.gender) count += 1;
  if (draft.known.year.trim() && draft.known.month.trim() && draft.known.day.trim()) count += 1;
  check(draft.known.birthPlace);
  check(draft.known.fuzzyTimeSlot);
  if (draft.known.fuzzyHourFrom.trim() || draft.known.fuzzyHourTo.trim()) count += 1;
  check(draft.known.birthMemory);

  for (const val of Object.values(draft.profile)) {
    check(val);
  }

  const m = draft.milestones;
  if (m.studyWhen.trim() || m.studyResult.trim() || m.studyMajor.trim()) count += 1;
  if (m.careerStartWhen.trim() || m.careerChangeWhen.trim() || m.careerChangeEvent.trim() || m.careerField.trim()) count += 1;
  if (m.loveWhen.trim() || m.marriageWhen.trim() || m.marriageStatus.trim() || m.partnerTraits.trim()) count += 1;
  if (m.wealthGoodWhen.trim() || m.wealthGoodReason.trim()) count += 1;
  if (m.wealthBadWhen.trim() || m.wealthBadReason.trim()) count += 1;
  if (m.propertyWhen.trim() || m.propertyEvent.trim()) count += 1;
  if (m.healthWhen.trim() || m.healthType.trim() || m.healthDetail.trim()) count += 1;
  if (m.moveWhen.trim() || m.moveDirection.trim()) count += 1;
  if (m.helperWhen.trim() || m.disputeWhen.trim() || m.disputeType.trim()) count += 1;
  if (m.recentTrend.trim() || m.recentEvent.trim()) count += 1;
  for (const item of m.customMilestones) {
    if (item.when.trim() || item.event.trim() || item.impact.trim()) count += 1;
  }
  check(draft.extraNote);
  return count;
}

export function hasValidBirthDateForCandidates(known: TimeReverseKnownInfo): boolean {
  const y = Number(known.year.trim());
  const m = Number(known.month.trim());
  const d = Number(known.day.trim());
  if (!Number.isInteger(y) || y < 1900 || y > 2100) return false;
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(d) || d < 1 || d > 31) return false;
  try {
    if (known.calendar === 'lunar') {
      LunarDay.fromYmd(y, known.isLeapMonth ? -m : m, d).getSolarDay();
    } else {
      const solar = SolarDay.fromYmd(y, m, d);
      if (solar.getYear() !== y || solar.getMonth() !== m || solar.getDay() !== d) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function formatHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export async function computeTimeReverseCandidates(
  known: TimeReverseKnownInfo,
): Promise<TimeReverseCandidatesResult | null> {
  if (!hasValidBirthDateForCandidates(known)) return null;

  const year = Number(known.year.trim());
  const month = Number(known.month.trim());
  const day = Number(known.day.trim());
  const hasPlaceCoords = typeof known.longitude === 'number' && Number.isFinite(known.longitude);
  const baseBirth: Record<string, unknown> = {
    year,
    month,
    day,
    calendar: known.calendar,
    ...(known.calendar === 'lunar' ? { leapMonth: known.isLeapMonth } : {}),
    clock: { kind: 'unknown' },
    ...(known.timeZoneId
      ? { timeZoneId: known.timeZoneId }
      : known.timezone !== undefined
        ? { timezone: known.timezone }
        : { timezone: 8 }),
    ...(hasPlaceCoords ? { timeStandard: 'true-solar', longitude: known.longitude } : { timeStandard: 'civil' }),
  };

  try {
    const baziRawPayload = applyGlobalRulesToPayload(
      'bazi',
      {
        birth: baseBirth,
        ...(known.gender ? { gender: known.gender } : {}),
        question: '未知时辰候选对照',
      },
      false,
    );
    const baziRes = (await calculate('bazi', baziRawPayload)) as {
      data?: {
        unknown?: {
          source?: { solarDate?: string };
          segments?: Array<{
            startTimestamp: number;
            endTimestamp: number;
            timezone?: number;
            localStart: { year: number; month: number; day: number; hour: number; minute: number };
            pillars: {
              year: { ganZhi: string };
              month: { ganZhi: string };
              day: { ganZhi: string };
              hour: { ganZhi: string };
            };
            strength?: { status?: string };
            ordinaryPattern?: { candidate?: string };
            usefulGod?: {
              useful?: string;
              favorableWuxing?: string[];
              unfavorableWuxing?: string[];
            };
          }>;
        };
      };
    };

    const segments = baziRes.data?.unknown?.segments ?? [];
    if (!segments.length) return null;

    type ZiweiCand = {
      startTimestamp: number;
      endTimestamp: number;
      chart: {
        natal: {
          soulBranch: string;
          bodyBranch: string;
          fiveElementsClass: string;
          palaces: Array<{
            index: number;
            name: string;
            earthlyBranch: string;
            majorStars: Array<{ name: string; brightness?: string; mutagen?: string }>;
          }>;
        };
      };
    };

    let ziweiCandidates: ZiweiCand[] = [];
    try {
      const ziweiRawPayload = applyGlobalRulesToPayload(
        'ziwei',
        {
          birth: baseBirth,
          gender: known.gender || 'male',
          question: '未知时辰候选对照',
        },
        false,
      );
      const ziweiRes = (await calculate('ziwei', ziweiRawPayload)) as {
        data?: { unknown?: { candidates?: ZiweiCand[] } };
      };
      ziweiCandidates = ziweiRes.data?.unknown?.candidates ?? [];
    } catch {
      ziweiCandidates = [];
    }

    const candidates: TimeReverseCandidateItem[] = segments.map((seg) => {
      const shichenIdx = Math.max(0, getTimeIndexFromClock(seg.localStart.hour, seg.localStart.minute));
      const optionMeta = BIRTH_TIME_OPTIONS[shichenIdx];
      const offsetHours = typeof seg.timezone === 'number' ? seg.timezone : 8;
      const endLocal = new Date(seg.endTimestamp - 1000 + offsetHours * 3600_000);
      const endHour = endLocal.getUTCHours();
      const endMinute = endLocal.getUTCMinutes();
      const timeWindow = optionMeta
        ? `${formatHm(seg.localStart.hour, seg.localStart.minute)}–${formatHm(endHour, endMinute)}`
        : `${formatHm(seg.localStart.hour, seg.localStart.minute)}`;

      const pillarsText = `${seg.pillars.year.ganZhi} ${seg.pillars.month.ganZhi} ${seg.pillars.day.ganZhi} ${seg.pillars.hour.ganZhi}`;
      const fav = seg.usefulGod?.favorableWuxing?.join('、') || '待判';
      const unfav = seg.usefulGod?.unfavorableWuxing?.join('、') || '待判';
      const baziNote = `旺衰${seg.strength?.status ?? '待核'} · ${seg.ordinaryPattern?.candidate ?? '格局待核'} · 喜${fav}/忌${unfav}`;

      const matchedZw = ziweiCandidates.find(
        (z) => Math.max(seg.startTimestamp, z.startTimestamp) < Math.min(seg.endTimestamp, z.endTimestamp),
      );
      let ziweiNote = '';
      if (matchedZw) {
        const natal = matchedZw.chart.natal;
        const ming = natal.palaces.find((p) => p.name === '命宫');
        const opposite = ming ? natal.palaces[(ming.index + 6) % 12] : undefined;
        const formatStars = (stars: Array<{ name: string; mutagen?: string }>) =>
          stars.map((s) => `${s.name}${s.mutagen ? `化${s.mutagen}` : ''}`).join('、');
        const mingStars = ming?.majorStars.length
          ? formatStars(ming.majorStars)
          : opposite?.majorStars.length
            ? `空宫(借${formatStars(opposite.majorStars)})`
            : '无主星';
        ziweiNote = `命宫${natal.soulBranch}[${mingStars}] · 身宫${natal.bodyBranch} · ${natal.fiveElementsClass}`;
      }

      return {
        shichenIndex: shichenIdx,
        shichenLabel: optionMeta?.label ?? `时辰${shichenIdx}`,
        timeWindow,
        pillarsText,
        hourPillar: seg.pillars.hour.ganZhi,
        baziNote,
        ziweiNote,
      };
    });

    return {
      solarDate: baziRes.data?.unknown?.source?.solarDate ?? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      calendarNote: `${known.calendar === 'lunar' ? `农历${known.isLeapMonth ? '闰' : ''}${month}月${day}日` : `公历 ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`}${hasPlaceCoords ? `（按出生地 ${known.birthPlace || ''} 经度校正真太阳时）` : '（按民用钟表时间）'}`,
      candidates,
    };
  } catch (err) {
    return {
      solarDate: '',
      calendarNote: '',
      candidates: [],
      error: err instanceof Error ? err.message : '未能生成候选对照表',
    };
  }
}

function compactJoin(parts: Array<string | false | undefined | null>, sep = '；'): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(sep);
}

export function buildTimeReversePrompt(
  draft: TimeReverseDraft,
  candidatesResult?: TimeReverseCandidatesResult | null,
): string {
  const { known, profile, milestones, extraNote } = draft;

  // 1. 已知出生线索
  const knownLines: string[] = [];
  if (known.name.trim()) knownLines.push(`- 称呼/姓名：${known.name.trim()}`);
  if (known.gender) knownLines.push(`- 性别：${known.gender === 'male' ? '男' : '女'}`);
  if (known.year.trim() || known.month.trim() || known.day.trim()) {
    const calText = known.calendar === 'lunar' ? `农历${known.isLeapMonth ? '闰' : ''}` : '公历';
    const yText = known.year.trim() ? `${known.year.trim()}年` : '年份未填';
    const mText = known.month.trim() ? `${known.month.trim()}月` : '月份未填';
    const dText = known.day.trim() ? `${known.day.trim()}日` : '日期未填';
    knownLines.push(`- 出生日期：${calText} ${yText}${mText}${dText}`);
  }
  if (known.birthPlace.trim()) knownLines.push(`- 出生地点：${known.birthPlace.trim()}`);
  if (known.fuzzyTimeSlot.trim()) knownLines.push(`- 模糊时段印象：${known.fuzzyTimeSlot.trim()}`);
  if (known.fuzzyHourFrom.trim() || known.fuzzyHourTo.trim()) {
    const fromText = known.fuzzyHourFrom.trim() ? `${known.fuzzyHourFrom.trim()}点` : '不详';
    const toText = known.fuzzyHourTo.trim() ? `${known.fuzzyHourTo.trim()}点` : '不详';
    knownLines.push(`- 大致钟点范围：约 ${fromText} 到 ${toText} 之间`);
  }
  if (known.birthMemory.trim()) knownLines.push(`- 出生当天家人记忆细节：${known.birthMemory.trim()}`);

  // 2. 外貌特征、体质与性格底色
  const profileLines: string[] = [];
  if (profile.bodyBuild.trim() || profile.appearanceFeature.trim()) {
    profileLines.push(
      `- 身高体态与外貌特征：${compactJoin([
        profile.bodyBuild.trim() && `体型偏${profile.bodyBuild.trim()}`,
        profile.appearanceFeature.trim() && `特点为${profile.appearanceFeature.trim()}`,
      ])}`,
    );
  }
  if (profile.firstImpression.trim() || profile.innerSelf.trim()) {
    profileLines.push(
      `- 外在印象与真实内心：${compactJoin([
        profile.firstImpression.trim() && `给人第一印象偏「${profile.firstImpression.trim()}」`,
        profile.innerSelf.trim() && `私下真实内心偏「${profile.innerSelf.trim()}」`,
      ])}`,
    );
  }
  if (profile.healthWeakness.trim()) {
    profileLines.push(`- 从小偏弱或易不适部位：${profile.healthWeakness.trim()}`);
  }
  if (profile.siblingRank.trim() || profile.parentsRelation.trim()) {
    profileLines.push(
      `- 家庭排行与六亲缘分：${compactJoin([
        profile.siblingRank.trim() && `家中排行${profile.siblingRank.trim()}`,
        profile.parentsRelation.trim() && `早年与父母关系偏「${profile.parentsRelation.trim()}」`,
      ])}`,
    );
  }

  // 3. 已发生的人生重大节点
  const milestoneLines: string[] = [];
  if (milestones.studyWhen.trim() || milestones.studyResult.trim() || milestones.studyMajor.trim()) {
    milestoneLines.push(
      `- 学业与考学：${compactJoin([
        milestones.studyWhen.trim() && `约 ${milestones.studyWhen.trim()}`,
        milestones.studyResult.trim() && `经历「${milestones.studyResult.trim()}」`,
        milestones.studyMajor.trim() && `专业/方向偏「${milestones.studyMajor.trim()}」`,
      ])}`,
    );
  }
  if (
    milestones.careerStartWhen.trim() ||
    milestones.careerChangeWhen.trim() ||
    milestones.careerChangeEvent.trim() ||
    milestones.careerField.trim()
  ) {
    milestoneLines.push(
      `- 职业与事业变动：${compactJoin([
        milestones.careerStartWhen.trim() && `约 ${milestones.careerStartWhen.trim()} 开始入行/工作`,
        (milestones.careerChangeWhen.trim() || milestones.careerChangeEvent.trim()) &&
          `${milestones.careerChangeWhen.trim() ? `${milestones.careerChangeWhen.trim()} ` : ''}发生过「${milestones.careerChangeEvent.trim() || '重要职场变动'}」`,
        milestones.careerField.trim() && `行业/岗位偏「${milestones.careerField.trim()}」`,
      ])}`,
    );
  }
  if (
    milestones.loveWhen.trim() ||
    milestones.marriageWhen.trim() ||
    milestones.marriageStatus.trim() ||
    milestones.partnerTraits.trim()
  ) {
    milestoneLines.push(
      `- 感情与婚姻：${compactJoin([
        milestones.loveWhen.trim() && `约 ${milestones.loveWhen.trim()} 有过刻骨感情`,
        (milestones.marriageWhen.trim() || milestones.marriageStatus.trim()) &&
          `${milestones.marriageWhen.trim() ? `${milestones.marriageWhen.trim()} ` : ''}${milestones.marriageStatus.trim() || '情感重要转折'}`,
        milestones.partnerTraits.trim() && `伴侣特征偏「${milestones.partnerTraits.trim()}」`,
      ])}`,
    );
  }
  if (milestones.wealthGoodWhen.trim() || milestones.wealthGoodReason.trim()) {
    milestoneLines.push(
      `- 明显顺财/进账节点：${compactJoin([
        milestones.wealthGoodWhen.trim() && `约 ${milestones.wealthGoodWhen.trim()}`,
        milestones.wealthGoodReason.trim() && `缘由：${milestones.wealthGoodReason.trim()}`,
      ])}`,
    );
  }
  if (milestones.wealthBadWhen.trim() || milestones.wealthBadReason.trim()) {
    milestoneLines.push(
      `- 明显破财/经济压力节点：${compactJoin([
        milestones.wealthBadWhen.trim() && `约 ${milestones.wealthBadWhen.trim()}`,
        milestones.wealthBadReason.trim() && `缘由：${milestones.wealthBadReason.trim()}`,
      ])}`,
    );
  }
  if (milestones.propertyWhen.trim() || milestones.propertyEvent.trim()) {
    milestoneLines.push(
      `- 置业与安居变动：${compactJoin([
        milestones.propertyWhen.trim() && `约 ${milestones.propertyWhen.trim()}`,
        milestones.propertyEvent.trim() && `事件：${milestones.propertyEvent.trim()}`,
      ])}`,
    );
  }
  if (milestones.healthWhen.trim() || milestones.healthType.trim() || milestones.healthDetail.trim()) {
    milestoneLines.push(
      `- 健康与意外/至亲变故：${compactJoin([
        milestones.healthWhen.trim() && `约 ${milestones.healthWhen.trim()}`,
        milestones.healthType.trim() && `类型：${milestones.healthType.trim()}`,
        milestones.healthDetail.trim() && `详情：${milestones.healthDetail.trim()}`,
      ])}`,
    );
  }
  if (milestones.moveWhen.trim() || milestones.moveDirection.trim()) {
    milestoneLines.push(
      `- 离乡求学/外地发展：${compactJoin([
        milestones.moveWhen.trim() && `约 ${milestones.moveWhen.trim()} 离开老家`,
        milestones.moveDirection.trim() && `方向大致在老家的「${milestones.moveDirection.trim()}」`,
      ])}`,
    );
  }
  if (milestones.helperWhen.trim() || milestones.disputeWhen.trim() || milestones.disputeType.trim()) {
    milestoneLines.push(
      `- 贵人提携或官非是非：${compactJoin([
        milestones.helperWhen.trim() && `约 ${milestones.helperWhen.trim()} 遇关键贵人相助`,
        (milestones.disputeWhen.trim() || milestones.disputeType.trim()) &&
          `${milestones.disputeWhen.trim() ? `${milestones.disputeWhen.trim()} ` : ''}遭遇「${milestones.disputeType.trim() || '是非纠纷'}」`,
      ])}`,
    );
  }
  if (milestones.recentTrend.trim() || milestones.recentEvent.trim()) {
    milestoneLines.push(
      `- 近两三年真实体感：${compactJoin([
        milestones.recentTrend.trim() && `主线感受偏「${milestones.recentTrend.trim()}」`,
        milestones.recentEvent.trim() && `典型事件：${milestones.recentEvent.trim()}`,
      ])}`,
    );
  }
  for (const item of milestones.customMilestones) {
    if (item.when.trim() || item.event.trim() || item.impact.trim()) {
      milestoneLines.push(
        `- 补充大事记：${compactJoin([
          item.when.trim() && `时间 ${item.when.trim()}`,
          item.event.trim() && `事件「${item.event.trim()}」`,
          item.impact.trim() && `影响：${item.impact.trim()}`,
        ])}`,
      );
    }
  }

  const candidateSection =
    candidatesResult && candidatesResult.candidates.length > 0
      ? [
          `【本地排盘十二时辰候选对照（${candidatesResult.calendarNote}）】`,
          ...candidatesResult.candidates.map(
            (c, idx) =>
              `${idx + 1}. ${c.shichenLabel}（${c.timeWindow}）｜八字：${c.pillarsText}（${c.baziNote}）${c.ziweiNote ? `｜紫微：${c.ziweiNote}` : ''}`,
          ),
        ].join('\n')
      : '';

  const sections: string[] = [
    `【任务角色与目标】\n请作为同时精通传统八字命理（子平格局、十神体用、大运流年应期）与紫微斗数（三合宫位星情、四化飞星、大限流年定盘）的生时校正顾问。命主不知道自己的准确出生时辰，请根据下面提供的已知线索、外貌性格与已发生的人生重大节点，通过“现实事象 ↔ 命盘结构与岁运应期”的双向交叉校验，逆向推算最可能的出生时辰。`,
    `【已知出生线索】\n${knownLines.length ? knownLines.join('\n') : '（命主暂未提供明确出生年月日与地点，请结合下方性格体貌与重大节点先做特征归类，并指出最需要补充的出生时间边界。）'}`,
    `【外貌体貌、体质与性格底色】\n${profileLines.length ? profileLines.join('\n') : '（暂未填写外貌与性格线索。）'}`,
    `【已发生的人生重大节点】\n${milestoneLines.length ? milestoneLines.join('\n') : '（暂未填写过往重大事件节点。）'}`,
    candidateSection,
    extraNote.trim() ? `【命主特别补充与关注问题】\n${extraNote.trim()}` : '',
    `【定盘推演与回答要求】
1. 若上方已列出「十二时辰候选对照」，请逐段结合命主给出的模糊时段、外貌性格特征（如紫微命身宫主星外貌、八字时柱透干十神）以及重大事件发生年份的流年/大限应期，排除明显不符的时辰；若尚未提供完整出生日期，请先总结命盘倾向（如偏哪种命宫主星或日主喜忌/十神配置），并说明哪类时辰最贴近。
2. 给出【最可能的 1–3 个候选时辰排序】（注明优先级/匹配度），分别说明：① 命理匹配依据（哪些年份的事件、性格或体貌特征正好踩中该时辰的宫位/十神/四化）；② 仍存疑或需进一步核实的细节。
3. 请不要把推测直接当成 100% 确定结论，而是给出【2–4 个“一问定乾坤”的反推验证小问题】（例如用通俗白话问：“如果偏 A 时辰，某一年前后家里/感情/学业往往会有……请问当时是否发生过？”），方便命主继续通过追问把时辰锁定到唯一答案。
4. 全程用通俗易懂、条理清晰的简体中文解释，少堆砌生僻术语；如果涉及术语（如命宫、食伤、正官、化忌等），顺手用一句话白话解释其现实含义。`,
  ];

  return sections.filter(Boolean).join('\n\n');
}
