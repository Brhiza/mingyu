import { memo, type ReactNode } from 'react';
import { DropdownSelect } from '@/components/DropdownSelect';
import { SegmentedControl } from '@/components/SegmentedControl';
import { BIRTH_TIME_OPTIONS, getBirthTimeDropdownOptions } from '@/lib/birth-time';
import { getPersonSectionTitle } from '@/lib/input-labels';
import type { QueryInputState } from '@/lib/query-state';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { isValidHourMinute } from '@/lib/input-validation';
import { getPersonValue, type SELF_FIELD_MAP } from './InputPage.field-helpers';
import type { PersonRole } from './InputPage.field-helpers';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';

import type { PersonInputMode } from './InputPage.field-helpers';
export type { PersonInputMode } from './InputPage.field-helpers';

function getTrueSolarTimeLabel(form: QueryInputState, role: PersonRole) {
  const rawHour = getPersonValue(form, role, 'birthHour');
  const rawMinute = getPersonValue(form, role, 'birthMinute');

  // 空串转 Number 得 0，但未填写时应视为无效输入而非 00:00
  if (rawHour === '' || rawMinute === '') {
    return '';
  }

  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (!isValidHourMinute(hour, minute)) {
    return '';
  }

  const timeIndex = getTimeIndexFromClock(hour, minute);
  const matched = BIRTH_TIME_OPTIONS[timeIndex];
  return matched ? `当前对应时辰：${matched.label}（${matched.range}）` : '';
}

export interface PersonFormProps {
  role: PersonRole;
  form: QueryInputState;
  updatePersonField: (
    role: PersonRole,
    key: keyof typeof SELF_FIELD_MAP,
    value: QueryInputState[keyof QueryInputState],
  ) => void;
  updateNumericField: (
    role: PersonRole,
    key: 'year' | 'month' | 'day' | 'birthHour' | 'birthMinute',
    value: string,
  ) => void;
  updateBirthTime: (role: PersonRole, value: string) => void;
  openBirthPlaceModal: (role: PersonRole) => void;
  sectionTitle?: string;
  headerAction?: ReactNode;
  footerHint?: ReactNode;
  forcePreciseBirthPlace?: boolean;
  showNameField?: boolean;
  inputMode?: PersonInputMode;
  onInputModeChange?: (mode: PersonInputMode) => void;
  reversePanel?: ReactNode;
  reverseSource?: BaziReverseSource | null;
  allowUnknownTime?: boolean;
}

export const PersonForm = memo(function PersonForm({
  role,
  form,
  updatePersonField,
  updateNumericField,
  updateBirthTime,
  openBirthPlaceModal,
  sectionTitle,
  headerAction,
  footerHint,
  forcePreciseBirthPlace = false,
  showNameField = true,
  inputMode,
  onInputModeChange,
  reversePanel,
  reverseSource = null,
  allowUnknownTime = false,
}: PersonFormProps) {
  const birthTimeValue =
    getPersonValue(form, role, 'birthHour') !== '' &&
    getPersonValue(form, role, 'birthMinute') !== ''
      ? `${String(getPersonValue(form, role, 'birthHour')).padStart(2, '0')}:${String(
          getPersonValue(form, role, 'birthMinute'),
        ).padStart(2, '0')}${
          getPersonValue(form, role, 'birthSecond') !== ''
            ? `:${String(getPersonValue(form, role, 'birthSecond')).padStart(2, '0')}`
            : ''
        }`
      : '';
  const effectiveInputMode =
    inputMode ?? (getPersonValue(form, role, 'dateType') === 'lunar' ? 'lunar' : 'solar');
  const isLunar = getPersonValue(form, role, 'dateType') === 'lunar';
  const useTrueSolarTime = Boolean(getPersonValue(form, role, 'useTrueSolarTime'));
  const trueSolarTimeLabel = getTrueSolarTimeLabel(form, role);
  const hasPreciseStandardTime = getPersonValue(form, role, 'birthSecond') !== '';
  const canChooseInputMode = Boolean(onInputModeChange && reversePanel);

  return (
    <section
      className={`workspace-ui-form-surface ${role === 'partner' ? 'is-second-person' : ''}`}
    >
      <div className="workspace-ui-form-heading">
        <h2>{sectionTitle || getPersonSectionTitle(form.analysisMode, role)}</h2>
        {headerAction}
      </div>

      <div className="workspace-ui-form-body">
        {showNameField ? (
          <div className="workspace-ui-form-row">
            <div className="workspace-ui-field">
              <label htmlFor={`${role}-name-input`}>姓名</label>
              <input
                id={`${role}-name-input`}
                value={String(getPersonValue(form, role, 'name'))}
                type="text"
                placeholder="请输入姓名"
                className="workspace-ui-control"
                onChange={(event) => updatePersonField(role, 'name', event.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="workspace-ui-form-row">
          <div className="workspace-ui-field">
            <label>性别</label>
            <SegmentedControl
              value={getPersonValue(form, role, 'gender') as 'male' | 'female'}
              options={[
                { label: '男', value: 'male' as const },
                { label: '女', value: 'female' as const },
              ]}
              onChange={(value) => updatePersonField(role, 'gender', value)}
            />
          </div>
        </div>

        <div className="workspace-ui-form-row">
          <div className="workspace-ui-field">
            <label>日期输入</label>
            <SegmentedControl
              value={effectiveInputMode}
              options={[
                { label: '公历', value: 'solar' as const },
                { label: '农历', value: 'lunar' as const },
                ...(canChooseInputMode ? [{ label: '四柱', value: 'pillars' as const }] : []),
              ]}
              onChange={(value) =>
                onInputModeChange
                  ? onInputModeChange(value)
                  : updatePersonField(role, 'dateType', value === 'lunar' ? 'lunar' : 'solar')
              }
            />
          </div>
        </div>

        {effectiveInputMode === 'pillars' && reversePanel ? (
          reversePanel
        ) : (
          <>
            <div className="workspace-ui-form-row">
              {isLunar ? (
                <div className="workspace-ui-field">
                  <label>月别</label>
                  <SegmentedControl
                    value={Boolean(getPersonValue(form, role, 'isLeapMonth'))}
                    options={[
                      { label: '平月', value: false },
                      { label: '闰月', value: true },
                    ]}
                    onChange={(value) => updatePersonField(role, 'isLeapMonth', value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="workspace-ui-form-row workspace-ui-date-row">
              <div className="workspace-ui-field">
                <label htmlFor={`${role}-year-input`}>年</label>
                <input
                  id={`${role}-year-input`}
                  value={String(getPersonValue(form, role, 'year'))}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="2000"
                  className="workspace-ui-control"
                  onChange={(event) => updateNumericField(role, 'year', event.target.value)}
                />
              </div>
              <div className="workspace-ui-field">
                <label htmlFor={`${role}-month-input`}>月</label>
                <input
                  id={`${role}-month-input`}
                  value={String(getPersonValue(form, role, 'month'))}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1-12"
                  className="workspace-ui-control"
                  onChange={(event) => updateNumericField(role, 'month', event.target.value)}
                />
              </div>
              <div className="workspace-ui-field">
                <label htmlFor={`${role}-day-input`}>日</label>
                <input
                  id={`${role}-day-input`}
                  value={String(getPersonValue(form, role, 'day'))}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1-31"
                  className="workspace-ui-control"
                  onChange={(event) => updateNumericField(role, 'day', event.target.value)}
                />
              </div>
            </div>

            {forcePreciseBirthPlace ? null : (
              <div className="workspace-ui-form-row">
                <label className="workspace-ui-checkbox" htmlFor={`${role}-true-solar-time-input`}>
                  <input
                    id={`${role}-true-solar-time-input`}
                    checked={useTrueSolarTime}
                    type="checkbox"
                    onChange={(event) =>
                      updatePersonField(role, 'useTrueSolarTime', event.target.checked)
                    }
                  />
                  <span>使用真太阳时（需精准时分和出生地）</span>
                </label>
              </div>
            )}

            {forcePreciseBirthPlace || useTrueSolarTime || hasPreciseStandardTime ? (
              <>
                <div className="workspace-ui-form-row">
                  <div className="workspace-ui-field">
                    <label htmlFor={`${role}-birth-time-input`}>
                      {useTrueSolarTime
                        ? '精准时间'
                        : hasPreciseStandardTime
                          ? '标准北京时间（精确到秒）'
                          : '北京时间'}
                    </label>
                    <input
                      id={`${role}-birth-time-input`}
                      value={birthTimeValue}
                      type="time"
                      step={hasPreciseStandardTime ? 1 : undefined}
                      className="workspace-ui-control"
                      onChange={(event) => updateBirthTime(role, event.target.value)}
                    />
                    {useTrueSolarTime && trueSolarTimeLabel ? (
                      <div className="workspace-ui-field-hint">{trueSolarTimeLabel}</div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="workspace-ui-form-row">
                <div className="workspace-ui-field">
                  <label htmlFor={`${role}-time-index-input`}>时辰</label>
                  <DropdownSelect
                    id={`${role}-time-index-input`}
                    value={String(getPersonValue(form, role, 'timeIndex'))}
                    options={getBirthTimeDropdownOptions(allowUnknownTime)}
                    variant="field"
                    onChange={(value) =>
                      updatePersonField(role, 'timeIndex', value === '' ? '' : Number(value))
                    }
                  />
                </div>
              </div>
            )}
          </>
        )}
        {forcePreciseBirthPlace || useTrueSolarTime ? (
          <div className="workspace-ui-form-row">
            <div className="workspace-ui-field">
              <label htmlFor={`${role}-birth-place-input`}>出生地</label>
              <button
                id={`${role}-birth-place-input`}
                type="button"
                className="workspace-ui-control address-trigger"
                onClick={() => openBirthPlaceModal(role)}
              >
                <span>{String(getPersonValue(form, role, 'birthPlace')) || '请选择出生地'}</span>
                <span className="address-trigger-arrow">选择</span>
              </button>
            </div>
          </div>
        ) : null}
        {reverseSource ? (
          <div className="workspace-ui-field-hint">
            已选日期（四柱输入）：{Object.values(reverseSource.pillars).join(' ')}；候选区间{' '}
            {reverseSource.intervalStart} 至 {reverseSource.intervalEnd}（起点含、终点不含）。
            采用区间起点 {birthTimeValue || '代表时刻'}
            （北京时间）。完整区间会随日期保留，具体排盘采用的分段范围或代表时刻见结果页。
          </div>
        ) : null}
      </div>
      {footerHint ? <div className="workspace-ui-form-case-hint">{footerHint}</div> : null}
    </section>
  );
});
