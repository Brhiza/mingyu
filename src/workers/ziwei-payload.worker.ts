import { calculateZiweiPayloadByScope, type ZiweiHoroscopeContext } from '@/lib/full-chart-engine';
import type { ChartInput } from '@/types/chart';

type ZiweiPayloadWorkerRequest = {
  id: string;
  input: ChartInput;
  horoscopeContext: ZiweiHoroscopeContext;
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
    const payloadByScope = await calculateZiweiPayloadByScope(
      event.data.input,
      event.data.horoscopeContext,
    );
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
