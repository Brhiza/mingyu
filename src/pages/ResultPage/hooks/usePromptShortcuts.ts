import { useEffect, useMemo, useState } from 'react';
import type { QueryInputState, QueryPromptState } from '@/lib/query-state';
import { buildBaziCustomPromptPatch, buildZiweiCustomPromptPatch } from '@/lib/prompt-page-rules';
import {
  findBaziShortcutByMode,
  findZiweiShortcutByMode,
  readPromptDraft,
  resolveAstrolabeShortcutMode,
  resolveAstrolabeTopicByShortcutMode,
  resolveBaziShortcutMode,
  resolveZiweiShortcutMode,
  writePromptDraft,
} from '../ResultPage.helpers';
import type { PromptShortcutMode } from '../ResultPage.types';
import { normalizeThematicTopic } from 'mingyu-core/prompt';

function resolveBaziSelection(promptId: string, mode: string) {
  const subtopicByPromptId: Record<string, string> = {
    'ai-job-change': 'job-change',
    'ai-startup-partnership': 'startup',
    'ai-investment-partnership': 'investment',
    'ai-relationship-push': 'partner',
    'ai-relationship-decision': 'reconciliation',
    'ai-reconciliation-decision': 'reconciliation',
    'ai-study-advance': 'advanced-study',
    'ai-exam-landing': 'exam',
    'ai-home-move': 'home',
    'ai-settle-relocate': 'home',
  };
  const compatibilityTopicByPromptId: Record<string, string> = {
    'ai-compat-marriage': 'relationship',
    'ai-compat-career': 'career',
    'ai-compat-friendship': 'relationship',
    'ai-compat-children': 'family',
    'ai-compat-parents': 'family',
    'ai-compat-siblings': 'family',
  };
  const topicId =
    compatibilityTopicByPromptId[promptId] ??
    (normalizeThematicTopic(mode) === 'general' && mode === '综合'
      ? 'general'
      : normalizeThematicTopic(mode));
  return { topicId, subtopicId: subtopicByPromptId[promptId] ?? '' };
}

function resolveZiweiSelection(topic: string, mode: string) {
  const topicByLegacyId: Record<string, string> = {
    life: 'general',
    destiny: 'general',
    recent: 'timing',
    relationship: 'relationship',
    'relationship-push': 'relationship',
    'relationship-decision': 'relationship',
    'reconciliation-decision': 'relationship',
    children: 'family',
    family: 'family',
    'career-wealth': 'career',
    'job-change': 'career',
    'startup-partnership': 'career',
    'investment-partnership': 'wealth',
    'home-move': 'family',
    'settle-relocate': 'family',
    social: 'relationship',
    emotion: 'health',
    health: 'health',
    study: 'academic',
    'study-advance': 'academic',
    'exam-landing': 'academic',
    growth: 'general',
    talent: 'general',
    chat: 'general',
  };
  const subtopicByLegacyId: Record<string, string> = {
    'relationship-push': 'partner',
    'relationship-decision': 'reconciliation',
    'reconciliation-decision': 'reconciliation',
    'job-change': 'job-change',
    'startup-partnership': 'startup',
    'investment-partnership': 'investment',
    'home-move': 'home',
    'settle-relocate': 'home',
  };
  return {
    topicId: topicByLegacyId[topic] ?? normalizeThematicTopic(mode),
    subtopicId: subtopicByLegacyId[topic] ?? '',
  };
}

export interface PromptShortcuts {
  activeBaziShortcutMode: PromptShortcutMode;
  activeZiweiShortcutMode: PromptShortcutMode;
  activeAstrolabeShortcutMode: PromptShortcutMode;
  baziQuestionDraft: string;
  ziweiQuestionDraft: string;
  astrolabeQuestionDraft: string;
  setBaziQuestionDraft: (value: string) => void;
  setZiweiQuestionDraft: (value: string) => void;
  setAstrolabeQuestionDraft: (value: string) => void;
  effectiveBaziQuickQuestion: string;
  effectiveZiweiQuickQuestion: string;
  effectiveAstrolabeQuickQuestion: string;
  applyBaziShortcutMode: (mode: PromptShortcutMode) => void;
  applyZiweiShortcutMode: (mode: PromptShortcutMode) => void;
  applyAstrolabeShortcutMode: (mode: PromptShortcutMode) => void;
  applyInspiredQuestion: (question: string) => void;
}

export function usePromptShortcuts(
  inputState: QueryInputState,
  promptState: QueryPromptState,
  baziDraftStorageKey: string,
  ziweiDraftStorageKey: string,
  astrolabeDraftStorageKey: string,
  astrolabeShortcutActions: ReadonlyArray<{ label: string; topic: string }>,
  onUpdatePromptState: (next: Partial<QueryPromptState>) => void,
  onCloseInspiration: () => void,
): PromptShortcuts {
  const {
    astrolabeQuickQuestion,
    astrolabeShortcutMode,
    astrolabeTopic,
    baziPresetId,
    baziQuickQuestion,
    baziShortcutMode,
    promptSource,
    ziweiQuickQuestion,
    ziweiShortcutMode,
    ziweiTopic,
  } = promptState;
  const [activeBaziShortcutMode, setActiveBaziShortcutMode] = useState<PromptShortcutMode>(() =>
    resolveBaziShortcutMode(promptState, inputState.analysisMode),
  );
  const [activeZiweiShortcutMode, setActiveZiweiShortcutMode] = useState<PromptShortcutMode>(() =>
    resolveZiweiShortcutMode(promptState, inputState.analysisMode),
  );
  const [baziQuestionDraft, setBaziQuestionDraft] = useState(() => {
    const mode = resolveBaziShortcutMode(promptState, inputState.analysisMode);
    if (mode === '问题灵感') {
      return readPromptDraft(baziDraftStorageKey, 'inspiration') || baziQuickQuestion;
    }
    if (mode === '自定义') {
      return readPromptDraft(baziDraftStorageKey) || baziQuickQuestion;
    }
    return '';
  });
  const [ziweiQuestionDraft, setZiweiQuestionDraft] = useState(() => {
    const mode = resolveZiweiShortcutMode(promptState, inputState.analysisMode);
    if (mode === '问题灵感') {
      return readPromptDraft(ziweiDraftStorageKey, 'inspiration') || ziweiQuickQuestion;
    }
    if (mode === '自定义') {
      return readPromptDraft(ziweiDraftStorageKey) || ziweiQuickQuestion;
    }
    return '';
  });
  const [astrolabeQuestionDraft, setAstrolabeQuestionDraft] = useState(() => {
    const mode = resolveAstrolabeShortcutMode(promptState);
    if (mode === '问题灵感') {
      return readPromptDraft(astrolabeDraftStorageKey, 'inspiration') || astrolabeQuickQuestion;
    }

    if (mode === '自定义') {
      return readPromptDraft(astrolabeDraftStorageKey) || astrolabeQuickQuestion;
    }
    return '';
  });
  const [activeAstrolabeShortcutMode, setActiveAstrolabeShortcutMode] =
    useState<PromptShortcutMode>(() => resolveAstrolabeShortcutMode(promptState));

  useEffect(() => {
    const nextMode = resolveBaziShortcutMode(
      { baziPresetId, baziShortcutMode },
      inputState.analysisMode,
    );
    setActiveBaziShortcutMode(nextMode);
    if (nextMode === '自定义') {
      setBaziQuestionDraft(readPromptDraft(baziDraftStorageKey));
      return;
    }
    if (nextMode === '问题灵感') {
      setBaziQuestionDraft(
        readPromptDraft(baziDraftStorageKey, 'inspiration') || baziQuickQuestion,
      );
      return;
    }
    setBaziQuestionDraft('');
  }, [
    baziDraftStorageKey,
    baziPresetId,
    baziQuickQuestion,
    baziShortcutMode,
    inputState.analysisMode,
  ]);

  useEffect(() => {
    const nextMode = resolveZiweiShortcutMode(
      { ziweiShortcutMode, ziweiTopic },
      inputState.analysisMode,
    );
    setActiveZiweiShortcutMode(nextMode);
    if (nextMode === '自定义') {
      setZiweiQuestionDraft(readPromptDraft(ziweiDraftStorageKey));
      return;
    }
    if (nextMode === '问题灵感') {
      setZiweiQuestionDraft(
        readPromptDraft(ziweiDraftStorageKey, 'inspiration') || ziweiQuickQuestion,
      );
      return;
    }
    setZiweiQuestionDraft('');
  }, [
    inputState.analysisMode,
    ziweiDraftStorageKey,
    ziweiQuickQuestion,
    ziweiShortcutMode,
    ziweiTopic,
  ]);

  useEffect(() => {
    const nextMode = resolveAstrolabeShortcutMode({ astrolabeShortcutMode, astrolabeTopic });
    setActiveAstrolabeShortcutMode(nextMode);
    if (nextMode === '自定义') {
      setAstrolabeQuestionDraft(readPromptDraft(astrolabeDraftStorageKey));
      return;
    }
    if (nextMode === '问题灵感') {
      setAstrolabeQuestionDraft(
        readPromptDraft(astrolabeDraftStorageKey, 'inspiration') || astrolabeQuickQuestion,
      );
      return;
    }
    setAstrolabeQuestionDraft('');
  }, [astrolabeDraftStorageKey, astrolabeQuickQuestion, astrolabeShortcutMode, astrolabeTopic]);

  useEffect(() => {
    if (activeBaziShortcutMode !== '自定义') {
      return;
    }

    writePromptDraft(baziDraftStorageKey, baziQuestionDraft);
  }, [activeBaziShortcutMode, baziDraftStorageKey, baziQuestionDraft]);

  useEffect(() => {
    if (activeZiweiShortcutMode !== '自定义') {
      return;
    }

    writePromptDraft(ziweiDraftStorageKey, ziweiQuestionDraft);
  }, [activeZiweiShortcutMode, ziweiDraftStorageKey, ziweiQuestionDraft]);

  useEffect(() => {
    if (activeBaziShortcutMode !== '问题灵感') {
      return;
    }

    writePromptDraft(baziDraftStorageKey, baziQuestionDraft, 'inspiration');
  }, [activeBaziShortcutMode, baziDraftStorageKey, baziQuestionDraft]);

  useEffect(() => {
    if (activeZiweiShortcutMode !== '问题灵感') {
      return;
    }

    writePromptDraft(ziweiDraftStorageKey, ziweiQuestionDraft, 'inspiration');
  }, [activeZiweiShortcutMode, ziweiDraftStorageKey, ziweiQuestionDraft]);

  useEffect(() => {
    if (activeAstrolabeShortcutMode !== '自定义') {
      return;
    }

    writePromptDraft(astrolabeDraftStorageKey, astrolabeQuestionDraft);
  }, [activeAstrolabeShortcutMode, astrolabeDraftStorageKey, astrolabeQuestionDraft]);

  useEffect(() => {
    if (activeAstrolabeShortcutMode !== '问题灵感') {
      return;
    }

    writePromptDraft(astrolabeDraftStorageKey, astrolabeQuestionDraft, 'inspiration');
  }, [activeAstrolabeShortcutMode, astrolabeDraftStorageKey, astrolabeQuestionDraft]);

  const effectiveBaziQuickQuestion = useMemo(() => {
    if (activeBaziShortcutMode === '自定义' || activeBaziShortcutMode === '问题灵感') {
      return baziQuestionDraft;
    }
    return '';
  }, [activeBaziShortcutMode, baziQuestionDraft]);

  const effectiveZiweiQuickQuestion = useMemo(() => {
    if (activeZiweiShortcutMode === '自定义' || activeZiweiShortcutMode === '问题灵感') {
      return ziweiQuestionDraft;
    }
    return '';
  }, [activeZiweiShortcutMode, ziweiQuestionDraft]);
  const effectiveAstrolabeQuickQuestion = useMemo(() => {
    if (activeAstrolabeShortcutMode === '自定义' || activeAstrolabeShortcutMode === '问题灵感') {
      return astrolabeQuestionDraft;
    }
    return '';
  }, [activeAstrolabeShortcutMode, astrolabeQuestionDraft]);

  function applyBaziShortcutMode(mode: PromptShortcutMode) {
    setActiveBaziShortcutMode(mode);
    if (mode === '自定义') {
      setBaziQuestionDraft(readPromptDraft(baziDraftStorageKey));
      onUpdatePromptState(buildBaziCustomPromptPatch());
      return;
    }

    const matched = findBaziShortcutByMode(mode, inputState.analysisMode);
    if (!matched) {
      return;
    }

    setBaziQuestionDraft('');
    const selection = resolveBaziSelection(matched.promptId, mode);
    onUpdatePromptState({
      baziShortcutMode: mode,
      baziPresetId: matched.promptId,
      baziTopicId: selection.topicId,
      baziSubtopicId: selection.subtopicId,
      baziQuickQuestion: '',
    });
  }

  function applyZiweiShortcutMode(mode: PromptShortcutMode) {
    setActiveZiweiShortcutMode(mode);
    if (mode === '自定义') {
      setZiweiQuestionDraft(readPromptDraft(ziweiDraftStorageKey));
      onUpdatePromptState(buildZiweiCustomPromptPatch());
      return;
    }

    const matched = findZiweiShortcutByMode(mode, inputState.analysisMode);
    if (!matched) {
      return;
    }

    setZiweiQuestionDraft('');
    const selection = resolveZiweiSelection(matched.topic, mode);
    onUpdatePromptState({
      ziweiShortcutMode: mode,
      ziweiTopic: matched.topic,
      ziweiTopicId: selection.topicId,
      ziweiSubtopicId: selection.subtopicId,
      ziweiQuickQuestion: '',
    });
  }

  function applyAstrolabeShortcutMode(mode: PromptShortcutMode) {
    setActiveAstrolabeShortcutMode(mode);
    if (mode === '自定义') {
      setAstrolabeQuestionDraft(readPromptDraft(astrolabeDraftStorageKey));
      onUpdatePromptState({
        astrolabeShortcutMode: '自定义',
        astrolabeTopic: 'chat',
        astrolabeTopicId: '',
        astrolabeSubtopicId: '',
      });
      return;
    }

    const matched = astrolabeShortcutActions.find((item) => item.label === mode) ?? null;
    if (!matched) {
      return;
    }

    setAstrolabeQuestionDraft('');
    const selection = resolveZiweiSelection(matched.topic, mode);
    onUpdatePromptState({
      astrolabeShortcutMode: mode,
      astrolabeTopic: resolveAstrolabeTopicByShortcutMode(mode),
      astrolabeTopicId: selection.topicId,
      astrolabeSubtopicId: selection.subtopicId,
      astrolabeQuickQuestion: '',
    });
  }

  function applyInspiredQuestion(question: string) {
    if (promptSource === 'bazi' || promptSource === 'bazi-ziwei') {
      writePromptDraft(baziDraftStorageKey, question, 'inspiration');
      setActiveBaziShortcutMode('问题灵感');
      setBaziQuestionDraft(question);
      onUpdatePromptState({
        baziShortcutMode: '问题灵感',
      });
    } else if (promptSource === 'astrolabe') {
      writePromptDraft(astrolabeDraftStorageKey, question, 'inspiration');
      setActiveAstrolabeShortcutMode('问题灵感');
      setAstrolabeQuestionDraft(question);
      onUpdatePromptState({
        astrolabeShortcutMode: '问题灵感',
      });
    } else {
      writePromptDraft(ziweiDraftStorageKey, question, 'inspiration');
      setActiveZiweiShortcutMode('问题灵感');
      setZiweiQuestionDraft(question);
      onUpdatePromptState({
        ziweiShortcutMode: '问题灵感',
      });
    }

    onCloseInspiration();
  }

  return {
    activeBaziShortcutMode,
    activeZiweiShortcutMode,
    activeAstrolabeShortcutMode,
    baziQuestionDraft,
    ziweiQuestionDraft,
    astrolabeQuestionDraft,
    setBaziQuestionDraft,
    setZiweiQuestionDraft,
    setAstrolabeQuestionDraft,
    effectiveBaziQuickQuestion,
    effectiveZiweiQuickQuestion,
    effectiveAstrolabeQuickQuestion,
    applyBaziShortcutMode,
    applyZiweiShortcutMode,
    applyAstrolabeShortcutMode,
    applyInspiredQuestion,
  };
}
