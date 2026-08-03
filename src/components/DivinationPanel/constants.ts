import {
  ALMANAC_TOPIC_OPTIONS,
  DIVINATION_METHOD_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
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
  liuyaoMethod: 'time',
  liuyaoYaos: [],
  liuyaoCoinThrows: [],
  meihuaMethod: 'time',
  meihuaNumber: '',
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
  taiyiScope: 'year',
};

export const methodLabelMap = Object.fromEntries(
  DIVINATION_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<DivinationDraft['method'], string>;

export const meihuaMethodLabelMap = Object.fromEntries(
  MEIHUA_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['meihuaMethod']>, string>;

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
