import { LunarHour, SolarTime } from 'tyme4ts';
import { getGanYinYang, getTenGod, getTenGodForBranch, getWuxing } from '../utils/bazi/baziUtils';
import { BIRTH_TIME_OPTIONS } from './birth-time';

export const UNKNOWN_TIME_INDEX = -1;

export const UNKNOWN_TIME_OPTION = {
  label: '未知时辰',
  range: '待反推',
} as const;

export const REVERSE_BIRTH_TIME_SELECT_FIELDS = [
  {
    id: 'bodyBuild',
    label: '体型气质',
    helper: '如果知道大概体型、气质或别人常给你的印象，可以选最接近的一项。',
    options: [
      '未选择',
      '偏瘦灵活',
      '匀称平稳',
      '骨架明显或偏壮',
      '圆润松弛',
      '五官秀气',
      '肤色偏白或清冷',
      '少年显小成熟后更显气场',
      '气质强势显眼',
      '少年和成年差异明显',
    ],
  },
  {
    id: 'personalityStyle',
    label: '性格节奏',
    helper: '选择更像自己的整体状态，不需要特别准确。',
    options: [
      '未选择',
      '外向主动',
      '慢热谨慎',
      '敏感多思',
      '务实稳定',
      '理性克制',
      '情绪起伏明显',
      '要强不服输',
      '随和好说话',
      '行动快但容易急',
      '想很多再行动',
    ],
  },
  {
    id: 'familyAtmosphere',
    label: '成长氛围',
    helper: '回忆小时候的家庭感受即可。',
    options: [
      '未选择',
      '整体稳定',
      '要求严格',
      '照顾较多',
      '父母比较强势',
      '变动较多',
      '关系疏离',
      '和母亲更亲',
      '和父亲更亲',
      '家里规矩多',
      '自己小时候更早独立',
    ],
  },
  {
    id: 'caregiverPattern',
    label: '童年主要照料者',
    helper: '看小时候长期是谁带你、陪你更多。',
    options: [
      '未选择',
      '主要由父母亲自带大',
      '更多由母亲照顾',
      '更多由父亲照顾',
      '长期跟祖辈生活',
      '有寄宿或长期离家经历',
      '经常由亲友帮忙照看',
    ],
  },
  {
    id: 'educationLevel',
    label: '学历和学业路径',
    helper: '按最高学历或整体学业路径选择，哪怕只是大概也可以。',
    options: [
      '未选择',
      '中学及以下',
      '大专',
      '普通本科',
      '重点本科或名校路径',
      '本科以上',
      '读书一路较顺',
      '重要考试起伏明显',
      '考研考公考编经历明显',
      '有换专业或复读经历',
      '早早工作或中途离校',
      '学历一般但技能路线清晰',
    ],
  },
  {
    id: 'careerPattern',
    label: '工作状态',
    helper: '如果已经工作，可以选更像自己的状态；暂时不确定可以留空。',
    options: [
      '未选择',
      '比较稳定',
      '变化较多',
      '自己主导性强',
      '容易受环境影响',
      '适合单打独斗',
      '适合在体系内发展',
      '早期反复试错',
      '越往后越稳定',
      '贵人帮助明显',
      '靠专业能力吃饭',
    ],
  },
  {
    id: 'socialStyle',
    label: '社交和表达',
    helper: '选更像你平时和人相处、说话表达的状态。',
    options: [
      '未选择',
      '话不多但观察多',
      '表达直接',
      '很会照顾气氛',
      '边界感强',
      '熟了以后很能聊',
      '容易憋着不说',
      '容易被看作靠谱',
      '容易被看作有距离感',
    ],
  },
  {
    id: 'relationshipTiming',
    label: '恋爱开始节奏',
    helper: '如果感情开始偏早或偏晚，通常也能提供一些反推线索。',
    options: [
      '未选择',
      '学生时代就有明显感情经历',
      '工作后才开始认真恋爱',
      '恋爱偏晚',
      '桃花不少但不稳定',
      '遇到喜欢的人不多',
      '常有暧昧但难落地',
      '关系推进快',
    ],
  },
  {
    id: 'earlyRomanceStatus',
    label: '早恋和情感启蒙',
    helper: '如果知道自己情感启蒙偏早还是偏晚，也可以补一条。',
    options: [
      '未选择',
      '中学阶段就有明显感情经历',
      '大学阶段感情经历更明显',
      '工作后才真正开始',
      '身边桃花不少但自己谨慎',
      '很少真正进入关系',
      '容易暗恋或单向投入',
    ],
  },
  {
    id: 'marriageParentingStatus',
    label: '婚育状态',
    helper: '如果不方便细说，也可以只选最接近的一项。',
    options: [
      '未选择',
      '未婚未育',
      '有稳定对象',
      '已婚',
      '已育',
      '感情经历较少',
      '感情经历不止一段',
      '婚育节奏偏晚',
    ],
  },
  {
    id: 'healthPattern',
    label: '身体体感',
    helper: '选择最常见的倾向，不需要医学判断。',
    options: [
      '未选择',
      '精力较稳',
      '容易疲惫',
      '睡眠波动大',
      '情绪容易影响身体',
      '肠胃偏敏感',
      '容易上火',
      '偏寒或手脚凉',
      '肩颈头痛较多',
      '容易过敏或皮肤敏感',
      '恢复慢但能扛',
    ],
  },
  {
    id: 'schedulePattern',
    label: '作息偏向',
    helper: '看你长期更像早睡早起还是夜里更有精神。',
    options: [
      '未选择',
      '早睡早起型',
      '晚睡晚起型',
      '晚上更有精神',
      '白天状态更稳',
      '作息经常被工作打乱',
      '睡眠浅容易醒',
      '熬夜后恢复慢',
    ],
  },
  {
    id: 'mobilityPattern',
    label: '居住和变动',
    helper: '选更像你整体人生节奏的迁移状态。',
    options: [
      '未选择',
      '长期在一个地方',
      '学生时代有明显搬迁',
      '工作后换过城市',
      '离家发展比较早',
      '经常出差或跑动',
      '出国或长期异地经历',
      '人生阶段变化多',
    ],
  },
  {
    id: 'leaveHometownStatus',
    label: '离乡发展情况',
    helper: '是否离开出生地长期发展，通常也有参考价值。',
    options: [
      '未选择',
      '基本一直在老家',
      '上学后离乡',
      '工作后离乡',
      '长期异地发展',
      '多地来回切换',
      '有出国或长期外地经历',
      '离乡后发展更明显',
    ],
  },
] as const;

export const REVERSE_BIRTH_TIME_TEXT_FIELDS = [
  {
    id: 'parentsMarriageNotes',
    label: '父母关系状态',
    helper: '简单填写即可，例如关系稳定、常年争吵、早年离异、父亲常年不在家。',
    placeholder: '例如：关系稳定；常年争吵；早年离异；主要由母亲照顾。',
    inputType: 'text',
  },
  {
    id: 'siblingNotes',
    label: '兄弟姐妹情况',
    helper: '直接简单填写即可，例如独生、一姐一弟、两个妹妹。',
    placeholder: '例如：独生；一姐一弟；两个妹妹。',
    inputType: 'text',
  },
  {
    id: 'familyOrderNotes',
    label: '家中角色',
    helper: '直接填写你在家里更像什么位置，例如老大、常承担责任、被照顾较多。',
    placeholder: '例如：家里老大；常承担责任；容易夹在中间协调。',
    inputType: 'text',
  },
  {
    id: 'workSystemNotes',
    label: '工作体制和路径',
    helper: '简单填写工作环境或路径，例如在编、大厂、创业、频繁换行业。',
    placeholder: '例如：在编；大厂几年后创业；长期民企；跨行业换过两次。',
    inputType: 'text',
  },
  {
    id: 'careerTypeNotes',
    label: '职业类型',
    helper: '直接填写更像你的工作类型，例如技术岗、销售、设计、教师、管理岗。',
    placeholder: '例如：技术岗；设计转运营；教师；销售后期带团队。',
    inputType: 'text',
  },
  {
    id: 'keyYearsNotes',
    label: '关键年份',
    helper: '只写年份和事件，越短越好，例如搬家、升学、毕业、换城市、结婚等。',
    placeholder: '例如：2012 搬家，2018 毕业，2020 换城市。',
    inputType: 'text',
  },
  {
    id: 'livingPatternNotes',
    label: '居住状态',
    helper: '简单填写长期居住状态，例如长期和父母同住、独居、住宿舍、搬家频繁。',
    placeholder: '例如：长期和父母同住；工作后常独居；租房搬动较多。',
    inputType: 'text',
  },
  {
    id: 'relationshipPatternNotes',
    label: '感情状态',
    helper: '直接填写最像你的感情模式，例如慢热、恋爱少但认真、容易反复、重稳定。',
    placeholder: '例如：慢热保守；恋爱少但很认真；关系起伏明显；更重精神交流。',
    inputType: 'text',
  },
  {
    id: 'extraClueNotes',
    label: '其他补充线索',
    helper: '如果还有特别明显的经历或状态，用几句话写最关键的就行，不用写成长文。',
    placeholder: '例如：小时候跟母亲更亲，恋爱偏晚，睡眠浅，肠胃偏敏感。',
    inputType: 'textarea',
    rows: 3,
  },
] as const;

export type ReverseBirthTimeSelectFieldId =
  (typeof REVERSE_BIRTH_TIME_SELECT_FIELDS)[number]['id'];
export type ReverseBirthTimeTextFieldId =
  (typeof REVERSE_BIRTH_TIME_TEXT_FIELDS)[number]['id'];

export type ReverseBirthTimeFormData = Record<ReverseBirthTimeSelectFieldId, string> &
  Record<ReverseBirthTimeTextFieldId, string>;

export const DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA: ReverseBirthTimeFormData = {
  bodyBuild: '未选择',
  personalityStyle: '未选择',
  familyAtmosphere: '未选择',
  caregiverPattern: '未选择',
  educationLevel: '未选择',
  careerPattern: '未选择',
  socialStyle: '未选择',
  relationshipTiming: '未选择',
  earlyRomanceStatus: '未选择',
  marriageParentingStatus: '未选择',
  healthPattern: '未选择',
  schedulePattern: '未选择',
  mobilityPattern: '未选择',
  leaveHometownStatus: '未选择',
  parentsMarriageNotes: '',
  siblingNotes: '',
  familyOrderNotes: '',
  workSystemNotes: '',
  careerTypeNotes: '',
  keyYearsNotes: '',
  livingPatternNotes: '',
  relationshipPatternNotes: '',
  extraClueNotes: '',
};

type BirthBaseInput = {
  gender: 'male' | 'female';
  dateType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  isLeapMonth: boolean;
};

type ThreePillarDetail = {
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
  constellation: string;
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

function normalizeNumber(value: string, fallback: string) {
  return value.trim() || fallback;
}

function createBaseTime(input: BirthBaseInput) {
  const year = Number(normalizeNumber(input.year, '0'));
  const month = Number(normalizeNumber(input.month, '0'));
  const day = Number(normalizeNumber(input.day, '0'));

  if (!year || !month || !day) {
    throw new Error('请先填写完整的出生年月日。');
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

function isOmittedSelectValue(value: string) {
  return (
    value === '未选择' ||
    value === '暂时说不清' ||
    value === '说不清或较复杂' ||
    value === '说不清或不方便回答' ||
    !value.trim()
  );
}

export function isUnknownTimeIndex(value: number | '') {
  return value === UNKNOWN_TIME_INDEX;
}

export function buildThreePillarsProfile(input: BirthBaseInput): ThreePillarsProfile {
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
    constellation: solarTime.getSolarDay().getConstellation().getName(),
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
    `星座：${profile.constellation}`,
    `日主：${profile.dayMaster.gan} ${profile.dayMaster.element}（${profile.dayMaster.yinYang}）`,
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
    '当前只保留年柱、月柱、日柱，不包含时柱；凡是强依赖时柱的判断都只能先做保守推测。',
  ].join('\n');
}

function buildSelectSummary(formData: ReverseBirthTimeFormData) {
  return REVERSE_BIRTH_TIME_SELECT_FIELDS
    .map((field) => {
      const value = formData[field.id];
      if (isOmittedSelectValue(value)) {
        return '';
      }
      return `${field.label}：${value}`;
    })
    .filter(Boolean)
    .join('\n');
}

function buildTextSummary(formData: ReverseBirthTimeFormData) {
  return REVERSE_BIRTH_TIME_TEXT_FIELDS
    .map((field) => {
      const value = formData[field.id].trim();
      if (!value) {
        return '';
      }
      return `${field.label}：${value}`;
    })
    .filter(Boolean)
    .join('\n');
}

function buildBirthTimeOptionText() {
  return BIRTH_TIME_OPTIONS.map((item) => `${item.label}（${item.range}）`).join('、');
}

export function buildUnknownTimeBaziPrompt(
  profile: ThreePillarsProfile,
  question: string,
) {
  const normalizedQuestion = question.trim() || '请先基于三柱做整体分析。';

  return [
    '你是资深八字命理师，擅长在出生时辰未知的情况下，先基于三柱做保守、清晰的初步判断。',
    '【要求】',
    '- 只基于提供的三柱信息与问题作答。',
    '- 不得擅自假定时柱，也不要把时柱当成已知事实。',
    '- 明确区分哪些结论已经可以判断，哪些地方因为时辰未知还不能定论。',
    '- 如果需要继续缩小时辰范围，可以提出少量最值得补充的线索。',
    '',
    `【当前时间】\n${new Date().toLocaleString('zh-CN')}`,
    `【排盘信息】\n${profile.promptText}`,
    `【问题】\n${normalizedQuestion}`,
    '【任务】\n请先基于三柱做初步分析，再指出哪些判断需要通过反推时辰继续确认。',
    '【输出要求】\n先给结论，再分成“确定部分”“待确认部分”“建议补充线索”三段；用简体中文，不写空话。',
  ].join('\n');
}

export function buildReverseBirthTimePrompt(params: {
  profile: ThreePillarsProfile;
  formData: ReverseBirthTimeFormData;
}) {
  const selectSummary = buildSelectSummary(params.formData);
  const textSummary = buildTextSummary(params.formData);

  return [
    '你是资深八字反推时辰助手，擅长在只有三柱的前提下，通过和用户互动提问，逐步缩小最可能的出生时辰范围。',
    '【要求】',
    '- 只基于提供的三柱、用户已补充的资料、用户后续回答和常识性人生线索推进判断。',
    '- 不要直接假定时柱，不要把任何一个候选时辰提前当成结论。',
    '- 先阅读我已经补充的信息，再根据信息设计第一轮问题。',
    '- 先向我提问，再根据我的回答逐轮缩小时辰范围。',
    '- 每轮问题必须具体、可回忆、可验证，避免空泛提问。',
    '- 每个问题都要直接给出几个清晰选项，让用户只回复选项字母、编号或对应文本。',
    '- 优先使用单选题形式，只有确实必要时才使用多选题。',
    '- 每轮优先问最有区分度的问题，控制在 4 到 6 个问题。',
    '- 如果我已经提供了可直接用于排除某些时辰的线索，你要先指出这些线索会影响哪些候选时辰。',
    '- 如果信息仍不足，要明确告诉我下一轮还需要补什么。',
    '- 最终需要给出最可能的 3 个时辰候选，并说明各自依据与置信度。',
    '',
    `【当前时间】\n${new Date().toLocaleString('zh-CN')}`,
    `【已知出生信息】\n${params.profile.promptText}`,
    `【候选时辰范围】\n${buildBirthTimeOptionText()}`,
    ...(selectSummary ? [`【用户已选择的信息】\n${selectSummary}`] : []),
    ...(textSummary ? [`【用户已补充的线索】\n${textSummary}`] : []),
    '【问题】\n我想根据三柱反推出更可能的出生时辰，请你先向我提问。',
    '【任务】\n请先阅读三柱信息和我已补充的资料，先提炼出当前最有区分度的线索，再设计第一轮问题，帮助后续逐步排除不符合的时辰。',
    '【输出要求】\n先输出“已知线索初判”；再输出“第一轮问题”；列出 4 到 6 个问题；每个问题都写成带选项的题目，选项建议用 A/B/C/D 或 1/2/3/4 标注；让用户只回复选项，不需要展开长叙述；不要解释提问理由；本轮先不要直接下最终结论；用简体中文。',
  ].join('\n');
}
