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

function buildMutagenFocusPalaces(payload: AnalysisPayloadV1): PalaceFact[] {
  const palaces = payload.palaces.filter((palace) => {
    const stars = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
    return stars.some(
      (star) =>
        Boolean(star.birth_mutagen) ||
        Boolean(star.horoscope_mutagen) ||
        Boolean(star.active_scope_mutagen) ||
        Boolean(palace.self_mutagens?.length),
    );
  });
  return dedupePalaces(palaces);
}

function isFeixingOrSihuaTopic(reportContext: PromptContext) {
  const topic = `${reportContext.selected_topic || ''} ${reportContext.report_key || ''} ${reportContext.report_title || ''}`;
  return /飞星|四化|飞化|mutagen|sihua|feixing/i.test(topic);
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
      ]),
      avoid: buildCommonBoundary(),
    };
  }

  if (isFeixingOrSihuaTopic(reportContext) || reportContext.report_type === 'mutagen') {
    const mutagenPalaces = buildMutagenFocusPalaces(payload);
    const focusPalaces = dedupePalaces([
      ...mutagenPalaces,
      activePalace,
      mingPalace,
      bodyPalace,
      ...(!isOriginScope ? buildScopeFocusPalaces(payload) : []),
    ]);
    return {
      focusSummary:
        '围绕生年四化、运限四化、自化与飞化落宫组织专题主线，先定四化牵动，再看落宫与三方会照条件。',
      focusPalaces,
      avoid: buildCommonBoundary(),
    };
  }

  const generalPalaces = isOriginScope
    ? dedupePalaces([
        activePalace,
        mingPalace,
        bodyPalace,
        getPalaceByName(payload, '福德'),
        getPalaceByName(payload, '迁移'),
        ...buildMutagenFocusPalaces(payload),
      ])
    : dedupePalaces([
        activePalace,
        ...buildScopeFocusPalaces(payload),
        mingPalace,
        bodyPalace,
        ...buildMutagenFocusPalaces(payload),
      ]);

  return {
    focusSummary: isOriginScope
      ? '重点分析命宫、身宫、相关宫位，并保留生年四化牵动线索。'
      : '重点分析当前运限落宫、本命主线与运限四化触发关系。',
    focusPalaces: generalPalaces,
    avoid: buildCommonBoundary(),
  };
}
