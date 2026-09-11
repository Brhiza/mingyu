import { generateQimenLifetimePrompt } from 'mingyu-core/divination/qimen';
import type { QimenLifetimeInput } from 'mingyu-core/types';

type QimenLifetimeWorkerRequest = {
  id: string;
  input: QimenLifetimeInput;
  question?: string;
};

self.onmessage = (event: MessageEvent<QimenLifetimeWorkerRequest>) => {
  const { id, input, question } = event.data;
  try {
    const { data, prompt } = generateQimenLifetimePrompt(input, question);
    self.postMessage({
      id,
      ok: true,
      prompt,
      result: data,
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : '奇门终身局排盘失败。',
    });
  }
};
