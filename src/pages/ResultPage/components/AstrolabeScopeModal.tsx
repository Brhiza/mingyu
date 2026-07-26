import { useEffect, useMemo, useState } from 'react';
import type { AstrolabeScopeMode } from '@/lib/query-state';

const astrolabeScopeLabelMap: Record<AstrolabeScopeMode, string> = {
  natal: '本命',
  full: '完整输出',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
};

const ASTROLABE_SCOPE_MIN_YEAR = 1900;
const ASTROLABE_SCOPE_MAX_YEAR = 2200;

function getCurrentDateParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function parseDateParts(dateStr: string) {
  const matched = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(dateStr.trim());
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = matched[2] ? Number(matched[2]) : undefined;
  const day = matched[3] ? Number(matched[3]) : undefined;
  if (
    !Number.isInteger(year) ||
    year < ASTROLABE_SCOPE_MIN_YEAR ||
    year > ASTROLABE_SCOPE_MAX_YEAR
  ) {
    return null;
  }
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return null;
  }
  if (day !== undefined) {
    if (
      month === undefined ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > daysInMonth(year, month)
    ) {
      return null;
    }
  }

  return {
    year,
    month,
    day,
  };
}

function daysInMonth(year: number, month: number) {
  if (
    !Number.isInteger(year) ||
    year < ASTROLABE_SCOPE_MIN_YEAR ||
    year > ASTROLABE_SCOPE_MAX_YEAR
  ) {
    return 31;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return 31;
  }

  return new Date(year, month, 0).getDate();
}

function normalizeBirthYear(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) &&
    parsed >= ASTROLABE_SCOPE_MIN_YEAR &&
    parsed <= ASTROLABE_SCOPE_MAX_YEAR
    ? parsed
    : null;
}

function formatDateByScope(scope: AstrolabeScopeMode, year: number, month: number, day: number) {
  if (scope === 'yearly') {
    return String(year);
  }
  if (scope === 'monthly') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  if (scope === 'daily') {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return '';
}

export function AstrolabeScopeModal(props: {
  birthYear: string;
  selectedScope: AstrolabeScopeMode;
  selectedDateStr: string;
  onApply: (scope: AstrolabeScopeMode, dateStr: string) => void;
  onClose: () => void;
}) {
  const { birthYear, selectedScope, selectedDateStr, onApply, onClose } = props;
  const current = useMemo(() => getCurrentDateParts(), []);
  const parsedSelectedDate = parseDateParts(selectedDateStr);
  const initialYear = parsedSelectedDate?.year ?? current.year;
  const initialMonth = parsedSelectedDate?.month ?? current.month;
  const initialDay = parsedSelectedDate?.day ?? current.day;
  const [draftScope, setDraftScope] = useState<AstrolabeScopeMode>(selectedScope);
  const [draftYear, setDraftYear] = useState(initialYear);
  const [draftMonth, setDraftMonth] = useState(initialMonth);
  const [draftDay, setDraftDay] = useState(initialDay);

  useEffect(() => {
    const nextDate = parseDateParts(selectedDateStr);
    setDraftScope(selectedScope);
    setDraftYear(nextDate?.year ?? current.year);
    setDraftMonth(nextDate?.month ?? current.month);
    setDraftDay(nextDate?.day ?? current.day);
  }, [current.day, current.month, current.year, selectedDateStr, selectedScope]);

  const yearOptions = useMemo(() => {
    const normalizedBirthYear = normalizeBirthYear(birthYear);
    const startYear = normalizedBirthYear ?? current.year - 30;
    const endYear = Math.min(
      ASTROLABE_SCOPE_MAX_YEAR,
      Math.max(current.year + 10, startYear, draftYear),
    );
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
  }, [birthYear, current.year, draftYear]);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth(draftYear, draftMonth) }, (_, index) => index + 1),
    [draftMonth, draftYear],
  );
  const normalizedDraftDay = Math.min(draftDay, dayOptions.length || 1);
  const draftScopeDateStr = formatDateByScope(
    draftScope,
    draftYear,
    draftMonth,
    normalizedDraftDay,
  );
  const draftScopeDetailLabel =
    draftScope === 'natal' || draftScope === 'full'
      ? ''
      : draftScope === 'yearly'
        ? `${draftYear}年`
        : draftScope === 'monthly'
          ? `${draftYear}年${draftMonth}月`
          : `${draftYear}年${draftMonth}月${normalizedDraftDay}日`;
  const summaryText =
    draftScope === 'full'
      ? '本命盘与完整流年流月流日行运。'
      : draftScope === 'natal'
        ? '仅使用本命信息，不附加任何流年、流月或流日行运。'
        : `${astrolabeScopeLabelMap[draftScope]} ${draftScopeDetailLabel}，会写入对应行运相位证据。`;
  const quickActions: Array<{
    scope: Exclude<AstrolabeScopeMode, 'natal'>;
    label: string;
  }> = [
    { scope: 'yearly', label: '流年' },
    { scope: 'monthly', label: '流月' },
    { scope: 'daily', label: '流日' },
  ];
  const showMonthRow =
    draftScope === 'yearly' || draftScope === 'monthly' || draftScope === 'daily';
  const showDayRow = draftScope === 'monthly' || draftScope === 'daily';

  function applyCurrentScope(scope: Exclude<AstrolabeScopeMode, 'natal'>) {
    setDraftScope(scope);
    setDraftYear(current.year);
    setDraftMonth(current.month);
    setDraftDay(current.day);
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
                onClick={() => applyCurrentScope(item.scope)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="result-chip result-chip-highlight">
            {astrolabeScopeLabelMap[draftScope]}
          </span>
          {draftScopeDetailLabel ? (
            <span className="result-chip">{draftScopeDetailLabel}</span>
          ) : null}
        </div>

        <div className="fortune-modal-grid">
          <section className="fortune-modal-section">
            <div className="fortune-modal-section-head">
              <h3>流年</h3>
              <small>选具体年份后，可继续下钻到流月。</small>
            </div>
            <div className="fortune-modal-list">
              {yearOptions.map((year) => (
                <button
                  type="button"
                  key={year}
                  className={`fortune-modal-item ${
                    draftScope === 'yearly' && draftYear === year ? 'is-active is-selected' : ''
                  }`}
                  onClick={() => {
                    setDraftYear(year);
                    setDraftScope('yearly');
                  }}
                >
                  <strong>{year}年</strong>
                  <span>
                    {year === current.year ? '今年' : year > current.year ? '未来' : '过往'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {showMonthRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流月</h3>
                <small>第一项是流年；选具体月份后，可继续下钻到流日。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    draftScope === 'yearly' ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('yearly')}
                >
                  <strong>流年</strong>
                  <span>{draftYear}年</span>
                </button>
                {monthOptions.map((month) => (
                  <button
                    type="button"
                    key={month}
                    className={`fortune-modal-item ${
                      draftScope === 'monthly' && draftMonth === month
                        ? 'is-active is-selected'
                        : ''
                    }`}
                    onClick={() => {
                      setDraftMonth(month);
                      setDraftDay(Math.min(draftDay, daysInMonth(draftYear, month)));
                      setDraftScope('monthly');
                    }}
                  >
                    <strong>{month}月</strong>
                    <span>{`${draftYear}-${String(month).padStart(2, '0')}`}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {showDayRow ? (
            <section className="fortune-modal-section">
              <div className="fortune-modal-section-head">
                <h3>流日</h3>
                <small>第一项是流月；选具体日期时，只写这个流日本身。</small>
              </div>
              <div className="fortune-modal-list">
                <button
                  type="button"
                  className={`fortune-modal-item fortune-modal-item-overall ${
                    draftScope === 'monthly' ? 'is-selected is-active' : ''
                  }`}
                  onClick={() => setDraftScope('monthly')}
                >
                  <strong>流月</strong>
                  <span>
                    {draftYear}年{draftMonth}月
                  </span>
                </button>
                {dayOptions.map((day) => (
                  <button
                    type="button"
                    key={day}
                    className={`fortune-modal-item ${
                      draftScope === 'daily' && normalizedDraftDay === day
                        ? 'is-active is-selected'
                        : ''
                    }`}
                    onClick={() => {
                      setDraftDay(day);
                      setDraftScope('daily');
                    }}
                  >
                    <strong>{day}日</strong>
                    <span>
                      {String(draftMonth).padStart(2, '0')}/{String(day).padStart(2, '0')}
                    </span>
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
              onClick={() => setDraftScope('natal')}
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
                  draftScope === 'natal'
                    ? ''
                    : draftScope === 'full'
                      ? formatDateByScope('daily', draftYear, draftMonth, normalizedDraftDay)
                      : draftScopeDateStr,
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
