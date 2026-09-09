import {
  buildZiweiFortunePrompt,
  type ZiweiFortunePromptRequest,
} from '@/lib/ziwei-fortune-prompt';

self.onmessage = async (event: MessageEvent<ZiweiFortunePromptRequest & { id: string }>) => {
  const { id, key } = event.data;
  try {
    const text = await buildZiweiFortunePrompt(event.data);
    self.postMessage({ id, ok: true, key, text });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : '紫微流年资料生成失败。',
    });
  }
};
