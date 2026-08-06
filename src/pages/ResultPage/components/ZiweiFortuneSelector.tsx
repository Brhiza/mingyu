import { useEffect, useMemo, useState } from 'react';
import {
  findCurrentDecadalOption,
  formatDecadalAgeRange,
  getDefaultHoroscopeContext,
} from 'mingyu-core/ziwei';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { DecadalTimelineOption } from 'mingyu-core/ziwei';
import { formatMonthDayLabel, splitGanZhi } from '../ResultPage.helpers';
import { useZiweiFortuneOptionsWorker } from '../hooks/useZiweiFortuneOptionsWorker';
import { BaziFortuneLoadingCard } from './skeletons';

export function ZiweiFortuneSelector(props: {
  chartInput: ChartInput;
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
  decadalTimeline: DecadalTimelineOption[];
  selectedScope: ScopeType;
  selectedDateStr: string;
  onSelectScopeDate: (scope: ScopeType, dateStr: string) => void;
}) {
  const {
    chartInput,
    payloadByScope,
    decadalTimeline,
    selectedScope,
    selectedDateStr,
    onSelectScopeDate,
  } = props;
  const defaultContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const originPayload = payloadByScope.origin;
  const birthSolarDate = originPayload.basic_info.solar_date;
  const decadalOptions = decadalTimeline;
  const initialDecadal = useMemo(
    () => findCurrentDecadalOption(decadalOptions, payloadByScope.yearly.active_scope.nominal_age),
    [decadalOptions, payloadByScope],
  );
  const [selectedDecadalIndex, setSelectedDecadalIndex] = useState(
    decadalOptions.findIndex((item) => item === initialDecadal),
  );
  const selectedDecadal = decadalOptions[selectedDecadalIndex] ?? null;
  const [selectedYearDateStr, setSelectedYearDateStr] = useState(selectedDateStr);
  const [selectedMonthDateStr, setSelectedMonthDateStr] = useState(selectedDateStr);

  const selectedDecadalForWorker = selectedDecadal
    ? {
        startAge: selectedDecadal.startAge,
        endAge: selectedDecadal.endAge,
        dateStr: selectedDecadal.dateStr,
      }
    : null;

  const {
    yearOptions,
    monthOptions,
    dayOptions,
    isLoading: isFortuneOptionsLoading,
    effectiveYearDateStr,
    effectiveMonthDateStr,
  } = useZiweiFortuneOptionsWorker(
    chartInput,
    birthSolarDate,
    defaultContext.hourIndex,
    selectedDecadalForWorker,
    selectedYearDateStr,
    selectedMonthDateStr,
    selectedDecadalIndex,
  );

  useEffect(() => {
    if (effectiveYearDateStr) {
      setSelectedYearDateStr(effectiveYearDateStr);
    }
  }, [effectiveYearDateStr]);

  useEffect(() => {
    if (effectiveMonthDateStr) {
      setSelectedMonthDateStr(effectiveMonthDateStr);
    }
  }, [effectiveMonthDateStr]);

  useEffect(() => {
    if (selectedDecadal && !yearOptions.some((item) => item.dateStr === selectedYearDateStr)) {
      setSelectedYearDateStr(yearOptions[0]?.dateStr ?? selectedDecadal.dateStr);
    }
  }, [selectedDecadal, selectedYearDateStr, yearOptions]);

  const selectedYearItem =
    yearOptions.find((item) => item.dateStr === selectedYearDateStr) ?? yearOptions[0];

  useEffect(() => {
    if (selectedYearItem && !monthOptions.some((item) => item.dateStr === selectedMonthDateStr)) {
      setSelectedMonthDateStr(monthOptions[0]?.dateStr ?? selectedYearItem.dateStr);
    }
  }, [monthOptions, selectedMonthDateStr, selectedYearItem]);

  if (
    isFortuneOptionsLoading &&
    yearOptions.length === 0 &&
    monthOptions.length === 0 &&
    dayOptions.length === 0
  ) {
    return <BaziFortuneLoadingCard />;
  }

  return (
    <section className="fortune-selector-card fortune-selector-card-ziwei">
      <div className="fortune-grid">
        <div className="fortune-row">
          <div className="row-title">大限</div>
          <div className="fortune-container">
            {decadalOptions.map((item, index) => {
              const isActive = selectedScope === 'decadal' && selectedDateStr === item.dateStr;
              return (
                <button
                  type="button"
                  key={`${item.label}-${item.startAge}`}
                  className={`fortune-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDecadalIndex(index);
                    onSelectScopeDate('decadal', item.dateStr);
                  }}
                >
                  <div className="fortune-year">{item.label}</div>
                  <div className="fortune-age">{formatDecadalAgeRange(item)}岁</div>
                  <div className="fortune-vertical-group">
                    <div className="fortune-text-chip">{formatMonthDayLabel(item.dateStr)}</div>
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
              const isActive = selectedScope === 'yearly' && selectedDateStr === item.dateStr;
              return (
                <button
                  type="button"
                  key={item.dateStr}
                  className={`fortune-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedYearDateStr(item.dateStr);
                    onSelectScopeDate('yearly', item.dateStr);
                  }}
                >
                  <div className="fortune-year">{item.year}</div>
                  <div className="fortune-age">{item.age}岁</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair">
                      <span className="main-char">{gan}</span>
                    </div>
                    <div className="char-pair">
                      <span className="main-char">{zhi}</span>
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
            {monthOptions.map((item) => {
              const [gan, zhi] = splitGanZhi(item.ganZhi);
              const isActive = selectedScope === 'monthly' && selectedDateStr === item.dateStr;
              return (
                <button
                  type="button"
                  key={item.dateStr}
                  className={`fortune-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMonthDateStr(item.dateStr);
                    onSelectScopeDate('monthly', item.dateStr);
                  }}
                >
                  <div className="fortune-year">{item.label}</div>
                  <div className="fortune-age">{formatMonthDayLabel(item.dateStr)}</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair">
                      <span className="main-char">{gan}</span>
                    </div>
                    <div className="char-pair">
                      <span className="main-char">{zhi}</span>
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
              const isActive = selectedScope === 'daily' && selectedDateStr === item.dateStr;
              return (
                <button
                  type="button"
                  key={item.dateStr}
                  className={`fortune-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectScopeDate('daily', item.dateStr)}
                >
                  <div className="fortune-year">{item.day}</div>
                  <div className="fortune-age">{item.label}</div>
                  <div className="fortune-vertical-group">
                    <div className="char-pair">
                      <span className="main-char">{gan}</span>
                    </div>
                    <div className="char-pair">
                      <span className="main-char">{zhi}</span>
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
