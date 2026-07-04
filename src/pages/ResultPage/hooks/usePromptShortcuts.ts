import { useEffect, useMemo, useState } from 'react';
import type { QueryInputState, QueryPromptState } from '@/lib/query-state';
import { buildBaziCustomPromptPatch, buildZiweiCustomPromptPatch } from '@/lib/prompt-page-rules';
import {
  findAstrolabeShortcutByMode,
  findBaziShortcutByMode,
  findZiweiShortcutByMode,
  readPromptDraft,
  resolveAstrolabeShortcutMode,
  resolveAstrolabeTopicByShortcutMode,
  resolveBaziQuestionSceneByShortcutMode,
  resolveBaziShortcutMode,
  resolveZiweiShortcutMode,
  writePromptDraft,
} from '../ResultPage.helpers';
import type { PromptShortcutMode, QuestionInspirationIntent } from '../ResultPage.types';

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
  applyInspiredQuestion: (
    question: string,
    category?: string,
    intent?: QuestionInspirationIntent,
  ) => void;
}

export function usePromptShortcuts(
  inputState: QueryInputState,
  promptState: QueryPromptState,
  baziDraftStorageKey: string,
  ziweiDraftStorageKey: string,
  astrolabeDraftStorageKey: string,
  astrolabeShortcutActions: ReadonlyArray<{ label: string; topic: string; question: string }>,
  onUpdatePromptState: (next: Partial<QueryPromptState>) => void,
  onCloseInspiration: () => void,
): PromptShortcuts {
  const [activeBaziShortcutMode, setActiveBaziShortcutMode] = useState<PromptShortcutMode>(() =>
    resolveBaziShortcutMode(promptState, inputState.analysisMode),
  );
  const [activeZiweiShortcutMode, setActiveZiweiShortcutMode] = useState<PromptShortcutMode>(() =>
    resolveZiweiShortcutMode(promptState, inputState.analysisMode),
  );
  const [baziQuestionDraft, setBaziQuestionDraft] = useState(() => {
    const mode = resolveBaziShortcutMode(promptState, inputState.analysisMode);
    if (mode === '问题灵感') {
      return readPromptDraft(baziDraftStorageKey, 'inspiration') || promptState.baziQuickQuestion;
    }

    return (
      readPromptDraft(baziDraftStorageKey) ||
      promptState.baziQuickQuestion ||
      findBaziShortcutByMode(mode, inputState.analysisMode)?.question ||
      ''
    );
  });
  const [ziweiQuestionDraft, setZiweiQuestionDraft] = useState(() => {
    const mode = resolveZiweiShortcutMode(promptState, inputState.analysisMode);
    if (mode === '问题灵感') {
      return readPromptDraft(ziweiDraftStorageKey, 'inspiration') || promptState.ziweiQuickQuestion;
    }

    return (
      readPromptDraft(ziweiDraftStorageKey) ||
      promptState.ziweiQuickQuestion ||
      findZiweiShortcutByMode(mode, inputState.analysisMode)?.question ||
      ''
    );
  });
  const [astrolabeQuestionDraft, setAstrolabeQuestionDraft] = useState(() => {
    const mode = resolveAstrolabeShortcutMode(promptState);
    if (mode === '问题灵感') {
      return (
        readPromptDraft(astrolabeDraftStorageKey, 'inspiration') ||
        promptState.astrolabeQuickQuestion
      );
    }

    if (mode === '自定义') {
      return readPromptDraft(astrolabeDraftStorageKey) || promptState.astrolabeQuickQuestion;
    }

    return (
      promptState.astrolabeQuickQuestion ||
      findAstrolabeShortcutByMode(mode)?.question ||
      astrolabeShortcutActions[0]?.question ||
      ''
    );
  });
  const [activeAstrolabeShortcutMode, setActiveAstrolabeShortcutMode] =
    useState<PromptShortcutMode>(() => resolveAstrolabeShortcutMode(promptState));

  useEffect(() => {
    const nextMode = resolveBaziShortcutMode(promptState, inputState.analysisMode);
    setActiveBaziShortcutMode(nextMode);
    if (nextMode === '自定义') {
      setBaziQuestionDraft(readPromptDraft(baziDraftStorageKey));
      return;
    }
    if (nextMode === '问题灵感') {
      setBaziQuestionDraft(
        readPromptDraft(baziDraftStorageKey, 'inspiration') || promptState.baziQuickQuestion,
      );
      return;
    }

    setBaziQuestionDraft(findBaziShortcutByMode(nextMode, inputState.analysisMode)?.question ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    baziDraftStorageKey,
    inputState.analysisMode,
    promptState.baziPresetId,
    promptState.baziShortcutMode,
    promptState.baziQuickQuestion,
  ]);

  useEffect(() => {
    const nextMode = resolveZiweiShortcutMode(promptState, inputState.analysisMode);
    setActiveZiweiShortcutMode(nextMode);
    if (nextMode === '自定义') {
      setZiweiQuestionDraft(readPromptDraft(ziweiDraftStorageKey));
      return;
    }
    if (nextMode === '问题灵感') {
      setZiweiQuestionDraft(
        readPromptDraft(ziweiDraftStorageKey, 'inspiration') || promptState.ziweiQuickQuestion,
      );
      return;
    }

    setZiweiQuestionDraft(
      findZiweiShortcutByMode(nextMode, inputState.analysisMode)?.question ?? '',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inputState.analysisMode,
    promptState.ziweiQuickQuestion,
    promptState.ziweiShortcutMode,
    promptState.ziweiTopic,
    ziweiDraftStorageKey,
  ]);

  useEffect(() => {
    const nextMode = resolveAstrolabeShortcutMode(promptState);
    setActiveAstrolabeShortcutMode(nextMode);
    if (nextMode === '自定义') {
      setAstrolabeQuestionDraft(readPromptDraft(astrolabeDraftStorageKey));
      return;
    }
    if (nextMode === '问题灵感') {
      setAstrolabeQuestionDraft(
        readPromptDraft(astrolabeDraftStorageKey, 'inspiration') ||
          promptState.astrolabeQuickQuestion,
      );
      return;
    }

    setAstrolabeQuestionDraft(findAstrolabeShortcutByMode(nextMode)?.question ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    astrolabeDraftStorageKey,
    promptState.astrolabeQuickQuestion,
    promptState.astrolabeShortcutMode,
    promptState.astrolabeTopic,
  ]);

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
    return findBaziShortcutByMode(activeBaziShortcutMode, inputState.analysisMode)?.question || '';
  }, [activeBaziShortcutMode, baziQuestionDraft, inputState.analysisMode]);

  const effectiveZiweiQuickQuestion = useMemo(() => {
    if (activeZiweiShortcutMode === '自定义' || activeZiweiShortcutMode === '问题灵感') {
      return ziweiQuestionDraft;
    }
    return (
      findZiweiShortcutByMode(activeZiweiShortcutMode, inputState.analysisMode)?.question || ''
    );
  }, [activeZiweiShortcutMode, inputState.analysisMode, ziweiQuestionDraft]);
  const effectiveAstrolabeQuickQuestion = useMemo(() => {
    if (activeAstrolabeShortcutMode === '自定义' || activeAstrolabeShortcutMode === '问题灵感') {
      return astrolabeQuestionDraft;
    }
    return findAstrolabeShortcutByMode(activeAstrolabeShortcutMode)?.question || '';
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

    setBaziQuestionDraft(matched.question);
    onUpdatePromptState({
      baziShortcutMode: mode,
      baziPresetId: matched.promptId,
      baziQuestionScene: resolveBaziQuestionSceneByShortcutMode(mode),
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

    setZiweiQuestionDraft(matched.question);
    onUpdatePromptState({
      ziweiShortcutMode: mode,
      ziweiTopic: matched.topic,
    });
  }

  function applyAstrolabeShortcutMode(mode: PromptShortcutMode) {
    setActiveAstrolabeShortcutMode(mode);
    if (mode === '自定义') {
      setAstrolabeQuestionDraft(readPromptDraft(astrolabeDraftStorageKey));
      onUpdatePromptState({
        astrolabeShortcutMode: '自定义',
        astrolabeTopic: 'chat',
      });
      return;
    }

    const matched = astrolabeShortcutActions.find((item) => item.label === mode) ?? null;
    if (!matched) {
      return;
    }

    setAstrolabeQuestionDraft(matched.question);
    onUpdatePromptState({
      astrolabeShortcutMode: mode,
      astrolabeTopic: resolveAstrolabeTopicByShortcutMode(mode),
    });
  }

  function applyInspiredQuestion(
    question: string,
    _category?: string,
    _intent?: QuestionInspirationIntent,
  ) {
    if (promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei') {
      writePromptDraft(baziDraftStorageKey, question, 'inspiration');
      setActiveBaziShortcutMode('问题灵感');
      setBaziQuestionDraft(question);
      onUpdatePromptState({
        baziShortcutMode: '问题灵感',
      });
    } else if (promptState.promptSource === 'astrolabe') {
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
