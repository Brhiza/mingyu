import { useEffect, useMemo, useState } from 'react';
import { shareText } from '@/utils/share-text';

export interface PromptCopyShare {
  copyState: string;
  shareState: string;
  handleCopy: () => Promise<void>;
  handleShare: () => Promise<void>;
}

export function usePromptCopyShare(promptText: string): PromptCopyShare {
  const [copyResult, setCopyResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareResult, setShareResult] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    setCopyResult('idle');
    setShareResult('idle');
  }, [promptText]);

  const copyState = useMemo(() => {
    if (!promptText) return '暂无内容';
    if (copyResult === 'copied') return '已复制';
    if (copyResult === 'failed') return '复制失败';
    return '复制提问内容';
  }, [copyResult, promptText]);

  const shareState = useMemo(() => {
    if (!promptText) return '暂无内容';
    if (shareResult === 'shared') return '已调起系统分享';
    if (shareResult === 'copied') return '已复制，可粘贴分享';
    if (shareResult === 'failed') return '分享失败';
    return '分享提问内容';
  }, [shareResult, promptText]);

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
      setShareResult('failed');
      return;
    }

    try {
      const ok = await shareText(promptText);
      if (ok) {
        setShareResult('shared');
        return;
      }

      await navigator.clipboard.writeText(promptText);
      setShareResult('copied');
    } catch {
      setShareResult('failed');
    }
  }

  return { copyState, shareState, handleCopy, handleShare };
}
