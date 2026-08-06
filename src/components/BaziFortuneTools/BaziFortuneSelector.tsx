import { useEffect, useMemo, useState } from 'react';
import type { BaziChartResult } from 'mingyu-core/bazi';
import {
  getBaziDayIndexByDate,
  getBaziMonthIndexByDate,
  getMonthDaysInfo,
  getYearInfo,
} from 'mingyu-core/bazi';
import { getCurrentLuckCycle, getWuxingClass, splitGanZhi } from './helpers';

export function BaziFortuneSelector(props: { result: BaziChartResult }) {
  const { result } = props;
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

  return (
    <section className="fortune-selector-card">
      <div className="fortune-grid">
        <div className="fortune-row">
          <div className="row-title">大运</div>
          <div className="fortune-container">
            {result.luckInfo.cycles.map((cycle, index) => {
              const [gan, zhi] = splitGanZhi(cycle.ganZhi);
              return (
                <button
                  type="button"
                  key={`${cycle.age}-${cycle.ganZhi}`}
                  className={`fortune-item ${index === selectedCycleIndex ? 'active' : ''}`}
                  onClick={() => setSelectedCycleIndex(index)}
                >
                  <div className="fortune-year">{cycle.year}</div>
                  <div className="fortune-age">{cycle.age}岁</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair">
                      <span className={`main-char ${getWuxingClass(gan)}`}>{gan}</span>
                    </div>
                    <div className="char-pair">
                      <span className={`main-char ${getWuxingClass(zhi)}`}>{zhi}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流年</div>
          <div className="fortune-container">
            {yearOptions.map((item) => {
              const [gan, zhi] = splitGanZhi(item.ganZhi);
              return (
                <button
                  type="button"
                  key={item.year}
                  className={`fortune-item ${item.year === selectedYear ? 'active' : ''}`}
                  onClick={() => setSelectedYear(item.year)}
                >
                  <div className="fortune-year">{item.year}</div>
                  <div className="fortune-age">{item.age}岁</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair">
                      <span className={`main-char ${getWuxingClass(gan)}`}>{gan}</span>
                    </div>
                    <div className="char-pair">
                      <span className={`main-char ${getWuxingClass(zhi)}`}>{zhi}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流月</div>
          <div className="fortune-container">
            {monthOptions.map((item, index) => {
              const [gan, zhi] = splitGanZhi(item.ganZhi);
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
                  <div className="fortune-vertical-group">
                    <div className="char-pair">
                      <span className={`main-char ${getWuxingClass(gan)}`}>{gan}</span>
                    </div>
                    <div className="char-pair">
                      <span className={`main-char ${getWuxingClass(zhi)}`}>{zhi}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fortune-row">
          <div className="row-title">流日</div>
          <div className="fortune-container">
            {dayOptions.map((item) => {
              const [gan, zhi] = splitGanZhi(item.ganZhi);
              return (
                <button
                  type="button"
                  key={item.solarDate}
                  className={`fortune-item ${item.day === selectedDay ? 'active' : ''}`}
                  onClick={() => setSelectedDay(item.day)}
                >
                  <div className="fortune-year">{item.solarLabel}</div>
                  <div className="fortune-age">{item.lunar}</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair">
                      <span className={`main-char ${getWuxingClass(gan)}`}>{gan}</span>
                    </div>
                    <div className="char-pair">
                      <span className={`main-char ${getWuxingClass(zhi)}`}>{zhi}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
