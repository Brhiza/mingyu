import type { AiChatCompletionStatus, AiChatStatus, ChatTurn } from '@/hooks/useAiChat';
import { safeStorage } from '@/lib/safe-storage';
import { createSecureId } from '@/lib/secure-id';
import { normalizeReadingSubject, type ReadingSubjectSnapshot } from './reading-subject';

export type AiChatPromptMode = 'context' | 'context-question';

export interface AiChatSession {
  id: string;
  title: string;
  initialQuestion: string;
  initialPrompt?: string;
  readingSubject?: ReadingSubjectSnapshot;
  readingMethod?: string;
  completionStatus?: AiChatCompletionStatus;
  promptMode: AiChatPromptMode;
  turns: ChatTurn[];
  createdAt: string;
  updatedAt: string;
}

export interface AiChatHistoryState {
  sessions: AiChatSession[];
  activeSessionId: string;
}

const AI_CHAT_HISTORY_VERSION = 2;
export const MAX_AI_CHAT_SESSIONS = 20;

type SavedAiChatHistoryV2 = AiChatHistoryState & {
  version: typeof AI_CHAT_HISTORY_VERSION;
};

type LegacyAiChatHistory = {
  turns?: unknown;
  updatedAt?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is ChatTurn =>
        isRecord(item) &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.length > 0,
    )
    .map((item) => ({
      role: item.role,
      content: item.content,
      ...(Array.isArray(item.notices) && item.notices.some((notice) => typeof notice === 'string')
        ? {
            notices: item.notices
              .filter((notice): notice is string => typeof notice === 'string')
              .slice(0, 12),
          }
        : {}),
      ...(item.incomplete === true ? { incomplete: true } : {}),
    }));
}

function inferCompletionStatus(turns: ChatTurn[]): AiChatCompletionStatus | undefined {
  const latest = turns[turns.length - 1];
  if (!latest) return undefined;
  if (latest.role === 'user') return 'pending';
  return latest.incomplete ? 'partial' : undefined;
}

function normalizeSession(value: unknown): AiChatSession | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  const turns = normalizeTurns(value.turns);
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : '';
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : createdAt;
  const promptMode = value.promptMode === 'context-question' ? 'context-question' : 'context';
  const readingSubject = normalizeReadingSubject(value.readingSubject);
  const readingMethod =
    typeof value.readingMethod === 'string' && value.readingMethod.trim()
      ? value.readingMethod.trim()
      : undefined;
  const completionStatus =
    value.completionStatus === 'pending' ||
    value.completionStatus === 'complete' ||
    value.completionStatus === 'partial' ||
    value.completionStatus === 'cancelled' ||
    value.completionStatus === 'error'
      ? value.completionStatus
      : inferCompletionStatus(turns);

  return {
    id: value.id,
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : '新对话',
    initialQuestion: typeof value.initialQuestion === 'string' ? value.initialQuestion : '',
    ...(typeof value.initialPrompt === 'string' ? { initialPrompt: value.initialPrompt } : {}),
    ...(readingSubject ? { readingSubject } : {}),
    ...(readingMethod ? { readingMethod } : {}),
    ...(completionStatus ? { completionStatus } : {}),
    promptMode,
    turns,
    createdAt,
    updatedAt,
  };
}

export function normalizeAiChatHistory(value: unknown): AiChatHistoryState {
  if (!isRecord(value)) return { sessions: [], activeSessionId: '' };

  if (Array.isArray(value.sessions)) {
    const sessions = value.sessions
      .map(normalizeSession)
      .filter((session): session is AiChatSession => Boolean(session))
      .slice(0, MAX_AI_CHAT_SESSIONS);
    const requestedActiveId =
      typeof value.activeSessionId === 'string' ? value.activeSessionId : '';
    const activeSessionId = sessions.some((session) => session.id === requestedActiveId)
      ? requestedActiveId
      : (sessions[0]?.id ?? '');
    return { sessions, activeSessionId };
  }

  const legacy = value as LegacyAiChatHistory;
  const turns = normalizeTurns(legacy.turns);
  if (!turns.length) return { sessions: [], activeSessionId: '' };
  const updatedAt = typeof legacy.updatedAt === 'string' ? legacy.updatedAt : '';
  const legacySession: AiChatSession = {
    id: 'legacy',
    title: '最近一次解析',
    initialQuestion: '',
    promptMode: 'context',
    turns,
    createdAt: updatedAt,
    updatedAt,
  };
  return { sessions: [legacySession], activeSessionId: legacySession.id };
}

export function loadAiChatHistory(storageKey: string): AiChatHistoryState {
  if (!storageKey) return { sessions: [], activeSessionId: '' };
  return normalizeAiChatHistory(safeStorage.getJSON<unknown>(storageKey, null));
}

export function saveAiChatHistory(storageKey: string, state: AiChatHistoryState) {
  if (!storageKey) return false;
  if (!state.sessions.length) {
    return safeStorage.remove(storageKey);
  }
  const value: SavedAiChatHistoryV2 = {
    version: AI_CHAT_HISTORY_VERSION,
    sessions: state.sessions.slice(0, MAX_AI_CHAT_SESSIONS),
    activeSessionId: state.activeSessionId,
  };
  return safeStorage.setJSON(storageKey, value);
}

export function createAiChatSessionId() {
  return createSecureId();
}

export function createAiChatTitle(value: string, fallback = '新对话') {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 36 ? `${normalized.slice(0, 36)}…` : normalized;
}

export function extractPromptQuestion(prompt: string) {
  const match = prompt.match(
    /^[ \t]*【问题】[ \t]*(?:\r?\n|$)([\s\S]*?)(?=^[ \t]*【[^\r\n】]+】[ \t]*(?:\r?\n|$)|(?![\s\S]))/mu,
  );
  return match?.[1]?.trim() ?? '';
}

export function getAiChatCompletionStatus(
  status: AiChatStatus,
  turns: ChatTurn[],
): AiChatCompletionStatus | undefined {
  if (status === 'done') return 'complete';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'error') {
    const latest = turns[turns.length - 1];
    return latest?.role === 'assistant' && latest.incomplete ? 'partial' : 'error';
  }
  if (status === 'loading' || status === 'streaming') return 'pending';
  return undefined;
}

export function buildAiChatInitialPrompt(contextPrompt: string, session: AiChatSession) {
  if (session.initialPrompt?.trim()) return session.initialPrompt;
  if (session.promptMode === 'context-question' && session.initialQuestion.trim()) {
    return `${contextPrompt}\n\n${session.initialQuestion.trim()}`;
  }
  return contextPrompt;
}

export function getChartChatHistoryContext(prompt: string) {
  return prompt.replace(/【当前时间】[\s\S]*?(?=【|$)/u, '').trim();
}

export function upsertAiChatSession(sessions: AiChatSession[], nextSession: AiChatSession) {
  return [nextSession, ...sessions.filter((session) => session.id !== nextSession.id)].slice(
    0,
    MAX_AI_CHAT_SESSIONS,
  );
}
