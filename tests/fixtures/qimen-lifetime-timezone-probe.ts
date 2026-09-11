import { calculateQimenLifetime } from '../../packages/core/src/divination/algorithms/qimen';

const result = calculateQimenLifetime({
  birthDateTime: '2024-01-02T00:30:00',
  timezone: 14,
  timeStandard: 'civil',
  periodRange: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  },
});

const ianaResult = calculateQimenLifetime({
  birthDateTime: '2023-01-15T14:30:00',
  timeZoneId: 'America/New_York',
  timeStandard: 'civil',
  periodRange: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  },
});

const summarizeClusters = (source: typeof result) =>
  source.eventClusters?.map((cluster) => ({
    key: cluster.key,
    stageIndex: cluster.stageIndex,
    supportEvidence: cluster.supportEvidence,
    counterEvidence: cluster.counterEvidence,
  }));

process.stdout.write(
  JSON.stringify({
    timestamp: result.baseChart.timestamp,
    solar: result.baseChart.timeInfo.solar,
    ganzhi: result.baseChart.ganzhi,
    seasonality: {
      currentJieQi: result.baseChart.seasonality?.currentJieQi,
      phase: result.baseChart.seasonality?.jieQiPhase.phase,
      lunarPhase: result.baseChart.seasonality?.lunarPhase,
      dayOfficer: result.baseChart.seasonality?.dayOfficer,
    },
    stageStart: result.stages[0]?.calendarStart,
    dynamicClusters: summarizeClusters(result),
    ianaDynamicClusters: summarizeClusters(ianaResult),
  }),
);
