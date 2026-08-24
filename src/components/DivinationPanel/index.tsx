import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TAROT_SPREAD_OPTIONS } from 'mingyu-core/divination/config';
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
import { applyPersonalCaseToDivinationDraft } from '@/lib/divination/case-context';
import { usePromptCopyShare } from '@/hooks/usePromptCopyShare';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { useBirthPlace } from '@/hooks/useBirthPlace';
import {
  QuestionInspirationModal,
  type QuestionInspirationSection,
} from '@/components/QuestionInspirationModal';
import { getDivinationSummaryBlocks } from '@/lib/divination/summary';
import { defaultDraft, methodLabelMap } from './constants';
import { DivinationForm } from './DivinationForm';
import { DivinationResult } from './DivinationResult';
import { BirthPlaceModal } from '@/pages/InputPage.BirthPlaceModal';

type DivinationPanelProps = {
  initialMethod?: DivinationDraft['method'];
  lockedMethod?: DivinationDraft['method'];
  displayMode?: 'workspace' | 'input' | 'result';
  assistantOnly?: boolean;
  initialQuestion?: string;
  autoSubmit?: boolean;
  onGenerated?: (recordId: string, requestedMethod: DivinationDraft['method']) => void;
  onOpenAssistant?: () => void;
  onReturnToBoard?: () => void;
  onRestart?: () => void;
};

function getDefaultAlmanacDateRange() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  const start = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 20);
  return {
    almanacStartDate: start.toISOString().slice(0, 10),
    almanacEndDate: end.toISOString().slice(0, 10),
  };
}

function createDefaultDraft(
  method?: DivinationPanelProps['initialMethod'],
  initialQuestion?: string,
): DivinationDraft {
  return {
    ...defaultDraft,
    ...(method ? { method } : {}),
    ...(method === 'almanac' ? getDefaultAlmanacDateRange() : {}),
    ...(initialQuestion?.trim()
      ? { question: initialQuestion.trim(), questionSource: 'custom' as const }
      : {}),
  };
}

export function DivinationPanel({
  initialMethod,
  lockedMethod,
  displayMode = 'workspace',
  assistantOnly = false,
  initialQuestion,
  autoSubmit = false,
  onGenerated,
  onOpenAssistant,
  onReturnToBoard,
  onRestart,
}: DivinationPanelProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeCase, cases } = useActivePersonalCase();
  const [draft, setDraft] = useState<DivinationDraft>(() =>
    applyPersonalCaseToDivinationDraft(
      createDefaultDraft(initialMethod, initialQuestion),
      activeCase,
    ),
  );
  const [session, setSession] = useState<DivinationSession | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuestionInspirationModalOpen, setIsQuestionInspirationModalOpen] = useState(false);
  const [activeInspirationTab, setActiveInspirationTab] =
    useState<DivinationInspirationTabId>('ganqing');
  const [inspirationSearch, setInspirationSearch] = useState('');
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSubmitStartedRef = useRef(false);
  const divinationBirthPlace = useBirthPlace({ form: draft, setForm: setDraft });

  const { copyState, shareState, handleCopy, handleShare } = usePromptCopyShare(
    session?.prompt ?? '',
  );

  useEffect(() => {
    if (displayMode === 'result') return;
    setDraft((current) => applyPersonalCaseToDivinationDraft(current, activeCase));
    setSession(null);
    setError('');
  }, [activeCase, displayMode]);

  useEffect(() => {
    if (isDivinationInspirationTabVisible(activeInspirationTab, draft)) {
      return;
    }

    setActiveInspirationTab(getDefaultDivinationInspirationTab(draft));
  }, [activeInspirationTab, draft]);

  useEffect(() => {
    const recordId = searchParams.get('record');
    if (!recordId) {
      if (displayMode === 'result') {
        setError('未指定要打开的占问记录');
      }
      return;
    }

    const record = getDivinationHistoryById(recordId);
    if (!record) {
      setError('未找到对应的占问记录');
      return;
    }

    setDraft(record.draft);
    setSession(record.session);
    setError('');
    setIsSubmitting(false);
  }, [displayMode, searchParams]);

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
      const items = (TAROT_SPREAD_INSPIRATION_QUESTIONS[draft.tarotSpread] ?? [])
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
  useEffect(() => {
    if (displayMode === 'result') {
      return;
    }
    if (!lockedMethod || draft.method === lockedMethod) {
      return;
    }

    setDraft((current) => ({
      ...current,
      method: lockedMethod,
    }));
    setSession(null);
    setError('');
  }, [displayMode, draft.method, lockedMethod]);

  function updateDraft<K extends keyof DivinationDraft>(key: K, value: DivinationDraft[K]) {
    if (lockedMethod && key === 'method' && value !== lockedMethod) {
      return;
    }

    setSession(null);
    setError('');
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
    setSession(null);
    setError('');
    setDraft((current) => ({
      ...current,
      ...resolveDivinationInspiredDraftPatch(current, question),
    }));
    setIsQuestionInspirationModalOpen(false);
    window.setTimeout(() => {
      questionInputRef.current?.focus();
    }, 0);
  }

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError('');
    setSession(null);

    try {
      const nextSession = await generateDivinationSession(draft);
      const savedRecord = addDivinationHistory(draft, nextSession, activeCase);
      setSession(nextSession);
      if (!savedRecord) {
        return;
      }
      if (onGenerated) {
        onGenerated(savedRecord.id, savedRecord.requestedMethod);
      } else {
        navigate(
          `/divination/${savedRecord.requestedMethod}/result?record=${encodeURIComponent(savedRecord.id)}`,
        );
      }
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : '占卜生成失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [activeCase, draft, navigate, onGenerated]);

  useEffect(() => {
    if (!autoSubmit || displayMode === 'result' || autoSubmitStartedRef.current) return;
    autoSubmitStartedRef.current = true;
    void handleSubmit();
  }, [autoSubmit, displayMode, handleSubmit]);

  return (
    <div className="divination-panel-shell">
      {displayMode !== 'result' ? (
        <DivinationForm
          draft={draft}
          updateDraft={updateDraft}
          lockedMethod={lockedMethod}
          isSubmitting={isSubmitting}
          error={error}
          onSubmit={handleSubmit}
          onOpenInspiration={openQuestionInspirationModal}
          onOpenBirthPlace={() => divinationBirthPlace.openBirthPlaceModal('self')}
          questionInputRef={questionInputRef}
          cases={cases}
          showHeading
        />
      ) : null}

      {displayMode !== 'input' ? (
        <>
          {error ? <p className="error-text workspace-divination-error">{error}</p> : null}
          <DivinationResult
            key={searchParams.get('record') ?? session?.prompt ?? 'divination-result'}
            isSubmitting={isSubmitting}
            session={session}
            summary={summary}
            methodLabelMap={methodLabelMap}
            copyState={copyState}
            shareState={shareState}
            showHeading={displayMode === 'workspace'}
            assistantOnly={assistantOnly}
            onCopy={handleCopy}
            onShare={handleShare}
            onOpenAssistant={onOpenAssistant}
            onReturnToBoard={onReturnToBoard}
            onRestart={onRestart}
          />
        </>
      ) : null}

      {displayMode !== 'result' && isQuestionInspirationModalOpen ? (
        <QuestionInspirationModal
          filters={inspirationFilters}
          activeFilter={activeInspirationTab}
          onFilterChange={(value) => setActiveInspirationTab(value as DivinationInspirationTabId)}
          searchValue={inspirationSearch}
          onSearchChange={setInspirationSearch}
          sections={filteredInspirationSections}
          emptyText="没有找到匹配的问题，请换个搜索词或主题。"
          onSelect={applyInspiredQuestion}
          onClose={() => setIsQuestionInspirationModalOpen(false)}
        />
      ) : null}

      {displayMode !== 'result' && divinationBirthPlace.isBirthPlaceModalOpen ? (
        <BirthPlaceModal birthPlace={divinationBirthPlace} purpose="observer" />
      ) : null}
    </div>
  );
}
