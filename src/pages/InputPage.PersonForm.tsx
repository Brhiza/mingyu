import { memo } from 'react';
import { SegmentedControl } from '@/components/SegmentedControl';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';
import { getPersonSectionTitle } from '@/lib/input-labels';
import type { QueryInputState } from '@/lib/query-state';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { UNKNOWN_TIME_INDEX } from '@/lib/birth-time-reverse';
import { isValidHourMinute } from '@/lib/input-validation';
import { getPersonValue, type SELF_FIELD_MAP } from './InputPage.field-helpers';
import type { PersonRole } from './InputPage.field-helpers';

function getTrueSolarTimeLabel(form: QueryInputState, role: PersonRole) {
  const hour = Number(getPersonValue(form, role, 'birthHour'));
  const minute = Number(getPersonValue(form, role, 'birthMinute'));

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
  openBirthTimeReversePage: (role: PersonRole) => void;
  sectionTitle?: string;
  historyHint?: string;
  forcePreciseBirthPlace?: boolean;
}

export const PersonForm = memo(function PersonForm({
  role,
  form,
  updatePersonField,
  updateNumericField,
  updateBirthTime,
  openBirthPlaceModal,
  openBirthTimeReversePage,
  sectionTitle,
  historyHint: historyHintOverride,
  forcePreciseBirthPlace = false,
}: PersonFormProps) {
  const birthTimeValue =
    getPersonValue(form, role, 'birthHour') !== '' &&
    getPersonValue(form, role, 'birthMinute') !== ''
      ? `${String(getPersonValue(form, role, 'birthHour')).padStart(2, '0')}:${String(
          getPersonValue(form, role, 'birthMinute'),
        ).padStart(2, '0')}`
      : '';
  const isLunar = getPersonValue(form, role, 'dateType') === 'lunar';
  const useTrueSolarTime =
    forcePreciseBirthPlace || Boolean(getPersonValue(form, role, 'useTrueSolarTime'));
  const historyHint =
    historyHintOverride ||
    (role === 'self' ? '录入姓名后会自动保存。' : '合盘模式下会自动生成合盘历史。');
  const trueSolarTimeLabel = getTrueSolarTimeLabel(form, role);

  return (
    <section className={`person-section ${role === 'partner' ? 'second-person' : ''}`}>
      <div className="person-section-head">
        <h2>{sectionTitle || getPersonSectionTitle(form.analysisMode, role)}</h2>
        <p>{historyHint}</p>
      </div>

      <div className="person-info-form">
        <div className="form-row">
          <div className="form-item">
            <label htmlFor={`${role}-name-input`}>姓名</label>
            <input
              id={`${role}-name-input`}
              value={String(getPersonValue(form, role, 'name'))}
              type="text"
              placeholder="请输入姓名"
              className="form-input"
              onChange={(event) => updatePersonField(role, 'name', event.target.value)}
            />
          </div>
        </div>

        <div className={`form-row-flex ${isLunar ? 'has-third-item' : ''}`}>
          <div className="form-item compact-segmented-field">
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

          <div className="form-item compact-segmented-field">
            <label>日历</label>
            <SegmentedControl
              value={isLunar}
              options={[
                { label: '公历', value: false },
                { label: '农历', value: true },
              ]}
              onChange={(value) => updatePersonField(role, 'dateType', value ? 'lunar' : 'solar')}
            />
          </div>

          {isLunar ? (
            <div className="form-item">
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

        <div className="form-row birth-date-row">
          <div className="form-item">
            <label htmlFor={`${role}-year-input`}>年</label>
            <input
              id={`${role}-year-input`}
              value={String(getPersonValue(form, role, 'year'))}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="2000"
              className="form-input"
              onChange={(event) => updateNumericField(role, 'year', event.target.value)}
            />
          </div>
          <div className="form-item">
            <label htmlFor={`${role}-month-input`}>月</label>
            <input
              id={`${role}-month-input`}
              value={String(getPersonValue(form, role, 'month'))}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1-12"
              className="form-input"
              onChange={(event) => updateNumericField(role, 'month', event.target.value)}
            />
          </div>
          <div className="form-item">
            <label htmlFor={`${role}-day-input`}>日</label>
            <input
              id={`${role}-day-input`}
              value={String(getPersonValue(form, role, 'day'))}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1-31"
              className="form-input"
              onChange={(event) => updateNumericField(role, 'day', event.target.value)}
            />
          </div>
        </div>

        {forcePreciseBirthPlace ? null : (
          <div className="form-row">
            <label className="checkbox-label" htmlFor={`${role}-true-solar-time-input`}>
              <input
                id={`${role}-true-solar-time-input`}
                checked={useTrueSolarTime}
                type="checkbox"
                className="checkbox-input"
                onChange={(event) =>
                  updatePersonField(role, 'useTrueSolarTime', event.target.checked)
                }
              />
              <span>使用真太阳时</span>
            </label>
          </div>
        )}

        {useTrueSolarTime ? (
          <>
            <div className="form-row">
              <div className="form-item">
                <label htmlFor={`${role}-birth-time-input`}>精准时间</label>
                <input
                  id={`${role}-birth-time-input`}
                  value={birthTimeValue}
                  type="time"
                  className="form-input"
                  onChange={(event) => updateBirthTime(role, event.target.value)}
                />
                {trueSolarTimeLabel ? (
                  <div className="birth-time-hint">{trueSolarTimeLabel}</div>
                ) : null}
              </div>
            </div>

            <div className="form-row">
              <div className="form-item">
                <label htmlFor={`${role}-birth-place-input`}>出生地</label>
                <button
                  id={`${role}-birth-place-input`}
                  type="button"
                  className="form-input address-trigger"
                  onClick={() => openBirthPlaceModal(role)}
                >
                  <span>{String(getPersonValue(form, role, 'birthPlace')) || '请选择出生地'}</span>
                  <span className="address-trigger-arrow">选择</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="form-row">
            <div className="form-item">
              <label htmlFor={`${role}-time-index-input`}>时辰</label>
              <select
                id={`${role}-time-index-input`}
                value={
                  getPersonValue(form, role, 'timeIndex') === ''
                    ? ''
                    : Number(getPersonValue(form, role, 'timeIndex'))
                }
                className="form-input"
                onChange={(event) =>
                  updatePersonField(
                    role,
                    'timeIndex',
                    event.target.value === '' ? '' : Number(event.target.value),
                  )
                }
              >
                <option value="">请选择时辰</option>
                {BIRTH_TIME_OPTIONS.map((time, index) => (
                  <option key={time.label} value={index}>
                    {time.label}（{time.range}）
                  </option>
                ))}
                <option value={UNKNOWN_TIME_INDEX}>未知时辰</option>
              </select>
              {form.analysisMode === 'single' && role === 'self' && !forcePreciseBirthPlace ? (
                <div className="birth-time-actions">
                  <button
                    type="button"
                    className="birth-time-reverse-button"
                    onClick={() => openBirthTimeReversePage(role)}
                  >
                    反推时辰
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
