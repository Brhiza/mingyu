import {
  buildSerializableZiweiResult,
  type SerializableZiweiResult,
} from 'mingyu-core/ziwei/iztro';
import type {
  BirthChartBundle,
  BirthChartPointBundle,
  BirthChartRangeBundle,
} from 'mingyu-core/birth';

type SerializablePointBundle = Omit<BirthChartPointBundle, 'ziwei'> & {
  ziwei?: SerializableZiweiResult;
};

/** full 紫微范围资料页的 scope 游标；origin 会随每页重复返回。 */
export interface BirthRangeScopeBatch {
  requestedScope: 'full';
  scopes: string[];
  startIndex: number;
  endIndexExclusive: number;
  totalScopes: number;
  nextIndex: number | null;
}

type SerializableRangeSample = Omit<BirthChartRangeBundle['range']['samples'][number], 'bundle'> & {
  bundle: SerializablePointBundle;
};

export type SerializableBirthChartRangeBundle = Omit<BirthChartRangeBundle, 'range'> & {
  range: Omit<BirthChartRangeBundle['range'], 'samples'> & {
    samples: SerializableRangeSample[];
    scopeBatch?: BirthRangeScopeBatch;
  };
};

export function isBirthChartRangeBundle(value: unknown): value is BirthChartRangeBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as { range?: unknown };
  if (!candidate.range || typeof candidate.range !== 'object' || Array.isArray(candidate.range)) {
    return false;
  }
  const range = candidate.range as { samples?: unknown };
  return Array.isArray(range.samples);
}

/** 将 core 的紫微运行对象投影为已有 public API 使用的完整稳定结构。 */
export function serializeBirthChartRangeBundle(
  bundle: BirthChartBundle,
  scopeBatch?: BirthRangeScopeBatch,
): BirthChartBundle | SerializableBirthChartRangeBundle {
  if (!isBirthChartRangeBundle(bundle)) return bundle;

  return {
    ...bundle,
    range: {
      ...bundle.range,
      ...(scopeBatch ? { scopeBatch } : {}),
      samples: bundle.range.samples.map((sample) => ({
        ...sample,
        bundle: serializePointBundle(sample.bundle),
      })),
    },
  };
}

function serializePointBundle(bundle: BirthChartPointBundle): SerializablePointBundle {
  const { ziwei, ...rest } = bundle;
  return {
    ...rest,
    ...(ziwei ? { ziwei: buildSerializableZiweiResult(ziwei) } : {}),
  };
}
