import { useEffect, useMemo, useState } from 'react';
import { shareText } from '@/utils/share-text';
import { ANDROID_AI_APP_EVENT, readPreferredAndroidAiApp } from '@/lib/android-ai-app';

export interface PromptCopyShare {
  copyState: string;
  shareState: string;
  handleCopy: () => Promise<void>;
  handleShare: () => Promise<void>;
}

export function usePromptCopyShare(promptText: string): PromptCopyShare {
  const [copyResult, setCopyResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareResult, setShareResult] = useState<
    | { type: 'idle' }
    | { type: 'app'; label: string }
    | { type: 'system' }
    | { type: 'copied' }
    | { type: 'failed'; message: string }
  >({ type: 'idle' });
  const [preferredAppLabel, setPreferredAppLabel] = useState(
    () => readPreferredAndroidAiApp()?.label ?? '',
  );

  useEffect(() => {
    setCopyResult('idle');
    setShareResult({ type: 'idle' });
  }, [promptText]);

  useEffect(() => {
    const refreshPreferredApp = () => {
      setPreferredAppLabel(readPreferredAndroidAiApp()?.label ?? '');
      setShareResult({ type: 'idle' });
    };
    window.addEventListener(ANDROID_AI_APP_EVENT, refreshPreferredApp);
    return () => window.removeEventListener(ANDROID_AI_APP_EVENT, refreshPreferredApp);
  }, []);

  const copyState = useMemo(() => {
    if (!promptText) return '暂无内容';
    if (copyResult === 'copied') return '已复制';
    if (copyResult === 'failed') return '复制失败';
    return '复制提问内容';
  }, [copyResult, promptText]);

  const shareState = useMemo(() => {
    if (!promptText) return '暂无内容';
    if (shareResult.type === 'app') return `已发送到${shareResult.label}`;
    if (shareResult.type === 'system') return '已调起系统分享';
    if (shareResult.type === 'copied') return '已复制，可粘贴分享';
    if (shareResult.type === 'failed') return shareResult.message;
    return preferredAppLabel ? `发送到${preferredAppLabel}` : '分享提问内容';
  }, [preferredAppLabel, shareResult, promptText]);

  async function handleCopy() {
    if (!promptText) {
      setCopyResult('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      setCopyResult('copied');
    } catch {
      setCopyResult('failed');
    }
  }

  async function handleShare() {
    if (!promptText) {
      setShareResult({ type: 'failed', message: '分享失败' });
      return;
    }

    try {
      const result = await shareText(promptText);
      if (result.type === 'app' || result.type === 'system') {
        setShareResult(result);
        return;
      }

      await navigator.clipboard.writeText(promptText);
      setShareResult({ type: 'copied' });
    } catch (error) {
      setShareResult({
        type: 'failed',
        message: error instanceof Error ? error.message : '分享失败',
      });
    }
  }

  return { copyState, shareState, handleCopy, handleShare };
}
