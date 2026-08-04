import type { SsgwData } from '../../types/divination';

function normalizeSsgwText(text: string) {
  return text.replace(/[，。、《》；：？！“”"'、\s]/g, '');
}

export function resolveSsgwStoryContent(data: SsgwData) {
  const story = data.story?.trim() || '';
  const detailStory = data.details?.典故?.trim() || '';

  if (!story && !detailStory) {
    return {
      canonicalStory: '',
      extraStory: '',
    };
  }

  if (!story) {
    return {
      canonicalStory: detailStory,
      extraStory: '',
    };
  }

  if (!detailStory) {
    return {
      canonicalStory: story,
      extraStory: '',
    };
  }

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

  return {
    canonicalStory: detailStory,
    extraStory: story,
  };
}
