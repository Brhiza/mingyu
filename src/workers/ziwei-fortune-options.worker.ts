import { buildAstrolabeFromInput, buildHoroscope, shiftLunarYear } from '@core/ziwei/iztro';
import type { ChartInput } from '@/types/chart';

type DecadalOptionInput = {
  startAge: number;
  endAge: number;
  dateStr: string;
};

type YearOption = {
  year: number;
  age: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};

type MonthOption = {
  month: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};

type DayOption = {
  day: number;
  dateStr: string;
  label: string;
  ganZhi: string;
};

type ZiweiFortuneOptionsRequest = {
  id: string;
  input: ChartInput;
  birthSolarDate: string;
  hourIndex: number;
  selectedDecadal: DecadalOptionInput | null;
  selectedYearDateStr: string;
  selectedMonthDateStr: string;
};

type ZiweiFortuneOptionsResponse =
  | {
      id: string;
      ok: true;
      yearOptions: YearOption[];
      monthOptions: MonthOption[];
      dayOptions: DayOption[];
      effectiveYearDateStr: string;
      effectiveMonthDateStr: string;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };

function getDateParts(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatMonthDayLabel(dateStr: string) {
  const [, month, day] = dateStr.split('-');
  return `${month}/${day}`;
}

self.onmessage = async (event: MessageEvent<ZiweiFortuneOptionsRequest>) => {
  try {
    if (!event.data.selectedDecadal) {
      const emptyResponse: ZiweiFortuneOptionsResponse = {
        id: event.data.id,
        ok: true,
        yearOptions: [],
        monthOptions: [],
        dayOptions: [],
        effectiveYearDateStr: '',
        effectiveMonthDateStr: '',
      };
      self.postMessage(emptyResponse);
      return;
    }

    const astrolabe = await buildAstrolabeFromInput(event.data.input);
    const yearOptions: YearOption[] = [];

    for (
      let age = event.data.selectedDecadal.startAge;
      age <= event.data.selectedDecadal.endAge;
      age += 1
    ) {
      const dateStr = shiftLunarYear(event.data.birthSolarDate, age - 1);
      const horoscope = buildHoroscope(astrolabe, dateStr, event.data.hourIndex);
      const year = getDateParts(dateStr).year;
      yearOptions.push({
        year,
        age,
        dateStr,
        label: `${year}年`,
        ganZhi: `${horoscope.yearly.heavenlyStem}${horoscope.yearly.earthlyBranch}`,
      });
    }

    const effectiveYearDateStr =
      yearOptions.find((item) => item.dateStr === event.data.selectedYearDateStr)?.dateStr ??
      yearOptions[0]?.dateStr ??
      '';

    const monthOptions: MonthOption[] = effectiveYearDateStr
      ? Array.from({ length: 12 }, (_, index) => {
          const { year } = getDateParts(effectiveYearDateStr);
          const dateStr = `${year}-${String(index + 1).padStart(2, '0')}-15`;
          const horoscope = buildHoroscope(astrolabe, dateStr, event.data.hourIndex);
          const monthNumber = index + 1;
          return {
            month: monthNumber,
            dateStr,
            label: `${monthNumber}月`,
            ganZhi: `${horoscope.monthly.heavenlyStem}${horoscope.monthly.earthlyBranch}`,
          };
        })
      : [];

    const effectiveMonthDateStr =
      monthOptions.find((item) => item.dateStr === event.data.selectedMonthDateStr)?.dateStr ??
      monthOptions[0]?.dateStr ??
      '';

    const dayOptions: DayOption[] = effectiveMonthDateStr
      ? Array.from(
          {
            length: getDaysInMonth(
              getDateParts(effectiveMonthDateStr).year,
              getDateParts(effectiveMonthDateStr).month,
            ),
          },
          (_, index) => {
            const { year, month } = getDateParts(effectiveMonthDateStr);
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
            const horoscope = buildHoroscope(astrolabe, dateStr, event.data.hourIndex);
            return {
              day: index + 1,
              dateStr,
              label: formatMonthDayLabel(dateStr),
              ganZhi: `${horoscope.daily.heavenlyStem}${horoscope.daily.earthlyBranch}`,
            };
          },
        )
      : [];

    const response: ZiweiFortuneOptionsResponse = {
      id: event.data.id,
      ok: true,
      yearOptions,
      monthOptions,
      dayOptions,
      effectiveYearDateStr,
      effectiveMonthDateStr,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ZiweiFortuneOptionsResponse = {
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : '紫微运限选项计算失败。',
    };
    self.postMessage(response);
  }
};
