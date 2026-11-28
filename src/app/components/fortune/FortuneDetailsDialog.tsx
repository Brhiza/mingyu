import { Check, Copy } from 'lucide-react';
import type { FortuneCalculatedData } from '../../hooks/fortune-cache';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { AgentMarkdown } from '../AgentMarkdown';

export interface FortuneDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fortuneData: FortuneCalculatedData | null;
  promptText: string;
  copiedPrompt: boolean;
  onCopyPrompt: () => void;
}

export function FortuneDetailsDialog({
  open,
  onOpenChange,
  fortuneData,
  promptText,
  copiedPrompt,
  onCopyPrompt,
}: FortuneDetailsDialogProps) {
  const ov = fortuneData?.overview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85dvh] flex flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>详细推演路径与完整原文</DialogTitle>
          <DialogDescription>
            {fortuneData
              ? `${fortuneData.targetLabel}${fortuneData.scopeLabel} · ${fortuneData.mode === 'personalized' ? `定制案例「${fortuneData.caseName || '已选档案'}」` : '未选档案 · 当日历法'}`
              : '算法明细、原始盘面数据与提示词原文'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto grid gap-4 pr-1 text-xs">
          {ov && ov.scoreFactors.length > 0 ? (
            <section className="grid gap-1.5">
              <h4 className="m-0 text-[12.5px] font-bold text-[var(--text-strong)]">
                一、本地算法推演路径与触发因子（{ov.scoreFactors.length} 项）
              </h4>
              <div className="grid gap-1.5">
                {ov.scoreFactors.map((f, idx) => (
                  <div
                    key={`${f.label}-${idx}`}
                    className="flex items-start justify-between gap-2 rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2"
                  >
                    <div className="grid gap-0.5">
                      <strong className="text-[var(--text-strong)]">{f.label}</strong>
                      <span className="text-[var(--text-secondary)]">{f.detail}</span>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-[11px] font-bold',
                        f.impact > 0
                          ? 'text-[var(--success-text)]'
                          : f.impact < 0
                            ? 'text-[var(--secondary-strong)]'
                            : 'text-[var(--text-muted)]',
                      )}
                    >
                      {f.impact > 0 ? `+${f.impact}` : f.impact === 0 ? '背景' : f.impact}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {fortuneData?.markdown ? (
            <section className="grid gap-1.5">
              <h4 className="m-0 text-[12.5px] font-bold text-[var(--text-strong)]">
                二、完整排盘数据与历法摘要
              </h4>
              <div className="rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3">
                <AgentMarkdown content={fortuneData.markdown} />
              </div>
            </section>
          ) : null}

          {fortuneData?.omitted && fortuneData.omitted.length > 0 ? (
            <section className="grid gap-1">
              <h4 className="m-0 text-[12.5px] font-bold text-[var(--text-strong)]">
                三、未计算项目与说明
              </h4>
              <ul className="m-0 list-disc pl-4 text-[var(--text-secondary)]">
                {fortuneData.omitted.map((o) => (
                  <li key={o.system}>
                    <strong>{o.system}：</strong>
                    {o.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <h4 className="m-0 text-[12.5px] font-bold text-[var(--text-strong)]">
                完整定制 AI 提示词原文（约 {promptText.length} 字）
              </h4>
              <Button
                variant="secondary"
                size="xs"
                disabled={!promptText}
                onClick={onCopyPrompt}
              >
                {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedPrompt ? '已复制' : '复制提示词'}</span>
              </Button>
            </div>
            <pre className="m-0 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 font-sans text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
              {promptText || '正在生成提示词…'}
            </pre>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
