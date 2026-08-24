import { ALMANAC_TOPIC_OPTIONS } from 'mingyu-core/divination/config';
import type { AlmanacParticipantInput } from '@/types/divination';
import { DropdownSelect } from '@/components/DropdownSelect';
import { WorkspaceButton } from '@/components/workspace/WorkspaceUI';
import type { DivinationDraft } from '@/lib/divination/engine';
import type { PersonalHistoryRecord } from '@/lib/history-records';
import { createSecureId } from '@/lib/secure-id';

const OPTIONAL_GENDER_OPTIONS = [
  { value: '', label: '不填' },
  { value: '男', label: '男' },
  { value: '女', label: '女' },
] as const;

const CALENDAR_TYPE_OPTIONS = [
  { value: 'solar', label: '公历' },
  { value: 'lunar', label: '农历' },
] as const;

const BIRTH_TIME_OPTIONS = [
  { value: '', label: '时辰不详' },
  { value: '0', label: '早子时' },
  { value: '1', label: '丑时' },
  { value: '2', label: '寅时' },
  { value: '3', label: '卯时' },
  { value: '4', label: '辰时' },
  { value: '5', label: '巳时' },
  { value: '6', label: '午时' },
  { value: '7', label: '未时' },
  { value: '8', label: '申时' },
  { value: '9', label: '酉时' },
  { value: '10', label: '戌时' },
  { value: '11', label: '亥时' },
  { value: '12', label: '晚子时' },
] as const;

const WEEKEND_PREFERENCE_OPTIONS = [
  { value: 'any', label: '日期不限' },
  { value: 'prefer', label: '优先周末' },
  { value: 'avoid', label: '避开周末' },
] as const;

const TIME_PREFERENCE_OPTIONS = [
  { value: 'work-hours', label: '工作时间' },
  { value: 'morning', label: '优先上午' },
  { value: 'afternoon', label: '优先下午' },
] as const;

type AlmanacFormProps = {
  draft: DivinationDraft;
  cases: PersonalHistoryRecord[];
  updateDraft: <K extends keyof DivinationDraft>(key: K, value: DivinationDraft[K]) => void;
  questionInputRef: React.RefObject<HTMLTextAreaElement | null>;
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getBeijingToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function participantFromCase(record: PersonalHistoryRecord): AlmanacParticipantInput {
  const input = record.input;
  return {
    id: `case:${record.id}`,
    name: record.name,
    gender: input.gender === 'male' ? '男' : '女',
    year: input.year,
    month: input.month,
    day: input.day,
    timeIndex: input.timeIndex === '' ? '' : String(input.timeIndex),
    dateType: input.dateType,
    isLeapMonth: input.isLeapMonth,
  };
}

function getParticipantCaseId(participant: AlmanacParticipantInput) {
  if (participant.id.startsWith('active-case:')) return participant.id.slice('active-case:'.length);
  if (participant.id.startsWith('case:')) return participant.id.slice('case:'.length);
  return '';
}

function getParticipantSummary(participant: AlmanacParticipantInput) {
  const birthDate =
    participant.year && participant.month && participant.day
      ? `${participant.year}-${participant.month.padStart(2, '0')}-${participant.day.padStart(2, '0')}`
      : '出生日期未填';
  const timeLabel =
    BIRTH_TIME_OPTIONS.find((item) => item.value === participant.timeIndex)?.label ?? '时辰不详';
  const calendarLabel = participant.dateType === 'lunar' ? '农历' : '公历';
  return [participant.gender, `${calendarLabel} ${birthDate}`, timeLabel]
    .filter(Boolean)
    .join(' · ');
}

export function AlmanacForm({ draft, cases, updateDraft, questionInputRef }: AlmanacFormProps) {
  const participantCaseIds = new Set(
    draft.almanacParticipants.map(getParticipantCaseId).filter(Boolean),
  );
  const availableCases = cases.filter((record) => !participantCaseIds.has(record.id));
  const caseOptions = [
    { value: '', label: '从案例添加', disabled: true },
    ...availableCases.map((record) => ({ value: record.id, label: record.name })),
  ];

  function updateParticipant(
    id: string,
    key: keyof AlmanacParticipantInput,
    value: string | boolean,
  ) {
    updateDraft(
      'almanacParticipants',
      draft.almanacParticipants.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    );
  }

  function addParticipant() {
    updateDraft('almanacParticipants', [
      ...draft.almanacParticipants,
      {
        id: `participant-${createSecureId()}`,
        name: '',
        gender: '',
        year: '',
        month: '',
        day: '',
        timeIndex: '',
        dateType: 'solar',
        isLeapMonth: false,
      },
    ]);
  }

  function addCaseParticipant(caseId: string) {
    const record = cases.find((item) => item.id === caseId);
    if (!record || participantCaseIds.has(record.id)) return;
    updateDraft('almanacParticipants', [...draft.almanacParticipants, participantFromCase(record)]);
  }

  function removeParticipant(id: string) {
    updateDraft(
      'almanacParticipants',
      draft.almanacParticipants.filter((item) => item.id !== id),
    );
  }

  function setQuickRange(dayCount: number) {
    const start = getBeijingToday();
    updateDraft('almanacStartDate', formatDate(start));
    updateDraft('almanacEndDate', formatDate(addDays(start, dayCount - 1)));
  }

  function setStartDate(value: string) {
    updateDraft('almanacStartDate', value);
    if (!value || (draft.almanacEndDate && draft.almanacEndDate >= value)) return;
    const start = new Date(`${value}T00:00:00Z`);
    updateDraft('almanacEndDate', formatDate(addDays(start, 20)));
  }

  function setWeekendPreference(value: 'any' | 'prefer' | 'avoid') {
    updateDraft('almanacWeekendPreference', value);
    if (value !== 'avoid' && draft.almanacTimePreferences?.includes('work-hours')) {
      updateDraft(
        'almanacTimePreferences',
        draft.almanacTimePreferences.filter((item) => item !== 'work-hours'),
      );
    }
  }

  function toggleTimePreference(value: 'work-hours' | 'morning' | 'afternoon') {
    const selected = draft.almanacTimePreferences ?? [];
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    updateDraft('almanacTimePreferences', next);
    if (value === 'work-hours' && !selected.includes(value)) {
      updateDraft('almanacWeekendPreference', 'avoid');
    }
  }

  return (
    <div className="almanac-form-flow">
      <section className="almanac-form-section">
        <div className="almanac-form-section-head">
          <strong>择日事项</strong>
        </div>
        <div className="almanac-topic-grid" role="group" aria-label="择日事项">
          {ALMANAC_TOPIC_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={draft.almanacTopic === item.value ? 'is-active' : ''}
              aria-pressed={draft.almanacTopic === item.value}
              onClick={() => updateDraft('almanacTopic', item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="almanac-form-section almanac-date-section">
        <div className="almanac-form-section-head">
          <strong>日期范围</strong>
          <div className="almanac-quick-ranges" role="group" aria-label="快速选择日期范围">
            <button type="button" onClick={() => setQuickRange(7)}>
              7天
            </button>
            <button type="button" onClick={() => setQuickRange(21)}>
              21天
            </button>
            <button type="button" onClick={() => setQuickRange(30)}>
              30天
            </button>
            <button type="button" onClick={() => setQuickRange(90)}>
              90天
            </button>
            <button type="button" onClick={() => setQuickRange(180)}>
              180天
            </button>
          </div>
        </div>
        <div className="almanac-date-fields">
          <div className="form-item">
            <label htmlFor="almanac-start-date-input">开始日期</label>
            <input
              id="almanac-start-date-input"
              type="date"
              className="form-input"
              value={draft.almanacStartDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <span aria-hidden="true">至</span>
          <div className="form-item">
            <label htmlFor="almanac-end-date-input">结束日期</label>
            <input
              id="almanac-end-date-input"
              type="date"
              className="form-input"
              min={draft.almanacStartDate || undefined}
              value={draft.almanacEndDate}
              onChange={(event) => updateDraft('almanacEndDate', event.target.value)}
            />
          </div>
        </div>
        <div className="almanac-common-options">
          <span>日期</span>
          <div role="group" aria-label="周末偏好">
            {WEEKEND_PREFERENCE_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={
                  (draft.almanacWeekendPreference ?? 'any') === item.value ? 'is-active' : ''
                }
                aria-pressed={(draft.almanacWeekendPreference ?? 'any') === item.value}
                onClick={() => setWeekendPreference(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span>时段</span>
          <div role="group" aria-label="时段条件">
            {TIME_PREFERENCE_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={draft.almanacTimePreferences?.includes(item.value) ? 'is-active' : ''}
                aria-pressed={draft.almanacTimePreferences?.includes(item.value) ?? false}
                onClick={() => toggleTimePreference(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="almanac-form-section">
        <div className="almanac-form-section-head">
          <div>
            <strong>参与人</strong>
            <span>用于核对生肖、日柱关系和可用时辰</span>
          </div>
          <div className="almanac-participant-actions">
            {availableCases.length ? (
              <DropdownSelect
                value=""
                options={caseOptions}
                ariaLabel="从案例添加参与人"
                onChange={addCaseParticipant}
              />
            ) : null}
            <WorkspaceButton size="small" onClick={addParticipant}>
              手动添加
            </WorkspaceButton>
          </div>
        </div>

        {draft.almanacParticipants.length ? (
          <div className="almanac-participant-list">
            {draft.almanacParticipants.map((participant, index) => (
              <details className="almanac-participant-item" key={participant.id}>
                <summary>
                  <span className="almanac-participant-index">{index + 1}</span>
                  <span className="almanac-participant-summary">
                    <strong>{participant.name || `参与人${index + 1}`}</strong>
                    <small>{getParticipantSummary(participant)}</small>
                  </span>
                  <span className="almanac-participant-edit">编辑</span>
                </summary>
                <div className="almanac-participant-editor">
                  <div className="form-row-flex">
                    <div className="form-item">
                      <label htmlFor={`${participant.id}-name-input`}>称呼</label>
                      <input
                        id={`${participant.id}-name-input`}
                        className="form-input"
                        value={participant.name}
                        placeholder="例如：本人"
                        onChange={(event) =>
                          updateParticipant(participant.id, 'name', event.target.value)
                        }
                      />
                    </div>
                    <div className="form-item">
                      <label htmlFor={`${participant.id}-gender-select`}>性别</label>
                      <DropdownSelect
                        id={`${participant.id}-gender-select`}
                        value={participant.gender}
                        options={OPTIONAL_GENDER_OPTIONS}
                        variant="field"
                        onChange={(value) => updateParticipant(participant.id, 'gender', value)}
                      />
                    </div>
                  </div>
                  <div className="form-row-flex has-third-item">
                    {(['year', 'month', 'day'] as const).map((key) => (
                      <div className="form-item" key={key}>
                        <label htmlFor={`${participant.id}-${key}-input`}>
                          {key === 'year' ? '年' : key === 'month' ? '月' : '日'}
                        </label>
                        <input
                          id={`${participant.id}-${key}-input`}
                          className="form-input"
                          inputMode="numeric"
                          value={participant[key]}
                          onChange={(event) =>
                            updateParticipant(
                              participant.id,
                              key,
                              event.target.value.replace(/[^\d]/g, ''),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="form-row-flex">
                    <div className="form-item">
                      <label htmlFor={`${participant.id}-calendar-select`}>日历</label>
                      <DropdownSelect
                        id={`${participant.id}-calendar-select`}
                        value={participant.dateType}
                        options={CALENDAR_TYPE_OPTIONS}
                        variant="field"
                        onChange={(value) => updateParticipant(participant.id, 'dateType', value)}
                      />
                    </div>
                    <div className="form-item">
                      <label htmlFor={`${participant.id}-time-select`}>时辰</label>
                      <DropdownSelect
                        id={`${participant.id}-time-select`}
                        value={participant.timeIndex}
                        options={BIRTH_TIME_OPTIONS}
                        variant="field"
                        onChange={(value) => updateParticipant(participant.id, 'timeIndex', value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="almanac-participant-remove"
                    onClick={() => removeParticipant(participant.id)}
                  >
                    移除此人
                  </button>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="almanac-participant-empty">不指定参与人时，将只按事项和日期比较。</p>
        )}
      </section>

      <section className="almanac-form-section almanac-notes-section">
        <div className="form-item">
          <label htmlFor="divination-question-input">补充要求（可选）</label>
          <textarea
            ref={questionInputRef}
            id="divination-question-input"
            rows={3}
            value={draft.question}
            className="form-input divination-textarea"
            placeholder="例如：避开周末，优先上午，兼顾家人时间"
            onChange={(event) => {
              updateDraft('questionSource', 'custom');
              updateDraft('question', event.target.value);
            }}
          />
        </div>
      </section>
    </div>
  );
}
