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
    onUpdatePromptState({
      baziShortcutMode: mode,
      baziPresetId: matched.promptId,
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
    onUpdatePromptState({
      ziweiShortcutMode: mode,
      ziweiTopic: matched.topic,
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
      });
      return;
    }

    const matched = astrolabeShortcutActions.find((item) => item.label === mode) ?? null;
    if (!matched) {
      return;
    }

    setAstrolabeQuestionDraft('');
    onUpdatePromptState({
      astrolabeShortcutMode: mode,
      astrolabeTopic: resolveAstrolabeTopicByShortcutMode(mode),
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
