import * as React from 'react';
import { getActiveCaseId, type PersonalCase } from '../../v2-ui/cases-store';
import {
  createEmptyAgentSession,
  loadAgentSessions,
  saveActiveAgentSessionId,
  saveAgentSessions,
  type AgentChatMessage,
  type AgentChatSession,
} from '../../web-agent-storage';
import type { TopDomainId, WorkspaceRouteId } from '../workspace-catalog';
import { buildWorkspaceUrl } from '../workspace-router';

export interface UseAgentChatOptions {
  initialChatSessionId?: string;
  activeRoute: WorkspaceRouteId;
  activeDomainHint: TopDomainId;
  personalCases: readonly PersonalCase[];
}

/**
 * 站内多轮 AI 对话与工具调用 Agent 状态管理 Hook（按需动态加载 `web-agent` 运行时）。
 */
export function useAgentChat({
  initialChatSessionId,
  activeRoute,
  activeDomainHint,
  personalCases,
}: UseAgentChatOptions) {
  const [agentSessions, setAgentSessions] = React.useState<AgentChatSession[]>(() => {
    const loaded = loadAgentSessions();
    if (loaded.some((s) => s.messages.length === 0)) return loaded;
    return [createEmptyAgentSession(getActiveCaseId()), ...loaded];
  });

  const [activeAgentSessionId, setActiveAgentSessionId] = React.useState<string>(() => {
    const loaded = loadAgentSessions();
    if (initialChatSessionId && loaded.some((s) => s.id === initialChatSessionId)) {
      return initialChatSessionId;
    }
    const emptySession = loaded.find((s) => s.messages.length === 0);
    return emptySession?.id ?? '';
  });

  const [agentRunning, setAgentRunning] = React.useState(false);
  const [agentStatusText, setAgentStatusText] = React.useState('');
  const agentAbortRef = React.useRef<AbortController | null>(null);
  const agentSessionsRef = React.useRef(agentSessions);
  agentSessionsRef.current = agentSessions;
  const agentRunningRef = React.useRef(agentRunning);
  agentRunningRef.current = agentRunning;

  const activeAgentSession = React.useMemo(() => {
    return (
      agentSessions.find((s) => s.id === activeAgentSessionId) ??
      agentSessions.find((s) => s.messages.length === 0) ??
      agentSessions[0]
    );
  }, [agentSessions, activeAgentSessionId]);

  React.useEffect(() => {
    if (activeAgentSession && activeAgentSession.id !== activeAgentSessionId) {
      setActiveAgentSessionId(activeAgentSession.id);
    }
  }, [activeAgentSession, activeAgentSessionId]);

  React.useEffect(() => {
    if (activeAgentSession?.id) {
      saveActiveAgentSessionId(activeAgentSession.id);
    }
  }, [activeAgentSession?.id]);

  React.useEffect(() => {
    if (!agentRunning) {
      saveAgentSessions(agentSessions);
    }
  }, [agentSessions, agentRunning]);

  const handleAgentSelectAttachedCase = React.useCallback(
    (caseId: string | null) => {
      if (!activeAgentSession) return;
      setAgentSessions((prev) =>
        prev.map((s) => (s.id === activeAgentSession.id ? { ...s, attachedCaseId: caseId } : s)),
      );
    },
    [activeAgentSession],
  );

  const handleAgentNewChat = React.useCallback(() => {
    if (agentRunning) return;
    const fresh = createEmptyAgentSession(activeAgentSession?.attachedCaseId ?? getActiveCaseId());
    setAgentSessions((prev) => [fresh, ...prev]);
    setActiveAgentSessionId(fresh.id);
    if (activeRoute === 'chat' && typeof window !== 'undefined') {
      const nextUrl = buildWorkspaceUrl({
        route: 'chat',
        domainHint: activeDomainHint,
        chatSessionId: fresh.id,
      });
      window.history.replaceState(null, '', nextUrl);
    }
  }, [activeAgentSession?.attachedCaseId, activeDomainHint, activeRoute, agentRunning]);

  const handleAgentSelectSession = React.useCallback(
    (id: string) => {
      if (agentRunning && id !== activeAgentSession?.id) {
        agentAbortRef.current?.abort();
      }
      setActiveAgentSessionId(id);
      if (activeRoute === 'chat' && typeof window !== 'undefined') {
        const nextUrl = buildWorkspaceUrl({
          route: 'chat',
          domainHint: activeDomainHint,
          chatSessionId: id,
        });
        window.history.replaceState(null, '', nextUrl);
      }
    },
    [activeAgentSession?.id, activeDomainHint, activeRoute, agentRunning],
  );

  const handleAgentDeleteSession = React.useCallback(
    (id: string) => {
      if (agentRunning && id === activeAgentSession?.id) return;
      setAgentSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (filtered.length > 0) {
          if (id === activeAgentSession?.id) {
            setActiveAgentSessionId(filtered[0].id);
          }
          return filtered;
        }
        const fresh = createEmptyAgentSession(getActiveCaseId());
        setActiveAgentSessionId(fresh.id);
        return [fresh];
      });
    },
    [activeAgentSession?.id, agentRunning],
  );

  const handleAgentStop = React.useCallback(() => {
    agentAbortRef.current?.abort();
  }, []);

  const handleAgentSendMessage = React.useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || agentRunning || !activeAgentSession) return;

      const sessionId = activeAgentSession.id;
      const attachedCase =
        personalCases.find((c) => c.id === activeAgentSession.attachedCaseId) ?? null;
      const nowIso = new Date().toISOString();
      const userMsg: AgentChatMessage = {
        id: `u_${Date.now().toString(36)}`,
        role: 'user',
        content: trimmed,
        createdAt: nowIso,
        ...(attachedCase ? { attachedCaseName: attachedCase.name } : {}),
      };
      const assistantMsgId = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const assistantPlaceholder: AgentChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: nowIso,
        toolTraces: [],
        status: 'streaming',
      };

      const nextTitle =
        activeAgentSession.messages.length === 0
          ? trimmed.slice(0, 18) + (trimmed.length > 18 ? '…' : '')
          : activeAgentSession.title;

      setAgentSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                title: nextTitle,
                updatedAt: nowIso,
                messages: [...s.messages, userMsg, assistantPlaceholder],
              }
            : s,
        ),
      );

      const abortController = new AbortController();
      agentAbortRef.current = abortController;
      setAgentRunning(true);
      setAgentStatusText('正在思考并选择合适工具…');

      const priorApiHistory = activeAgentSession.apiHistory;

      void import('../../web-agent')
        .then(({ runAgentTurn }) =>
          runAgentTurn({
            userText: trimmed,
            priorApiHistory,
            attachedCase,
            signal: abortController.signal,
            callbacks: {
              onAssistantUpdate: ({ content, reasoning, toolTraces, statusText }) => {
                if (statusText) setAgentStatusText(statusText);
                setAgentSessions((prev) =>
                  prev.map((s) =>
                    s.id === sessionId
                      ? {
                          ...s,
                          messages: s.messages.map((m) =>
                            m.id === assistantMsgId
                              ? {
                                  ...m,
                                  content,
                                  ...(reasoning !== undefined ? { reasoning } : {}),
                                  toolTraces,
                                }
                              : m,
                          ),
                        }
                      : s,
                  ),
                );
              },
            },
          }),
        )
        .then((res) => {
          setAgentSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    updatedAt: new Date().toISOString(),
                    apiHistory: res.nextApiHistory,
                    messages: s.messages.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content: res.finalContent,
                            ...(res.finalReasoning !== undefined ? { reasoning: res.finalReasoning } : {}),
                            toolTraces: res.toolTraces,
                            status: 'done',
                          }
                        : m,
                    ),
                  }
                : s,
            ),
          );
        })
        .catch((err) => {
          const isAborted =
            abortController.signal.aborted ||
            (err instanceof DOMException && err.name === 'AbortError');
          const msgText = isAborted
            ? undefined
            : err instanceof TypeError
              ? '无法连接模型服务，请检查接口地址、网络或跨域设置。'
              : err instanceof Error
                ? err.message
                : '模型请求失败。';
          setAgentSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    updatedAt: new Date().toISOString(),
                    messages: s.messages.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            status: isAborted ? 'stopped' : 'error',
                            ...(msgText ? { errorMessage: msgText } : {}),
                          }
                        : m,
                    ),
                  }
                : s,
            ),
          );
        })
        .finally(() => {
          if (agentAbortRef.current === abortController) {
            agentAbortRef.current = null;
            setAgentRunning(false);
            setAgentStatusText('');
          }
        });
    },
    [activeAgentSession, agentRunning, personalCases],
  );

  return {
    agentSessions,
    setAgentSessions,
    activeAgentSessionId,
    setActiveAgentSessionId,
    activeAgentSession,
    agentRunning,
    agentStatusText,
    agentSessionsRef,
    agentRunningRef,
    handleAgentSelectAttachedCase,
    handleAgentNewChat,
    handleAgentSelectSession,
    handleAgentDeleteSession,
    handleAgentStop,
    handleAgentSendMessage,
  };
}
