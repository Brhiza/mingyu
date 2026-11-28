import * as React from 'react';
import { APP_NAME } from '../../brand-config';
import { listModels, streamChat, type AiConfig, type AiMessage } from '../../ai';
import { splitPromptIntoSystemAndUser } from '../../prompt-profile';
import {
  AI_PROVIDER_PRESETS,
  activateWebAiProfile,
  getActiveWebAiProfileId,
  loadWebAiProfiles,
  readWebAiConfig,
  writeWebAiConfig,
  type AiConfigProfile,
} from '../../web-ai';
import { Select } from '../../components/ui';
import { AgentMarkdown } from './AgentMarkdown';

export interface SingleChartFollowUpItem {
  label: string;
  question: string;
  reason?: string;
}

export interface SingleChartAiHandle {
  setAiPrompt: (prompt: { text: string; followUps?: SingleChartFollowUpItem[] }) => void;
  clearReading: () => void;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  streaming?: boolean;
  badge?: string;
}

interface StoredSingleReading {
  key: string;
  updatedAt: string;
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; reasoning?: string }>;
}

const SINGLE_READINGS_STORAGE_KEY = 'mingyu.v2.ai.singleReadings';
const MAX_STORED_SINGLE_READINGS = 25;

function hashPromptFingerprint(text: string): string {
  // FNV-1a 32-bit hash over normalized prompt text (stable across refreshes)
  const normalized = text.replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `r_${(h >>> 0).toString(36)}_${normalized.length}`;
}

function loadStoredSingleReadings(): StoredSingleReading[] {
  try {
    const raw = window.localStorage.getItem(SINGLE_READINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredSingleReading =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as StoredSingleReading).key === 'string' &&
        Array.isArray((item as StoredSingleReading).messages),
    );
  } catch {
    return [];
  }
}

function saveStoredSingleReading(entry: StoredSingleReading): void {
  const existing = loadStoredSingleReadings().filter((item) => item.key !== entry.key);
  const next = [entry, ...existing].slice(0, MAX_STORED_SINGLE_READINGS);
  for (let limit = next.length; limit >= 1; limit--) {
    try {
      window.localStorage.setItem(SINGLE_READINGS_STORAGE_KEY, JSON.stringify(next.slice(0, limit)));
      return;
    } catch {
      // storage quota exceeded: evict oldest
    }
  }
}

function removeStoredSingleReading(key: string): void {
  if (!key) return;
  try {
    const next = loadStoredSingleReadings().filter((item) => item.key !== key);
    window.localStorage.setItem(SINGLE_READINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function buildMarkdownExport(
  messages: readonly DisplayMessage[],
  modelName: string,
): string {
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const lines: string[] = [
    `# ${APP_NAME} · AI 盘面解读报告`,
    '',
    `- 导出时间：${now}`,
    ...(modelName.trim() ? [`- 解读模型：${modelName.trim()}`] : []),
    '',
    '---',
    '',
  ];
  let qaRound = 0;
  for (const msg of messages) {
    if (msg.role === 'user') {
      qaRound += 1;
      lines.push(`## 追问 ${qaRound}`, '', msg.content.trim(), '');
    } else {
      lines.push(qaRound === 0 ? '## 核心盘面解读' : `## 追问回复 ${qaRound}`, '', msg.content.trim(), '');
    }
  }
  return lines.join('\n').trim() + '\n';
}

function formatAiError(error: unknown): string {
  return error instanceof TypeError
    ? '无法连接模型服务，请检查地址、网络及跨域设置。'
    : error instanceof Error
      ? error.message
      : '模型请求失败。';
}

function CopyReplyButton({ content }: { content: string }) {
  const [label, setLabel] = React.useState<'复制' | '已复制' | '请手动复制'>('复制');
  return (
    <button
      type="button"
      className={label === '已复制' ? 'ai-message-copy-btn is-copied' : 'ai-message-copy-btn'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setLabel('已复制');
          window.setTimeout(() => setLabel('复制'), 1800);
        } catch {
          setLabel('请手动复制');
        }
      }}
    >
      {label}
    </button>
  );
}

/**
 * 站内单盘 AI 解读面板（React 统一实现，替代旧版手写 DOM 拼装）。
 * 完整保留 #ai-base / #ai-key / #ai-model / #ai-list / #ai-start / #ai-stop / #ai-ask 等语义节点。
 */
export const SingleChartAiPanel = React.forwardRef<SingleChartAiHandle, object>(
  function SingleChartAiPanel(_props, ref) {
    const initialCfg = React.useMemo(() => readWebAiConfig(), []);
    const [baseUrl, setBaseUrl] = React.useState(initialCfg.baseUrl);
    const [apiKey, setApiKey] = React.useState(initialCfg.apiKey ?? '');
    const [model, setModel] = React.useState(initialCfg.model);
    const [modelPlaceholder, setModelPlaceholder] = React.useState('');
    const [modelOptions, setModelOptions] = React.useState<string[]>([]);
    const [status, setStatus] = React.useState('');
    const [question, setQuestion] = React.useState('');
    const [hasOriginalPrompt, setHasOriginalPrompt] = React.useState(false);
    const [hasConversation, setHasConversation] = React.useState(false);
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [isListingModels, setIsListingModels] = React.useState(false);
    const [messagesView, setMessagesView] = React.useState<DisplayMessage[]>([]);
    const [followUps, setFollowUps] = React.useState<SingleChartFollowUpItem[]>([]);
    const [profiles, setProfiles] = React.useState<AiConfigProfile[]>(() => loadWebAiProfiles());
    const [activeProfileId, setActiveProfileId] = React.useState<string | null>(() => getActiveWebAiProfileId());

    const baseInputRef = React.useRef<HTMLInputElement>(null);
    const keyInputRef = React.useRef<HTMLInputElement>(null);
    const modelInputRef = React.useRef<HTMLInputElement>(null);
    const questionInputRef = React.useRef<HTMLTextAreaElement>(null);
    const outputRef = React.useRef<HTMLDivElement>(null);

    const originalMessagesRef = React.useRef<AiMessage[]>([]);
    const conversationRef = React.useRef<AiMessage[]>([]);
    const reasoningByIndexRef = React.useRef<Record<number, string>>({});
    const promptKeyRef = React.useRef<string>('');
    const streamAbortRef = React.useRef<AbortController | null>(null);
    const listAbortRef = React.useRef<AbortController | null>(null);
    const sessionVersionRef = React.useRef(0);
    const questionRevisionRef = React.useRef(0);

    const readLiveConfig = React.useCallback((): AiConfig => ({
      baseUrl: baseInputRef.current?.value ?? baseUrl,
      apiKey: keyInputRef.current?.value ?? apiKey,
      model: modelInputRef.current?.value ?? model,
    }), [baseUrl, apiKey, model]);

    // Sync external localStorage / ConnectPage updates via mingyu:web-ai-changed
    React.useEffect(() => {
      const syncFromStorage = () => {
        const cfg = readWebAiConfig();
        setBaseUrl(cfg.baseUrl);
        setApiKey(cfg.apiKey ?? '');
        setModel(cfg.model);
        setProfiles(loadWebAiProfiles());
        setActiveProfileId(getActiveWebAiProfileId());
      };
      window.addEventListener('mingyu:web-ai-changed', syncFromStorage);
      return () => window.removeEventListener('mingyu:web-ai-changed', syncFromStorage);
    }, []);

    // Support native programmatic `el.value = ...; el.dispatchEvent(new Event('input'))` (e.g. E2E checks)
    React.useEffect(() => {
      const baseEl = baseInputRef.current;
      const keyEl = keyInputRef.current;
      const modelEl = modelInputRef.current;
      const qEl = questionInputRef.current;
      const onBase = () => {
        if (!baseEl) return;
        setBaseUrl(baseEl.value);
        writeWebAiConfig({ baseUrl: baseEl.value });
      };
      const onKey = () => {
        if (!keyEl) return;
        setApiKey(keyEl.value);
        writeWebAiConfig({ apiKey: keyEl.value });
      };
      const onModel = () => {
        if (!modelEl) return;
        setModel(modelEl.value);
        writeWebAiConfig({ model: modelEl.value });
      };
      const onQ = () => {
        if (!qEl) return;
        questionRevisionRef.current += 1;
        setQuestion(qEl.value);
      };
      baseEl?.addEventListener('input', onBase);
      keyEl?.addEventListener('input', onKey);
      modelEl?.addEventListener('input', onModel);
      qEl?.addEventListener('input', onQ);
      return () => {
        baseEl?.removeEventListener('input', onBase);
        keyEl?.removeEventListener('input', onKey);
        modelEl?.removeEventListener('input', onModel);
        qEl?.removeEventListener('input', onQ);
      };
    }, []);

    const cancelModelList = React.useCallback((clearOptions = false) => {
      listAbortRef.current?.abort();
      listAbortRef.current = null;
      setIsListingModels(false);
      if (clearOptions) {
        setModelOptions([]);
        setStatus((prev) =>
          prev.startsWith('已获取 ') || prev === '模型列表为空，可手动填写。' ? '' : prev,
        );
      }
    }, []);

    const buildVisibleList = React.useCallback((allMsgs: readonly AiMessage[]): DisplayMessage[] => {
      const visible = allMsgs.slice(originalMessagesRef.current.length);
      return visible.map((m, idx) => ({
        id: `m-${idx}-${m.role}`,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
        ...(reasoningByIndexRef.current[idx] ? { reasoning: reasoningByIndexRef.current[idx] } : {}),
      }));
    }, []);

    const clearReading = React.useCallback(() => {
      sessionVersionRef.current += 1;
      cancelModelList();
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      originalMessagesRef.current = [];
      conversationRef.current = [];
      reasoningByIndexRef.current = {};
      promptKeyRef.current = '';
      setHasOriginalPrompt(false);
      setHasConversation(false);
      setIsStreaming(false);
      setMessagesView([]);
      setStatus('');
      setQuestion('');
    }, [cancelModelList]);

    const setAiPrompt = React.useCallback((prompt: { text: string; followUps?: SingleChartFollowUpItem[] }) => {
      if (Array.isArray(prompt.followUps)) {
        setFollowUps(prompt.followUps);
      }
      const split = splitPromptIntoSystemAndUser(prompt.text);
      originalMessagesRef.current = split.system
        ? [
            { role: 'system', content: split.system },
            { role: 'user', content: split.user },
          ]
        : [{ role: 'user', content: split.user }];
      const nextKey = hashPromptFingerprint(prompt.text);
      promptKeyRef.current = nextKey;
      setHasOriginalPrompt(originalMessagesRef.current.length > 0);

      // 若当前没有进行中的对话，自动恢复本地已保存的同盘历史解读（避免刷新丢失）
      if (conversationRef.current.length === 0 && !streamAbortRef.current) {
        const saved = loadStoredSingleReadings().find((item) => item.key === nextKey);
        if (saved && saved.messages.length > 0) {
          const restoredReasonings: Record<number, string> = {};
          const restoredMsgs: AiMessage[] = [
            ...originalMessagesRef.current,
            ...saved.messages.map((m, idx) => {
              if (m.reasoning) restoredReasonings[idx] = m.reasoning;
              return { role: m.role, content: m.content };
            }),
          ];
          reasoningByIndexRef.current = restoredReasonings;
          conversationRef.current = restoredMsgs;
          setHasConversation(true);
          setMessagesView(buildVisibleList(restoredMsgs));
          setStatus('已恢复本盘历史 AI 解读记录。');
        }
      }
    }, [buildVisibleList]);

    React.useImperativeHandle(ref, () => ({ setAiPrompt, clearReading }), [setAiPrompt, clearReading]);

    const scrollOutputToBottom = React.useCallback(() => {
      const el = outputRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, []);

    const askModel = React.useCallback(
      async (
        messages: AiMessage[],
        followup: boolean,
        submittedDraft?: { value: string; revision: number },
      ) => {
        if (streamAbortRef.current) return;
        const version = sessionVersionRef.current;
        cancelModelList();
        const current = new AbortController();
        streamAbortRef.current = current;
        setIsStreaming(true);

        const restarting = !followup && conversationRef.current.length > 0;
        const baseVisible = buildVisibleList(restarting ? conversationRef.current : messages);
        setMessagesView(baseVisible);
        setStatus('正在等待模型回复…');

        const cfg = readLiveConfig();
        let streamedContent = '';
        let streamedReasoning = '';

        const updateStreamingView = () => {
          setMessagesView([
            ...baseVisible,
            {
              id: 'streaming',
              role: 'assistant',
              content: streamedContent,
              ...(streamedReasoning ? { reasoning: streamedReasoning } : {}),
              streaming: true,
              badge: !streamedContent && streamedReasoning
                ? '深度思考中…'
                : restarting
                  ? '重新解读中…'
                  : '生成中…',
            },
          ]);
          scrollOutputToBottom();
        };

        try {
          const result = await streamChat(
            cfg,
            messages,
            (chunk) => {
              if (version !== sessionVersionRef.current || current.signal.aborted) return;
              if (!streamedContent) setStatus('正在生成…');
              streamedContent += chunk;
              updateStreamingView();
            },
            current.signal,
            fetch,
            (rChunk) => {
              if (version !== sessionVersionRef.current || current.signal.aborted) return;
              if (!streamedContent && !streamedReasoning) setStatus('模型正在深度思考…');
              streamedReasoning += rChunk;
              updateStreamingView();
            },
          );

          if (version !== sessionVersionRef.current) return;
          if (current.signal.aborted) {
            if (streamedContent || streamedReasoning) {
              setMessagesView([
                ...baseVisible,
                {
                  id: 'stopped',
                  role: 'assistant',
                  content: streamedContent,
                  ...(streamedReasoning ? { reasoning: streamedReasoning } : {}),
                  badge: '已停止',
                },
              ]);
            }
            setStatus('已停止，已收到的内容保留在页面中。');
            return;
          }
          if (result.finishReason !== 'stop') {
            if (streamedContent || streamedReasoning) {
              setMessagesView([
                ...baseVisible,
                {
                  id: 'partial',
                  role: 'assistant',
                  content: streamedContent,
                  ...(streamedReasoning ? { reasoning: streamedReasoning } : {}),
                  badge: '未完整结束',
                },
              ]);
            }
            setStatus(`回答未完整结束（${result.finishReason}），已保留本次内容，可重试。`);
            return;
          }

          if (!followup) {
            reasoningByIndexRef.current = {};
          }
          const nextConversation: AiMessage[] = [
            ...messages,
            { role: 'assistant', content: result.content },
          ];
          const assistantVisibleIdx = nextConversation.length - originalMessagesRef.current.length - 1;
          const finalReasoning = result.reasoning ?? streamedReasoning;
          if (finalReasoning && assistantVisibleIdx >= 0) {
            reasoningByIndexRef.current[assistantVisibleIdx] = finalReasoning;
          }
          conversationRef.current = nextConversation;
          setHasConversation(true);
          const nextVisible = buildVisibleList(nextConversation);
          setMessagesView(nextVisible);
          if (promptKeyRef.current) {
            saveStoredSingleReading({
              key: promptKeyRef.current,
              updatedAt: new Date().toISOString(),
              model: cfg.model.trim(),
              messages: nextVisible.map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.reasoning ? { reasoning: m.reasoning } : {}),
              })),
            });
          }
          if (
            followup &&
            submittedDraft &&
            questionRevisionRef.current === submittedDraft.revision &&
            (questionInputRef.current?.value ?? question) === submittedDraft.value
          ) {
            setQuestion('');
          }
          setStatus('回复完成。');
          scrollOutputToBottom();
        } catch (error) {
          if (version !== sessionVersionRef.current) return;
          if (streamedContent || streamedReasoning) {
            setMessagesView([
              ...baseVisible,
              {
                id: 'err-partial',
                role: 'assistant',
                content: streamedContent,
                ...(streamedReasoning ? { reasoning: streamedReasoning } : {}),
                badge: current.signal.aborted ? '已停止' : '请求中断',
              },
            ]);
          }
          setStatus(
            current.signal.aborted
              ? '已停止，已收到的内容保留在页面中。'
              : formatAiError(error),
          );
        } finally {
          if (version === sessionVersionRef.current && streamAbortRef.current === current) {
            streamAbortRef.current = null;
            setIsStreaming(false);
          }
        }
      },
      [buildVisibleList, cancelModelList, question, readLiveConfig, scrollOutputToBottom],
    );

    const handleListModels = React.useCallback(async () => {
      if (listAbortRef.current) return;
      const before = readLiveConfig();
      const version = sessionVersionRef.current;
      const current = new AbortController();
      listAbortRef.current = current;
      setIsListingModels(true);
      const isCurrent = () =>
        listAbortRef.current === current &&
        sessionVersionRef.current === version &&
        (baseInputRef.current?.value ?? baseUrl) === before.baseUrl &&
        (keyInputRef.current?.value ?? apiKey) === before.apiKey;
      try {
        const models = await listModels(before, fetch, current.signal);
        if (!isCurrent()) return;
        setModelOptions(models);
        setStatus(models.length ? `已获取 ${models.length} 个模型。` : '模型列表为空，可手动填写。');
      } catch (error) {
        if (isCurrent() && !current.signal.aborted) {
          setStatus(formatAiError(error));
        }
      } finally {
        if (listAbortRef.current === current) {
          listAbortRef.current = null;
          setIsListingModels(false);
        }
      }
    }, [apiKey, baseUrl, readLiveConfig]);

    const handleStart = React.useCallback(() => {
      const nowIso = new Date().toISOString();
      void askModel(
        originalMessagesRef.current.map((message) =>
          message.role === 'user' ? { ...message, submittedAt: nowIso } : { ...message },
        ),
        false,
      );
    }, [askModel]);

    const handleAskFollowup = React.useCallback(() => {
      const currentValue = questionInputRef.current?.value ?? question;
      const submittedDraft = { value: currentValue, revision: questionRevisionRef.current };
      const trimmed = submittedDraft.value.trim();
      if (!trimmed) {
        setStatus('请填写追问。');
        return;
      }
      void askModel(
        [
          ...conversationRef.current,
          { role: 'user', content: trimmed, submittedAt: new Date().toISOString() },
        ],
        true,
        submittedDraft,
      );
    }, [askModel, question]);

    const configured = Boolean(baseUrl.trim() && model.trim());
    const hasMessages = hasConversation || messagesView.length > 0;
    const normalizedBase = baseUrl.trim().replace(/\/+$/, '');

    const panelClass = [
      'panel-card',
      'ai-panel',
      configured ? 'is-model-configured' : 'is-model-unconfigured',
      hasMessages ? 'has-ai-messages' : '',
      isStreaming ? 'is-ai-streaming' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="workspace-pane-ai">
        <details className={panelClass} open>
          <summary>AI 模型解读</summary>

          <div className="ai-chat-headbar">
            <div className="ai-chat-headbar-info">
              <span className="ai-chat-status-dot" aria-hidden="true" />
              <span
                className={
                  configured ? 'ai-chat-model-badge' : 'ai-chat-model-badge is-unconfigured'
                }
              >
                {configured ? model.trim() : '尚未填写接口地址或模型'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {profiles.length >= 2 ? (
                <Select
                  aria-label="切换模型配置"
                  size="sm"
                  value={activeProfileId ?? ''}
                  onValueChange={(nextId) => {
                    const hit = activateWebAiProfile(nextId);
                    if (hit) {
                      setActiveProfileId(hit.id);
                      setBaseUrl(hit.baseUrl);
                      setApiKey(hit.apiKey);
                      setModel(hit.model);
                      setStatus(`已切换至方案「${hit.name}」。`);
                    }
                  }}
                  className="w-auto max-w-[148px] text-[11px] font-semibold"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              <button
                type="button"
                className="workspace-ui-button is-ghost is-small ai-chat-config-link"
                onClick={() => window.dispatchEvent(new CustomEvent('mingyu:navigate-connect'))}
              >
                配置 AI
              </button>
            </div>
          </div>

          <div className="ai-presets" aria-label="常用模型服务商预设">
            <span className="ai-presets-label whitespace-nowrap">预设：</span>
            {AI_PROVIDER_PRESETS.map((preset) => {
              const active = normalizedBase === preset.baseUrl;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={active ? 'ai-preset-btn active' : 'ai-preset-btn'}
                  aria-pressed={active ? 'true' : 'false'}
                  onClick={() => {
                    cancelModelList(true);
                    setBaseUrl(preset.baseUrl);
                    setModelPlaceholder(preset.modelHint);
                    writeWebAiConfig({ baseUrl: preset.baseUrl });
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="ai-config-grid">
            <label>
              接口地址{' '}
              <input
                ref={baseInputRef}
                id="ai-base"
                type="url"
                placeholder="https://example.com/v1"
                autoComplete="off"
                value={baseUrl}
                onChange={(e) => {
                  cancelModelList(true);
                  setBaseUrl(e.target.value);
                  writeWebAiConfig({ baseUrl: e.target.value });
                }}
              />
            </label>
            <label>
              密钥（可选）{' '}
              <input
                ref={keyInputRef}
                id="ai-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => {
                  cancelModelList(true);
                  setApiKey(e.target.value);
                  writeWebAiConfig({ apiKey: e.target.value });
                }}
              />
            </label>
            <div className="ai-model-row">
              <label>
                模型{' '}
                <input
                  ref={modelInputRef}
                  id="ai-model"
                  list="ai-models"
                  autoComplete="off"
                  placeholder={modelPlaceholder}
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    writeWebAiConfig({ model: e.target.value });
                  }}
                />
              </label>
              <datalist id="ai-models">
                {modelOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <button
                id="ai-list"
                type="button"
                disabled={isListingModels}
                onClick={() => void handleListModels()}
              >
                获取模型
              </button>
            </div>
          </div>

          <div className="ai-action-row">
            <button
              id="ai-start"
              type="button"
              className="btn-primary"
              disabled={!hasOriginalPrompt || isStreaming}
              onClick={handleStart}
            >
              {hasConversation ? '重新解读' : 'AI 解读'}
            </button>
            <button
              id="ai-stop"
              type="button"
              disabled={!isStreaming}
              onClick={() => streamAbortRef.current?.abort()}
            >
              停止
            </button>
            {hasConversation && !isStreaming ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const md = buildMarkdownExport(messagesView, readLiveConfig().model);
                    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `mingyu-ai-reading-${new Date().toISOString().slice(0, 10)}.md`;
                    a.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    setStatus('已导出 Markdown 解读报告。');
                  }}
                >
                  导出 .md
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeStoredSingleReading(promptKeyRef.current);
                    conversationRef.current = [];
                    reasoningByIndexRef.current = {};
                    setHasConversation(false);
                    setMessagesView([]);
                    setStatus('已清空本盘解读记录。');
                  }}
                >
                  清空
                </button>
              </>
            ) : null}
          </div>

          <p id="ai-status" role="status">
            {status}
          </p>

          <div id="ai-output" ref={outputRef} aria-live="polite">
            {messagesView.map((msg) => (
              <article
                key={msg.id}
                className={
                  msg.streaming
                    ? `ai-message ai-message-${msg.role} is-streaming`
                    : `ai-message ai-message-${msg.role}`
                }
              >
                <div className="ai-message-meta">
                  <span className="ai-message-role">
                    {msg.role === 'assistant' ? 'AI 解读' : '追问'}
                  </span>
                  {msg.role === 'assistant' ? (
                    msg.streaming || msg.badge ? (
                      <span className="ai-streaming-badge">{msg.badge ?? '生成中…'}</span>
                    ) : (
                      <CopyReplyButton content={msg.content} />
                    )
                  ) : null}
                </div>
                {msg.role === 'assistant' && msg.reasoning ? (
                  <details
                    className="mb-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]"
                    open={Boolean(msg.streaming && !msg.content)}
                  >
                    <summary className="cursor-pointer select-none font-semibold">
                      {msg.streaming && !msg.content ? '思考中…' : '思考过程'}
                    </summary>
                    <div className="mt-1 whitespace-pre-wrap leading-relaxed text-[12px] text-[var(--text-muted)]">
                      {msg.reasoning}
                    </div>
                  </details>
                ) : null}
                {msg.role === 'assistant' ? (
                  msg.streaming ? (
                    msg.content ? (
                      <div className="ai-message-body markdown-body">
                        <span className="ai-streaming-text">{msg.content}</span>
                      </div>
                    ) : null
                  ) : (
                    <AgentMarkdown content={msg.content} className="ai-message-body" />
                  )
                ) : (
                  <div className="ai-message-body">
                    <p>{msg.content}</p>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="ai-followup-composer">
            {hasConversation && !isStreaming && followUps.length > 0 ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="快捷追问建议">
                <span className="whitespace-nowrap text-[11px] font-semibold text-[var(--text-muted)]">追问：</span>
                {followUps.slice(0, 4).map((item, idx) => (
                  <button
                    key={`${item.label}-${idx}`}
                    type="button"
                    title={item.reason || item.question}
                    onClick={() => {
                      void askModel(
                        [
                          ...conversationRef.current,
                          { role: 'user', content: item.question, submittedAt: new Date().toISOString() },
                        ],
                        true,
                      );
                    }}
                    className="whitespace-nowrap rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-hover-surface)] cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            <p>
              <label className="full-width-label">
                <span>继续追问</span>
                <textarea
                  ref={questionInputRef}
                  id="ai-question"
                  rows={2}
                  placeholder="输入追问内容，Enter 发送 / Shift+Enter 换行…"
                  value={question}
                  onChange={(e) => {
                    questionRevisionRef.current += 1;
                    setQuestion(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing &&
                      hasConversation &&
                      !isStreaming
                    ) {
                      e.preventDefault();
                      handleAskFollowup();
                    }
                  }}
                />
              </label>
            </p>
            <div className="ai-followup-actions">
              <button
                id="ai-ask"
                type="button"
                disabled={!hasConversation || isStreaming}
                onClick={handleAskFollowup}
              >
                发送追问
              </button>
            </div>
          </div>
        </details>
      </div>
    );
  },
);
