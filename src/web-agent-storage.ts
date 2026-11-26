import type { AgentApiMessage } from './ai';
import type { Method } from './core';

export const AGENT_SESSIONS_STORAGE_KEY = 'mingyu.v2.agent.sessions';
export const AGENT_ACTIVE_SESSION_KEY = 'mingyu.v2.agent.activeSessionId';
const MAX_STORED_SESSIONS = 25;

export interface AgentResultSummary {
  title?: string;
  tags?: string[];
  lines?: string[];
}

export interface AgentToolTrace {
  id: string;
  name: string;
  label: string;
  status: 'running' | 'success' | 'error';
  argsText: string;
  method?: Method;
  methodLabel?: string;
  question?: string;
  summary?: AgentResultSummary;
  repromptToken?: string;
  payload?: Record<string, unknown>;
  fullResult?: unknown;
  outputPreview?: string;
  errorMessage?: string;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  createdAt: string;
  attachedCaseName?: string;
  toolTraces?: AgentToolTrace[];
  status?: 'streaming' | 'done' | 'stopped' | 'error';
  errorMessage?: string;
}

export interface AgentChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachedCaseId: string | null;
  messages: AgentChatMessage[];
  apiHistory: AgentApiMessage[];
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyAgentSession(attachedCaseId: string | null = null): AgentChatSession {
  const now = new Date().toISOString();
  return {
    id: makeId('chat'),
    title: '新算命对话',
    createdAt: now,
    updatedAt: now,
    attachedCaseId,
    messages: [],
    apiHistory: [],
  };
}

function sanitizeTraceForStorage(trace: AgentToolTrace): AgentToolTrace {
  const { fullResult: _drop, ...rest } = trace;
  return rest;
}

export function loadAgentSessions(): AgentChatSession[] {
  try {
    const raw = window.localStorage.getItem(AGENT_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AgentChatSession =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as AgentChatSession).id === 'string' &&
        Array.isArray((item as AgentChatSession).messages) &&
        Array.isArray((item as AgentChatSession).apiHistory),
    );
  } catch {
    return [];
  }
}

export function saveAgentSessions(sessions: readonly AgentChatSession[]): void {
  const trimmed = sessions.slice(0, MAX_STORED_SESSIONS).map((session) => ({
    ...session,
    messages: session.messages.map((msg) => ({
      ...msg,
      ...(msg.status === 'streaming' ? { status: 'stopped' as const } : {}),
      ...(msg.toolTraces ? { toolTraces: msg.toolTraces.map(sanitizeTraceForStorage) } : {}),
    })),
  }));

  for (let limit = trimmed.length; limit >= 1; limit--) {
    try {
      window.localStorage.setItem(AGENT_SESSIONS_STORAGE_KEY, JSON.stringify(trimmed.slice(0, limit)));
      return;
    } catch {
      // Storage quota exceeded: prune oldest sessions and retry
    }
  }
}

export function loadActiveAgentSessionId(): string | null {
  try {
    return window.localStorage.getItem(AGENT_ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveActiveAgentSessionId(id: string): void {
  try {
    window.localStorage.setItem(AGENT_ACTIVE_SESSION_KEY, id);
  } catch {}
}
