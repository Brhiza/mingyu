import { buildZiweiFortuneOptions } from 'mingyu-core/ziwei';
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

    const result = await buildZiweiFortuneOptions(event.data.input, event.data.selectedDecadal, {
      birthSolarDate: event.data.birthSolarDate,
      hourIndex: event.data.hourIndex,
      selectedYearDateStr: event.data.selectedYearDateStr,
      selectedMonthDateStr: event.data.selectedMonthDateStr,
    });

    const response: ZiweiFortuneOptionsResponse = {
      id: event.data.id,
      ok: true,
      ...result,
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
