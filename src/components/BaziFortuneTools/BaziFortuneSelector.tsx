import React, { useLayoutEffect, useMemo, useState } from 'react';
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
import {
  formatBaziTenGodAbbreviation,
  getCurrentLuckCycle,
  getWuxingClass,
  splitGanZhi,
} from './helpers';

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
  const ganTenGod = getTenGod(gan, props.dayMaster);
  const zhiTenGod = getTenGodForBranch(zhi, props.dayMaster);

  return (
    <div className="fortune-vertical-group">
      <div className="char-pair">
        <span className={`main-char ${getWuxingClass(gan)}`}>{gan}</span>
        <small className="sub-char" title={ganTenGod}>
          {formatBaziTenGodAbbreviation(ganTenGod)}
        </small>
      </div>
      <div className="char-pair">
        <span className={`main-char ${getWuxingClass(zhi)}`}>{zhi}</span>
        <small className="sub-char" title={zhiTenGod}>
          {formatBaziTenGodAbbreviation(zhiTenGod)}
        </small>
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

  const resolvedCycleIndex = result.luckInfo.cycles[selectedCycleIndex]
    ? selectedCycleIndex
    : currentCycleIndex;
  const selectedCycle = result.luckInfo.cycles[resolvedCycleIndex] ?? result.luckInfo.cycles[0];
  const yearOptions = useMemo(() => selectedCycle?.years ?? [], [selectedCycle]);
  const selectedYearOption =
    yearOptions.find((item) => item.year === selectedYear) ?? yearOptions[0];
  const resolvedYear = selectedYearOption?.year ?? 0;
  const monthOptions = useMemo(
    () => (resolvedYear ? getYearInfo(resolvedYear).months : []),
    [resolvedYear],
  );
  const resolvedMonth =
    selectedMonth >= 1 && selectedMonth <= monthOptions.length ? selectedMonth : 1;
  const selectedMonthOption = monthOptions[resolvedMonth - 1];
  const dayOptions = useMemo(
    () => (resolvedYear && resolvedMonth ? getMonthDaysInfo(resolvedYear, resolvedMonth) : []),
    [resolvedMonth, resolvedYear],
  );
  const selectedDayOption = dayOptions.find((item) => item.day === selectedDay) ?? dayOptions[0];
  const resolvedDay = selectedDayOption?.day ?? 1;
  const hourOptions = useMemo(() => {
    const solarDate = selectedDayOption?.solarDate;
    if (!solarDate) return [];
    const [year, month, day] = solarDate.split('-').map(Number);
    return getDayHourBreakdown(year, month, day);
  }, [selectedDayOption]);
  const resolvedHourIndex = hourOptions.length
    ? Math.min(Math.max(selectedHourIndex, 0), hourOptions.length - 1)
    : 0;
  const selectedHourOption = hourOptions[resolvedHourIndex];
  const displayColumns = useMemo(() => {
    const columns: BaziFortuneDisplayColumn[] = [];
    if (selectedCycle && isGanZhiPair(selectedCycle.ganZhi[0], selectedCycle.ganZhi[1])) {
      columns.push({
        key: 'dayun',
        label: '大运',
        caption: `${selectedCycle.age}岁起`,
        ganZhi: selectedCycle.ganZhi,
      });
    }
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
    return columns;
  }, [
    selectedCycle,
    selectedDayOption,
    selectedHourOption,
    selectedMonthOption,
    selectedYearOption,
  ]);

  useLayoutEffect(() => {
    onSelectionChange?.(displayColumns);
  }, [displayColumns, onSelectionChange]);

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
                  className={`fortune-item ${index === resolvedCycleIndex ? 'active' : ''}`}
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
                  className={`fortune-item ${item.year === resolvedYear ? 'active' : ''}`}
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
                  key={`${resolvedYear}-${item.month}-${item.ganZhi}`}
                  className={`fortune-item ${monthNumber === resolvedMonth ? 'active' : ''}`}
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
                  className={`fortune-item ${item.day === resolvedDay ? 'active' : ''}`}
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
                className={`fortune-item ${index === resolvedHourIndex ? 'active' : ''}`}
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
