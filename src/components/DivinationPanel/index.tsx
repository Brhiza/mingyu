import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TAROT_SPREAD_OPTIONS } from '@/lib/divination/config';
import {
  generateDivinationSession,
  type DivinationDraft,
  type DivinationSession,
} from '@/lib/divination/engine';
import {
  DIVINATION_INSPIRATION_TABS,
  getDivinationInspirationSections,
  getDefaultDivinationInspirationTab,
  getDivinationSpecialInspiration,
  isDivinationInspirationTabVisible,
  resolveDivinationInspiredDraftPatch,
  TAROT_SPREAD_INSPIRATION_QUESTIONS,
  type DivinationInspirationTabId,
} from '@/lib/divination/inspiration';
import { addDivinationHistory, getDivinationHistoryById } from '@/lib/history-records';
import { shouldShowPromptShareButton } from '@/lib/prompt-page-rules';
import { useViewportSize } from '@/hooks/useViewportWidth';
import { usePromptCopyShare } from '@/hooks/usePromptCopyShare';
import {
  QuestionInspirationModal,
  type QuestionInspirationSection,
} from '@/components/QuestionInspirationModal';
import { getDivinationSummaryBlocks } from '@/lib/divination/summary';
import { defaultDraft, methodLabelMap } from './constants';
import { DivinationForm } from './DivinationForm';
import { DivinationResult } from './DivinationResult';

type DivinationPanelProps = {
  initialMethod?: Extract<DivinationDraft['method'], 'almanac' | 'astrolabe'>;
  lockedMethod?: Extract<DivinationDraft['method'], 'almanac' | 'astrolabe'>;
};

function createDefaultDraft(method?: DivinationPanelProps['initialMethod']): DivinationDraft {
  return method
    ? {
        ...defaultDraft,
        method,
      }
    : defaultDraft;
}

export function DivinationPanel({ initialMethod, lockedMethod }: DivinationPanelProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<DivinationDraft>(() => createDefaultDraft(initialMethod));
  const [session, setSession] = useState<DivinationSession | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuestionInspirationModalOpen, setIsQuestionInspirationModalOpen] = useState(false);
  const [activeInspirationTab, setActiveInspirationTab] =
    useState<DivinationInspirationTabId>('ganqing');
  const [inspirationSearch, setInspirationSearch] = useState('');
  const viewportSize = useViewportSize({ width: 1280, height: 800 });
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);

  const { copyState, shareState, handleCopy, handleShare } = usePromptCopyShare(
    session?.prompt ?? '',
  );

  useEffect(() => {
    if (isDivinationInspirationTabVisible(activeInspirationTab, draft)) {
      return;
    }

    setActiveInspirationTab(getDefaultDivinationInspirationTab(draft));
  }, [activeInspirationTab, draft]);

  useEffect(() => {
    const recordId = searchParams.get('record');
    if (!recordId) {
      return;
    }

    const record = getDivinationHistoryById(recordId);
    if (!record) {
      setError('未找到对应的占卜历史记录');
      return;
    }

    setDraft(record.draft);
    setSession(record.session);
    setError('');
    setIsSubmitting(false);

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('mode', 'divination');
    nextSearchParams.delete('record');
    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const summary = useMemo(
    () => (session ? getDivinationSummaryBlocks(session.method, session.data) : null),
    [session],
  );
  const specialInspiration = useMemo(() => getDivinationSpecialInspiration(draft), [draft]);
  const inspirationFilters = useMemo(
    () => [
      ...(draft.method === 'tarot' ? [{ label: '牌阵', value: 'spread' as const }] : []),
      ...(specialInspiration
        ? [
            {
              label: specialInspiration.label,
              value: 'special' as const,
            },
          ]
        : []),
      ...DIVINATION_INSPIRATION_TABS.map((item) => ({
        label: item.label,
        value: item.id,
      })),
    ],
    [draft.method, specialInspiration],
  );
  const filteredInspirationSections = useMemo<QuestionInspirationSection[]>(() => {
    const keyword = inspirationSearch.trim();
    const includeQuestion = (question: string) => !keyword || question.includes(keyword);

    if (activeInspirationTab === 'spread') {
      const spreadName =
        TAROT_SPREAD_OPTIONS.find((item) => item.value === draft.tarotSpread)?.label || '当前牌阵';
      const items = TAROT_SPREAD_INSPIRATION_QUESTIONS[draft.tarotSpread]
        .filter(includeQuestion)
        .map((question) => ({
          id: `spread-${question}`,
          question,
        }));

      return items.length > 0
        ? [
            {
              id: 'spread',
              heading: `${spreadName}专属问题`,
              items,
            },
          ]
        : [];
    }

    if (activeInspirationTab === 'special') {
      if (!specialInspiration) {
        return [];
      }

      return specialInspiration.sections
        .map((section) => ({
          id: `special-${section.heading}`,
          heading: section.heading,
          items: section.questions.filter(includeQuestion).map((question) => ({
            id: `${section.heading}-${question}`,
            question,
          })),
        }))
        .filter((section) => section.items.length > 0);
    }

    return getDivinationInspirationSections(draft, activeInspirationTab)
      .map((section) => ({
        id: `${activeInspirationTab}-${section.heading}`,
        heading: section.heading,
        items: section.questions.filter(includeQuestion).map((question) => ({
          id: `${section.heading}-${question}`,
          question,
        })),
      }))
      .filter((section) => section.items.length > 0);
  }, [activeInspirationTab, draft, inspirationSearch, specialInspiration]);
  const showShareButton = shouldShowPromptShareButton({
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    hasNavigatorShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  });

  useEffect(() => {
    if (!lockedMethod || draft.method === lockedMethod) {
      return;
    }

    setDraft((current) => ({
      ...current,
      method: lockedMethod,
    }));
    setSession(null);
    setError('');
  }, [draft.method, lockedMethod]);

  function updateDraft<K extends keyof DivinationDraft>(key: K, value: DivinationDraft[K]) {
    if (lockedMethod && key === 'method' && value !== lockedMethod) {
      return;
    }

    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openQuestionInspirationModal() {
    setActiveInspirationTab(getDefaultDivinationInspirationTab(draft));
    setInspirationSearch('');
    setIsQuestionInspirationModalOpen(true);
  }

  function applyInspiredQuestion(question: string) {
    setDraft((current) => ({
      ...current,
      ...resolveDivinationInspiredDraftPatch(current, question),
    }));
    setIsQuestionInspirationModalOpen(false);
    window.setTimeout(() => {
      questionInputRef.current?.focus();
    }, 0);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError('');
    setSession(null);

    try {
      const nextSession = await generateDivinationSession(draft);
      const savedRecord = addDivinationHistory(draft, nextSession);
      setSession(nextSession);
      if (!savedRecord) {
        return;
      }
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('mode', 'divination');
      nextSearchParams.set('record', savedRecord.id);
      setSearchParams(nextSearchParams, { replace: true });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : '占卜生成失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="divination-panel-shell">
      <DivinationForm
        draft={draft}
        updateDraft={updateDraft}
        lockedMethod={lockedMethod}
        isSubmitting={isSubmitting}
        error={error}
        onSubmit={handleSubmit}
        onOpenInspiration={openQuestionInspirationModal}
        onNavigateToHistory={() => navigate('/records?tab=divination')}
        questionInputRef={questionInputRef}
      />

      <DivinationResult
        isSubmitting={isSubmitting}
        session={session}
        summary={summary}
        methodLabelMap={methodLabelMap}
        copyState={copyState}
        shareState={shareState}
        showShareButton={showShareButton}
        onCopy={handleCopy}
        onShare={handleShare}
      />

      {isQuestionInspirationModalOpen ? (
        <QuestionInspirationModal
          filters={inspirationFilters}
          activeFilter={activeInspirationTab}
          onFilterChange={(value) => setActiveInspirationTab(value as DivinationInspirationTabId)}
          searchValue={inspirationSearch}
          onSearchChange={setInspirationSearch}
          sections={filteredInspirationSections}
          emptyText="没有找到匹配的问题，请换个关键词或分类。"
          onSelect={applyInspiredQuestion}
          onClose={() => setIsQuestionInspirationModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
