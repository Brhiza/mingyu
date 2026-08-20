import { calculateZiweiPayloadByScope } from '@/lib/full-chart-engine/ziwei';
import type { ChartInput } from '@/types/chart';

type ZiweiPayloadWorkerRequest = {
  id: string;
  input: ChartInput;
};

type ZiweiPayloadWorkerResponse =
  | {
      id: string;
      ok: true;
      payloadByScope: Awaited<ReturnType<typeof calculateZiweiPayloadByScope>>;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };

self.onmessage = async (event: MessageEvent<ZiweiPayloadWorkerRequest>) => {
  try {
    const payloadByScope = await calculateZiweiPayloadByScope(event.data.input);
    const response: ZiweiPayloadWorkerResponse = {
      id: event.data.id,
      ok: true,
      payloadByScope,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ZiweiPayloadWorkerResponse = {
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : '紫微排盘失败。',
    };
    self.postMessage(response);
  }
};
