import * as React from 'react';
import { GanzhiCalendarPanel } from '../culture/GanzhiCalendarPanel';
import {
  ALMANAC_TOPICS,
  LabeledInput,
  LabeledSelect,
  SHICHEN_OPTIONS,
  addDaysToDateStr,
  type AlmanacParticipantDraft,
} from './divination-shared';

export function AlmanacForm({
  topic,
  customKeyword,
  startDate,
  endDate,
  nowDateStr,
  weekendPref,
  timePrefs,
  participants,
  onChangeTopic,
  onChangeCustomKeyword,
  onChangeStartDate,
  onChangeEndDate,
  onChangeWeekendPref,
  onChangeTimePrefs,
  onChangeParticipants,
}: {
  topic: string;
  customKeyword: string;
  startDate: string;
  endDate: string;
  nowDateStr: string;
  weekendPref: 'any' | 'prefer' | 'avoid';
  timePrefs: ReadonlyArray<'work-hours' | 'morning' | 'afternoon'>;
  participants: readonly AlmanacParticipantDraft[];
  onChangeTopic: (next: string) => void;
  onChangeCustomKeyword: (next: string) => void;
  onChangeStartDate: (next: string) => void;
  onChangeEndDate: (next: string) => void;
  onChangeWeekendPref: (next: 'any' | 'prefer' | 'avoid') => void;
  onChangeTimePrefs: (next: Array<'work-hours' | 'morning' | 'afternoon'>) => void;
  onChangeParticipants: (next: AlmanacParticipantDraft[]) => void;
}) {
  return (
    <div className="almanac-form almanac-form-flow">
      <section className="almanac-form-section almanac-calendar-section">
        <div>
          <GanzhiCalendarPanel
            selectedDate={startDate}
            embedded={false}
            onSelectDate={(pickedDate) => {
              onChangeStartDate(pickedDate);
              if (endDate < pickedDate) {
                onChangeEndDate(pickedDate);
              }
            }}
          />
        </div>
      </section>

      <section className="almanac-form-section">
            <div className="almanac-form-section-head">
              <strong>择日事项</strong>
            </div>
            <div className="almanac-topic-grid" role="group" aria-label="择日事项">
              {ALMANAC_TOPICS.map((item) => {
                const isActive = topic === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={isActive ? 'is-active' : ''}
                    aria-pressed={isActive}
                    onClick={() => onChangeTopic(item.value)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            {topic === 'custom' ? (
              <LabeledInput
                label="自定义黄历宜忌词"
                value={customKeyword}
                placeholder="输入黄历宜忌关键词"
                onChange={onChangeCustomKeyword}
              />
            ) : null}
          </section>

          <section className="almanac-form-section almanac-date-section">
            <div className="almanac-form-section-head">
              <strong>择吉日期范围</strong>
              <div className="almanac-quick-ranges">
                {([7, 21, 30, 90, 180] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => onChangeEndDate(addDaysToDateStr(startDate, days - 1))}
                  >
                    {`${days}天`}
                  </button>
                ))}
              </div>
            </div>

            <div className="almanac-date-fields">
              <div className="form-item workspace-ui-field">
                <label htmlFor="almanac-start-date-input">开始日期</label>
                <input
                  id="almanac-start-date-input"
                  type="date"
                  className="form-input workspace-ui-control"
                  value={startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value || nowDateStr;
                    onChangeStartDate(nextStart);
                    if (endDate < nextStart) {
                      onChangeEndDate(addDaysToDateStr(nextStart, 20));
                    }
                  }}
                />
              </div>
              <span aria-hidden="true">至</span>
              <div className="form-item workspace-ui-field">
                <label htmlFor="almanac-end-date-input">结束日期</label>
                <input
                  id="almanac-end-date-input"
                  type="date"
                  className="form-input workspace-ui-control"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => onChangeEndDate(e.target.value || startDate)}
                />
              </div>
            </div>

            <div className="almanac-common-options">
              <span>日期</span>
              <div role="group">
                {(
                  [
                    { id: 'any', label: '日期不限' },
                    { id: 'prefer', label: '优先周末' },
                    { id: 'avoid', label: '避开周末' },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={weekendPref === w.id ? 'is-active' : ''}
                    onClick={() => onChangeWeekendPref(w.id)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              <span>时段</span>
              <div role="group">
                {(
                  [
                    { id: 'work-hours', label: '工作时间' },
                    { id: 'morning', label: '优先上午' },
                    { id: 'afternoon', label: '优先下午' },
                  ] as const
                ).map((tp) => {
                  const active = timePrefs.includes(tp.id);
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      className={active ? 'is-active' : ''}
                      onClick={() => {
                        onChangeTimePrefs(
                          active ? timePrefs.filter((x) => x !== tp.id) : [...timePrefs, tp.id],
                        );
                      }}
                    >
                      {tp.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="almanac-form-section">
            <div className="almanac-form-section-head">
              <div>
                <strong>参与人</strong>
              </div>
              <div className="almanac-participant-actions">
                <button
                  type="button"
                  className="workspace-ui-button is-secondary is-small"
                  onClick={() =>
                    onChangeParticipants([
                      ...participants,
                      {
                        id: `p-${Date.now()}`,
                        name: '本人',
                        gender: '',
                        year: '1990',
                        month: '5',
                        day: '15',
                        shichenIndex: '',
                        calendar: 'solar',
                      },
                    ])
                  }
                >
                  手动添加
                </button>
              </div>
            </div>

            {participants.length > 0 ? (
              <div className="almanac-participant-list">
                {participants.map((p, idx) => {
                  const shichenLabel =
                    SHICHEN_OPTIONS.find((o) => o.value === p.shichenIndex)?.label ?? '时辰不详';
                  const updateItem = (patch: Partial<AlmanacParticipantDraft>) => {
                    onChangeParticipants(
                      participants.map((item) => (item.id === p.id ? { ...item, ...patch } : item)),
                    );
                  };
                  return (
                    <details key={p.id} className="almanac-participant-item" open>
                      <summary>
                        <span className="almanac-participant-index">{idx + 1}</span>
                        <span className="almanac-participant-summary">
                          <strong>{p.name || `参与人${idx + 1}`}</strong>
                          <small>
                            {`${p.calendar === 'lunar' ? '农历' : '公历'} ${p.year}-${p.month}-${
                              p.day
                            } · ${shichenLabel}`}
                          </small>
                        </span>
                        <span className="almanac-participant-edit">编辑</span>
                      </summary>
                      <div className="almanac-participant-editor">
                        <div className="form-row-flex">
                          <LabeledInput
                            label="称呼"
                            value={p.name}
                            placeholder="本人"
                            onChange={(v) => updateItem({ name: v })}
                          />
                          <LabeledSelect
                            label="历法"
                            options={[
                              { value: 'solar', label: '公历' },
                              { value: 'lunar', label: '农历' },
                            ]}
                            value={p.calendar}
                            onChange={(v) => updateItem({ calendar: v as 'solar' | 'lunar' })}
                          />
                        </div>
                        <div className="form-row-flex has-third-item">
                          <LabeledInput
                            label="年"
                            value={p.year}
                            placeholder="1990"
                            onChange={(v) => updateItem({ year: v.replace(/[^\d]/g, '').slice(0, 4) })}
                          />
                          <LabeledInput
                            label="月"
                            value={p.month}
                            placeholder="5"
                            onChange={(v) =>
                              updateItem({ month: v.replace(/[^\d]/g, '').slice(0, 2) })
                            }
                          />
                          <LabeledInput
                            label="日"
                            value={p.day}
                            placeholder="15"
                            onChange={(v) => updateItem({ day: v.replace(/[^\d]/g, '').slice(0, 2) })}
                          />
                        </div>
                        <div className="form-row">
                          <LabeledSelect
                            label="时辰"
                            options={SHICHEN_OPTIONS}
                            value={p.shichenIndex}
                            onChange={(v) => updateItem({ shichenIndex: v })}
                          />
                        </div>
                        <button
                          type="button"
                          className="almanac-participant-remove"
                          onClick={() =>
                            onChangeParticipants(participants.filter((item) => item.id !== p.id))
                          }
                        >
                          移除此人
                        </button>
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : null}
      </section>
    </div>
  );
}
