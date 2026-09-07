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

  if (/career|事业|工作|职场|跳槽|创业|变动/i.test(topic)) {
    const careerPalace = getPalaceByName(payload, '官禄');
    const wealthPalace = getPalaceByName(payload, '财帛');
    const migrationPalace = getPalaceByName(payload, '迁移');
    const parentsPalace = getPalaceByName(payload, '父母');
    const siblingPalace = getPalaceByName(payload, '兄弟');
    return {
      focusSummary: '围绕官禄宫及其三方四正（命宫、财帛、迁移）与父母、兄弟宫组织事业职场证据。',
      focusPalaces: dedupePalaces([
        careerPalace,
        lifePalace,
        bodyPalace,
        wealthPalace,
        migrationPalace,
        parentsPalace,
        siblingPalace,
        activePalace,
        ...buildMutagenFocusPalaces(payload).slice(0, 2),
      ]).slice(0, 8),
      avoid: [],
    };
  }

  if (/wealth|财运|财富|求财|投资|资产/i.test(topic)) {
    const wealthPalace = getPalaceByName(payload, '财帛');
    const estatePalace = getPalaceByName(payload, '田宅');
    const happinessPalace = getPalaceByName(payload, '福德');
    const careerPalace = getPalaceByName(payload, '官禄');
    const siblingPalace = getPalaceByName(payload, '兄弟');
    return {
      focusSummary: '围绕财帛宫、田宅宫（财库）、福德宫（财源造化）与官禄、命宫组织求财财富证据。',
      focusPalaces: dedupePalaces([
        wealthPalace,
        estatePalace,
        happinessPalace,
        careerPalace,
        lifePalace,
        bodyPalace,
        siblingPalace,
        activePalace,
        ...buildMutagenFocusPalaces(payload).slice(0, 2),
      ]).slice(0, 8),
      avoid: [],
    };
  }

  if (/health|健康|疾厄|病|体质|五行/i.test(topic)) {
    const healthPalace = getPalaceByName(payload, '疾厄');
    const parentsPalace = getPalaceByName(payload, '父母');
    const happinessPalace = getPalaceByName(payload, '福德');
    return {
      focusSummary:
        '围绕疾厄宫、父母宫（遗传与疾厄对宫）、福德宫（心神寿元）与命身宫组织健康体质证据。',
      focusPalaces: dedupePalaces([
        healthPalace,
        parentsPalace,
        lifePalace,
        bodyPalace,
        happinessPalace,
        activePalace,
        ...buildMutagenFocusPalaces(payload).slice(0, 2),
      ]).slice(0, 7),
      avoid: [],
    };
  }

  if (/family|家庭|六亲|田宅|父母|子女|房产|房宅/i.test(topic)) {
    const estatePalace = getPalaceByName(payload, '田宅');
    const parentsPalace = getPalaceByName(payload, '父母');
    const childrenPalace = getPalaceByName(payload, '子女');
    const siblingPalace = getPalaceByName(payload, '兄弟');
    const spousePalace = getPalaceByName(payload, '夫妻');
    return {
      focusSummary: '围绕田宅宫（家宅不动产）、父母宫、子女宫、兄弟宫与命身宫组织家庭六亲证据。',
      focusPalaces: dedupePalaces([
        estatePalace,
        parentsPalace,
        childrenPalace,
        siblingPalace,
        lifePalace,
        bodyPalace,
        spousePalace,
        activePalace,
      ]).slice(0, 8),
      avoid: [],
    };
  }

  if (/academic|study|学业|考试|考运|考研|考公|上岸|进修|升学/i.test(topic)) {
    const careerPalace = getPalaceByName(payload, '官禄');
    const parentsPalace = getPalaceByName(payload, '父母');
    const happinessPalace = getPalaceByName(payload, '福德');
    const migrationPalace = getPalaceByName(payload, '迁移');
    return {
      focusSummary: '围绕官禄宫、父母宫（考官印信）、命身宫与福德宫组织学业考试与进修证据。',
      focusPalaces: dedupePalaces([
        careerPalace,
        parentsPalace,
        lifePalace,
        bodyPalace,
        happinessPalace,
        migrationPalace,
        activePalace,
        ...buildMutagenFocusPalaces(payload).slice(0, 2),
      ]).slice(0, 8),
      avoid: [],
    };
  }

  if (/timing|时机|应期|岁运|动静|抉择/i.test(topic)) {
    return {
      focusSummary: '围绕当前运限落宫、对宫冲照、四化飞伏与命身主轴组织岁运动静抉择证据。',
      focusPalaces: dedupePalaces([
        activePalace,
        getOppositePalace(payload, activePalace),
        ...buildScopeFocusPalaces(payload),
        lifePalace,
        bodyPalace,
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
