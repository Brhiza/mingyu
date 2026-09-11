import {
  calculatePublicZiweiChartForScopes,
  calculateZiweiPayloadByScope,
} from '@/lib/full-chart-engine/ziwei';
import { buildSerializableZiweiResult } from 'mingyu-core/ziwei';
import { formatPublicZiweiFullScopeText } from 'mingyu-core/prompt/public-api';
import type { ChartInput } from '@/types/chart';

import type { ZiweiReadingResourceContent } from '@/pages/ResultPage/utils/createPayloadWorker';

type ZiweiPayloadWorkerRequest =
  | {
      id: string;
      input: ChartInput;
      kind?: 'payload';
    }
  | {
      id: string;
      input: ChartInput;
      kind: 'reading-resource';
      dateStr: string;
      hourIndex: number;
    };

type ZiweiPayloadWorkerResponse =
  | {
      id: string;
      kind: 'payload';
      ok: true;
      payloadByScope: Awaited<ReturnType<typeof calculateZiweiPayloadByScope>>;
    }
  | {
      id: string;
      kind: 'reading-resource';
      ok: true;
      resource: ZiweiReadingResourceContent;
    }
  | {
      id: string;
      kind: 'payload' | 'reading-resource';
      ok: false;
      error: string;
    };

self.onmessage = async (event: MessageEvent<ZiweiPayloadWorkerRequest>) => {
  const request = event.data;
  try {
    const response: ZiweiPayloadWorkerResponse =
      request.kind === 'reading-resource'
        ? {
            id: request.id,
            kind: 'reading-resource',
            ok: true,
            resource: await (async (): Promise<ZiweiReadingResourceContent> => {
              const runtime = await calculatePublicZiweiChartForScopes(
                request.input,
                ['decadal', 'yearly', 'monthly', 'daily', 'hourly'],
                {
                  skipAnalysis: true,
                  horoscopeContext: {
                    dateStr: request.dateStr,
                    hourIndex: request.hourIndex,
                  },
                  fortuneRange: {
                    scope: 'all',
                    dateStr: request.dateStr,
                    hourIndex: request.hourIndex,
                  },
                },
              );
              return {
                text: formatPublicZiweiFullScopeText(runtime),
                usable: true,
                kind: 'evidence',
                structured: { ...buildSerializableZiweiResult(runtime) },
              };
            })(),
          }
        : {
            id: request.id,
            kind: 'payload',
            ok: true,
            payloadByScope: await calculateZiweiPayloadByScope(request.input),
          };
    self.postMessage(response);
  } catch (error) {
    const response: ZiweiPayloadWorkerResponse = {
      id: request.id,
      kind: request.kind === 'reading-resource' ? 'reading-resource' : 'payload',
      ok: false,
      error: error instanceof Error ? error.message : '紫微排盘失败。',
    };
    self.postMessage(response);
  }
};
