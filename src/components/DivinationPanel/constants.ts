import {
  ALMANAC_TOPIC_OPTIONS,
  DIVINATION_METHOD_OPTIONS,
  LENORMAND_SPREAD_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
  XIAOLIUREN_METHOD_OPTIONS,
} from '@core/divination/config';
import type { DivinationDraft } from '@/lib/divination/engine';

export const defaultDraft: DivinationDraft = {
  method: 'random',
  question: '',
  questionSource: 'custom',
  currentSituation: '',
  currentState: '',
  knownFacts: '',
  desiredOutcome: '',
  constraints: '',
  gender: '',
  birthYear: '',
  divinationTimeMode: 'current',
  customDivinationDate: '',
  customDivinationTime: '',
  meihuaMethod: 'time',
  meihuaNumber: '',
  xiaoliurenMethod: 'time',
  xiaoliurenNumber: '',
  liuyaoTemplate: 'general',
  liurenTemplate: 'general',
  tarotSpread: 'single',
  almanacTopic: 'custom',
  almanacStartDate: '',
  almanacEndDate: '',
  almanacParticipants: [
    {
      id: 'self',
      name: '本人',
      gender: '',
      year: '',
      month: '',
      day: '',
      timeIndex: '',
      dateType: 'solar',
      isLeapMonth: false,
    },
  ],
  lenormandSpread: 'single',
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
};

export const methodLabelMap = Object.fromEntries(
  DIVINATION_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<DivinationDraft['method'], string>;

export const meihuaMethodLabelMap = Object.fromEntries(
  MEIHUA_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['meihuaMethod']>, string>;

export const xiaoliurenMethodLabelMap = Object.fromEntries(
  XIAOLIUREN_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['xiaoliurenMethod']>, string>;

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
