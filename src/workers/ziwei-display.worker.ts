import { calculateZiweiDisplayPayload } from '@/lib/full-chart-engine/ziwei';
import type { ChartInput } from '@/types/chart';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';

type ZiweiDisplayWorkerRequest = {
  id: string;
  input: ChartInput;
  dateStr: string;
  hourIndex: number;
  scope: ScopeType;
};

type ZiweiDisplayWorkerResponse =
  | {
      id: string;
      ok: true;
      payload: AnalysisPayloadV1;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };

self.onmessage = async (event: MessageEvent<ZiweiDisplayWorkerRequest>) => {
  try {
    const payload = await calculateZiweiDisplayPayload(event.data);
    const response: ZiweiDisplayWorkerResponse = {
      id: event.data.id,
      ok: true,
      payload,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ZiweiDisplayWorkerResponse = {
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : '紫微盘面计算失败。',
    };
    self.postMessage(response);
  }
};
