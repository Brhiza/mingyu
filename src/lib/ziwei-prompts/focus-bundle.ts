import type { AnalysisPayloadV1, PalaceFact } from '../../types/analysis';
import { formatPalaceName } from './labels';
import {
  buildScopeFocusPalaces,
  dedupePalaces,
  getBodyPalace,
  getOppositePalace,
  getPalaceByIndex,
  getPalaceByName,
  getSurroundedPalaces,
} from './palace-helpers';
import type { PromptContext } from './types';

type FocusTaskBundle = {
  focusSummary: string;
  focusPalaces: PalaceFact[];
  avoid: string[];
};

function buildCommonBoundary() {
  return [];
}

export function buildFocusTaskBundle(
  payload: AnalysisPayloadV1,
  reportContext: PromptContext,
): FocusTaskBundle {
  const activePalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const bodyPalace = getBodyPalace(payload);
  const mingPalace = getPalaceByName(payload, '命宫');
  const isOriginScope = payload.active_scope.scope === 'origin';

  if (reportContext.report_type === 'palace') {
    const selectedPalace = reportContext.palace_name
      ? getPalaceByName(payload, reportContext.palace_name)
      : activePalace;
    const palaceName = formatPalaceName(
      selectedPalace?.name ?? reportContext.palace_name ?? '当前宫位',
    );

    return {
      focusSummary: `围绕${palaceName}及其对宫、三方四正组织证据。`,
      focusPalaces: dedupePalaces([
        selectedPalace,
        getOppositePalace(payload, selectedPalace),
        ...getSurroundedPalaces(payload, selectedPalace),
      ]),
      avoid: buildCommonBoundary(),
    };
  }

  if (reportContext.report_type === 'scope') {
    return {
      focusSummary: `围绕${payload.active_scope.label || '当前运限'}与本命主线的触发关系组织证据。`,
      focusPalaces: dedupePalaces([
        activePalace,
        ...buildScopeFocusPalaces(payload),
        mingPalace,
        bodyPalace,
      ]).slice(0, 6),
      avoid: buildCommonBoundary(),
    };
  }

  const generalPalaces = (
    isOriginScope
      ? dedupePalaces([
          activePalace,
          mingPalace,
          bodyPalace,
          getPalaceByName(payload, '福德'),
          getPalaceByName(payload, '迁移'),
        ])
      : dedupePalaces([activePalace, ...buildScopeFocusPalaces(payload), mingPalace, bodyPalace])
  ).slice(0, 6);

  return {
    focusSummary: '重点分析命宫、身宫及与【问题】相关的宫位。',
    focusPalaces: generalPalaces,
    avoid: buildCommonBoundary(),
  };
}
