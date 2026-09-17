import type { ReadingResource } from './reading-workflow';

/** 替换会话资料时回收不再使用的补算存储，保留仍由新会话引用的存储。 */
export async function disposeReadingResources(
  resources: readonly ReadingResource[],
  retained: readonly ReadingResource[] = [],
): Promise<void> {
  const keep = new Set(retained.map((resource) => resource.dispose).filter(Boolean));
  const releases = new Set(
    resources
      .map((resource) => resource.dispose)
      .filter((dispose) => dispose && !keep.has(dispose)),
  );
  const results = await Promise.allSettled(
    [...releases].map((dispose) => Promise.resolve().then(dispose!)),
  );
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      '清除补算临时资料失败。',
    );
}
