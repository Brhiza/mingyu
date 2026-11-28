import * as React from 'react';
import { CalendarDays, FolderOpen } from 'lucide-react';
import {
  createBirthPlaceModal,
  type BirthPlaceModalController,
  type BirthPlaceSelection,
} from '../../../v2-ui/birth-place-modal';
import {
  BIRTH_TIME_OPTIONS,
  clampNumericField,
  createDefaultPersonalCase,
  getBirthTimeDropdownOptions,
  getTimeIndexFromClock,
  getTrueSolarTimeHintLabel,
  setActiveCaseId,
  upsertPersonalCase,
  type PersonalCase,
  type TimeIndexValue,
} from '../../../v2-ui/cases-store';
import { validatePersonalCase } from '../../../v2-ui/case-birth';
import { Checkbox, Select } from '../../../components/ui';
import { UiSegmentedControl, type UiSegmentedOption } from '../shared/UiSegmentedControl';
import { WheelPickerModal, type WheelPickerColumn } from '../shared/WheelPickerModal';
import { BaziReversePanel } from './BaziReversePanel';
import {
  openCasePickerModal,
  type PersonFormCardHandle,
  type PersonInputMode,
  type PersonRole,
} from './person-form-helpers';

export interface PersonFormCardProps {
  role?: PersonRole;
  sectionTitle?: string;
  initialCase?: Partial<PersonalCase>;
  forcePreciseBirthPlace?: boolean;
  allowUnknownTime?: boolean;
  allowPillarsMode?: boolean;
  showNameField?: boolean;
  showCasePickerButton?: boolean;
  showSaveToCaseOption?: boolean;
  defaultSaveToCase?: boolean;
  footerHint?: string;
  className?: string;
  birthPlaceModal?: BirthPlaceModalController;
  onRequestCasePicker?: (
    role: PersonRole,
    applyCase: (selected: PersonalCase, isTemporary: boolean) => void,
  ) => void;
  onOpenTimeReverse?: (person: PersonalCase, role: PersonRole) => void;
  onOpenRangeScan?: (person: PersonalCase, role: PersonRole) => void;
  onChange?: (
    person: PersonalCase,
    meta: { inputMode: PersonInputMode; saveToCase: boolean },
  ) => void;
}

function normalizeInitialPerson(
  initialCase: Partial<PersonalCase> | undefined,
  forcePrecise: boolean,
): PersonalCase {
  const next = createDefaultPersonalCase({
    ...initialCase,
    ...(forcePrecise ? { useTrueSolarTime: true } : {}),
  });
  if (forcePrecise && (next.birthHour === '' || next.birthMinute === '')) {
    next.birthHour = '12';
    next.birthMinute = '00';
  }
  return next;
}

function deriveInputMode(person: PersonalCase): PersonInputMode {
  return person.reverseSource ? 'pillars' : person.calendar === 'lunar' ? 'lunar' : 'solar';
}

export const PersonFormCard = React.forwardRef<PersonFormCardHandle, PersonFormCardProps>(
  function PersonFormCard(
    {
      role = 'self',
      sectionTitle,
      initialCase,
      forcePreciseBirthPlace = false,
      allowUnknownTime = true,
      allowPillarsMode = true,
      showNameField = true,
      showCasePickerButton = true,
      showSaveToCaseOption = true,
      defaultSaveToCase = false,
      footerHint,
      className,
      birthPlaceModal,
      onRequestCasePicker,
      onOpenTimeReverse,
      onOpenRangeScan,
      onChange,
    },
    ref,
  ) {
    const forcePrecise = Boolean(forcePreciseBirthPlace);
    const [person, setPersonState] = React.useState<PersonalCase>(() =>
      normalizeInitialPerson(initialCase, forcePrecise),
    );
    const [inputMode, setInputModeState] = React.useState<PersonInputMode>(() =>
      deriveInputMode(normalizeInitialPerson(initialCase, forcePrecise)),
    );
    const [saveToCase, setSaveToCaseState] = React.useState<boolean>(() =>
      Boolean(defaultSaveToCase),
    );
    const [wheelOpen, setWheelOpen] = React.useState(false);
    const [mobileManualDate, setMobileManualDate] = React.useState(false);
    const [wheelDraft, setWheelDraft] = React.useState<string[]>([]);

    const personRef = React.useRef(person);
    const inputModeRef = React.useRef(inputMode);
    const saveToCaseRef = React.useRef(saveToCase);

    const ownedModalRef = React.useRef<BirthPlaceModalController | null>(null);
    React.useEffect(() => {
      return () => {
        ownedModalRef.current?.destroy();
        ownedModalRef.current = null;
      };
    }, []);

    const getPlaceModal = (): BirthPlaceModalController => {
      if (birthPlaceModal) return birthPlaceModal;
      if (!ownedModalRef.current) {
        ownedModalRef.current = createBirthPlaceModal();
      }
      return ownedModalRef.current;
    };

    const commitPerson = (
      nextPerson: PersonalCase,
      nextMode: PersonInputMode = inputModeRef.current,
      nextSave: boolean = saveToCaseRef.current,
      emitChange = true,
    ) => {
      personRef.current = nextPerson;
      inputModeRef.current = nextMode;
      saveToCaseRef.current = nextSave;
      setPersonState(nextPerson);
      setInputModeState(nextMode);
      setSaveToCaseState(nextSave);
      if (emitChange) {
        onChange?.(nextPerson, { inputMode: nextMode, saveToCase: nextSave });
      }
    };

    const stripReverse = (p: PersonalCase): PersonalCase =>
      p.reverseSource ? { ...p, reverseSource: null } : p;

    React.useImperativeHandle(
      ref,
      () => ({
        getPerson: () => ({ ...personRef.current }),
        setPerson: (next) => {
          const merged = normalizeInitialPerson(
            { ...personRef.current, ...next },
            forcePrecise,
          );
          const derivedMode = deriveInputMode(merged);
          commitPerson(merged, derivedMode, saveToCaseRef.current, false);
        },
        getInputMode: () => inputModeRef.current,
        setInputMode: (mode) => {
          inputModeRef.current = mode;
          setInputModeState(mode);
        },
        shouldSaveToCase: () => saveToCaseRef.current,
        validate: () =>
          validatePersonalCase(personRef.current, {
            label: role === 'partner' ? '命主二' : '命主一',
            forcePreciseBirthPlace: forcePrecise,
            allowUnknownTime,
            inputMode: inputModeRef.current,
          }),
        saveToCasesStore: () => {
          const cur = personRef.current;
          const saved = upsertPersonalCase(cur, cur.isTemporary ? undefined : cur.id);
          const nextSaved = { ...saved };
          personRef.current = nextSaved;
          setPersonState(nextSaved);
          return saved;
        },
      }),
      [allowUnknownTime, forcePrecise, role],
    );

    const applySelectedCase = (selected: Partial<PersonalCase>, isTemporary: boolean) => {
      if (role === 'self') {
        setActiveCaseId(isTemporary || !selected.id ? null : selected.id);
      }
      const next = normalizeInitialPerson(selected, forcePrecise);
      commitPerson(next, deriveInputMode(next));
    };

    const handleOpenPickerDialog = () => {
      if (onRequestCasePicker) {
        onRequestCasePicker(role, (selected, isTemporary) => {
          applySelectedCase(selected, isTemporary);
        });
        return;
      }
      openCasePickerModal({
        roleLabel: role === 'partner' ? '命主二' : '命主一',
        activeCaseId: personRef.current.isTemporary ? null : personRef.current.id,
        allowTemporaryOption: role === 'self',
        onSelect: (selected, isTemporary) => {
          applySelectedCase(selected, isTemporary);
        },
      });
    };

    const handleOpenPlaceModal = () => {
      getPlaceModal().open({
        purpose: 'birth',
        initialPlace: personRef.current.birthPlace,
        initialDistrictId: personRef.current.districtId,
        onConfirm: (selection: BirthPlaceSelection) => {
          const next: PersonalCase = {
            ...personRef.current,
            birthPlace: selection.displayName,
            provinceId: selection.provinceId,
            provinceName: selection.provinceName,
            cityId: selection.cityId,
            cityName: selection.cityName,
            districtId: selection.districtId,
            districtName: selection.districtName,
            longitude: selection.longitude,
            latitude: selection.latitude,
            ...(selection.timezone !== undefined ? { timezone: selection.timezone } : {}),
            ...(selection.timeZoneId ? { timeZoneId: selection.timeZoneId } : { timeZoneId: undefined }),
          };
          commitPerson(next);
        },
      });
    };

    const modeOptions: UiSegmentedOption<PersonInputMode>[] = [
      { label: '公历', value: 'solar' },
      { label: '农历', value: 'lunar' },
      ...(allowPillarsMode ? [{ label: '四柱', value: 'pillars' as const }] : []),
    ];

    const isLunar = person.calendar === 'lunar';
    const useTrueSolarTime = forcePrecise || Boolean(person.useTrueSolarTime);
    const trueSolarHint = getTrueSolarTimeHintLabel(person.birthHour, person.birthMinute);
    const dropdownOptions = getBirthTimeDropdownOptions(allowUnknownTime);
    const currentTimeSelectValue =
      person.timeIndex === 'unknown'
        ? 'unknown'
        : person.timeIndex === ''
          ? ''
          : String(person.timeIndex);

    const openBirthWheelPicker = () => {
      const y = String(Math.min(2100, Math.max(1900, Number(person.year) || 1995)));
      const m = String(Math.min(12, Math.max(1, Number(person.month) || 1)));
      const d = String(Math.min(31, Math.max(1, Number(person.day) || 1)));
      if (useTrueSolarTime) {
        const hh = (person.birthHour || '12').padStart(2, '0');
        const mm = (person.birthMinute || '00').padStart(2, '0');
        setWheelDraft([y, m, d, hh, mm]);
      } else {
        const idxStr =
          person.timeIndex === 'unknown'
            ? 'unknown'
            : person.timeIndex === ''
              ? '6'
              : String(person.timeIndex);
        setWheelDraft([y, m, d, idxStr]);
      }
      setWheelOpen(true);
    };

    const wheelColumns = React.useMemo<WheelPickerColumn[]>(() => {
      const selectedY = Number(wheelDraft[0] ?? person.year) || 1995;
      const selectedM = Number(wheelDraft[1] ?? person.month) || 1;
      const maxDay = isLunar ? 30 : new Date(selectedY, selectedM, 0).getDate() || 31;

      const yearCol: WheelPickerColumn = {
        key: 'year',
        label: '年',
        flex: 1.2,
        options: Array.from({ length: 201 }, (_, i) => {
          const y = String(1900 + i);
          return { value: y, label: `${y}年` };
        }),
      };
      const monthCol: WheelPickerColumn = {
        key: 'month',
        label: '月',
        flex: 0.9,
        options: Array.from({ length: 12 }, (_, i) => {
          const m = String(i + 1);
          return { value: m, label: `${m}月` };
        }),
      };
      const dayCol: WheelPickerColumn = {
        key: 'day',
        label: '日',
        flex: 0.9,
        options: Array.from({ length: maxDay }, (_, i) => {
          const d = String(i + 1);
          return { value: d, label: `${d}日` };
        }),
      };

      if (useTrueSolarTime) {
        const hourCol: WheelPickerColumn = {
          key: 'hour',
          label: '时',
          flex: 0.85,
          options: Array.from({ length: 24 }, (_, i) => {
            const hh = String(i).padStart(2, '0');
            return { value: hh, label: `${hh}时` };
          }),
        };
        const minCol: WheelPickerColumn = {
          key: 'minute',
          label: '分',
          flex: 0.85,
          options: Array.from({ length: 60 }, (_, i) => {
            const mm = String(i).padStart(2, '0');
            return { value: mm, label: `${mm}分` };
          }),
        };
        return [yearCol, monthCol, dayCol, hourCol, minCol];
      }

      const shichenCol: WheelPickerColumn = {
        key: 'shichen',
        label: '时辰',
        flex: 1.5,
        options: [
          ...BIRTH_TIME_OPTIONS.map((opt) => ({
            value: String(opt.index),
            label: `${opt.label} ${opt.range.slice(0, 5)}`,
          })),
          ...(allowUnknownTime ? [{ value: 'unknown', label: '未知时辰' }] : []),
        ],
      };
      return [yearCol, monthCol, dayCol, shichenCol];
    }, [allowUnknownTime, isLunar, person.day, person.month, person.year, useTrueSolarTime, wheelDraft]);

    const wheelTimeSummary = React.useMemo(() => {
      if (useTrueSolarTime) {
        return person.birthHour !== '' && person.birthMinute !== ''
          ? `${person.birthHour.padStart(2, '0')}:${person.birthMinute.padStart(2, '0')}`
          : '精准时间';
      }
      if (person.timeIndex === 'unknown') return '未知时辰';
      if (person.timeIndex === '') return '选择时辰';
      return BIRTH_TIME_OPTIONS[Number(person.timeIndex)]?.label ?? '选择时辰';
    }, [person.birthHour, person.birthMinute, person.timeIndex, useTrueSolarTime]);

    const mobileDateDisplay = `${isLunar ? (person.isLeapMonth ? '农历闰' : '农历') : '公历'} ${
      person.year || '----'
    }-${String(person.month || '').padStart(2, '0') || '--'}-${
      String(person.day || '').padStart(2, '0') || '--'
    } · ${wheelTimeSummary}`;

    const surfaceClasses = [
      'workspace-ui-form-surface',
      role === 'partner' ? 'is-second-person' : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <section className={surfaceClasses}>
        <div className="workspace-ui-form-heading">
          <h2>{sectionTitle || (role === 'partner' ? '命主二' : '出生资料')}</h2>
          {showCasePickerButton ? (
            <button
              type="button"
              className="workspace-ui-button is-secondary is-small inline-flex items-center gap-1.5"
              onClick={handleOpenPickerDialog}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>选择档案</span>
            </button>
          ) : null}
        </div>

        <div className="workspace-ui-form-body">
          <div
            className={
              showNameField
                ? 'workspace-ui-form-row form-row-flex person-name-gender-row'
                : 'workspace-ui-form-row'
            }
          >
            {showNameField ? (
              <div className="workspace-ui-field">
                <label htmlFor={`${role}-name-input`}>姓名</label>
                <input
                  id={`${role}-name-input`}
                  type="text"
                  className="workspace-ui-control"
                  placeholder="请输入姓名"
                  value={person.name}
                  onChange={(e) => {
                    commitPerson({ ...personRef.current, name: e.target.value });
                  }}
                />
              </div>
            ) : null}
            <div className="workspace-ui-field">
              <label>性别</label>
              <UiSegmentedControl<'male' | 'female'>
                value={person.gender}
                options={[
                  { label: '男', value: 'male' },
                  { label: '女', value: 'female' },
                ]}
                onChange={(val) => {
                  commitPerson({ ...personRef.current, gender: val });
                }}
              />
            </div>
          </div>

          <div className="workspace-ui-form-row">
            <div className="workspace-ui-field">
              <label>日期输入</label>
              <UiSegmentedControl<PersonInputMode>
                value={inputMode}
                options={modeOptions}
                onChange={(nextMode) => {
                  const nextPerson: PersonalCase =
                    nextMode !== 'pillars'
                      ? {
                          ...personRef.current,
                          calendar: nextMode,
                          dateType: nextMode,
                          ...(nextMode === 'solar' ? { isLeapMonth: false } : {}),
                          reverseSource: null,
                        }
                      : personRef.current;
                  commitPerson(nextPerson, nextMode);
                }}
              />
            </div>
          </div>

          {inputMode === 'pillars' ? (
            <BaziReversePanel
              source={person.reverseSource}
              onInvalidate={() => {
                if (personRef.current.reverseSource) {
                  commitPerson({ ...personRef.current, reverseSource: null });
                }
              }}
              onSelect={(selection) => {
                commitPerson({
                  ...personRef.current,
                  calendar: 'solar',
                  dateType: 'solar',
                  isLeapMonth: false,
                  year: selection.year,
                  month: selection.month,
                  day: selection.day,
                  timeIndex: selection.timeIndex,
                  birthHour: selection.birthHour,
                  birthMinute: selection.birthMinute,
                  birthSecond: selection.birthSecond,
                  reverseSource: selection.source,
                });
              }}
            />
          ) : (
            <>
              {isLunar ? (
                <div className="workspace-ui-form-row">
                  <div className="workspace-ui-field">
                    <label>月别</label>
                    <UiSegmentedControl<boolean>
                      value={Boolean(person.isLeapMonth)}
                      options={[
                        { label: '平月', value: false },
                        { label: '闰月', value: true },
                      ]}
                      onChange={(val) => {
                        commitPerson({ ...stripReverse(personRef.current), isLeapMonth: val });
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {/* 手机端优先显示合并滚轮触发条（支持一键切回手动数字输入） */}
              <div className="workspace-ui-form-row min-[680px]:hidden">
                <div className="workspace-ui-field">
                  <div className="flex items-center justify-between gap-2">
                    <label>出生日期与时间</label>
                    <button
                      type="button"
                      onClick={() => setMobileManualDate((v) => !v)}
                      className="inline-flex min-h-[30px] items-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 text-[11.5px] font-semibold text-[var(--accent-strong)] cursor-pointer transition-colors hover:border-[var(--border-contrast)] hover:bg-[var(--state-selected-surface)]"
                    >
                      {mobileManualDate ? '切回滚轮' : '手动输入'}
                    </button>
                  </div>
                  {!mobileManualDate ? (
                    <button
                      type="button"
                      data-testid={`${role}-wheel-picker-trigger`}
                      className="workspace-ui-control address-trigger"
                      onClick={openBirthWheelPicker}
                    >
                      <span className="inline-flex items-center gap-1.5 truncate font-semibold text-[var(--text-strong)]">
                        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
                        <span className="truncate">{mobileDateDisplay}</span>
                      </span>
                      <span className="address-trigger-arrow">选择</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                className={
                  mobileManualDate
                    ? 'workspace-ui-form-row workspace-ui-date-row'
                    : 'workspace-ui-form-row workspace-ui-date-row hidden min-[680px]:grid'
                }
              >
                {(
                  [
                    { key: 'year', label: '年', placeholder: '2000' },
                    { key: 'month', label: '月', placeholder: '1-12' },
                    { key: 'day', label: '日', placeholder: '1-31' },
                  ] as const
                ).map((cfg) => (
                  <div key={cfg.key} className="workspace-ui-field">
                    <div className="flex items-center justify-between gap-1">
                      <label htmlFor={`${role}-${cfg.key}-input`}>{cfg.label}</label>
                      {cfg.key === 'day' ? (
                        <button
                          type="button"
                          onClick={openBirthWheelPicker}
                          className="hidden min-[680px]:inline-flex items-center gap-0.5 border-0 bg-transparent p-0 text-[11px] font-semibold text-[var(--accent-strong)] cursor-pointer hover:underline"
                          title="用滚轮选择出生日期与时间"
                        >
                          <CalendarDays className="h-3 w-3" aria-hidden="true" />
                          <span>滚轮</span>
                        </button>
                      ) : null}
                    </div>
                    <input
                      id={`${role}-${cfg.key}-input`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={cfg.placeholder}
                      className="workspace-ui-control"
                      value={person[cfg.key]}
                      onChange={(e) => {
                        const clamped = clampNumericField(cfg.key, e.target.value);
                        commitPerson({
                          ...stripReverse(personRef.current),
                          [cfg.key]: clamped,
                        });
                      }}
                    />
                  </div>
                ))}
              </div>

              {!forcePrecise ? (
                <div className="workspace-ui-form-row">
                  <Checkbox
                    id={`${role}-true-solar-time-input`}
                    checked={Boolean(person.useTrueSolarTime)}
                    label="真太阳时"
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const base = stripReverse(personRef.current);
                      let birthHour = base.birthHour;
                      let birthMinute = base.birthMinute;
                      if (checked && (birthHour === '' || birthMinute === '')) {
                        birthHour = '12';
                        birthMinute = '00';
                      }
                      commitPerson({
                        ...base,
                        useTrueSolarTime: checked,
                        birthHour,
                        birthMinute,
                      });
                    }}
                  />
                </div>
              ) : null}

              {useTrueSolarTime ? (
                <div className={mobileManualDate ? 'workspace-ui-form-row' : 'workspace-ui-form-row hidden min-[680px]:grid'}>
                  <div className="workspace-ui-field">
                    <label htmlFor={`${role}-birth-time-input`}>精准时间</label>
                    <input
                      id={`${role}-birth-time-input`}
                      type="time"
                      className="workspace-ui-control"
                      value={
                        person.birthHour !== '' && person.birthMinute !== ''
                          ? `${person.birthHour.padStart(2, '0')}:${person.birthMinute.padStart(2, '0')}`
                          : ''
                      }
                      onChange={(e) => {
                        const base = stripReverse(personRef.current);
                        if (!e.target.value) {
                          commitPerson({
                            ...base,
                            birthHour: '',
                            birthMinute: '',
                            birthSecond: '',
                          });
                          return;
                        }
                        const [hh = '', mm = ''] = e.target.value.split(':');
                        const matchedIdx = getTimeIndexFromClock(Number(hh), Number(mm));
                        commitPerson({
                          ...base,
                          birthHour: hh,
                          birthMinute: mm,
                          birthSecond: '0',
                          ...(matchedIdx >= 0 ? { timeIndex: matchedIdx } : {}),
                        });
                      }}
                    />
                    {trueSolarHint ? (
                      <div className="workspace-ui-field-hint">{trueSolarHint}</div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className={mobileManualDate ? 'workspace-ui-form-row' : 'workspace-ui-form-row hidden min-[680px]:grid'}>
                  <div className="workspace-ui-field">
                    <label htmlFor={`${role}-time-index-input`}>时辰</label>
                    <Select
                      id={`${role}-time-index-input`}
                      value={currentTimeSelectValue}
                      onValueChange={(val) => {
                        const nextTimeIndex: TimeIndexValue =
                          val === 'unknown' ? 'unknown' : val === '' ? '' : Number(val);
                        commitPerson({
                          ...stripReverse(personRef.current),
                          timeIndex: nextTimeIndex,
                          birthHour: '',
                          birthMinute: '',
                          birthSecond: '',
                        });
                      }}
                    >
                      {dropdownOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              {onOpenTimeReverse && allowUnknownTime ? (
                <div className="workspace-ui-form-row person-unknown-time-row">
                  <button
                    type="button"
                    className="person-unknown-time-trigger"
                    data-testid={`${role}-unknown-time-reverse-btn`}
                    onClick={() => onOpenTimeReverse({ ...personRef.current }, role)}
                  >
                    <strong>我不知道时辰</strong>
                    <span>按过往经历逆推 →</span>
                  </button>
                </div>
              ) : null}
            </>
          )}

          {useTrueSolarTime ? (
            <>
              <div className="workspace-ui-form-row">
                <div className="workspace-ui-field">
                  <label htmlFor={`${role}-birth-place-input`}>出生地</label>
                  <button
                    id={`${role}-birth-place-input`}
                    type="button"
                    className="workspace-ui-control address-trigger"
                    onClick={handleOpenPlaceModal}
                  >
                    <span>{person.birthPlace || '请选择出生地'}</span>
                    <span className="address-trigger-arrow">
                      {person.birthPlace ? '更换' : '选择'}
                    </span>
                  </button>
                </div>
              </div>

              {onOpenRangeScan ? (
                <div className="workspace-ui-form-row person-unknown-time-row">
                  <button
                    type="button"
                    className="person-unknown-time-trigger"
                    data-testid={`${role}-unknown-minute-range-btn`}
                    onClick={() => onOpenRangeScan({ ...personRef.current }, role)}
                  >
                    <strong>我不知道具体分秒</strong>
                    <span>按时间段排查边界 →</span>
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {person.reverseSource ? (
            <div className="workspace-ui-field-hint">
              {`已选日期（四柱输入）：${person.reverseSource.pillars.year} ${person.reverseSource.pillars.month} ${person.reverseSource.pillars.day} ${person.reverseSource.pillars.hour}；候选区间 ${person.reverseSource.intervalStart} 至 ${person.reverseSource.intervalEnd}（起点含、终点不含）。采用区间起点 ${
                person.birthHour && person.birthMinute
                  ? `${person.birthHour.padStart(2, '0')}:${person.birthMinute.padStart(2, '0')}`
                  : '代表时刻'
              }（北京时间）。`}
            </div>
          ) : null}

          {showSaveToCaseOption ? (
            <div className="workspace-ui-form-row">
              <Checkbox
                id={`${role}-save-case-checkbox`}
                checked={saveToCase}
                label="排盘时同步保存到命例档案"
                onChange={(e) => {
                  commitPerson(personRef.current, inputModeRef.current, e.target.checked);
                }}
              />
            </div>
          ) : null}
        </div>

        {footerHint ? <div className="workspace-ui-form-case-hint">{footerHint}</div> : null}

        <WheelPickerModal
          open={wheelOpen}
          title={isLunar ? '选择农历出生日期与时间' : '选择公历出生日期与时间'}
          columns={wheelColumns}
          value={wheelDraft}
          onChange={setWheelDraft}
          onCancel={() => setWheelOpen(false)}
          onConfirm={(picked) => {
            const [y = '1995', m = '1', d = '1', fourth = '6', fifth = '00'] = picked;
            const base = stripReverse(personRef.current);
            if (useTrueSolarTime) {
              const hh = fourth.padStart(2, '0');
              const mm = fifth.padStart(2, '0');
              const matchedIdx = getTimeIndexFromClock(Number(hh), Number(mm));
              commitPerson({
                ...base,
                year: y,
                month: m,
                day: d,
                birthHour: hh,
                birthMinute: mm,
                birthSecond: '0',
                ...(matchedIdx >= 0 ? { timeIndex: matchedIdx } : {}),
              });
            } else {
              const nextTimeIndex: TimeIndexValue =
                fourth === 'unknown' ? 'unknown' : fourth === '' ? '' : Number(fourth);
              commitPerson({
                ...base,
                year: y,
                month: m,
                day: d,
                timeIndex: nextTimeIndex,
                birthHour: '',
                birthMinute: '',
                birthSecond: '',
              });
            }
            setWheelOpen(false);
          }}
        />
      </section>
    );
  },
);
