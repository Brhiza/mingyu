import { useEffect, useMemo, useState } from 'react';
import type { BaziFortuneScope } from '@/lib/query-state';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import {
  getBaziDayIndexByDate,
  getBaziMonthIndexByDate,
  getMonthDaysInfo,
  getYearInfo,
} from '@core/bazi/calendarTool';
import {
  buildFortuneSelectionContext,
  normalizeFortuneSelection,
  type BaziFortuneSelectionValue,
} from '@core/bazi/fortuneSelection';
import {
  isFortuneModalDetailOptionActive,
  isFortuneModalParentOptionActive,
} from '@core/bazi/fortuneModalSelection';
import { baziFortuneScopeLabelMap, formatBaziCycleDisplay, getCurrentLuckCycle } from './helpers';

export function BaziFortuneModal(props: {
  result: BaziChartResult;
  selection: BaziFortuneSelectionValue;
  onApply: (next: BaziFortuneSelectionValue) => void;
  onClose: () => void;
}) {
  const { result, selection, onApply, onClose } = props;
  const normalizedSelection = useMemo(
    () => normalizeFortuneSelection(result, selection),
    [result, selection],
  );
  const currentCycle = useMemo(() => getCurrentLuckCycle(result), [result]);
  const currentCycleIndex = useMemo(
    () =>
      Math.max(
        0,
        result.luckInfo.cycles.findIndex((item) => item === currentCycle),
      ),
    [currentCycle, result.luckInfo.cycles],
  );
  const now = useMemo(() => new Date(), []);
  const currentQuickYear = now.getFullYear();
  const currentQuickMonth = getBaziMonthIndexByDate(currentQuickYear, now) ?? 1;
  const currentQuickDay = getBaziDayIndexByDate(currentQuickYear, currentQuickMonth, now) ?? 1;
  const currentQuickSelection = useMemo(
    () => ({
      cycleIndex: currentCycleIndex,
      year: currentQuickYear,
      month: currentQuickMonth,
      day: currentQuickDay,
    }),
    [currentCycleIndex, currentQuickDay, currentQuickMonth, currentQuickYear],
  );
  const [draftScope, setDraftScope] = useState<BaziFortuneScope>(normalizedSelection.scope);
  const [draftCycleIndex, setDraftCycleIndex] = useState(normalizedSelection.cycleIndex ?? 0);
  const [draftYear, setDraftYear] = useState(normalizedSelection.year ?? 0);
  const [draftMonth, setDraftMonth] = useState(normalizedSelection.month ?? 1);
  const [draftDay, setDraftDay] = useState(normalizedSelection.day ?? 1);

  useEffect(() => {
    setDraftScope(normalizedSelection.scope);
    setDraftCycleIndex(normalizedSelection.cycleIndex ?? 0);
    setDraftYear(normalizedSelection.year ?? 0);
    setDraftMonth(normalizedSelection.month ?? 1);
    setDraftDay(normalizedSelection.day ?? 1);
  }, [normalizedSelection]);

  const selectedCycle = result.luckInfo.cycles[draftCycleIndex] ?? result.luckInfo.cycles[0];
  const yearOptions = useMemo(() => selectedCycle?.years ?? [], [selectedCycle]);
  const monthOptions = useMemo(() => (draftYear ? getYearInfo(draftYear).months : []), [draftYear]);
  const dayOptions = useMemo(
    () => (draftYear && draftMonth ? getMonthDaysInfo(draftYear, draftMonth) : []),
    [draftMonth, draftYear],
  );

  useEffect(() => {
    if (!yearOptions.length) return;
    if (!yearOptions.some((item) => item.year === draftYear)) {
      setDraftYear(yearOptions[0].year);
    }
  }, [draftYear, yearOptions]);

  useEffect(() => {
    if (!monthOptions.length) return;
    if (draftMonth < 1 || draftMonth > monthOptions.length) {
      setDraftMonth(1);
    }
  }, [draftMonth, monthOptions.length]);

  useEffect(() => {
    const maxDay = dayOptions.length;
    if (!maxDay) return;
    if (draftDay < 1 || draftDay > maxDay) {
      setDraftDay(1);
    }
  }, [dayOptions.length, draftDay]);

  const draftSelection = useMemo(
    () =>
      normalizeFortuneSelection(result, {
        scope: draftScope,
        cycleIndex: draftCycleIndex,
        year: draftYear || undefined,
        month: draftMonth || undefined,
        day: draftDay || undefined,
      }),
    [draftCycleIndex, draftDay, draftMonth, draftScope, draftYear, result],
  );
  const draftContext = useMemo(
    () => buildFortuneSelectionContext(result, draftSelection),
    [draftSelection, result],
  );
  const isDayunDetailActive = isFortuneModalDetailOptionActive('dayun', draftScope);
  const isYearOverallActive = isFortuneModalParentOptionActive('year', draftScope);
  const isYearDetailActive = isFortuneModalDetailOptionActive('year', draftScope);
  const isMonthOverallActive = isFortuneModalParentOptionActive('month', draftScope);
  const isMonthDetailActive = isFortuneModalDetailOptionActive('month', draftScope);
  const isDayOverallActive = isFortuneModalParentOptionActive('day', draftScope);
  const isDayDetailActive = isFortuneModalDetailOptionActive('day', draftScope);
  const summaryText = draftContext?.displayText ?? '仅使用本命信息，不附加任何大运流年流月流日。';
  const showYearRow = draftScope !== 'natal';
  const showMonthRow = draftScope === 'year' || draftScope === 'month' || draftScope === 'day';
  const showDayRow = draftScope === 'month' || draftScope === 'day';

  function handleJumpToCurrent(scope: BaziFortuneScope) {
    const nextSelection = normalizeFortuneSelection(result, {
      scope,
      cycleIndex: currentQuickSelection.cycleIndex,
      year: currentQuickSelection.year,
      month: currentQuickSelection.month,
      day: currentQuickSelection.day,
    });

    setDraftScope(nextSelection.scope);
    setDraftCycleIndex(nextSelection.cycleIndex ?? currentQuickSelection.cycleIndex);
    setDraftYear(nextSelection.year ?? 0);
    setDraftMonth(nextSelection.month ?? 1);
    setDraftDay(nextSelection.day ?? 1);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card bazi-fortune-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>选择年限</h2>
          </div>
        </div>

        <div className="draft-tip">
          <strong>当前将写入：</strong>
          {summaryText}
        </div>

        <div className="fortune-modal-summary-row">
          <span className="fortune-modal-quick-label">当前</span>
          <div className="fortune-modal-quick-actions">
            <button
              type="button"
              className="fortune-modal-quick-btn"
              onClick={() => handleJumpToCurrent('dayun')}
            >
              大运
            </button>
            <button
              type="button"
              className="fortune-modal-quick-btn"
              onClick={() => handleJumpToCurrent('year')}
            >
              流年
            </button>
            <button
              type="button"
              className="fortune-modal-quick-btn"
              onClick={() => handleJumpToCurrent('month')}
            >
              流月
            </button>
            <button
              type="button"
              className="fortune-modal-quick-btn"
              onClick={() => handleJumpToCurrent('day')}
            >
              流日
            </button>
          </div>
          <span className="result-chip result-chip-highlight">
            {baziFortuneScopeLabelMap[draftScope]}
          </span>
          {draftContext ? <span className="result-chip">{draftContext.displayLabel}</span> : null}
        </div>

        <div className="fortune-modal-grid">
          <section className="fortune-modal-section">
            <div className="fortune-modal-section-head">
              <h3>大运</h3>
              <small>先选某一步大运，才会展开下一排流年。</small>
            </div>
            <div className="fortune-modal-list">
              {result.luckInfo.cycles.map((cycle, index) => (
                <button
                  type="button"
                  key={`${cycle.year}-${cycle.ganZhi}-${cycle.age}`}
                  className={`fortune-modal-item ${
                    isDayunDetailActive && draftCycleIndex === index ? 'is-active is-selected' : ''
                  }`}
                  onClick={() => {
                    setDraftCycleIndex(index);
                    setDraftScope('dayun');
                  }}
                >
                  <strong>{formatBaziCycleDisplay(cycle.ganZhi, cycle.isXiaoyun)}</strong>
                  <span>{cycle.year} 年起</span>
                  <span>{cycle.age} 岁交运</span>
                </button>
              ))}
            </div>
          </section>

          {showYearRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流年</h3>
                <small>第一项是大运；选具体流年后，才会展开下一排流月。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    isYearOverallActive ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('dayun')}
                >
                  <strong>大运</strong>
                  <span>
                    {selectedCycle
                      ? formatBaziCycleDisplay(selectedCycle.ganZhi, selectedCycle.isXiaoyun)
                      : ''}
                  </span>
                </button>
                {yearOptions.map((item) => (
                  <button
                    type="button"
                    key={`${item.year}-${item.ganZhi}`}
                    className={`fortune-modal-item ${
                      isYearDetailActive && draftYear === item.year ? 'is-active is-selected' : ''
                    }`}
                    onClick={() => {
                      setDraftYear(item.year);
                      setDraftScope('year');
                    }}
                  >
                    <strong>{item.year}年</strong>
                    <span>{item.ganZhi}</span>
                    <span>{item.age} 岁</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {showMonthRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流月</h3>
                <small>第一项是流年；选具体流月后，才会展开下一排流日。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    isMonthOverallActive ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('year')}
                >
                  <strong>流年</strong>
                  <span>{draftYear}年</span>
                </button>
                {monthOptions.map((item, index) => {
                  const monthNumber = index + 1;
                  return (
                    <button
                      type="button"
                      key={`${draftYear}-${monthNumber}-${item.ganZhi}`}
                      className={`fortune-modal-item ${
                        isMonthDetailActive && draftMonth === monthNumber
                          ? 'is-active is-selected'
                          : ''
                      }`}
                      onClick={() => {
                        setDraftMonth(monthNumber);
                        setDraftScope('month');
                      }}
                    >
                      <strong>{monthNumber}月</strong>
                      <span>{item.month}</span>
                      <span>
                        {item.startDate} 至 {item.endDate}
                      </span>
                      <span>{item.ganZhi}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {showDayRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流日</h3>
                <small>第一项是流月；选具体流日时，只写这个流日本身。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    isDayOverallActive ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('month')}
                >
                  <strong>流月</strong>
                  <span>
                    {draftYear}年 {monthOptions[draftMonth - 1]?.month ?? ''}
                  </span>
                </button>
                {dayOptions.map((item) => (
                  <button
                    type="button"
                    key={item.solarDate}
                    className={`fortune-modal-item ${
                      isDayDetailActive && draftDay === item.day ? 'is-active is-selected' : ''
                    }`}
                    onClick={() => {
                      setDraftDay(item.day);
                      setDraftScope('day');
                    }}
                  >
                    <strong>{item.solarLabel}</strong>
                    <span>{item.ganZhi}</span>
                    <span>{item.lunar}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="modal-actions modal-actions-split">
          <div className="modal-actions-left">
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={() => {
                setDraftScope('natal');
              }}
            >
              仅用本命
            </button>
          </div>
          <div className="modal-actions-right">
            <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-primary"
              onClick={() => {
                onApply(draftSelection);
                onClose();
              }}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
