import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { runCalculateInBackground } from '../../../workers/calc-runner';
import {
  DAILY_HEXAGRAM_DIRECTION_KEYS,
  DAILY_HEXAGRAM_DIRECTIONS,
} from '../../../systems/daily-hexagram-directions';
import { distillPromptForUser } from '../../../prompt-profile';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../../../web-settings';
import { Badge, Button, Card } from '../../../components/ui';
import { ExternalAiShareButtons } from '../shared/ExternalAiShareButtons';

const DAILY_DIRECTION_LABELS: Record<(typeof DAILY_HEXAGRAM_DIRECTION_KEYS)[number], string> = {
  career: '事业',
  wealth: '财务',
  relationship: '感情',
  social: '人际',
  health: '健康',
  study: '学业',
  travel: '出行',
  decision: '决策',
};

export function DailyHexagramCard() {
  const [casting, setCasting] = React.useState(false);
  const [castError, setCastError] = React.useState<string | null>(null);
  const [hexResult, setHexResult] = React.useState<{
    name: string;
    changedName?: string;
    interName?: string;
    palaceName?: string;
    promptText: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleCast = async () => {
    setCasting(true);
    setCastError(null);
    try {
      const payload = applyGlobalRulesToPayload(
        'liuyao',
        {
          question: '今日行动指引与吉凶注意事项？',
          liuyao: { method: 'coins' },
          prompt: { includeClassics: false },
        },
        true,
      ) as Record<string, unknown>;
      const res = (await runCalculateInBackground(
        'liuyao',
        payload,
        { promptGuidance: loadGlobalRules().prompt },
      )) as {
        data?: {
          originalName?: string;
          changedName?: string;
          interName?: string;
          palace?: { name?: string };
        };
        summary?: { title?: string };
        prompt?: { text?: string };
      };
      const rawName = res.data?.originalName ?? '';
      const matchedName = DAILY_HEXAGRAM_DIRECTIONS[rawName]
        ? rawName
        : Object.keys(DAILY_HEXAGRAM_DIRECTIONS).find((k) => rawName.includes(k)) ?? '';
      const cleanPrompt =
        distillPromptForUser(res.prompt?.text ?? '', { includeClassics: false }) ||
        res.prompt?.text ||
        '';
      setHexResult({
        name: matchedName || rawName || '今日一卦',
        changedName: res.data?.changedName,
        interName: res.data?.interName,
        palaceName: res.data?.palace?.name,
        promptText: cleanPrompt,
      });
    } catch (err) {
      setCastError(err instanceof Error ? err.message : '起卦失败，请稍后重试。');
    } finally {
      setCasting(false);
    }
  };

  const directions = hexResult ? DAILY_HEXAGRAM_DIRECTIONS[hexResult.name] : undefined;

  return (
    <Card className="grid gap-3 bg-[var(--surface-base)] p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[14px] font-bold text-[var(--text-strong)]">每日一卦</strong>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="secondary" size="xs" disabled={casting} onClick={() => void handleCast()}>
            <span>{casting ? '起卦中…' : hexResult ? '重新起卦' : '今日一卦'}</span>
          </Button>
          {hexResult?.promptText ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(hexResult.promptText).catch(() => undefined);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                }}
              >
                {copied ? <Check className="h-3 w-3 text-[var(--success-text)]" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? '已复制' : '复制提示词'}</span>
              </Button>
              <ExternalAiShareButtons promptText={hexResult.promptText} size="xs" />
            </>
          ) : null}
        </div>
      </div>
      {castError ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--danger-text)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger-text)_8%,var(--surface-base))] px-3 py-2 text-xs text-[var(--danger-text)]">
          {castError}
        </div>
      ) : null}
      {hexResult ? (
        <div className="ws-view-enter grid gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm text-[var(--accent-deep)]">{hexResult.name}</strong>
            {hexResult.palaceName ? (
              <Badge variant="outline">{hexResult.palaceName}宫</Badge>
            ) : null}
            {hexResult.changedName && hexResult.changedName !== hexResult.name ? (
              <Badge variant="outline">变卦：{hexResult.changedName}</Badge>
            ) : null}
          </div>
          {directions ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DAILY_HEXAGRAM_DIRECTION_KEYS.map((key) => (
                <div key={key} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-2">
                  <strong className="block text-[var(--text-strong)]">{DAILY_DIRECTION_LABELS[key]}</strong>
                  <span className="text-[var(--text-secondary)]">{directions[key]}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
