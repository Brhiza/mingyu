import * as React from 'react';
import { ArrowUp, Loader2, Sparkles, UserCheck } from 'lucide-react';
import { Button } from '../../components/ui';
import type { PersonalCase } from '../../v2-ui/cases-store';
import type {
  ExtractedBirthProfile,
  ExtractedStructuredInputs,
} from '../../router-model/birth-extractor';
import type { MethodId } from '../../router-model/index';
import type { SynastryRelationship } from '../../systems/focus-presets';

export interface LocalAgentApplyPayload {
  method: MethodId;
  query: string;
  profiles: ExtractedBirthProfile[];
  isTwoPerson: boolean;
  relationship?: SynastryRelationship;
  structured: ExtractedStructuredInputs;
  attachedCaseId?: string | null;
}

export interface LocalAgentBarProps {
  cases?: readonly PersonalCase[];
  attachedCaseId?: string | null;
  onSelectAttachedCase?: (caseId: string | null) => void;
  onApplyRecommendation: (payload: LocalAgentApplyPayload) => void | Promise<void>;
}

const COMPAT_METHODS = new Set<MethodId>([
  'bazi-synastry',
  'ziwei-synastry',
  'astrolabe-synastry',
]);

export const LocalAgentBar: React.FC<LocalAgentBarProps> = ({
  cases = [],
  attachedCaseId = null,
  onSelectAttachedCase,
  onApplyRecommendation,
}) => {
  const [draft, setDraft] = React.useState('');
  const [isRouting, setIsRouting] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || isRouting) return;
    setIsRouting(true);
    try {
      const [{ runLocalAgentPlan }, { extractSubstantiveQuestion }] = await Promise.all([
        import('../../router-model/local-agent'),
        import('../../router-model/features'),
      ]);
      const plan = await runLocalAgentPlan(trimmed);
      const extracted = plan.analysis.extractedBirth;
      const topMethod = plan.routing.recommendations[0]?.method ?? 'bazi';
      const resolvedMethod: MethodId =
        extracted.profiles.length >= 2 && !COMPAT_METHODS.has(topMethod)
          ? 'bazi-synastry'
          : topMethod;

      setDraft('');
      await onApplyRecommendation({
        method: resolvedMethod,
        query: extractSubstantiveQuestion(plan.query),
        profiles: extracted.profiles,
        isTwoPerson: extracted.isTwoPerson,
        relationship: extracted.relationship,
        structured: extracted.structured,
        attachedCaseId,
      });
    } finally {
      setIsRouting(false);
    }
  }, [attachedCaseId, draft, isRouting, onApplyRecommendation]);

  return (
    <section
      aria-label="智能提问对话框"
      className="mx-auto flex w-full max-w-[780px] flex-col gap-3.5 pt-4 pb-2 min-[680px]:gap-5 min-[680px]:pt-9 min-[680px]:pb-4"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-white shadow-[0_6px_18px_rgba(184,59,43,0.18)]">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="m-0 font-sans text-[21px] min-[680px]:text-[26px] font-extrabold tracking-[-0.02em] text-[var(--text-strong)]">
          今天想问什么？
        </h1>
      </div>

      <div
        data-testid="home-local-composer-dock"
        className="fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom,0px))] z-40 px-2.5 pt-2.5 pb-2 bg-gradient-to-t from-[var(--surface-base)] via-[var(--surface-base)]/95 to-transparent min-[680px]:static min-[680px]:inset-auto min-[680px]:z-auto min-[680px]:bg-none min-[680px]:p-0"
      >
        <div className="mx-auto w-full max-w-[780px] rounded-2xl min-[680px]:rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-2.5 min-[680px]:p-4 shadow-[0_8px_28px_rgba(32,24,16,0.10)] min-[680px]:shadow-[0_6px_26px_rgba(32,24,16,0.06)] transition-colors focus-within:border-[var(--accent)]">
          <textarea
            rows={2}
            value={draft}
            disabled={isRouting}
            placeholder="输入想问的事，或直接贴入生辰、合盘、号码…"
            aria-label="输入想问的事"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            className="min-h-[44px] min-[680px]:min-h-[78px] w-full resize-none border-0 bg-transparent px-1 text-[14.5px] leading-relaxed text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:opacity-60"
          />

          <div className="mt-1 min-[680px]:mt-2 flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {cases.length > 0 && onSelectAttachedCase ? (
                <label className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--text-secondary)]">
                  <UserCheck className="h-3.5 w-3.5 text-[var(--accent-strong)]" aria-hidden="true" />
                  <select
                    aria-label="关联命造档案"
                    value={attachedCaseId ?? ''}
                    onChange={(e) => onSelectAttachedCase(e.target.value || null)}
                    className="max-w-[96px] min-[680px]:max-w-[116px] cursor-pointer border-0 bg-transparent text-[11.5px] font-semibold text-[var(--text-strong)] outline-none"
                  >
                    <option value="">不限档案</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              className="rounded-full px-3.5"
              aria-label="发送"
              disabled={isRouting || !draft.trim()}
              onClick={() => void handleSubmit()}
            >
              {isRouting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isRouting ? '生成中' : '发送'}</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
