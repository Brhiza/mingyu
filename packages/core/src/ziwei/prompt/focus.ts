import type { AnalysisPayloadV1, PalaceFact } from '../../types/analysis';
import {
  buildScopeFocusPalaces,
  dedupePalaces,
  getBodyPalace,
  getOppositePalace,
  getPalaceByIndex,
  getPalaceByName,
  getSurroundedPalaces,
} from '../iztro/palace-helpers';
import { formatPalaceName } from './labels';
import type { ZiweiFocusTaskBundle, ZiweiPromptContext } from './types';

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

function isFeixingOrSihuaTopic(context: ZiweiPromptContext) {
  const text = `${context.selectedTopic ?? ''} ${context.reportKey ?? ''} ${context.reportTitle ?? ''}`;
  return /飞星|四化|飞化|mutagen|sihua|feixing/i.test(text);
}

/** 根据专题、报告类型和当前运限选择需要优先放入提示词的宫位。 */
export function buildFocusTaskBundle(
  payload: AnalysisPayloadV1,
  reportContext: ZiweiPromptContext,
): ZiweiFocusTaskBundle {
  const activePalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const bodyPalace = getBodyPalace(payload);
  const lifePalace = getPalaceByName(payload, '命宫');
  const isOriginScope = payload.active_scope.scope === 'origin';

  if (reportContext.reportType === 'palace') {
    const selectedPalace = reportContext.palaceName
      ? getPalaceByName(payload, reportContext.palaceName)
      : activePalace;
    const palaceName = formatPalaceName(
      selectedPalace?.name ?? reportContext.palaceName ?? '当前宫位',
    );

    return {
      focusSummary: `围绕${palaceName}及其对宫、三方四正组织证据。`,
      focusPalaces: dedupePalaces([
        selectedPalace,
        getOppositePalace(payload, selectedPalace),
        ...getSurroundedPalaces(payload, selectedPalace),
      ]),
      avoid: [],
    };
  }

  if (reportContext.reportType === 'scope') {
    return {
      focusSummary: `围绕${payload.active_scope.label || '当前运限'}与本命主线的触发关系组织证据。`,
      focusPalaces: dedupePalaces([
        activePalace,
        ...buildScopeFocusPalaces(payload),
        lifePalace,
        bodyPalace,
      ]).slice(0, 6),
      avoid: [],
    };
  }

  if (isFeixingOrSihuaTopic(reportContext) || reportContext.reportType === 'mutagen') {
    const mutagenPalaces = buildMutagenFocusPalaces(payload);
    return {
      focusSummary:
        '围绕生年四化、运限四化、自化与飞化落宫组织专题主线，先定四化牵动，再看落宫与三方会照条件。',
      focusPalaces: dedupePalaces([
        ...mutagenPalaces,
        activePalace,
        lifePalace,
        bodyPalace,
        ...(!isOriginScope ? buildScopeFocusPalaces(payload) : []),
      ]).slice(0, 8),
      avoid: [],
    };
  }

  const topic = reportContext.selectedTopic ?? '';

  if (/relationship|婚恋|感情|配偶|夫妻|桃花|合婚/i.test(topic)) {
    const spousePalace = getPalaceByName(payload, '夫妻');
    const careerPalace = getPalaceByName(payload, '官禄');
    const happinessPalace = getPalaceByName(payload, '福德');
    const migrationPalace = getPalaceByName(payload, '迁移');
    return {
      focusSummary: '围绕夫妻宫及其对宫（官禄）、三方（迁移、福德）与命身宫组织婚恋情感证据。',
      focusPalaces: dedupePalaces([
        spousePalace,
        lifePalace,
        careerPalace,
        happinessPalace,
        migrationPalace,
        bodyPalace,
        activePalace,
        ...buildMutagenFocusPalaces(payload).slice(0, 2),
      ]).slice(0, 8),
      avoid: [],
    };
  }


  if (/career|wealth|事业|工作|财运|创业|投资/i.test(topic)) {
    const careerPalace = getPalaceByName(payload, '官禄');
    const wealthPalace = getPalaceByName(payload, '财帛');
    const estatePalace = getPalaceByName(payload, '田宅');
    const migrationPalace = getPalaceByName(payload, '迁移');
    return {
      focusSummary: '围绕官禄、财帛、田宅与命身宫组织事业财运证据。',
      focusPalaces: dedupePalaces([
        careerPalace,
        wealthPalace,
        estatePalace,
        migrationPalace,
        lifePalace,
        bodyPalace,
        activePalace,
        ...buildMutagenFocusPalaces(payload).slice(0, 2),
      ]).slice(0, 8),
      avoid: [],
    };
  }

  const generalPalaces = (

    isOriginScope
      ? dedupePalaces([
          activePalace,
          lifePalace,
          bodyPalace,
          getPalaceByName(payload, '福德'),
          getPalaceByName(payload, '迁移'),
          ...buildMutagenFocusPalaces(payload).slice(0, 2),
        ])
      : dedupePalaces([
          activePalace,
          ...buildScopeFocusPalaces(payload),
          lifePalace,
          bodyPalace,
          ...buildMutagenFocusPalaces(payload).slice(0, 2),
        ])
  ).slice(0, 6);

  return {
    focusSummary: isOriginScope
      ? '重点分析命宫、身宫、相关宫位，并保留生年四化牵动线索。'
      : '重点分析当前运限落宫、本命主线与运限四化触发关系。',
    focusPalaces: generalPalaces,
    avoid: [],
  };
}
