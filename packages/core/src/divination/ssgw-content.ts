import type { SsgwData } from '../types/divination';

function normalizeSsgwText(text: string) {
  return text.replace(/[，。、《》；：？！“”"'、\s]/g, '');
}

function sanitizeSsgwText(text: string, currentNumber: number) {
  return text
    .split(/(?<=[。！？!?])\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => {
      const references = [...sentence.matchAll(/第\s*(\d+)\s*签/gu)].map((match) =>
        Number(match[1]),
      );
      return references.every((number) => number === currentNumber);
    })
    .filter((sentence) => !sentence.includes('全方位的多'))
    .join('');
}

/** 合并签谱中的重复典故字段，避免同一内容在结果和详情中展示两次。 */
export function resolveSsgwStoryContent(data: SsgwData) {
  const story = sanitizeSsgwText(data.story?.trim() || '', data.number);
  const detailStory = sanitizeSsgwText(data.details?.典故?.trim() || '', data.number);

  if (!story && !detailStory) return { canonicalStory: '', extraStory: '' };
  if (!story) return { canonicalStory: detailStory, extraStory: '' };
  if (!detailStory) return { canonicalStory: story, extraStory: '' };

  const normalizedStory = normalizeSsgwText(story);
  const normalizedDetailStory = normalizeSsgwText(detailStory);
  if (
    normalizedStory.includes(normalizedDetailStory) ||
    normalizedDetailStory.includes(normalizedStory)
  ) {
    return {
      canonicalStory: story.length >= detailStory.length ? story : detailStory,
      extraStory: '',
    };
  }

  return { canonicalStory: detailStory, extraStory: story };
}
