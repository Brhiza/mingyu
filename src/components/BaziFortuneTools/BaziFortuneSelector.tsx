import { useEffect, useMemo, useState } from 'react';
import type { BaziChartResult } from 'mingyu-core/bazi';
import {
  getBaziDayIndexByDate,
  getBaziMonthIndexByDate,
  getMonthDaysInfo,
  getTenGod,
  getTenGodForBranch,
  getYearInfo,
  isGanZhiPair,
} from 'mingyu-core/bazi';
import { getDayHourBreakdown } from '@core/bazi/fortuneSelection/helpers/breakdown';
import { getCurrentLuckCycle, getWuxingClass, splitGanZhi } from './helpers';

export type BaziFortuneDisplayColumn = {
  key: 'dayun' | 'year' | 'month' | 'day' | 'hour';
  label: string;
  caption: string;
  ganZhi: string;
};

function FortuneGanZhi(props: { ganZhi: string; dayMaster: string }) {
  if (!isGanZhiPair(props.ganZhi[0], props.ganZhi[1])) {
    return <div className="fortune-text-value">{props.ganZhi === '小运' ? '童运' : '—'}</div>;
  }
  const [gan, zhi] = splitGanZhi(props.ganZhi);

  return (
    <div className="fortune-vertical-group">
      <div className="char-pair">
        <span className={`main-char ${getWuxingClass(gan)}`}>{gan}</span>
        <small className="sub-char">{getTenGod(gan, props.dayMaster)}</small>
      </div>
      <div className="char-pair">
        <span className={`main-char ${getWuxingClass(zhi)}`}>{zhi}</span>
        <small className="sub-char">{getTenGodForBranch(zhi, props.dayMaster)}</small>
      </div>
    </div>
  );
}

function formatHourClockRange(index: number) {
  if (index === 0) return '23–01';
  const start = String(index * 2 - 1).padStart(2, '0');
  const end = String(index * 2 + 1).padStart(2, '0');
  return `${start}–${end}`;
}

export function BaziFortuneSelector(props: {
  result: BaziChartResult;
  onSelectionChange?: (columns: BaziFortuneDisplayColumn[]) => void;
}) {
  const { result, onSelectionChange } = props;
  const currentCycle = getCurrentLuckCycle(result);
  const currentCycleIndex = Math.max(
    0,
    result.luckInfo.cycles.findIndex((item) => item === currentCycle),
  );
  const now = new Date();
  const initialMonth = getBaziMonthIndexByDate(now.getFullYear(), now) ?? 1;
  const initialDay = getBaziDayIndexByDate(now.getFullYear(), initialMonth, now) ?? 1;
  const [selectedCycleIndex, setSelectedCycleIndex] = useState(currentCycleIndex);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [selectedHourIndex, setSelectedHourIndex] = useState(
    Math.floor(((now.getHours() + 1) % 24) / 2),
  );

  const selectedCycle = result.luckInfo.cycles[selectedCycleIndex] ?? result.luckInfo.cycles[0];
  const yearOptions = useMemo(() => selectedCycle?.years ?? [], [selectedCycle]);
  const monthOptions = useMemo(
    () => (selectedYear ? getYearInfo(selectedYear).months : []),
    [selectedYear],
  );
  const dayOptions = useMemo(
    () => (selectedYear && selectedMonth ? getMonthDaysInfo(selectedYear, selectedMonth) : []),
    [selectedMonth, selectedYear],
  );
  const selectedDayOption = dayOptions.find((item) => item.day === selectedDay);
  const hourOptions = useMemo(() => {
    const solarDate = selectedDayOption?.solarDate;
    if (!solarDate) return [];
    const [year, month, day] = solarDate.split('-').map(Number);
    return getDayHourBreakdown(year, month, day);
  }, [selectedDayOption]);
  const selectedMonthOption = monthOptions[selectedMonth - 1];
  const selectedHourOption = hourOptions[selectedHourIndex];

  useEffect(() => {
    if (!yearOptions.length) return;
    if (!yearOptions.some((item) => item.year === selectedYear)) {
      setSelectedYear(yearOptions[0].year);
    }
  }, [selectedYear, yearOptions]);

  useEffect(() => {
    if (!monthOptions.length) return;
    if (selectedMonth < 1 || selectedMonth > monthOptions.length) {
      setSelectedMonth(1);
    }
  }, [selectedMonth, monthOptions]);

  useEffect(() => {
    const maxDay = dayOptions.length;
    if (!maxDay) return;
    if (selectedDay > maxDay) {
      setSelectedDay(1);
    }
  }, [dayOptions.length, selectedDay]);

  useEffect(() => {
    if (!onSelectionChange) return;
    const columns: BaziFortuneDisplayColumn[] = [];
    if (selectedCycle && isGanZhiPair(selectedCycle.ganZhi[0], selectedCycle.ganZhi[1])) {
      columns.push({
        key: 'dayun',
        label: '大运',
        caption: `${selectedCycle.age}岁起`,
        ganZhi: selectedCycle.ganZhi,
      });
    }
    const selectedYearOption = yearOptions.find((item) => item.year === selectedYear);
    if (selectedYearOption) {
      columns.push({
        key: 'year',
        label: '流年',
        caption: String(selectedYearOption.year),
        ganZhi: selectedYearOption.ganZhi,
      });
    }
    if (selectedMonthOption) {
      columns.push({
        key: 'month',
        label: '流月',
        caption: selectedMonthOption.month,
        ganZhi: selectedMonthOption.ganZhi,
      });
    }
    if (selectedDayOption) {
      columns.push({
        key: 'day',
        label: '流日',
        caption: selectedDayOption.solarLabel,
        ganZhi: selectedDayOption.ganZhi,
      });
    }
    if (selectedHourOption) {
      columns.push({
        key: 'hour',
        label: '流时',
        caption: selectedHourOption.label,
        ganZhi: selectedHourOption.ganZhi,
      });
    }
    onSelectionChange(columns);
  }, [
    onSelectionChange,
    selectedCycle,
    selectedDayOption,
    selectedHourOption,
    selectedMonthOption,
    selectedYear,
    yearOptions,
  ]);

  function selectToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = getBaziMonthIndexByDate(year, today) ?? 1;
    const day = getBaziDayIndexByDate(year, month, today) ?? 1;
    setSelectedCycleIndex(currentCycleIndex);
    setSelectedYear(year);
    setSelectedMonth(month);
    setSelectedDay(day);
    setSelectedHourIndex(Math.floor(((today.getHours() + 1) % 24) / 2));
  }

  return (
    <section className="fortune-selector-card">
      <div className="fortune-selector-head">
        <span>岁运</span>
        <button
          type="button"
          className="fortune-today-button"
          aria-label="回到今天"
          title="回到今天"
          onClick={selectToday}
        >
          今
        </button>
      </div>
      <div className="fortune-grid">
        <div className="fortune-row">
          <div className="row-title">大运</div>
          <div className="fortune-container">
            {result.luckInfo.cycles.map((cycle, index) => {
              return (
                <button
                  type="button"
                  key={`${cycle.age}-${cycle.ganZhi}`}
                  className={`fortune-item ${index === selectedCycleIndex ? 'active' : ''}`}
                  onClick={() => setSelectedCycleIndex(index)}
                >
                  <div className="fortune-year">{cycle.year}</div>
                  <div className="fortune-age">{cycle.age}岁</div>
                  <FortuneGanZhi ganZhi={cycle.ganZhi} dayMaster={result.dayMaster.gan} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流年</div>
          <div className="fortune-container">
            {yearOptions.map((item) => {
              return (
                <button
                  type="button"
                  key={item.year}
                  className={`fortune-item ${item.year === selectedYear ? 'active' : ''}`}
                  onClick={() => setSelectedYear(item.year)}
                >
                  <div className="fortune-year">{item.year}</div>
                  <div className="fortune-age">{item.age}岁</div>
                  <FortuneGanZhi ganZhi={item.ganZhi} dayMaster={result.dayMaster.gan} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流月</div>
          <div className="fortune-container">
            {monthOptions.map((item, index) => {
              const monthNumber = index + 1;
              return (
                <button
                  type="button"
                  key={`${selectedYear}-${item.month}-${item.ganZhi}`}
                  className={`fortune-item ${monthNumber === selectedMonth ? 'active' : ''}`}
                  onClick={() => setSelectedMonth(monthNumber)}
                >
                  <div className="fortune-year">{item.month}</div>
                  <div className="fortune-age">{monthNumber}月</div>
                  <FortuneGanZhi ganZhi={item.ganZhi} dayMaster={result.dayMaster.gan} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流日</div>
          <div className="fortune-container">
            {dayOptions.map((item) => {
              return (
                <button
                  type="button"
                  key={item.solarDate}
                  className={`fortune-item ${item.day === selectedDay ? 'active' : ''}`}
                  onClick={() => setSelectedDay(item.day)}
                >
                  <div className="fortune-year">{item.solarLabel}</div>
                  <div className="fortune-age">{item.lunar}</div>
                  <FortuneGanZhi ganZhi={item.ganZhi} dayMaster={result.dayMaster.gan} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流时</div>
          <div className="fortune-container">
            {hourOptions.map((item, index) => (
              <button
                type="button"
                key={`${selectedDayOption?.solarDate}-${item.label}`}
                className={`fortune-item ${index === selectedHourIndex ? 'active' : ''}`}
                onClick={() => setSelectedHourIndex(index)}
                title={item.timeRange}
              >
                <div className="fortune-year">{item.label}</div>
                <div className="fortune-age">{formatHourClockRange(index)}</div>
                <FortuneGanZhi ganZhi={item.ganZhi} dayMaster={result.dayMaster.gan} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
