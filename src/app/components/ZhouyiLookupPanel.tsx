import * as React from 'react';
import { BookOpen, Check, Copy, Search, Sparkles } from 'lucide-react';
import { runCalculateInBackground } from '../../workers/calc-runner';
import { Button, Card, Input, SegmentedTabs, Select } from '../../components/ui';

type ZhouyiMode = 'hexagram' | 'search' | 'wings';

const WING_OPTIONS = [
  { value: '', label: '全部十翼' },
  { value: '文言传', label: '文言传' },
  { value: '系辞上传', label: '系辞上传' },
  { value: '系辞下传', label: '系辞下传' },
  { value: '说卦传', label: '说卦传' },
  { value: '序卦传', label: '序卦传' },
  { value: '杂卦传', label: '杂卦传' },
] as const;

export interface ZhouyiLookupPanelProps {
  onOpenInResult?: (payload: Record<string, unknown>, result: unknown) => void;
}

export function ZhouyiLookupPanel({ onOpenInResult }: ZhouyiLookupPanelProps) {
  const [mode, setMode] = React.useState<ZhouyiMode>('hexagram');
  const [hexQuery, setHexQuery] = React.useState('乾');
  const [lineNum, setLineNum] = React.useState('');
  const [searchText, setSearchText] = React.useState('天行健');
  const [wingName, setWingName] = React.useState('');
  const [wingText, setWingText] = React.useState('');
  const [question, setQuestion] = React.useState('请结合这段《周易》经文解读其核心意涵与处事启发。');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    summary?: { title?: string; lines?: string[] };
    prompt?: { text?: string };
    data?: { result?: Record<string, unknown> };
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const runQuery = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query: Record<string, unknown>;
      if (mode === 'hexagram') {
        const trimmed = hexQuery.trim() || '1';
        const asId = /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
        const line = /^\d+$/.test(lineNum.trim()) ? Number(lineNum.trim()) : undefined;
        query = {
          kind: 'hexagram',
          ...(asId !== undefined ? { id: asId } : { name: trimmed }),
          ...(line !== undefined && line >= 1 && line <= 6 ? { line } : {}),
        };
      } else if (mode === 'search') {
        if (!searchText.trim()) throw new Error('请输入要检索的经文关键词。');
        query = { kind: 'search', text: searchText.trim(), limit: 20 };
      } else {
        query = {
          kind: 'wings',
          ...(wingName ? { wing: wingName } : {}),
          ...(wingText.trim() ? { text: wingText.trim() } : {}),
          limit: 20,
        };
      }
      const payload = {
        question: question.trim() || '请解读这段《周易》原文。',
        query,
      };
      const res = (await runCalculateInBackground('zhouyi', payload)) as typeof result;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '检索失败，请检查输入内容。');
    } finally {
      setLoading(false);
    }
  }, [mode, hexQuery, lineNum, searchText, wingName, wingText, question]);

  React.useEffect(() => {
    void runQuery();
    // 仅初次挂载自动查询第一卦作为示例
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promptText = result?.prompt?.text ?? '';
  const dataResult = result?.data?.result;
  const hexagram = dataResult?.kind === 'hexagram' ? (dataResult.hexagram as Record<string, unknown>) : null;
  const searchItems =
    dataResult?.kind === 'search' && Array.isArray(dataResult.items)
      ? (dataResult.items as Array<{
          id: number;
          name: string;
          matches: Array<{ field: string; excerpt: string }>;
        }>)
      : null;
  const wingItems =
    dataResult?.kind === 'wings' && Array.isArray(dataResult.items)
      ? (dataResult.items as Array<{ wing: string; chapter: string; title: string; text: string }>)
      : null;

  return (
    <div className="grid gap-4">
      <Card className="grid gap-3.5 p-4 sm:p-5">
        <div className="grid gap-1.5">
          <span className="text-xs font-bold text-[var(--text-strong)]">检索模式</span>
          <SegmentedTabs
            value={mode}
            onValueChange={(next) => {
              setMode(next);
              setError(null);
            }}
            options={[
              { id: 'hexagram', label: '按卦名 / 卦序查全卦' },
              { id: 'search', label: '经文关键词检索' },
              { id: 'wings', label: '十翼传文浏览' },
            ]}
          />
        </div>

        {mode === 'hexagram' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
              <span>卦名或卦序（1–64）</span>
              <Input
                value={hexQuery}
                placeholder="例如：乾、坤、既济，或数字 1–64"
                onChange={(e) => setHexQuery(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
              <span>指定爻位（可选 1–6）</span>
              <Select
                value={lineNum}
                onChange={(e) => setLineNum(e.target.value)}
              >
                <option value="">查看全卦六爻</option>
                <option value="1">初爻（第 1 爻）</option>
                <option value="2">二爻（第 2 爻）</option>
                <option value="3">三爻（第 3 爻）</option>
                <option value="4">四爻（第 4 爻）</option>
                <option value="5">五爻（第 5 爻）</option>
                <option value="6">上爻（第 6 爻）</option>
              </Select>
            </label>
          </div>
        ) : null}

        {mode === 'search' ? (
          <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
            <span>经文关键词</span>
            <Input
              value={searchText}
              placeholder="例如：天行健、潜龙勿用、元亨利贞"
              onChange={(e) => setSearchText(e.target.value)}
            />
          </label>
        ) : null}

        {mode === 'wings' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
              <span>选择传文</span>
              <Select
                value={wingName}
                onChange={(e) => setWingName(e.target.value)}
              >
                {WING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
              <span>传文关键词（可选）</span>
              <Input
                value={wingText}
                placeholder="输入关键词筛选传文片段"
                onChange={(e) => setWingText(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
          <span>附带解读问题（可选）</span>
          <Input
            value={question}
            placeholder="例如：这句卦辞对当下做决定有什么启发？"
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>

        {error ? <div className="workspace-ui-form-error">{error}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="md" onClick={() => void runQuery()} disabled={loading}>
            <Search className="h-4 w-4" />
            <span>{loading ? '查询中…' : '查询经文'}</span>
          </Button>
          {promptText ? (
            <Button
              variant="secondary"
              size="md"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(promptText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {}
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? '已复制' : '复制提示词'}</span>
            </Button>
          ) : null}
          {result && onOpenInResult ? (
            <Button
              variant="secondary"
              size="md"
              onClick={() => onOpenInResult({ question, query: result }, result)}
            >
              <Sparkles className="h-4 w-4" />
              <span>深度解读</span>
            </Button>
          ) : null}
        </div>
      </Card>

      {hexagram ? (
        <Card className="grid gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-2.5">
            <h3 className="m-0 flex items-center gap-2 text-base font-bold text-[var(--text-strong)]">
              <BookOpen className="h-4 w-4 text-[var(--accent)]" />
              <span>
                第 {String(hexagram.id)} 卦 · {String(hexagram.name)}（上{String(hexagram.upper)}下
                {String(hexagram.lower)}）
              </span>
            </h3>
            <span className="text-xs text-[var(--text-muted)]">{String(hexagram.palace)}</span>
          </div>
          <p className="m-0 text-sm leading-relaxed text-[var(--text-strong)]">
            <strong>卦辞：</strong>
            {String(hexagram.guaCi ?? '')}
          </p>
          <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
            <strong>彖辞：</strong>
            {String(hexagram.tuanCi ?? '')}
          </p>
          <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
            <strong>大象：</strong>
            {String(hexagram.daXiang ?? '')}
          </p>
          {hexagram.wenYan ? (
            <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
              <strong>文言：</strong>
              {String(hexagram.wenYan)}
            </p>
          ) : null}
          {Array.isArray(hexagram.yaos) ? (
            <div className="grid gap-2 pt-1">
              {(hexagram.yaos as Array<{ positionName: string; yaoCi: string; xiaoXiang: string }>).map(
                (y) => (
                  <div
                    key={y.positionName}
                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                  >
                    <div className="font-semibold text-[var(--text-strong)]">
                      {y.positionName}：{y.yaoCi}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--text-muted)]">小象：{y.xiaoXiang}</div>
                  </div>
                ),
              )}
            </div>
          ) : null}
        </Card>
      ) : null}

      {searchItems ? (
        <Card className="grid gap-2.5 p-4 sm:p-5">
          <h3 className="m-0 text-sm font-bold text-[var(--text-strong)]">
            检索结果（共 {String(dataResult?.total ?? searchItems.length)} 卦命中）
          </h3>
          {searchItems.length === 0 ? (
            <p className="m-0 text-sm text-[var(--text-muted)]">未找到包含该关键词的经文。</p>
          ) : (
            searchItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[var(--text-strong)]">
                    第 {item.id} 卦 · {item.name}
                  </strong>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-[var(--accent)] hover:underline"
                    onClick={() => {
                      setMode('hexagram');
                      setHexQuery(String(item.id));
                      setLineNum('');
                    }}
                  >
                    查看全卦 →
                  </button>
                </div>
                <div className="mt-1 grid gap-1 text-xs text-[var(--text-secondary)]">
                  {item.matches.map((m, idx) => (
                    <div key={idx}>
                      <span className="font-medium text-[var(--text-strong)]">{m.field}：</span>
                      {m.excerpt}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </Card>
      ) : null}

      {wingItems ? (
        <Card className="grid gap-2.5 p-4 sm:p-5">
          <h3 className="m-0 text-sm font-bold text-[var(--text-strong)]">
            十翼原文（共 {String(dataResult?.total ?? wingItems.length)} 节）
          </h3>
          {wingItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm"
            >
              <div className="text-xs font-bold text-[var(--accent-strong)]">
                {item.wing} · {item.chapter} · {item.title}
              </div>
              <p className="m-0 mt-1 leading-relaxed text-[var(--text-strong)]">{item.text}</p>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
