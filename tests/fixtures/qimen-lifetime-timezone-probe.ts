import { calculateQimenLifetime } from '../../packages/core/src/divination/algorithms/qimen';

const result = calculateQimenLifetime({
  birthDateTime: '2024-01-02T00:30:00',
  timezone: 14,
  timeStandard: 'civil',
});

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
  }),
);
