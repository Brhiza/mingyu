import {
  INSTANT_CHART_DEFINITIONS,
  buildInstantChartContext,
  type InstantChartType,
  type InstantObserver,
  type InstantTimeStandard,
} from 'mingyu-core/instant';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { buildChartRecordPath } from '@/lib/case-navigation';
import {
  defaultInputState,
  defaultPromptState,
  type PromptSourceKey,
  type QueryInputState,
  type ResultTabKey,
} from '@/lib/query-state';

export const INSTANT_TIME_STANDARD_PARAM = 'its';
export const FRONTEND_INSTANT_TIME_ZONE = 8;
export const FRONTEND_INSTANT_TIME_ZONE_ID = 'Asia/Shanghai';

const INSTANT_RESULT_CONFIG: Record<
  InstantChartType,
  {
    chartType: QueryInputState['chartType'];
    promptSource: PromptSourceKey;
    tab: ResultTabKey;
  }
> = {
  bazi: { chartType: 'bazi', promptSource: 'bazi', tab: 'bazi' },
  ziwei: { chartType: 'ziwei', promptSource: 'ziwei', tab: 'ziwei' },
  'bazi-ziwei': { chartType: 'bazi', promptSource: 'bazi-ziwei', tab: 'bazi' },
  astrolabe: { chartType: 'astrolabe', promptSource: 'astrolabe', tab: 'astrolabe' },
  qizheng: { chartType: 'astrolabe', promptSource: 'qizheng', tab: 'qizheng' },
};

export function isInstantChartType(value: unknown): value is InstantChartType {
  return INSTANT_CHART_DEFINITIONS.some((item) => item.type === value);
}

export function readInstantTimeStandard(value: unknown): InstantTimeStandard {
  return value === 'true-solar' ? 'true-solar' : 'beijing';
}

export function buildFrontendInstantObserver(input: {
  birthPlace: string;
  birthLongitude: string;
  birthLatitude: string;
}): InstantObserver | undefined {
  const longitude = Number(input.birthLongitude);
  const latitude = Number(input.birthLatitude);
  if (!input.birthPlace.trim() || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return undefined;
  }
  return {
    locationName: input.birthPlace.trim(),
    longitude,
    latitude,
    timezone: FRONTEND_INSTANT_TIME_ZONE,
    timeZoneId: FRONTEND_INSTANT_TIME_ZONE_ID,
  };
}

export function instantChartNeedsObserver(
  type: InstantChartType,
  timeStandard: InstantTimeStandard,
) {
  const definition = INSTANT_CHART_DEFINITIONS.find((item) => item.type === type)!;
  return (
    definition.requiresObserver === 'always' ||
    (definition.requiresObserver === 'true-solar' && timeStandard === 'true-solar')
  );
}

export function buildInstantQueryInput(options: {
  type: InstantChartType;
  timeStandard: InstantTimeStandard;
  now?: Date;
  observer?: InstantObserver;
}): QueryInputState {
  const config = INSTANT_RESULT_CONFIG[options.type];
  const definition = INSTANT_CHART_DEFINITIONS.find((item) => item.type === options.type)!;
  const context = buildInstantChartContext({
    type: options.type,
    customDate: options.now ?? new Date(),
    timeStandard: options.timeStandard,
    observer: options.observer,
  });
  const preciseTimeRequired =
    options.timeStandard === 'true-solar' ||
    options.type === 'astrolabe' ||
    options.type === 'qizheng';

  return {
    ...defaultInputState,
    name: definition.label,
    chartType: config.chartType,
    dateType: 'solar',
    year: String(context.wallClock.year),
    month: String(context.wallClock.month),
    day: String(context.wallClock.day),
    timeIndex: getTimeIndexFromClock(context.wallClock.hour, context.wallClock.minute),
    useTrueSolarTime: options.timeStandard === 'true-solar',
    ...(preciseTimeRequired
      ? {
          birthHour: String(context.wallClock.hour),
          birthMinute: String(context.wallClock.minute),
          birthPlace: context.observer?.locationName ?? '',
          birthLongitude:
            context.observer?.longitude === undefined ? '' : String(context.observer.longitude),
          birthLatitude:
            context.observer?.latitude === undefined ? '' : String(context.observer.latitude),
        }
      : {}),
  };
}

export function buildInstantResultPath(options: {
  type: InstantChartType;
  timeStandard: InstantTimeStandard;
  now?: Date;
  observer?: InstantObserver;
}) {
  const config = INSTANT_RESULT_CONFIG[options.type];
  const input = buildInstantQueryInput(options);
  const path = buildChartRecordPath(input, {
    ...defaultPromptState,
    tab: config.tab,
    promptSource: config.promptSource,
    ziweiScope: 'origin',
  });
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.set('instant', options.type);
  params.set(INSTANT_TIME_STANDARD_PARAM, options.timeStandard);
  params.delete('g');
  return `${pathname}?${params.toString()}`;
}

export function getInstantChartTypeForWorkspace(workspace: string): InstantChartType | undefined {
  return isInstantChartType(workspace) ? workspace : undefined;
}
