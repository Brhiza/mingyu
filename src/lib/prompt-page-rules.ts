import { shouldUsePhoneLayout } from './responsive-layout';

export function shouldShowPromptShareButton(options: {
  viewportWidth: number;
  viewportHeight?: number;
  hasNavigatorShare: boolean;
}) {
  return shouldUsePhoneLayout(options) && options.hasNavigatorShare;
}

export function buildBaziCustomPromptPatch() {
  return {
    baziShortcutMode: '自定义',
    baziPresetId: 'ai-mingge-zonglun',
    baziQuickQuestion: '',
  };
}

export function buildZiweiCustomPromptPatch() {
  return {
    ziweiShortcutMode: '自定义',
    ziweiTopic: 'chat',
    ziweiQuickQuestion: '',
  };
}
