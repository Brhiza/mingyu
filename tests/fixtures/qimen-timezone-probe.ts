import { generateQimen } from '../../packages/core/src/divination/algorithms/qimen/index';
import { getJieQiPhaseByDate } from '../../packages/core/src/divination/algorithms/qimen/helpers/seasonality';
import { TimeManager } from '../../packages/core/src/calendar/timeManager';

TimeManager.setTimezoneOffsetMinutesOverride(480);

const input = new Date('2024-02-10T04:00:30.000Z');
const chart = generateQimen(input);
const termBoundary = getJieQiPhaseByDate(new Date('2024-02-04T08:27:08.000Z'));

process.stdout.write(
  JSON.stringify({
    inputTimestamp: input.getTime(),
    chartTimestamp: chart.timestamp,
    civil: TimeManager.getWallClockParts(input),
    chartSolarTerm: chart.timeInfo.solarTerm,
    seasonality: {
      currentJieQi: chart.seasonality?.currentJieQi,
      jieQi: chart.seasonality?.jieQiPhase.jieQi,
      solarTermEvidenceUtcDateTime: chart.seasonality?.jieQiPhase.solarTermEvidence.utcDateTime,
      moonPhaseUtcTimestamp: chart.seasonality?.moonPhaseEvidence.utcTimestamp,
      moonPhaseUtcDateTime: chart.seasonality?.moonPhaseEvidence.utcDateTime,
    },
    termBoundary: {
      jieQi: termBoundary.jieQi,
      solarTermEvidenceUtcDateTime: termBoundary.solarTermEvidence.utcDateTime,
    },
  }),
);
