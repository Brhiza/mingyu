import * as React from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui';
import type {
  ExtractedBirthProfile,
  ExtractedStructuredInputs,
} from '../../router-model/birth-extractor';
import type { MethodId } from '../../router-model/index';
import { runLocalAgentPlan } from '../../router-model/local-agent';
import type { SynastryRelationship } from '../../systems/focus-presets';

export interface LocalAgentApplyPayload {
  method: MethodId;
  query: string;
  profiles: ExtractedBirthProfile[];
  isTwoPerson: boolean;
  relationship?: SynastryRelationship;
  structured: ExtractedStructuredInputs;
}

export interface LocalAgentBarProps {
  onApplyRecommendation: (payload: LocalAgentApplyPayload) => void | Promise<void>;
}

const COMPAT_METHODS = new Set<MethodId>([
  'bazi-synastry',
  'ziwei-synastry',
  'astrolabe-synastry',
]);

export const LocalAgentBar: React.FC<LocalAgentBarProps> = ({ onApplyRecommendation }) => {
  const [draft, setDraft] = React.useState('');
  const [isRouting, setIsRouting] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || isRouting) return;
    setIsRouting(true);
    try {
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
        query: plan.query,
        profiles: extracted.profiles,
        isTwoPerson: extracted.isTwoPerson,
        relationship: extracted.relationship,
        structured: extracted.structured,
      });
    } finally {
      setIsRouting(false);
    }
  }, [draft, isRouting, onApplyRecommendation]);

  return (
    <section
      aria-label="智能提问对话框"
      className="mx-auto w-full max-w-[780px] py-1"
    >
      <div className="mx-auto w-full rounded-2xl min-[680px]:rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-2.5 min-[680px]:p-4 shadow-[0_6px_26px_rgba(32,24,16,0.06)] transition-colors focus-within:border-[var(--accent)]">
        <textarea
          rows={2}
          value={draft}
          disabled={isRouting}
          placeholder="输入想问的事，或直接贴入生辰/合盘/号码，回车直接生成结果…"
          aria-label="输入想问的事"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          className="min-h-[44px] min-[680px]:min-h-[72px] w-full resize-none border-0 bg-transparent px-1 text-[14.5px] leading-relaxed text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:opacity-60"
        />

        <div className="mt-1 min-[680px]:mt-2 flex items-center justify-end gap-2 pt-1">
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
    </section>
  );
};
