import {
  calculatePublicZiweiChartForScopes,
  calculateZiweiPayloadByScope,
} from '@/lib/full-chart-engine/ziwei';
import { buildSerializableZiweiResult } from 'mingyu-core/ziwei';
import { formatPublicZiweiFullScopeText } from 'mingyu-core/prompt/public-api';
import type { ChartInput } from '@/types/chart';

type ZiweiReadingResourceContent = {
  text: string;
  usable: true;
  kind: 'evidence';
  structured: ReturnType<typeof buildSerializableZiweiResult>;
};

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
  try {
    const response: ZiweiPayloadWorkerResponse =
      event.data.kind === 'reading-resource'
        ? {
            id: event.data.id,
            kind: 'reading-resource',
            ok: true,
            resource: await (async (): Promise<ZiweiReadingResourceContent> => {
              const runtime = await calculatePublicZiweiChartForScopes(
                event.data.input,
                ['decadal', 'yearly', 'monthly', 'daily', 'hourly'],
                {
                  skipAnalysis: true,
                  horoscopeContext: {
                    dateStr: event.data.dateStr,
                    hourIndex: event.data.hourIndex,
                  },
                  fortuneRange: {
                    scope: 'all',
                    dateStr: event.data.dateStr,
                    hourIndex: event.data.hourIndex,
                  },
                },
              );
              return {
                text: formatPublicZiweiFullScopeText(runtime),
                usable: true,
                kind: 'evidence',
                structured: buildSerializableZiweiResult(runtime),
              };
            })(),
          }
        : {
            id: event.data.id,
            kind: 'payload',
            ok: true,
            payloadByScope: await calculateZiweiPayloadByScope(event.data.input),
          };
    self.postMessage(response);
  } catch (error) {
    const response: ZiweiPayloadWorkerResponse = {
      id: event.data.id,
      kind: event.data.kind === 'reading-resource' ? 'reading-resource' : 'payload',
      ok: false,
      error: error instanceof Error ? error.message : '紫微排盘失败。',
    };
    self.postMessage(response);
  }
};
