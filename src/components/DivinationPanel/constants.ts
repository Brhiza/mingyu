import {
  ALMANAC_TOPIC_OPTIONS,
  DIVINATION_METHOD_OPTIONS,
  LENORMAND_SPREAD_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
  JINKOUJUE_METHOD_OPTIONS,
} from 'mingyu-core/divination/config';
import type { DivinationDraft } from '@/lib/divination/engine';

export const defaultDraft: DivinationDraft = {
  method: 'liuyao',
  question: '',
  questionSource: 'custom',
  currentSituation: '',
  currentState: '',
  knownFacts: '',
  desiredOutcome: '',
  constraints: '',
  userSupplement: '',
  gender: '',
  birthYear: '',
  divinationTimeMode: 'current',
  customDivinationDate: '',
  customDivinationTime: '',
  divinationTimeStandard: 'beijing',
  birthPlace: '',
  birthLongitude: '',
  birthLatitude: '',
  liuyaoMethod: 'time',
  liuyaoYaos: [],
  liuyaoCoinThrows: [],
  meihuaMethod: 'time',
  meihuaNumber: '',
  xiaoliurenMethod: 'time',
  jinkoujueMethod: 'time',
  jinkoujueBranch: '子',
  jinkoujueNumber: '',
  // 网页端固定采用推荐口径；完整计式与排法仍由 API、MCP、Skill 和核心包开放。
  qimenMethod: 'zhuanpan',
  qimenScope: 'hour',
  qimenJuMethod: 'chaibu',
  liuyaoTemplate: 'general',
  liurenTemplate: 'general',
  tarotSpread: 'single',
  tarotMethod: 'random',
  tarotManualCards: [],
  tarotInteractiveSamples: [],
  ssgwMethod: 'random',
  ssgwNumber: '',
  almanacTopic: 'custom',
  almanacStartDate: '',
  almanacEndDate: '',
  almanacWeekendPreference: 'any',
  almanacTimePreferences: [],
  almanacParticipants: [],
  lenormandSpread: 'single',
  lenormandMethod: 'random',
  lenormandManualCardIds: [],
  lenormandInteractiveSamples: [],
  astrolabeName: '本人',
  astrolabeGender: '',
  astrolabeYear: '',
  astrolabeMonth: '',
  astrolabeDay: '',
  astrolabeHour: '12',
  astrolabeMinute: '00',
  astrolabeLatitude: '39.9042',
  astrolabeLongitude: '116.4074',
  astrolabeTimezone: '8',
  taiyiYear: String(new Date().getFullYear()),
  zhugeText: '',
  kongmingMethod: 'random',
  kongmingPattern: '●○●○○',
  taiyiScope: 'year',
};

export const methodLabelMap = Object.fromEntries([
  ['random', '随机'],
  ...DIVINATION_METHOD_OPTIONS.map((item) => [item.value, item.label]),
]) as Record<DivinationDraft['method'], string>;

export const meihuaMethodLabelMap = Object.fromEntries(
  MEIHUA_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['meihuaMethod']>, string>;

export const jinkoujueMethodLabelMap = Object.fromEntries(
  JINKOUJUE_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['jinkoujueMethod']>, string>;

export const liuyaoTemplateLabelMap = Object.fromEntries(
  LIUYAO_TEMPLATE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['liuyaoTemplate']>, string>;

export const tarotSpreadLabelMap = Object.fromEntries(
  TAROT_SPREAD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['tarotSpread']>, string>;

export const liurenTemplateLabelMap = Object.fromEntries(
  LIUREN_TEMPLATE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['liurenTemplate']>, string>;

export const almanacTopicLabelMap = Object.fromEntries(
  ALMANAC_TOPIC_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['almanacTopic']>, string>;

export const lenormandSpreadLabelMap = Object.fromEntries(
  LENORMAND_SPREAD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['lenormandSpread']>, string>;
