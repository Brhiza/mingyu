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
  return ['只基于已提供盘面、运限和问题作答；证据不足时直接说明。'];
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
    focusSummary:
      reportContext.selected_topic === 'chat'
        ? '按【问题】选择最相关宫位；主题未明确时按通用紫微证据处理。'
        : '主题只作为问题范围；重点宫位由【问题】与盘面证据决定。',
    focusPalaces: generalPalaces,
    avoid: buildCommonBoundary(),
  };
}
