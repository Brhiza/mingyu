import { Bot, Check, Copy, Loader2, Send, Square } from 'lucide-react';
import { Button, Card, Input } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { AgentMarkdown } from '../AgentMarkdown';
import { ExternalAiShareButtons } from '../shared/ExternalAiShareButtons';

export interface FortuneAiReportSectionProps {
  aiReady: boolean;
  promptText: string;
  computing: boolean;
  copiedPrompt: boolean;
  copiedReport: boolean;
  aiStatus: string;
  aiStreaming: boolean;
  aiMessages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
  followupDraft: string;
  onChangeFollowupDraft: (next: string) => void;
  onCopyPrompt: () => void;
  onCopyReport: (text: string) => void;
  onGenerateReport: () => void;
  onStopStreaming: () => void;
  onClearReport: () => void;
  onSendFollowup: () => void;
}

export function FortuneAiReportSection({
  aiReady,
  promptText,
  computing,
  copiedPrompt,
  copiedReport,
  aiStatus,
  aiStreaming,
  aiMessages,
  followupDraft,
  onChangeFollowupDraft,
  onCopyPrompt,
  onCopyReport,
  onGenerateReport,
  onStopStreaming,
  onClearReport,
  onSendFollowup,
}: FortuneAiReportSectionProps) {
  if (!aiReady) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!promptText}
          onClick={onCopyPrompt}
        >
          {copiedPrompt ? <Check className="h-3.5 w-3.5 text-[var(--success-text)]" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copiedPrompt ? '已复制' : '复制提示词'}</span>
        </Button>
        <ExternalAiShareButtons promptText={promptText} disabled={!promptText} size="sm" />
      </div>
    );
  }

  return (
    <Card className="grid gap-3 bg-[var(--surface-base)] p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <strong className="text-[14px] font-bold text-[var(--text-strong)]">AI 定制报告</strong>
          {aiStatus ? (
            <span className="text-[11.5px] text-[var(--text-muted)]">{aiStatus}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            disabled={!promptText}
            onClick={onCopyPrompt}
          >
            {copiedPrompt ? <Check className="h-3 w-3 text-[var(--success-text)]" /> : <Copy className="h-3 w-3" />}
            <span>{copiedPrompt ? '已复制' : '复制提示词'}</span>
          </Button>
          <ExternalAiShareButtons promptText={promptText} disabled={!promptText} size="xs" />
          {aiStreaming ? (
            <Button variant="destructive" size="xs" onClick={onStopStreaming}>
              <Square className="h-3 w-3" />
              <span>停止</span>
            </Button>
          ) : (
            <>
              {aiMessages.length > 0 ? (
                <Button variant="ghost" size="xs" onClick={onClearReport}>
                  <span>清空</span>
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                disabled={!promptText || computing}
                onClick={onGenerateReport}
              >
                <Bot className="h-3.5 w-3.5" />
                <span>{aiMessages.length > 0 ? '重新解读' : 'AI 解读'}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {aiMessages.length > 0 ? (
        <div className="grid gap-2.5">
          {aiMessages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-[12px] border p-3 text-xs',
                msg.role === 'user'
                  ? 'border-[var(--border-contrast)] bg-[var(--state-selected-surface)] text-[var(--text-strong)]'
                  : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <strong className="text-[11px] font-bold text-[var(--text-muted)]">
                  {msg.role === 'user' ? '我的追问' : '定制运势报告'}
                </strong>
                {msg.role === 'assistant' && msg.content ? (
                  <button
                    type="button"
                    onClick={() => onCopyReport(msg.content)}
                    className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11px] font-semibold text-[var(--accent-strong)] cursor-pointer hover:underline"
                  >
                    {copiedReport ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedReport ? '已复制' : '复制报告'}</span>
                  </button>
                ) : null}
              </div>
              {msg.role === 'assistant' ? (
                msg.content ? (
                  <AgentMarkdown content={msg.content} />
                ) : (
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>正在生成…</span>
                  </div>
                )
              ) : (
                <p className="m-0 whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {aiMessages.length > 0 ? (
        <div className="flex items-center gap-1.5 border-t border-[var(--border-soft)] pt-2.5">
          <Input
            type="text"
            value={followupDraft}
            onChange={(e) => onChangeFollowupDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendFollowup();
              }
            }}
            placeholder="继续追问…"
            className="h-8 flex-1 text-xs"
            disabled={aiStreaming}
          />
          <Button
            variant="primary"
            size="xs"
            disabled={!followupDraft.trim() || aiStreaming}
            onClick={onSendFollowup}
          >
            <Send className="h-3 w-3" />
            <span>发送</span>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
