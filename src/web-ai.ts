import { listModels, streamChat, type AiConfig, type AiMessage } from './ai';
import { renderMarkdownContent } from './web-report';
import { migrateV1StorageData } from './v2-ui/v1-migration';

export interface AiProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  modelHint: string;
}

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', modelHint: '例如 deepseek-chat' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelHint: '例如 gpt-4o-mini' },
  { id: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelHint: '例如 qwen-plus' },
  { id: 'moonshot', label: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', modelHint: '例如 moonshot-v1-8k' },
  { id: 'zhipu', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', modelHint: '例如 glm-4-flash' },
  { id: 'ollama', label: '本地 Ollama', baseUrl: 'http://localhost:11434/v1', modelHint: '例如 qwen2.5' },
];

function mountProviderPresets(aiBase: HTMLInputElement, aiModel: HTMLInputElement) {
  const anchor = aiBase.closest('p') ?? aiBase;
  const parent = anchor.parentElement;
  if (!parent || parent.querySelector('.ai-presets')) return;

  const bar = document.createElement('div');
  bar.className = 'ai-presets';
  bar.setAttribute('aria-label', '常用模型服务商预设');

  const label = document.createElement('span');
  label.className = 'ai-presets-label';
  label.textContent = '快捷预设：';
  bar.append(label);

  const buttons: HTMLButtonElement[] = [];
  const syncActive = () => {
    const current = aiBase.value.trim().replace(/\/+$/, '');
    buttons.forEach((btn, idx) => {
      const active = current === AI_PROVIDER_PRESETS[idx].baseUrl;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('active', active);
    });
  };

  for (const preset of AI_PROVIDER_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-preset-btn';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      aiBase.value = preset.baseUrl;
      aiModel.placeholder = preset.modelHint;
      aiBase.dispatchEvent(new Event('input', { bubbles: true }));
      syncActive();
    });
    buttons.push(btn);
    bar.append(btn);
  }

  aiBase.addEventListener('input', syncActive);
  syncActive();
  parent.insertBefore(bar, anchor);
}

export const WEB_AI_STORAGE_KEYS = {
  enabled: 'mingyu.v2.ai.webEnabled',
  baseUrl: 'mingyu.v2.ai.baseUrl',
  apiKey: 'mingyu.v2.ai.apiKey',
  model: 'mingyu.v2.ai.model',
  chatMode: 'mingyu.v2.ai.chatMode',
} as const;

export function isWebAiEnabled(): boolean {
  try {
    migrateV1StorageData();
    return window.localStorage.getItem(WEB_AI_STORAGE_KEYS.enabled) === 'true';
  } catch {
    return false;
  }
}

export function isWebAiConfigured(cfg: AiConfig = readWebAiConfig()): boolean {
  return Boolean(cfg.baseUrl.trim() && cfg.model.trim());
}

export function getChatModeOverride(): 'true' | 'false' | null {
  try {
    const val = window.localStorage.getItem(WEB_AI_STORAGE_KEYS.chatMode);
    if (val === 'true' || val === 'false') return val;
    return null;
  } catch {
    return null;
  }
}

export function isChatModeEnabled(): boolean {
  const override = getChatModeOverride();
  if (override === 'false') return false;
  if (override === 'true') return true;
  return isWebAiEnabled() && isWebAiConfigured();
}

export function isChatAgentActive(): boolean {
  return isWebAiEnabled() && isChatModeEnabled();
}

export function setChatModeEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(WEB_AI_STORAGE_KEYS.chatMode, enabled ? 'true' : 'false');
  } catch {}
  notifyWebAiChanged();
}

export function ensureChatModeDefaultOnSave(): boolean {
  const override = getChatModeOverride();
  if (override === null && isWebAiEnabled() && isWebAiConfigured()) {
    setChatModeEnabled(true);
    return true;
  }
  return isChatModeEnabled();
}

export function notifyWebAiChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mingyu:web-ai-changed'));
  }
}

export function setWebAiEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(WEB_AI_STORAGE_KEYS.enabled, enabled ? 'true' : 'false');
  } catch {}
  notifyWebAiChanged();
}

export function readWebAiConfig(): AiConfig {
  try {
    migrateV1StorageData();
    return {
      baseUrl: window.localStorage.getItem(WEB_AI_STORAGE_KEYS.baseUrl) ?? '',
      apiKey: window.localStorage.getItem(WEB_AI_STORAGE_KEYS.apiKey) ?? '',
      model: window.localStorage.getItem(WEB_AI_STORAGE_KEYS.model) ?? '',
    };
  } catch {
    return { baseUrl: '', apiKey: '', model: '' };
  }
}

export function writeWebAiConfig(patch: Partial<AiConfig>): void {
  try {
    if (patch.baseUrl !== undefined) {
      window.localStorage.setItem(WEB_AI_STORAGE_KEYS.baseUrl, patch.baseUrl);
    }
    if (patch.apiKey !== undefined) {
      window.localStorage.setItem(WEB_AI_STORAGE_KEYS.apiKey, patch.apiKey);
    }
    if (patch.model !== undefined) {
      window.localStorage.setItem(WEB_AI_STORAGE_KEYS.model, patch.model);
    }
  } catch {}

  if (typeof document !== 'undefined') {
    const baseEl = document.querySelector<HTMLInputElement>('#ai-base');
    const keyEl = document.querySelector<HTMLInputElement>('#ai-key');
    const modelEl = document.querySelector<HTMLInputElement>('#ai-model');
    if (baseEl && patch.baseUrl !== undefined && baseEl.value !== patch.baseUrl) {
      baseEl.value = patch.baseUrl;
    }
    if (keyEl && patch.apiKey !== undefined && keyEl.value !== patch.apiKey) {
      keyEl.value = patch.apiKey;
    }
    if (modelEl && patch.model !== undefined && modelEl.value !== patch.model) {
      modelEl.value = patch.model;
    }
  }
  notifyWebAiChanged();
}

function createAiPaneDom(): HTMLElement {
  const pane = document.createElement('div');
  pane.className = 'workspace-pane-ai';
  pane.innerHTML = `<details class="panel-card ai-panel" open>
    <summary>AI 模型解读</summary>
    <p class="hint-text">密钥仅存本地浏览器，直连所填接口。</p>
    <div class="ai-config-grid">
      <label>接口地址 <input id="ai-base" type="url" placeholder="https://example.com/v1" autocomplete="off"></label>
      <label>密钥（可选） <input id="ai-key" type="password" autocomplete="off"></label>
      <div class="ai-model-row">
        <label>模型 <input id="ai-model" list="ai-models" autocomplete="off"></label>
        <datalist id="ai-models"></datalist>
        <button id="ai-list" type="button">获取模型列表</button>
      </div>
    </div>
    <div class="ai-action-row">
      <button id="ai-start" type="button" class="btn-primary" disabled>开始 AI 解读</button>
      <button id="ai-stop" type="button" disabled>停止生成</button>
    </div>
    <p id="ai-status" role="status"></p>
    <div id="ai-output" aria-live="polite"></div>
    <div class="ai-followup-composer">
      <p><label class="full-width-label"><span>继续追问</span><textarea id="ai-question" rows="2" placeholder="输入追问内容，Enter 发送 / Shift+Enter 换行…"></textarea></label></p>
      <div class="ai-followup-actions">
        <button id="ai-ask" type="button" disabled>发送追问</button>
      </div>
    </div>
  </details>`;
  return pane;
}

/**
 * Initialize the browser AI chat panel and return its detached pane element plus controls.
 */
export function initAiChat() {
  const paneElement =
    document.querySelector<HTMLElement>('.workspace-pane-ai') ?? createAiPaneDom();
  const aiBase = paneElement.querySelector<HTMLInputElement>('#ai-base')!;
  const aiKey = paneElement.querySelector<HTMLInputElement>('#ai-key')!;
  const aiModel = paneElement.querySelector<HTMLInputElement>('#ai-model')!;
  const saved = readWebAiConfig();
  aiBase.value = saved.baseUrl;
  aiModel.value = saved.model;
  aiKey.value = saved.apiKey ?? '';

  aiBase.addEventListener('input', () => writeWebAiConfig({ baseUrl: aiBase.value }));
  aiKey.addEventListener('input', () => writeWebAiConfig({ apiKey: aiKey.value }));
  aiModel.addEventListener('input', () => writeWebAiConfig({ model: aiModel.value }));
  mountProviderPresets(aiBase, aiModel);
  const aiModels = paneElement.querySelector<HTMLDataListElement>('#ai-models')!;
  const aiList = paneElement.querySelector<HTMLButtonElement>('#ai-list')!;
  const aiStart = paneElement.querySelector<HTMLButtonElement>('#ai-start')!;
  const aiStop = paneElement.querySelector<HTMLButtonElement>('#ai-stop')!;
  const aiAsk = paneElement.querySelector<HTMLButtonElement>('#ai-ask')!;
  const aiQuestion = paneElement.querySelector<HTMLTextAreaElement>('#ai-question')!;
  const aiOutput = paneElement.querySelector<HTMLElement>('#ai-output')!;
  const aiStatus = paneElement.querySelector<HTMLElement>('#ai-status')!;
  const aiPanel = aiStart.closest<HTMLElement>('.ai-panel');

  // Inject clean active-model summary bar inside the result-page AI chat panel
  let activeModelPill: HTMLElement | null = null;
  if (aiPanel && !aiPanel.querySelector('.ai-chat-headbar')) {
    const headBar = document.createElement('div');
    headBar.className = 'ai-chat-headbar';
    const infoWrap = document.createElement('div');
    infoWrap.className = 'ai-chat-headbar-info';
    const statusDot = document.createElement('span');
    statusDot.className = 'ai-chat-status-dot';
    statusDot.setAttribute('aria-hidden', 'true');
    activeModelPill = document.createElement('span');
    activeModelPill.className = 'ai-chat-model-badge';
    infoWrap.append(statusDot, activeModelPill);

    const goConnectBtn = document.createElement('button');
    goConnectBtn.type = 'button';
    goConnectBtn.className = 'workspace-ui-button is-ghost is-small ai-chat-config-link';
    goConnectBtn.textContent = '配置接口';
    goConnectBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('mingyu:navigate-connect'));
    });

    headBar.append(infoWrap, goConnectBtn);
    const summaryEl = aiPanel.querySelector('summary');
    if (summaryEl) {
      summaryEl.insertAdjacentElement('afterend', headBar);
    } else {
      aiPanel.prepend(headBar);
    }
  }

  const syncModelBadge = () => {
    const cfg = config();
    const configured = Boolean(cfg.baseUrl.trim() && cfg.model.trim());
    if (activeModelPill) {
      if (configured) {
        activeModelPill.textContent = cfg.model.trim();
        activeModelPill.classList.remove('is-unconfigured');
      } else {
        activeModelPill.textContent = '尚未填写接口地址或模型';
        activeModelPill.classList.add('is-unconfigured');
      }
    }
    if (aiPanel) {
      aiPanel.classList.toggle('is-model-configured', configured);
      aiPanel.classList.toggle('is-model-unconfigured', !configured);
    }
  };
  syncModelBadge();
  window.addEventListener('mingyu:web-ai-changed', syncModelBadge);
  let originalMessages: AiMessage[] = [];
  let conversation: AiMessage[] = [];
  let controller: AbortController | undefined;
  let modelListController: AbortController | undefined;
  let sessionVersion = 0;
  let aiQuestionRevision = 0;
  aiQuestion.addEventListener('input', () => { aiQuestionRevision++; });
  aiQuestion.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !aiAsk.disabled) {
      event.preventDefault();
      aiAsk.click();
    }
  });

  function syncPanelState() {
    if (!aiPanel) return;
    const hasMessages = conversation.length > 0 || aiOutput.childElementCount > 0;
    aiPanel.classList.toggle('has-ai-messages', hasMessages);
    aiPanel.classList.toggle('is-ai-streaming', !!controller);
    aiStart.textContent = conversation.length > 0 ? '重新解读' : '开始 AI 解读';
  }

  function refreshAiButtons() {
    aiStart.disabled = !originalMessages.length || !!controller;
    aiAsk.disabled = !conversation.length || !!controller;
    aiStop.disabled = !controller;
    syncPanelState();
  }
  function cancelModelList(clearOptions = false) {
    modelListController?.abort();
    modelListController = undefined;
    aiList.disabled = false;
    if (clearOptions) {
      aiModels.replaceChildren();
      if (aiStatus.textContent?.startsWith('已获取 ') || aiStatus.textContent === '模型列表为空，可手动填写。') aiStatus.textContent = '';
    }
  }
  function clearReading() {
    sessionVersion++;
    cancelModelList();
    controller?.abort(); controller = undefined;
    originalMessages = []; conversation = [];
    aiOutput.replaceChildren(); aiStatus.textContent = ''; aiQuestion.value = '';
    refreshAiButtons();
  }
  function setAiPrompt(prompt: { text: string }) {
    originalMessages = [{ role: 'user', content: prompt.text }];
    refreshAiButtons();
  }
  function config(): AiConfig { return { baseUrl: aiBase.value, apiKey: aiKey.value, model: aiModel.value }; }

  function createCopyReplyButton(content: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-message-copy-btn';
    btn.textContent = '复制';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(content);
        btn.textContent = '已复制';
        btn.classList.add('is-copied');
        window.setTimeout(() => {
          btn.textContent = '复制';
          btn.classList.remove('is-copied');
        }, 1800);
      } catch {
        btn.textContent = '请手动复制';
      }
    });
    return btn;
  }

  function buildMessageItem(role: 'user' | 'assistant', content?: string): {
    item: HTMLElement;
    body: HTMLElement;
    badge?: HTMLElement;
  } {
    const item = document.createElement('article');
    item.className = `ai-message ai-message-${role}`;

    const meta = document.createElement('div');
    meta.className = 'ai-message-meta';
    const roleEl = document.createElement('span');
    roleEl.className = 'ai-message-role';
    roleEl.textContent = role === 'assistant' ? 'AI 解读' : '追问';
    meta.append(roleEl);

    let badge: HTMLElement | undefined;
    if (role === 'assistant') {
      if (content !== undefined) {
        meta.append(createCopyReplyButton(content));
      } else {
        badge = document.createElement('span');
        badge.className = 'ai-streaming-badge';
        badge.textContent = '生成中…';
        meta.append(badge);
      }
    }
    item.append(meta);

    const body = document.createElement('div');
    body.className = role === 'assistant' ? 'ai-message-body markdown-body' : 'ai-message-body';
    if (content !== undefined) {
      if (role === 'assistant') {
        renderMarkdownContent(body, content);
      } else {
        const p = document.createElement('p');
        p.textContent = content;
        body.append(p);
      }
    }
    item.append(body);
    return { item, body, badge };
  }

  function showConversation(messages: readonly AiMessage[]) {
    const visible = messages.slice(originalMessages.length);
    if (!visible.length) {
      aiOutput.replaceChildren();
      syncPanelState();
      return;
    }
    const fragment = document.createDocumentFragment();
    visible.forEach((message) => {
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const { item } = buildMessageItem(role, message.content);
      fragment.append(item);
    });
    aiOutput.replaceChildren(fragment);
    syncPanelState();
    aiOutput.scrollTop = aiOutput.scrollHeight;
  }
  function aiError(error: unknown) {
    return error instanceof TypeError ? '无法连接模型服务，请检查地址、网络及跨域设置。' : error instanceof Error ? error.message : '模型请求失败。';
  }
  async function askModel(messages: AiMessage[], followup: boolean, submittedDraft?: { value: string; revision: number }) {
    if (controller) return;
    const version = sessionVersion;
    cancelModelList();
    const current = new AbortController(); controller = current; refreshAiButtons();
    const restarting = !followup && conversation.length > 0;
    showConversation(restarting ? conversation : messages);
    aiStatus.textContent = '正在等待模型回复…';
    let responseText: Text | undefined;
    let streamItem: HTMLElement | undefined;
    let streamBody: HTMLElement | undefined;
    let streamBadge: HTMLElement | undefined;
    let streamedContent = '';

    const finalizePartialStream = (badgeLabel: string) => {
      if (!streamItem || !streamBody) return;
      streamItem.classList.remove('is-streaming');
      if (streamBadge) streamBadge.textContent = badgeLabel;
      if (streamedContent) {
        streamBody.replaceChildren();
        renderMarkdownContent(streamBody, streamedContent);
      }
    };

    try {
      const result = await streamChat(config(), messages, (chunk) => {
        if (version !== sessionVersion || current.signal.aborted) return;
        if (!responseText) {
          const built = buildMessageItem('assistant');
          streamItem = built.item;
          streamBody = built.body;
          streamBadge = built.badge;
          streamItem.classList.add('is-streaming');
          if (restarting && streamBadge) streamBadge.textContent = '重新解读中…';
          const span = document.createElement('span');
          span.className = 'ai-streaming-text';
          responseText = document.createTextNode('');
          span.append(responseText);
          streamBody.append(span);
          aiOutput.append(streamItem);
          syncPanelState();
          aiStatus.textContent = '正在生成…';
        }
        streamedContent += chunk;
        responseText.appendData(chunk);
        aiOutput.scrollTop = aiOutput.scrollHeight;
      }, current.signal);
      if (version !== sessionVersion) return;
      if (current.signal.aborted) {
        finalizePartialStream('已停止');
        aiStatus.textContent = '已停止，已收到的内容保留在页面中。';
        return;
      }
      if (result.finishReason !== 'stop') {
        finalizePartialStream('未完整结束');
        aiStatus.textContent = `回答未完整结束（${result.finishReason}），已保留本次内容，可重试。`;
        return;
      }
      conversation = [...messages, { role: 'assistant', content: result.content }];
      showConversation(conversation);
      if (followup && submittedDraft && aiQuestionRevision === submittedDraft.revision && aiQuestion.value === submittedDraft.value) aiQuestion.value = '';
      aiStatus.textContent = '回复完成。';
    } catch (error) {
      if (version !== sessionVersion) return;
      finalizePartialStream(current.signal.aborted ? '已停止' : '请求中断');
      aiStatus.textContent = current.signal.aborted ? '已停止，已收到的内容保留在页面中。' : aiError(error);
    } finally {
      if (version === sessionVersion && controller === current) { controller = undefined; refreshAiButtons(); }
    }
  }
  for (const field of [aiBase, aiKey]) field.addEventListener('input', () => cancelModelList(true));
  aiList.addEventListener('click', async () => {
    if (modelListController) return;
    const before = config(), version = sessionVersion;
    const current = new AbortController(); modelListController = current; aiList.disabled = true;
    const isCurrent = () => modelListController === current && sessionVersion === version
      && aiBase.value === before.baseUrl && aiKey.value === before.apiKey;
    try {
      const models = await listModels(before, fetch, current.signal);
      if (!isCurrent()) return;
      aiModels.replaceChildren(...models.map((value) => { const option = document.createElement('option'); option.value = value; return option; }));
      aiStatus.textContent = models.length ? `已获取 ${models.length} 个模型。` : '模型列表为空，可手动填写。';
    } catch (error) { if (isCurrent() && !current.signal.aborted) aiStatus.textContent = aiError(error); }
    finally { if (modelListController === current) { modelListController = undefined; aiList.disabled = false; } }
  });
  aiStart.addEventListener('click', () => { void askModel(originalMessages.map((message) => ({ ...message, submittedAt: new Date().toISOString() })), false); });
  aiStop.addEventListener('click', () => controller?.abort());
  aiAsk.addEventListener('click', () => {
    const submittedDraft = { value: aiQuestion.value, revision: aiQuestionRevision };
    const question = submittedDraft.value.trim();
    if (!question) { aiStatus.textContent = '请填写追问。'; return; }
    void askModel([...conversation, { role: 'user', content: question, submittedAt: new Date().toISOString() }], true, submittedDraft);
  });

  return { paneElement, clearReading, setAiPrompt };
}
