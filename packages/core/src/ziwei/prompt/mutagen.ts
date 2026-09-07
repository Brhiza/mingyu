import type { AnalysisPayloadV1, ScopeMutagenItem } from '../../types/analysis';
import { getAllStars } from '../iztro/palace-helpers';

/**
 * 取得提示词需要展示的四化事实。
 *
 * 本命层的部分旧数据只有星曜上的 birth_mutagen，没有同步生成
 * active_scope.mutagen_map；两者都属于同一条可追溯事实，输出时合并去重。
 */
export function getPromptMutagenItems(
  payload: AnalysisPayloadV1,
  isOriginScope = false,
): ScopeMutagenItem[] {
  const mappedItems = (payload.active_scope.mutagen_map ?? []).filter(
    (item) => !isOriginScope || !item.dynamic_palace_name,
  );
  const birthItems: ScopeMutagenItem[] = isOriginScope
    ? payload.palaces.flatMap((palace) =>
        getAllStars(palace)
          .filter((star) => Boolean(star.birth_mutagen))
          .map((star) => ({
            mutagen: star.birth_mutagen!,
            star: star.name,
            palace_index: palace.index,
            palace_name: palace.name,
          })),
      )
    : [];

  const seen = new Set<string>();
  return [...mappedItems, ...birthItems].filter((item) => {
    const key = [
      item.star,
      item.mutagen,
      item.palace_index ?? '',
      item.palace_name ?? '',
      item.dynamic_palace_name ?? '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
