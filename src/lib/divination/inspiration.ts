export {
  DIVINATION_INSPIRATION_TABS,
  DIVINATION_INSPIRATION_CONTENT,
  JINKOUJUE_SPECIAL_INSPIRATION_CONTENT,
  XIAOLIUREN_SPECIAL_INSPIRATION_CONTENT,
  MEIHUA_SPECIAL_INSPIRATION_CONTENT,
  QIMEN_SPECIAL_INSPIRATION_CONTENT,
  LIUYAO_TEMPLATE_INSPIRATION_CONTENT,
  LIUREN_TEMPLATE_INSPIRATION_CONTENT,
  LENORMAND_SPREAD_INSPIRATION_CONTENT,
  TAROT_SPREAD_INSPIRATION_QUESTIONS,
  getDivinationSpecialInspiration,
  getDefaultDivinationInspirationTab,
  isDivinationInspirationTabVisible,
  getDivinationInspirationSections,
  resolveDivinationInspiredDraftPatch,
} from 'mingyu-core/prompt/inspiration';

export type {
  DivinationInspirationTabId,
  DivinationInspirationTab,
  DivinationInspirationSection,
  DivinationSpecialInspiration,
  DivinationInspirationSelection,
  DivinationInspirationDraft,
} from 'mingyu-core/prompt/inspiration';
