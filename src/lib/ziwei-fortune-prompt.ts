import {
  buildHoroscopeFromInput,
  calculateZiweiChart,
  findCurrentDecadalOption,
  shiftLunarYear,
} from 'mingyu-core/ziwei';
import type { ChartInput } from '@/types/chart';
import type { IztroHoroscope } from '@/types/iztro';

export interface ZiweiFortunePromptRequest {
  input: ChartInput;
  dateStr: string;
  hourIndex: number;
  all: boolean;
  key: string;
}

function compactScope(horoscope: IztroHoroscope, type: 'decadal' | 'yearly'): string {
  const scope = horoscope[type];
  const palaces = horoscope.astrolabe.palaces.map((p, index) => {
    const stars = scope.stars?.[index]?.map((s) => s.name).join('、');
    return `${scope.palaceNames[index]}→${p.name}${stars ? `(${stars})` : ''}`;
  });
  const mutagens = scope.mutagen
    .map((star, index) => `${star}${['禄', '权', '科', '忌'][index]}`)
    .join('、');
  return `${scope.name} ${scope.heavenlyStem}${scope.earthlyBranch}｜四化 ${mutagens}｜${palaces.join('；')}`;
}

export async function buildZiweiFortunePrompt(request: ZiweiFortunePromptRequest): Promise<string> {
  const { input, dateStr, hourIndex } = request;
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin', 'decadal'],
    skipAnalysis: true,
    horoscopeContext: { dateStr, hourIndex },
  });
  const current = findCurrentDecadalOption(
    runtime.decadalTimeline,
    runtime.payloadByScope.decadal.active_scope.nominal_age,
  );
  const periods = request.all ? runtime.decadalTimeline : current ? [current] : [];
  if (!periods.length) throw new Error('所选日期没有对应的大限资料，请重新选择时间。');
  const lines = [
    request.all ? '【全部大限与流年】' : '【所选阶段的大限与流年】',
    '宫位记法：动态宫→本命宫，括号内为流曜；年龄为虚岁。',
  ];
  for (const period of periods) {
    lines.push(
      `${period.label} ${period.startAge}～${period.endAge}岁｜${period.dateStr}～${period.endDateStr || ''}`,
    );
    for (let age = period.startAge; age <= period.endAge; age += 1) {
      const yearDate = shiftLunarYear(runtime.astrolabe.solarDate, age - 1);
      const horoscope = await buildHoroscopeFromInput(
        runtime.astrolabe,
        input,
        yearDate,
        hourIndex,
      );
      if (age === period.startAge) lines.push(compactScope(horoscope, 'decadal'));
      lines.push(`${age}岁｜取盘日 ${yearDate}｜${compactScope(horoscope, 'yearly')}`);
    }
  }
  return lines.join('\n');
}
