import { wuxing } from './divination-data';
import type { LiuyaoChangeRelation } from '../types/divination';
import { BRANCH_ORDER, isKe, isLiuchong, isSheng } from '../ganzhi';

/**
 * 回头生克冲：动爻变出之爻对动爻本身的关系。
 * - 回头生：变爻生动爻
 * - 回头克：变爻克动爻
 * - 回头冲：变爻冲动爻
 * - 化空：变爻落旬空
 * - 比和：同五行同比和
 * - 化泄：动爻生变爻
 * - 化耗：动爻克变爻
 */
const VALID_LIUYAO_WUXING = new Set(Object.keys(wuxing));

export function getLiuyaoChangeRelation(
  originalWuxing: string,
  changedWuxing: string,
  originalBranch: string,
  changedBranch: string,
  changedIsVoid: boolean,
): LiuyaoChangeRelation {
  const relations = getLiuyaoChangeRelations(
    originalWuxing,
    changedWuxing,
    originalBranch,
    changedBranch,
    changedIsVoid,
  );
  if (changedIsVoid) return '化空';
  const relation = relations[0];
  if (!relation) {
    throw new Error(`动变五行关系无法判定：${originalWuxing}→${changedWuxing}`);
  }
  return relation;
}

/**
 * 返回动变条件的完整并见列表。
 * 《增删卜易》分别论回头生克冲、化空、进退等条件；化空描述变爻旬空，
 * 不会抹掉变爻对本爻原有的生、克、冲或比泄耗关系。卷二《六冲章》又以
 * “酉金化卯冲世而不克世”明确区分冲与克，故相冲和五行关系也分别保存。
 */
export function getLiuyaoChangeRelations(
  originalWuxing: string,
  changedWuxing: string,
  originalBranch: string,
  changedBranch: string,
  changedIsVoid: boolean,
): LiuyaoChangeRelation[] {
  if (!VALID_LIUYAO_WUXING.has(originalWuxing) || !VALID_LIUYAO_WUXING.has(changedWuxing)) {
    throw new Error(`六爻动变五行无效：${originalWuxing || '空'}→${changedWuxing || '空'}`);
  }
  if (!BRANCH_ORDER.includes(originalBranch) || !BRANCH_ORDER.includes(changedBranch)) {
    throw new Error(`六爻动变地支无效：${originalBranch || '空'}→${changedBranch || '空'}`);
  }
  if (typeof changedIsVoid !== 'boolean') {
    throw new Error('六爻变爻旬空标记必须是布尔值');
  }
  const wuxingRelation: LiuyaoChangeRelation = isSheng(changedWuxing, originalWuxing)
    ? '回头生'
    : isKe(changedWuxing, originalWuxing)
      ? '回头克'
      : originalWuxing === changedWuxing
        ? '比和'
        : isSheng(originalWuxing, changedWuxing)
          ? '化泄'
          : isKe(originalWuxing, changedWuxing)
            ? '化耗'
            : (() => {
                throw new Error(`动变五行关系无法判定：${originalWuxing}→${changedWuxing}`);
              })();
  const relations: LiuyaoChangeRelation[] = isLiuchong(originalBranch, changedBranch)
    ? ['回头冲', wuxingRelation]
    : [wuxingRelation];
  if (changedIsVoid) relations.push('化空');
  return relations;
}

const LIUYAO_ADVANCING_CHANGE: Record<string, string> = {
  亥: '子',
  寅: '卯',
  巳: '午',
  申: '酉',
  丑: '辰',
  辰: '未',
  未: '戌',
};

const LIUYAO_RETREATING_CHANGE: Record<string, string> = {
  子: '亥',
  卯: '寅',
  午: '巳',
  酉: '申',
  辰: '丑',
  未: '辰',
  戌: '未',
};

/** 按《增删卜易》进神退神章明表判定，不按十二地支循环外推。 */
export function getLiuyaoChangeDirection(
  originalBranch: string,
  changedBranch: string,
): '化进神' | '化退神' | null {
  if (LIUYAO_ADVANCING_CHANGE[originalBranch] === changedBranch) {
    return '化进神';
  }
  if (LIUYAO_RETREATING_CHANGE[originalBranch] === changedBranch) {
    return '化退神';
  }
  return null;
}
