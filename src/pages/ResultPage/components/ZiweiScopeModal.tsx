import { useEffect, useMemo, useState } from 'react';
import {
  findCurrentDecadalOption,
  formatDecadalAgeRange,
  getDefaultHoroscopeContext,
} from 'mingyu-core/ziwei';
import { type ZiweiScopeMode } from '@/lib/query-state';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { DecadalTimelineOption } from 'mingyu-core/ziwei';
import { ziweiScopeLabelMap } from '../ResultPage.constants';
import { useZiweiFortuneOptionsWorker } from '../hooks/useZiweiFortuneOptionsWorker';
import {
  buildZiweiMonthAnchorDate,
  findZiweiDayOptionDate,
  findZiweiDecadalIndexByDate,
  findZiweiMonthOptionDate,
  findZiweiYearOptionDate,
  formatMonthDayLabel,
  formatZiweiPromptScopeSummary,
} from '../ResultPage.helpers';
import { BaziFortuneLoadingCard } from './skeletons';

export function ZiweiScopeModal(props: {
  chartInput: ChartInput;
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
  decadalTimeline: DecadalTimelineOption[];
  selectedScope: ZiweiScopeMode;
  selectedDateStr: string;
  onApply: (scope: ZiweiScopeMode, dateStr: string) => void;
  onClose: () => void;
}) {
  const {
    chartInput,
    payloadByScope,
    decadalTimeline,
    selectedScope,
    selectedDateStr,
    onApply,
    onClose,
  } = props;
  const defaultContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const normalizedSelectedScope: Exclude<ZiweiScopeMode, 'hourly'> =
    selectedScope === 'hourly' ? 'daily' : selectedScope;
  const originPayload = payloadByScope.origin;
  const birthSolarDate = originPayload.basic_info.solar_date;
  const decadalOptions = decadalTimeline;
  const currentDecadal = useMemo(
    () => findCurrentDecadalOption(decadalOptions, payloadByScope.yearly.active_scope.nominal_age),
    [decadalOptions, payloadByScope.yearly.active_scope.nominal_age],
  );
  const currentDecadalIndex = useMemo(
    () => decadalOptions.findIndex((item) => item === currentDecadal),
    [currentDecadal, decadalOptions],
  );
  const fallbackScopeDateStr =
    selectedDateStr ||
    payloadByScope.daily.active_scope.solar_date ||
    payloadByScope.monthly.active_scope.solar_date ||
    payloadByScope.yearly.active_scope.solar_date ||
    defaultContext.dateStr;
  const initialDecadalIndex = useMemo(
    () => findZiweiDecadalIndexByDate(decadalOptions, fallbackScopeDateStr, currentDecadalIndex),
    [currentDecadalIndex, decadalOptions, fallbackScopeDateStr],
  );
  const [draftScope, setDraftScope] =
    useState<Exclude<ZiweiScopeMode, 'hourly'>>(normalizedSelectedScope);
  const [draftDecadalIndex, setDraftDecadalIndex] = useState(initialDecadalIndex);
  const [draftYearDateStr, setDraftYearDateStr] = useState(fallbackScopeDateStr);
  const [draftMonthDateStr, setDraftMonthDateStr] = useState(
    buildZiweiMonthAnchorDate(fallbackScopeDateStr),
  );
  const [draftDayDateStr, setDraftDayDateStr] = useState(fallbackScopeDateStr);
  useEffect(() => {
    setDraftScope(normalizedSelectedScope);
    setDraftDecadalIndex(initialDecadalIndex);
    setDraftYearDateStr(fallbackScopeDateStr);
    setDraftMonthDateStr(buildZiweiMonthAnchorDate(fallbackScopeDateStr));
    setDraftDayDateStr(fallbackScopeDateStr);
  }, [fallbackScopeDateStr, initialDecadalIndex, normalizedSelectedScope]);

  const selectedDecadal = decadalOptions[draftDecadalIndex] ?? null;
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
  } = useZiweiFortuneOptionsWorker(
    chartInput,
    birthSolarDate,
    defaultContext.hourIndex,
    selectedDecadalForWorker,
    draftYearDateStr,
    draftMonthDateStr,
    draftDecadalIndex,
  );

  useEffect(() => {
    if (!yearOptions.length) {
      return;
    }
    if (yearOptions.some((item) => item.dateStr === draftYearDateStr)) {
      return;
    }

    const matchedDateStr = findZiweiYearOptionDate(yearOptions, draftYearDateStr);
    if (matchedDateStr && matchedDateStr !== draftYearDateStr) {
      setDraftYearDateStr(matchedDateStr);
    }
  }, [draftYearDateStr, yearOptions]);

  useEffect(() => {
    if (!monthOptions.length) {
      return;
    }
    if (monthOptions.some((item) => item.dateStr === draftMonthDateStr)) {
      return;
    }

    const matchedDateStr = findZiweiMonthOptionDate(
      monthOptions,
      draftMonthDateStr || draftYearDateStr,
    );
    if (matchedDateStr && matchedDateStr !== draftMonthDateStr) {
      setDraftMonthDateStr(matchedDateStr);
    }
  }, [draftMonthDateStr, draftYearDateStr, monthOptions]);

  useEffect(() => {
    if (!dayOptions.length) {
      return;
    }
    if (dayOptions.some((item) => item.dateStr === draftDayDateStr)) {
      return;
    }

    const matchedDateStr = findZiweiDayOptionDate(dayOptions, draftDayDateStr || draftMonthDateStr);
    if (matchedDateStr && matchedDateStr !== draftDayDateStr) {
      setDraftDayDateStr(matchedDateStr);
    }
  }, [dayOptions, draftDayDateStr, draftMonthDateStr]);

  const selectedYearItem =
    yearOptions.find((item) => item.dateStr === draftYearDateStr) ?? yearOptions[0];
  const selectedMonthItem =
    monthOptions.find((item) => item.dateStr === draftMonthDateStr) ?? monthOptions[0];
  const selectedDayItem =
    dayOptions.find((item) => item.dateStr === draftDayDateStr) ?? dayOptions[0];
  const quickActions: Array<{
    scope: Exclude<ZiweiScopeMode, 'origin' | 'hourly' | 'full'>;
    label: string;
  }> = [
    { scope: 'decadal', label: '大限' },
    { scope: 'yearly', label: '流年' },
    { scope: 'monthly', label: '流月' },
    { scope: 'daily', label: '流日' },
  ];
  const quickScopeDateMap: Record<Exclude<ZiweiScopeMode, 'origin' | 'hourly' | 'full'>, string> = {
    decadal: payloadByScope.decadal.active_scope.solar_date,
    yearly: payloadByScope.yearly.active_scope.solar_date,
    monthly: payloadByScope.monthly.active_scope.solar_date,
    daily: payloadByScope.daily.active_scope.solar_date,
  };
  const draftScopeDateStr = (() => {
    switch (draftScope) {
      case 'origin':
        return '';
      case 'decadal':
        return selectedDecadal?.dateStr ?? '';
      case 'yearly':
        return selectedYearItem?.dateStr ?? draftYearDateStr ?? '';
      case 'monthly':
        return selectedMonthItem?.dateStr ?? draftMonthDateStr ?? draftYearDateStr ?? '';
      case 'daily':
        return (
          selectedDayItem?.dateStr ?? draftDayDateStr ?? draftMonthDateStr ?? draftYearDateStr ?? ''
        );
      default:
        return '';
    }
  })();
  const draftScopeDetailLabel = (() => {
    switch (draftScope) {
      case 'origin':
        return '';
      case 'decadal':
        return selectedDecadal
          ? `${selectedDecadal.label} ${formatDecadalAgeRange(selectedDecadal)}岁`
          : '';
      case 'yearly':
        return selectedYearItem ? `${selectedYearItem.year}年 ${selectedYearItem.ganZhi}` : '';
      case 'monthly':
        return selectedMonthItem ? `${selectedMonthItem.label} ${selectedMonthItem.ganZhi}` : '';
      case 'daily':
        return selectedDayItem ? `${selectedDayItem.label} ${selectedDayItem.ganZhi}` : '';
      default:
        return '';
    }
  })();
  const summaryText =
    draftScope === 'full'
      ? '本命盘与完整大限流年流月流日流时。'
      : draftScope === 'origin'
        ? '仅使用本命信息，不附加任何大限流年流月流日。'
        : formatZiweiPromptScopeSummary(draftScope, draftScopeDateStr, draftScopeDetailLabel);
  const isDecadalDetailActive = draftScope === 'decadal';
  const isYearOverallActive = draftScope === 'decadal';
  const isYearDetailActive = draftScope === 'yearly';
  const isMonthOverallActive = draftScope === 'yearly';
  const isMonthDetailActive = draftScope === 'monthly';
  const isDayOverallActive = draftScope === 'monthly';
  const isDayDetailActive = draftScope === 'daily';
  const showYearRow = draftScope !== 'origin' && draftScope !== 'full';
  const showMonthRow = ['yearly', 'monthly', 'daily'].includes(draftScope);
  const showDayRow = ['monthly', 'daily'].includes(draftScope);

  function handleJumpToCurrent(scope: Exclude<ZiweiScopeMode, 'origin' | 'hourly' | 'full'>) {
    const nextDateStr = quickScopeDateMap[scope] || defaultContext.dateStr;
    setDraftScope(scope);
    setDraftDecadalIndex(
      findZiweiDecadalIndexByDate(decadalOptions, nextDateStr, currentDecadalIndex),
    );
    setDraftYearDateStr(nextDateStr);
    setDraftMonthDateStr(buildZiweiMonthAnchorDate(nextDateStr));
    setDraftDayDateStr(nextDateStr);
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
            {quickActions.map((item) => (
              <button
                type="button"
                key={item.scope}
                className={`fortune-modal-quick-btn ${draftScope === item.scope ? 'is-active' : ''}`}
                onClick={() => handleJumpToCurrent(item.scope)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="result-chip result-chip-highlight">
            {ziweiScopeLabelMap[draftScope]}
          </span>
          {draftScopeDetailLabel ? (
            <span className="result-chip">{draftScopeDetailLabel}</span>
          ) : null}
        </div>

        <div className="fortune-modal-grid">
          <section className="fortune-modal-section">
            <div className="fortune-modal-section-head">
              <h3>大限</h3>
              <small>先选某一步大限，才会展开下一排流年。</small>
            </div>
            <div className="fortune-modal-list">
              {decadalOptions.map((item, index) => (
                <button
                  type="button"
                  key={`${item.label}-${item.startAge}-${item.endAge}`}
                  className={`fortune-modal-item ${
                    isDecadalDetailActive && draftDecadalIndex === index
                      ? 'is-active is-selected'
                      : ''
                  }`}
                  onClick={() => {
                    setDraftDecadalIndex(index);
                    setDraftScope('decadal');
                  }}
                >
                  <strong>{formatDecadalAgeRange(item)}岁</strong>
                  <span>{item.label}</span>
                  <span>{item.dateStr} 取盘</span>
                </button>
              ))}
            </div>
          </section>

          {showYearRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流年</h3>
                <small>第一项是大限；选具体流年后，才会展开下一排流月。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    isYearOverallActive ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('decadal')}
                >
                  <strong>大限</strong>
                  <span>
                    {selectedDecadal
                      ? `${selectedDecadal.label} ${formatDecadalAgeRange(selectedDecadal)}岁`
                      : ''}
                  </span>
                </button>
                {yearOptions.map((item) => (
                  <button
                    type="button"
                    key={item.dateStr}
                    className={`fortune-modal-item ${
                      isYearDetailActive && draftYearDateStr === item.dateStr
                        ? 'is-active is-selected'
                        : ''
                    }`}
                    onClick={() => {
                      setDraftYearDateStr(item.dateStr);
                      setDraftMonthDateStr(buildZiweiMonthAnchorDate(item.dateStr));
                      setDraftDayDateStr(item.dateStr);
                      setDraftScope('yearly');
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
                  onClick={() => setDraftScope('yearly')}
                >
                  <strong>流年</strong>
                  <span>{selectedYearItem ? `${selectedYearItem.year}年` : ''}</span>
                </button>
                {monthOptions.map((item) => (
                  <button
                    type="button"
                    key={item.dateStr}
                    className={`fortune-modal-item ${
                      isMonthDetailActive && draftMonthDateStr === item.dateStr
                        ? 'is-active is-selected'
                        : ''
                    }`}
                    onClick={() => {
                      setDraftMonthDateStr(item.dateStr);
                      setDraftDayDateStr(item.dateStr);
                      setDraftScope('monthly');
                    }}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.ganZhi}</span>
                    <span>{formatMonthDayLabel(item.dateStr)}</span>
                  </button>
                ))}
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
                  onClick={() => setDraftScope('monthly')}
                >
                  <strong>流月</strong>
                  <span>{selectedMonthItem ? selectedMonthItem.label : ''}</span>
                </button>
                {dayOptions.map((item) => (
                  <button
                    type="button"
                    key={item.dateStr}
                    className={`fortune-modal-item ${
                      isDayDetailActive && draftDayDateStr === item.dateStr
                        ? 'is-active is-selected'
                        : ''
                    }`}
                    onClick={() => {
                      setDraftDayDateStr(item.dateStr);
                      setDraftScope('daily');
                    }}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.ganZhi}</span>
                    <span>{item.day} 日</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {isFortuneOptionsLoading &&
        yearOptions.length === 0 &&
        monthOptions.length === 0 &&
        dayOptions.length === 0 ? (
          <BaziFortuneLoadingCard />
        ) : null}

        <div className="modal-actions modal-actions-split">
          <div className="modal-actions-left">
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={() => setDraftScope('origin')}
            >
              仅用本命
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={() => setDraftScope('full')}
            >
              完整输出版
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
                onApply(
                  draftScope,
                  draftScope === 'origin' || draftScope === 'full' ? '' : draftScopeDateStr,
                );
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
