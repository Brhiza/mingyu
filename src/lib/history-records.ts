import type { QueryInputState } from '@/lib/query-state';
import type { DivinationDraft, DivinationSession } from '@/lib/divination/engine';
import { ALMANAC_TOPIC_OPTIONS } from '@/lib/divination/config';
import { safeStorage } from '@/lib/safe-storage';

const PERSONAL_HISTORY_STORAGE_KEY = 'prompt_studio_personal_history_v1';
const COMPATIBILITY_HISTORY_STORAGE_KEY = 'prompt_studio_compatibility_history_v1';
const DIVINATION_HISTORY_STORAGE_KEY = 'prompt_studio_divination_history_v1';
const MAX_HISTORY_RECORDS = 20;
const DEFAULT_CASE_NAME = '案例';

type PersonalHistoryRecord = {
  id: string;
  type: 'single';
  name: string;
  gender: 'male' | 'female';
  chartType: QueryInputState['chartType'];
  birthText: string;
  input: QueryInputState;
  updatedAt: string;
  generatedName?: boolean;
};

type CompatibilityHistoryRecord = {
  id: string;
  type: 'compatibility';
  name: string;
  primaryName: string;
  partnerName: string;
  input: QueryInputState;
  updatedAt: string;
  primaryNameGenerated?: boolean;
  partnerNameGenerated?: boolean;
};

export type DivinationHistoryRecord = {
  id: string;
  type: 'divination';
  question: string;
  requestedMethod: DivinationSession['requestedMethod'];
  method: DivinationSession['method'];
  draft: DivinationDraft;
  session: DivinationSession;
  updatedAt: string;
};

function readRecords<T>(key: string): T[] {
  const parsed = safeStorage.getJSON<unknown>(key, null);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function writeRecords<T>(key: string, records: T[]): boolean {
  return safeStorage.setJSON(key, records.slice(0, MAX_HISTORY_RECORDS));
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function resolveAvailableCaseName(existingNames: string[], reservedNames: string[] = []) {
  const usedNames = new Set([...existingNames, ...reservedNames].map(normalizeText));
  if (!usedNames.has(normalizeText(DEFAULT_CASE_NAME))) {
    return DEFAULT_CASE_NAME;
  }

  let index = 2;
  while (usedNames.has(normalizeText(`${DEFAULT_CASE_NAME}${index}`))) {
    index += 1;
  }
  return `${DEFAULT_CASE_NAME}${index}`;
}

function isSamePersonalHistoryInput(left: QueryInputState, right: QueryInputState) {
  return (
    left.chartType === right.chartType &&
    left.gender === right.gender &&
    left.dateType === right.dateType &&
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  );
}

function isSameCompatibilityHistoryInput(left: QueryInputState, right: QueryInputState) {
  return (
    left.gender === right.gender &&
    left.partnerGender === right.partnerGender &&
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.partnerYear === right.partnerYear &&
    left.partnerMonth === right.partnerMonth &&
    left.partnerDay === right.partnerDay
  );
}

function resolvePersonalRecordName(input: QueryInputState, records: PersonalHistoryRecord[]) {
  const explicitName = input.name.trim();
  if (explicitName) {
    return {
      name: explicitName,
      generated: false,
    };
  }

  const existingRecord = records.find(
    (item) => item.generatedName && isSamePersonalHistoryInput(item.input, input),
  );
  return {
    name: existingRecord?.name ?? resolveAvailableCaseName(records.map((item) => item.name)),
    generated: true,
  };
}

function resolveCompatibilityRecordNames(
  input: QueryInputState,
  records: CompatibilityHistoryRecord[],
) {
  const primaryExplicitName = input.name.trim();
  const partnerExplicitName = input.partnerName.trim();
  const existingRecord = records.find((item) => isSameCompatibilityHistoryInput(item.input, input));
  const existingNames = records.flatMap((item) => [item.primaryName, item.partnerName]);

  const primaryName = primaryExplicitName
    ? primaryExplicitName
    : existingRecord?.primaryNameGenerated
      ? existingRecord.primaryName
      : resolveAvailableCaseName(existingNames);
  const partnerName = partnerExplicitName
    ? partnerExplicitName
    : existingRecord?.partnerNameGenerated
      ? existingRecord.partnerName
      : resolveAvailableCaseName(existingNames, [primaryName]);

  return {
    primaryName,
    partnerName,
    primaryGenerated: !primaryExplicitName,
    partnerGenerated: !partnerExplicitName,
  };
}

function buildBirthText(input: QueryInputState, role: 'self' | 'partner' = 'self') {
  const prefix = role === 'self' ? '' : 'partner';
  const year = prefix ? input.partnerYear : input.year;
  const month = prefix ? input.partnerMonth : input.month;
  const day = prefix ? input.partnerDay : input.day;
  return `${year}-${month}-${day}`;
}

function cloneInput(input: QueryInputState): QueryInputState {
  return JSON.parse(JSON.stringify(input)) as QueryInputState;
}

function cloneDivinationDraft(draft: DivinationDraft): DivinationDraft {
  return JSON.parse(JSON.stringify(draft)) as DivinationDraft;
}

function cloneDivinationSession(session: DivinationSession): DivinationSession {
  return JSON.parse(JSON.stringify(session)) as DivinationSession;
}

const almanacTopicLabelMap = Object.fromEntries(
  ALMANAC_TOPIC_OPTIONS.map((item) => [item.value, item.label]),
) as Record<DivinationDraft['almanacTopic'], string>;

function resolveDivinationRecordTitle(draft: DivinationDraft, session: DivinationSession) {
  const question = session.question.trim();
  if (question) {
    return question;
  }
  if (session.method === 'almanac') {
    const topic = almanacTopicLabelMap[draft.almanacTopic] || '择日';
    const dateRange =
      draft.almanacStartDate && draft.almanacEndDate
        ? `（${draft.almanacStartDate} 至 ${draft.almanacEndDate}）`
        : '';
    return `黄历择日：${topic}${dateRange}`;
  }
  return '';
}

export function loadPersonalHistory() {
  return readRecords<PersonalHistoryRecord>(PERSONAL_HISTORY_STORAGE_KEY);
}

export function loadCompatibilityHistory() {
  return readRecords<CompatibilityHistoryRecord>(COMPATIBILITY_HISTORY_STORAGE_KEY);
}

export function loadDivinationHistory() {
  return readRecords<DivinationHistoryRecord>(DIVINATION_HISTORY_STORAGE_KEY);
}

export function upsertPersonalHistory(input: QueryInputState) {
  if (!input.year || !input.month || !input.day) {
    return loadPersonalHistory();
  }

  const records = loadPersonalHistory();
  const { name, generated } = resolvePersonalRecordName(input, records);
  const id = [
    normalizeText(name),
    input.chartType,
    input.gender,
    input.dateType,
    input.year,
    input.month,
    input.day,
  ].join('|');

  const record: PersonalHistoryRecord = {
    id,
    type: 'single',
    name,
    gender: input.gender,
    chartType: input.chartType,
    birthText: buildBirthText(input),
    input: cloneInput({
      ...input,
      analysisMode: 'single',
      name,
    }),
    updatedAt: new Date().toISOString(),
    generatedName: generated,
  };

  const next = [record, ...records.filter((item) => item.id !== id)];
  writeRecords(PERSONAL_HISTORY_STORAGE_KEY, next);
  return next.slice(0, MAX_HISTORY_RECORDS);
}

export function upsertCompatibilityHistory(input: QueryInputState) {
  if (
    input.analysisMode !== 'compatibility' ||
    !input.year ||
    !input.month ||
    !input.day ||
    !input.partnerYear ||
    !input.partnerMonth ||
    !input.partnerDay
  ) {
    return loadCompatibilityHistory();
  }

  const records = loadCompatibilityHistory();
  const { primaryName, partnerName, primaryGenerated, partnerGenerated } =
    resolveCompatibilityRecordNames(input, records);
  const id = [
    normalizeText(primaryName),
    normalizeText(partnerName),
    input.gender,
    input.partnerGender,
    input.year,
    input.month,
    input.day,
    input.partnerYear,
    input.partnerMonth,
    input.partnerDay,
  ].join('|');

  const record: CompatibilityHistoryRecord = {
    id,
    type: 'compatibility',
    name: `${primaryName} 和 ${partnerName}`,
    primaryName,
    partnerName,
    input: cloneInput({
      ...input,
      name: primaryName,
      partnerName,
    }),
    updatedAt: new Date().toISOString(),
    primaryNameGenerated: primaryGenerated,
    partnerNameGenerated: partnerGenerated,
  };

  const next = [record, ...records.filter((item) => item.id !== id)];
  writeRecords(COMPATIBILITY_HISTORY_STORAGE_KEY, next);
  return next.slice(0, MAX_HISTORY_RECORDS);
}

export function removePersonalHistory(id: string) {
  const next = loadPersonalHistory().filter((item) => item.id !== id);
  writeRecords(PERSONAL_HISTORY_STORAGE_KEY, next);
  return next;
}

export function removeCompatibilityHistory(id: string) {
  const next = loadCompatibilityHistory().filter((item) => item.id !== id);
  writeRecords(COMPATIBILITY_HISTORY_STORAGE_KEY, next);
  return next;
}

export function addDivinationHistory(draft: DivinationDraft, session: DivinationSession) {
  const question = resolveDivinationRecordTitle(draft, session);
  if (!question) {
    return null;
  }

  const record: DivinationHistoryRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type: 'divination',
    question,
    requestedMethod: session.requestedMethod,
    method: session.method,
    draft: cloneDivinationDraft(draft),
    session: cloneDivinationSession(session),
    updatedAt: new Date().toISOString(),
  };

  writeRecords(DIVINATION_HISTORY_STORAGE_KEY, [record, ...loadDivinationHistory()]);
  return record;
}

export function getDivinationHistoryById(id: string) {
  return loadDivinationHistory().find((item) => item.id === id) ?? null;
}

export function removeDivinationHistory(id: string) {
  const next = loadDivinationHistory().filter((item) => item.id !== id);
  writeRecords(DIVINATION_HISTORY_STORAGE_KEY, next);
  return next;
}
