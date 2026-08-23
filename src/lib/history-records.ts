import type { PromptSourceKey, QueryInputState } from '@/lib/query-state';
import type { DivinationDraft, DivinationSession } from '@/lib/divination/engine';
import { ALMANAC_TOPIC_OPTIONS } from 'mingyu-core/divination/config';
import { safeStorage } from '@/lib/safe-storage';
import { createSecureId } from '@/lib/secure-id';

const PERSONAL_HISTORY_STORAGE_KEY = 'prompt_studio_personal_history_v1';
const COMPATIBILITY_HISTORY_STORAGE_KEY = 'prompt_studio_compatibility_history_v1';
const DIVINATION_HISTORY_STORAGE_KEY = 'prompt_studio_divination_history_v1';
const MAX_PERSONAL_CASES = 200;
const MAX_COMPATIBILITY_RECORDS = 100;
const MAX_DIVINATION_HISTORY_RECORDS = 50;
const DEFAULT_CASE_NAME = '案例';
export const HISTORY_RECORDS_EVENT = 'mingyu:history-records';

export type PersonalHistoryRecord = {
  id: string;
  type: 'single';
  name: string;
  gender: 'male' | 'female';
  chartType: QueryInputState['chartType'];
  workspaceSource?: PromptSourceKey;
  birthText: string;
  input: QueryInputState;
  createdAt?: string;
  lastUsedAt?: string;
  updatedAt: string;
  generatedName?: boolean;
  pinned?: boolean;
};

export type CompatibilityHistoryRecord = {
  id: string;
  type: 'compatibility';
  name: string;
  primaryName: string;
  partnerName: string;
  input: QueryInputState;
  updatedAt: string;
  primaryNameGenerated?: boolean;
  partnerNameGenerated?: boolean;
  pinned?: boolean;
};

export type DivinationHistoryRecord = {
  id: string;
  type: 'divination';
  question: string;
  requestedMethod: DivinationSession['requestedMethod'];
  method: DivinationSession['method'];
  draft: DivinationDraft;
  session: DivinationSession;
  caseId?: string;
  caseName?: string;
  updatedAt: string;
};

export function sortPersonalCasesForQuickSwitch(records: PersonalHistoryRecord[]) {
  return [...records].sort((left, right) => {
    if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1;
    return (right.lastUsedAt ?? right.updatedAt).localeCompare(left.lastUsedAt ?? left.updatedAt);
  });
}

function isObjectRecord(item: unknown): item is Record<string, unknown> {
  return typeof item === 'object' && item !== null;
}

function readRecords<T>(
  key: string,
  isValidRecord: (item: Record<string, unknown>) => boolean,
): T[] {
  const parsed = safeStorage.getJSON<unknown>(key, null);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is T => isObjectRecord(item) && isValidRecord(item));
}

function writeRecords<T>(key: string, records: T[], limit: number): boolean {
  const saved = safeStorage.setJSON(key, records.slice(0, limit));
  if (saved && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HISTORY_RECORDS_EVENT));
  }
  return saved;
}

function normalizeText(value: string | undefined) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
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
    left.gender === right.gender &&
    left.dateType === right.dateType &&
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  );
}

function isSamePersonalCase(record: PersonalHistoryRecord, name: string, input: QueryInputState) {
  return (
    normalizeText(record.name) === normalizeText(name) &&
    isSamePersonalHistoryInput(record.input, input)
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

function resolvePersonalRecordName(
  input: QueryInputState,
  records: PersonalHistoryRecord[],
  selectedRecord?: PersonalHistoryRecord,
) {
  const explicitName = input.name.trim();
  if (explicitName) {
    return {
      name: explicitName,
      generated: false,
    };
  }

  if (selectedRecord) {
    return {
      name: selectedRecord.name,
      generated: Boolean(selectedRecord.generatedName),
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

function getPersonalInputCompleteness(input: QueryInputState) {
  return [
    input.timeIndex !== '',
    input.birthHour !== '',
    input.birthMinute !== '',
    input.birthPlace.trim() !== '',
    input.birthLongitude !== '',
    input.birthLatitude !== '',
  ].filter(Boolean).length;
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

function createDivinationHistoryId() {
  return createSecureId();
}

export function loadPersonalHistory() {
  const records = readRecords<PersonalHistoryRecord>(
    PERSONAL_HISTORY_STORAGE_KEY,
    (item) => item.type === 'single' && typeof item.name === 'string',
  );
  const uniqueRecords = records.reduce<PersonalHistoryRecord[]>((cases, record) => {
    const duplicateIndex = cases.findIndex((candidate) =>
      isSamePersonalCase(candidate, record.name, record.input),
    );
    if (duplicateIndex < 0) {
      cases.push(record);
      return cases;
    }

    const current = cases[duplicateIndex];
    cases[duplicateIndex] = {
      ...current,
      pinned: Boolean(current.pinned || record.pinned),
      createdAt:
        [current.createdAt, record.createdAt, current.updatedAt, record.updatedAt]
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? current.updatedAt,
      lastUsedAt:
        [current.lastUsedAt, record.lastUsedAt, current.updatedAt, record.updatedAt]
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? current.updatedAt,
      input:
        getPersonalInputCompleteness(record.input) > getPersonalInputCompleteness(current.input)
          ? record.input
          : current.input,
    };
    return cases;
  }, []);
  return sortPersonalCasesForQuickSwitch(uniqueRecords);
}

export function loadCompatibilityHistory() {
  return readRecords<CompatibilityHistoryRecord>(
    COMPATIBILITY_HISTORY_STORAGE_KEY,
    (item) => item.type === 'compatibility' && typeof item.name === 'string',
  );
}

export function loadDivinationHistory() {
  return readRecords<DivinationHistoryRecord>(
    DIVINATION_HISTORY_STORAGE_KEY,
    (item) => item.type === 'divination' && typeof item.question === 'string',
  );
}

export function upsertPersonalHistory(
  input: QueryInputState,
  workspaceSource?: PromptSourceKey,
  selectedCaseId?: string,
) {
  if (!input.year || !input.month || !input.day) {
    return loadPersonalHistory();
  }

  const records = loadPersonalHistory();
  const selectedRecord = selectedCaseId
    ? records.find((item) => item.id === selectedCaseId)
    : undefined;
  const { name, generated } = resolvePersonalRecordName(input, records, selectedRecord);
  const existingRecord =
    selectedRecord ?? records.find((item) => isSamePersonalCase(item, name, input));
  const id =
    existingRecord?.id ??
    [normalizeText(name), input.gender, input.dateType, input.year, input.month, input.day].join(
      '|',
    );
  const now = new Date().toISOString();

  const record: PersonalHistoryRecord = {
    id,
    type: 'single',
    name,
    gender: input.gender,
    chartType: input.chartType,
    workspaceSource,
    birthText: buildBirthText(input),
    input: cloneInput({
      ...input,
      analysisMode: 'single',
      name,
    }),
    createdAt: existingRecord?.createdAt ?? existingRecord?.updatedAt ?? now,
    lastUsedAt: now,
    updatedAt: now,
    generatedName: generated,
    pinned: existingRecord?.pinned,
  };

  const next = [
    record,
    ...records.filter((item) => item.id !== id && !isSamePersonalCase(item, name, input)),
  ];
  writeRecords(PERSONAL_HISTORY_STORAGE_KEY, next, MAX_PERSONAL_CASES);
  return next.slice(0, MAX_PERSONAL_CASES);
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
  const existingRecord = records.find((item) => item.id === id);

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
    pinned: existingRecord?.pinned,
  };

  const next = [record, ...records.filter((item) => item.id !== id)];
  writeRecords(COMPATIBILITY_HISTORY_STORAGE_KEY, next, MAX_COMPATIBILITY_RECORDS);
  return next.slice(0, MAX_COMPATIBILITY_RECORDS);
}

export function removePersonalHistory(id: string) {
  const records = loadPersonalHistory();
  const selectedRecord = records.find((item) => item.id === id);
  const next = selectedRecord
    ? records.filter((item) => !isSamePersonalCase(item, selectedRecord.name, selectedRecord.input))
    : records;
  writeRecords(PERSONAL_HISTORY_STORAGE_KEY, next, MAX_PERSONAL_CASES);
  return next;
}

export function togglePersonalHistoryPin(id: string) {
  const records = loadPersonalHistory();
  const selectedRecord = records.find((item) => item.id === id);
  const next = records.map((item) =>
    selectedRecord && isSamePersonalCase(item, selectedRecord.name, selectedRecord.input)
      ? { ...item, pinned: !selectedRecord.pinned }
      : item,
  );
  writeRecords(PERSONAL_HISTORY_STORAGE_KEY, next, MAX_PERSONAL_CASES);
  return next;
}

export function touchPersonalHistoryUsage(id: string) {
  const records = loadPersonalHistory();
  const selectedRecord = records.find((item) => item.id === id);
  if (!selectedRecord) return records;

  const now = new Date().toISOString();
  const next = records.map((item) =>
    isSamePersonalCase(item, selectedRecord.name, selectedRecord.input)
      ? { ...item, lastUsedAt: now }
      : item,
  );
  writeRecords(PERSONAL_HISTORY_STORAGE_KEY, next, MAX_PERSONAL_CASES);
  return next;
}

export function removeCompatibilityHistory(id: string) {
  const next = loadCompatibilityHistory().filter((item) => item.id !== id);
  writeRecords(COMPATIBILITY_HISTORY_STORAGE_KEY, next, MAX_COMPATIBILITY_RECORDS);
  return next;
}

export function toggleCompatibilityHistoryPin(id: string) {
  const next = loadCompatibilityHistory().map((item) =>
    item.id === id ? { ...item, pinned: !item.pinned } : item,
  );
  writeRecords(COMPATIBILITY_HISTORY_STORAGE_KEY, next, MAX_COMPATIBILITY_RECORDS);
  return next;
}

export function addDivinationHistory(
  draft: DivinationDraft,
  session: DivinationSession,
  activeCase?: PersonalHistoryRecord | null,
) {
  const question = resolveDivinationRecordTitle(draft, session);
  if (!question) {
    return null;
  }

  const record: DivinationHistoryRecord = {
    id: createDivinationHistoryId(),
    type: 'divination',
    question,
    requestedMethod: session.requestedMethod,
    method: session.method,
    draft: cloneDivinationDraft(draft),
    session: cloneDivinationSession(session),
    ...(activeCase ? { caseId: activeCase.id, caseName: activeCase.name } : {}),
    updatedAt: new Date().toISOString(),
  };

  writeRecords(
    DIVINATION_HISTORY_STORAGE_KEY,
    [record, ...loadDivinationHistory()],
    MAX_DIVINATION_HISTORY_RECORDS,
  );
  return record;
}

export function getDivinationHistoryById(id: string) {
  return loadDivinationHistory().find((item) => item.id === id) ?? null;
}

export function removeDivinationHistory(id: string) {
  const next = loadDivinationHistory().filter((item) => item.id !== id);
  writeRecords(DIVINATION_HISTORY_STORAGE_KEY, next, MAX_DIVINATION_HISTORY_RECORDS);
  return next;
}
