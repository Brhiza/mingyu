import { memo } from 'react';
import { DropdownSelect } from '@/components/DropdownSelect';
import { SegmentedControl } from '@/components/SegmentedControl';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';
import { getPersonSectionTitle } from '@/lib/input-labels';
import type { QueryInputState } from '@/lib/query-state';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { isValidHourMinute } from '@/lib/input-validation';
import { getPersonValue, type SELF_FIELD_MAP } from './InputPage.field-helpers';
import type { PersonRole } from './InputPage.field-helpers';

const BIRTH_TIME_DROPDOWN_OPTIONS = [
  { value: '', label: '请选择时辰' },
  ...BIRTH_TIME_OPTIONS.map((time, index) => ({
    value: String(index),
    label: `${time.label}（${time.range}）`,
  })),
];

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
              <span>使用真太阳时（需精准时分和出生地）</span>
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
              <DropdownSelect
                id={`${role}-time-index-input`}
                value={String(getPersonValue(form, role, 'timeIndex'))}
                options={BIRTH_TIME_DROPDOWN_OPTIONS}
                variant="field"
                onChange={(value) =>
                  updatePersonField(role, 'timeIndex', value === '' ? '' : Number(value))
                }
              />
              <div className="birth-time-hint">
                普通排盘可直接按明确时辰生成完整时柱，无需精确到分钟。
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
