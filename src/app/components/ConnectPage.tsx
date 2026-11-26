import * as React from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  PlugZap,
} from 'lucide-react';
import type { Method } from '../../schema';
import { isWebAiEnabled } from '../../web-ai';
import { webExamples } from '../../web-examples';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  SegmentedTabs,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import { WebAiConfigForm } from './WebAiConfigForm';

type IntegrationTabId = 'mcp' | 'rest' | 'skill';
type RemoteMcpClientKey = 'claude' | 'cursor' | 'windsurf' | 'generic';

const CONNECT_METHOD_OPTIONS: ReadonlyArray<{ id: Method; label: string }> = [
  { id: 'bazi', label: '八字排盘' },
  { id: 'ziwei', label: '紫微斗数' },
  { id: 'liuyao', label: '六爻占卜' },
  { id: 'qimen', label: '奇门遁甲' },
  { id: 'zhouyi', label: '周易经典' },
  { id: 'tarot', label: '塔罗牌阵' },
];

const REMOTE_MCP_CLIENTS: ReadonlyArray<{ id: RemoteMcpClientKey; label: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'generic', label: '通用' },
];

const ENDPOINTS: ReadonlyArray<{ method: 'GET' | 'POST'; path: string; summary: string }> = [
  { method: 'GET', path: '/api/methods', summary: '全部术数方法列表' },
  { method: 'POST', path: '/api/calculate', summary: '执行排盘与生成提示词' },
  { method: 'POST', path: '/api/prompt', summary: '基于原盘重新生成追问' },
  { method: 'GET', path: '/api/schema', summary: '查询入参 JSON Schema' },
];

function getOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }
  return 'https://aov.cc';
}

function parseMcpInitializeResponse(raw: string, contentType: string): unknown {
  if (contentType.includes('text/event-stream')) {
    const dataLines = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== '[DONE]');
    const last = dataLines.at(-1);
    return last ? JSON.parse(last) : null;
  }
  return raw ? JSON.parse(raw) : null;
}

function buildMcpClientConfigs(origin: string): Record<RemoteMcpClientKey, string> {
  const mcpUrl = `${origin}/mcp`;
  return {
    claude: JSON.stringify(
      { mcpServers: { mingyu: { command: 'npx', args: ['-y', 'mcp-remote', mcpUrl] } } },
      null,
      2,
    ),
    cursor: JSON.stringify({ mcpServers: { mingyu: { url: mcpUrl } } }, null, 2),
    windsurf: JSON.stringify(
      { mcpServers: { mingyu: { serverUrl: mcpUrl, type: 'streamable-http' } } },
      null,
      2,
    ),
    generic: JSON.stringify(
      {
        transport: 'streamable-http',
        url: mcpUrl,
        headers: { Authorization: 'Bearer <可选访问令牌>' },
      },
      null,
      2,
    ),
  };
}

const UNIFIED_PANEL_CLS =
  'min-w-0 max-w-full rounded-xl min-[680px]:rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3 sm:p-5 shadow-[0_2px_12px_rgba(32,24,16,0.035)]';

export interface ConnectPageProps {
  onNavigateHome?: () => void;
}

export function ConnectPage({ onNavigateHome }: ConnectPageProps = {}) {
  const origin = React.useMemo(() => getOrigin(), []);
  const mcpUrl = `${origin}/mcp`;
  const apiDocsUrl = `${origin}/api-docs`;
  const apiDocsMdUrl = `${origin}/api-docs.md`;
  const skillZipUrl = `${origin}/downloads/mingyu-skill.zip`;
  const configs = React.useMemo(() => buildMcpClientConfigs(origin), [origin]);

  const [webAiEnabled, setWebAiEnabledState] = React.useState(() => isWebAiEnabled());
  React.useEffect(() => {
    const sync = () => setWebAiEnabledState(isWebAiEnabled());
    window.addEventListener('mingyu:web-ai-changed', sync);
    return () => window.removeEventListener('mingyu:web-ai-changed', sync);
  }, []);

  // External client integration tab
  const [integrationTab, setIntegrationTab] = React.useState<IntegrationTabId>('mcp');

  // Probe state
  const [probeDrawerOpen, setProbeDrawerOpen] = React.useState(false);
  const [accessToken, setAccessToken] = React.useState('');
  const [probing, setProbing] = React.useState(false);
  const [probeBadge, setProbeBadge] = React.useState<{
    variant: 'outline' | 'good' | 'warn';
    text: string;
  } | null>(null);
  const [probeLog, setProbeLog] = React.useState('');

  // Client & API code tabs + Copy feedback
  const [activeClient, setActiveClient] = React.useState<RemoteMcpClientKey>('claude');
  const [selectedMethod, setSelectedMethod] = React.useState<Method>('bazi');
  const [apiCodeMode, setApiCodeMode] = React.useState<'curl' | 'json'>('curl');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [copyToast, setCopyToast] = React.useState<string | null>(null);

  const handleCopy = async (id: string, label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setCopyToast(`已复制：${label}`);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === id ? null : cur));
      }, 1800);
    } catch {
      setCopyToast(`无法自动复制「${label}」，请手动复制。`);
    }
  };

  const runProbe = async () => {
    setProbeDrawerOpen(true);
    setProbing(true);
    setProbeBadge({ variant: 'outline', text: '检测中…' });
    setProbeLog(`正在测试 ${origin}/api/methods 与 ${mcpUrl} …`);

    const token = accessToken.trim();
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const lines: string[] = [];
    let apiOk = false;
    let mcpOk = false;

    const apiStart = performance.now();
    try {
      const res = await fetch(`${origin}/api/methods`, { headers: authHeaders });
      const elapsed = Math.round(performance.now() - apiStart);
      if (res.ok) {
        apiOk = true;
        const data = (await res.json()) as { methods?: unknown };
        const methods = Array.isArray(data.methods) ? data.methods : [];
        lines.push(`✓ REST API：连通（HTTP ${res.status} · ${elapsed} ms · ${methods.length} 项）`);
      } else {
        lines.push(`✕ REST API：异常（HTTP ${res.status} · ${elapsed} ms）`);
      }
    } catch (error) {
      lines.push(`✕ REST API：失败（${error instanceof Error ? error.message : '网络错误'}）`);
    }

    const mcpStart = performance.now();
    try {
      const res = await fetch(mcpUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...authHeaders,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'mingyu-web-connect', version: '2.0.0' },
          },
        }),
      });
      const elapsed = Math.round(performance.now() - mcpStart);
      const text = await res.text();
      if (res.ok) {
        const parsed = parseMcpInitializeResponse(text, res.headers.get('content-type') ?? '') as {
          result?: { protocolVersion?: string };
        } | null;
        if (parsed?.result) {
          mcpOk = true;
          lines.push(`✓ 远程 MCP：握手成功（HTTP ${res.status} · ${elapsed} ms）`);
        } else {
          lines.push(`△ 远程 MCP：响应未解析（HTTP ${res.status} · ${elapsed} ms）`);
        }
      } else {
        lines.push(`✕ 远程 MCP：异常（HTTP ${res.status} · ${elapsed} ms）`);
      }
    } catch (error) {
      lines.push(`✕ 远程 MCP：失败（${error instanceof Error ? error.message : '网络错误'}）`);
    }

    if (apiOk && mcpOk) {
      setProbeBadge({ variant: 'good', text: '全部在线' });
    } else if (apiOk || mcpOk) {
      setProbeBadge({ variant: 'outline', text: '部分可用' });
    } else {
      setProbeBadge({ variant: 'warn', text: '未就绪' });
    }
    setProbeLog(lines.join('\n'));
    setProbing(false);
  };

  const apiDocsAgentPrompt = `阅读以下命语 REST API 文档并帮我完成接口接入：\n${apiDocsMdUrl}`;
  const skillAgentPrompt = `从 ${skillZipUrl} 下载并解压到 Agent 技能目录，按其中 SKILL.md 使用 node scripts/mingyu.mjs 本地执行排盘与占卜。`;

  const curlCmd = React.useMemo(() => {
    const payload = JSON.stringify({ method: selectedMethod, input: webExamples[selectedMethod] });
    const escaped = payload.replace(/'/g, `'\\''`);
    return `curl -X POST '${origin}/api/calculate' \\\n  -H 'content-type: application/json' \\\n  -d '${escaped}'`;
  }, [origin, selectedMethod]);

  const apiCodeText =
    apiCodeMode === 'curl'
      ? curlCmd
      : JSON.stringify({ method: selectedMethod, input: webExamples[selectedMethod] }, null, 2);

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[var(--workspace-canvas-form,760px)] grid-cols-1 gap-2.5 sm:gap-4 pb-6 sm:pb-10">
      <PageHeader
        title="接入 AI"
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            {probeBadge ? <Badge variant={probeBadge.variant}>{probeBadge.text}</Badge> : null}
            <Button
              variant={probeDrawerOpen ? 'pillActive' : 'secondary'}
              size="sm"
              onClick={() => setProbeDrawerOpen((prev) => !prev)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>访问令牌</span>
            </Button>
            <Button variant="primary" size="sm" disabled={probing} onClick={() => void runProbe()}>
              <PlugZap className="h-3.5 w-3.5" />
              <span>{probing ? '检测中…' : '连通自检'}</span>
            </Button>
          </div>
        }
      />

      {probeDrawerOpen ? (
        <Card className="grid min-w-0 max-w-full grid-cols-1 gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
          <label className="grid min-w-0 gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
            <span>访问令牌（可选）</span>
            <Input
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="未配置 ACCESS_TOKEN 时留空即可"
            />
          </label>
          {probeLog ? (
            <pre className="m-0 w-full max-w-full overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3 font-mono text-xs leading-relaxed text-[var(--text-primary)]">
              {probeLog}
            </pre>
          ) : null}
        </Card>
      ) : null}

      {copyToast ? (
        <div
          role="status"
          className="rounded-xl border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[var(--state-selected-surface)] px-4 py-2 text-xs font-semibold text-[var(--state-selected-text)]"
        >
          {copyToast}
        </div>
      ) : null}

      {/* 1. 网页内 AI 对话 */}
      <Card
        className={cn(
          UNIFIED_PANEL_CLS,
          webAiEnabled && 'border-[color-mix(in_srgb,var(--accent)_35%,var(--border-soft))]',
        )}
      >
        <WebAiConfigForm onNavigateHome={onNavigateHome} />
      </Card>

      {/* 2. 外部 AI 客户端接入（单一统一切换卡：远程 MCP / REST 接口 / Agent Skill） */}
      <Card className={cn(UNIFIED_PANEL_CLS, 'grid min-w-0 max-w-full grid-cols-1 gap-4')}>
        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-soft)] pb-3.5">
          <h2 className="m-0 font-sans text-[15.5px] font-extrabold text-[var(--text-strong)]">
            外部客户端接入
          </h2>
          <SegmentedTabs
            value={integrationTab}
            onValueChange={setIntegrationTab}
            ariaLabel="外部 AI 接入方式"
            fullWidthOnMobile
            options={[
              { id: 'mcp', label: '远程 MCP' },
              { id: 'rest', label: 'REST 接口' },
              { id: 'skill', label: 'Agent Skill' },
            ]}
          />
        </div>

        {/* 2.1 远程 MCP */}
        {integrationTab === 'mcp' ? (
          <div className="grid min-w-0 max-w-full grid-cols-1 gap-3.5">
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 sm:px-3.5">
              <code className="min-w-0 max-w-full flex-1 basis-[180px] truncate font-mono text-xs font-bold text-[var(--text-strong)]">
                {mcpUrl}
              </code>
              <Button
                variant="secondary"
                size="xs"
                className="shrink-0"
                onClick={() => void handleCopy('mcp-url', 'MCP 地址', mcpUrl)}
              >
                {copiedId === 'mcp-url' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === 'mcp-url' ? '已复制' : '复制地址'}</span>
              </Button>
            </div>

            <SegmentedTabs
              value={activeClient}
              onValueChange={setActiveClient}
              ariaLabel="选择 MCP 客户端"
              fullWidthOnMobile
              options={REMOTE_MCP_CLIENTS}
            />

            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)]">
              <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2 sm:px-3.5">
                <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">
                  JSON 配置
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  className="shrink-0"
                  onClick={() => void handleCopy('mcp-cfg', 'MCP 配置', configs[activeClient])}
                >
                  {copiedId === 'mcp-cfg' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedId === 'mcp-cfg' ? '已复制' : '复制配置'}</span>
                </Button>
              </div>
              <pre className="m-0 w-full max-w-full overflow-x-auto !whitespace-pre !break-normal p-3 sm:p-3.5 font-mono text-[11px] sm:text-xs leading-relaxed text-[var(--text-strong)]">
                {configs[activeClient]}
              </pre>
            </div>
          </div>
        ) : null}

        {/* 2.2 REST 接口 */}
        {integrationTab === 'rest' ? (
          <div className="grid min-w-0 max-w-full grid-cols-1 gap-3.5">
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 sm:px-3.5">
              <code className="min-w-0 max-w-full flex-1 basis-[180px] truncate font-mono text-xs font-bold text-[var(--text-strong)]">
                {apiDocsUrl}
              </code>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <a
                  href="/api-docs"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--accent-strong)] px-2.5 text-xs font-semibold text-[var(--accent-contrast)] no-underline hover:bg-[var(--accent-deep)]"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>网页文档</span>
                </a>
                <a
                  href="/api-docs.md"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2.5 text-xs font-semibold text-[var(--text-primary)] no-underline hover:border-[var(--border-strong)]"
                >
                  <span>Markdown (.md)</span>
                </a>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              {ENDPOINTS.map((ep) => (
                <div
                  key={ep.path}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Badge variant={ep.method === 'POST' ? 'accent' : 'outline'} className="shrink-0 font-mono text-[10.5px]">
                      {ep.method}
                    </Badge>
                    <code className="min-w-0 truncate font-mono font-bold text-[var(--text-strong)]">{ep.path}</code>
                  </div>
                  <span className="min-w-0 truncate text-[var(--text-muted)]">{ep.summary}</span>
                </div>
              ))}
            </div>

            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 sm:px-3.5">
              <span className="text-xs font-bold text-[var(--text-strong)]">AI Agent 接入指令</span>
              <Button
                variant="primary"
                size="xs"
                className="shrink-0"
                onClick={() => void handleCopy('api-agent', 'Agent 接入指令', apiDocsAgentPrompt)}
              >
                {copiedId === 'api-agent' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === 'api-agent' ? '已复制' : '复制指令'}</span>
              </Button>
            </div>

            <details className="min-w-0 max-w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <summary className="cursor-pointer text-xs font-bold text-[var(--text-strong)]">
                请求示例（cURL / JSON）
              </summary>
              <div className="mt-3 grid min-w-0 grid-cols-1 gap-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {CONNECT_METHOD_OPTIONS.map((opt) => (
                      <Button
                        key={opt.id}
                        variant={selectedMethod === opt.id ? 'pillActive' : 'pill'}
                        size="xs"
                        onClick={() => setSelectedMethod(opt.id)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <SegmentedTabs
                    value={apiCodeMode}
                    onValueChange={setApiCodeMode}
                    options={[
                      { id: 'curl', label: 'cURL' },
                      { id: 'json', label: 'JSON' },
                    ]}
                  />
                </div>

                <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]">
                  <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2 sm:px-3.5">
                    <span className="font-mono text-[11px] text-[var(--text-muted)]">
                      {apiCodeMode === 'curl' ? 'POST /api/calculate' : '请求体'}
                    </span>
                    <Button
                      variant="secondary"
                      size="xs"
                      className="shrink-0"
                      onClick={() => void handleCopy('api-sample', '请求示例', apiCodeText)}
                    >
                      {copiedId === 'api-sample' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedId === 'api-sample' ? '已复制' : '复制'}</span>
                    </Button>
                  </div>
                  <pre className="m-0 w-full max-w-full overflow-x-auto !whitespace-pre !break-normal p-3 sm:p-3.5 font-mono text-[11px] sm:text-xs leading-relaxed text-[var(--text-strong)]">
                    {apiCodeText}
                  </pre>
                </div>
              </div>
            </details>
          </div>
        ) : null}

        {/* 2.3 Agent Skill */}
        {integrationTab === 'skill' ? (
          <div className="grid min-w-0 max-w-full grid-cols-1 gap-3.5">
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 sm:px-3.5">
              <code className="min-w-0 max-w-full flex-1 basis-[180px] truncate font-mono text-xs font-bold text-[var(--text-strong)]">
                {skillZipUrl}
              </code>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <a
                  href="/downloads/mingyu-skill.zip"
                  download="mingyu-skill.zip"
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--accent-strong)] px-2.5 text-xs font-semibold text-[var(--accent-contrast)] no-underline hover:bg-[var(--accent-deep)]"
                >
                  <Download className="h-3 w-3" />
                  <span>下载压缩包</span>
                </a>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => void handleCopy('skill-url', '下载直链', skillZipUrl)}
                >
                  {copiedId === 'skill-url' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedId === 'skill-url' ? '已复制' : '复制链接'}</span>
                </Button>
              </div>
            </div>

            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)]">
              <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2 sm:px-3.5">
                <span className="text-xs font-bold text-[var(--text-strong)]">AI Agent 安装指令</span>
                <Button
                  variant="primary"
                  size="xs"
                  className="shrink-0"
                  onClick={() => void handleCopy('skill-agent', 'Skill 安装指令', skillAgentPrompt)}
                >
                  {copiedId === 'skill-agent' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedId === 'skill-agent' ? '已复制' : '复制指令'}</span>
                </Button>
              </div>
              <pre className="m-0 w-full max-w-full overflow-x-auto !whitespace-pre-wrap !break-all p-3 sm:p-3.5 font-sans text-[12.5px] sm:text-xs leading-relaxed text-[var(--text-strong)]">
                {skillAgentPrompt}
              </pre>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
