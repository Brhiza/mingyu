import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SegmentedControl } from '@/components/SegmentedControl';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';
import { getPersonReferenceLabel, getPersonSectionTitle, type PersonRole } from '@/lib/input-labels';
import {
  upsertCompatibilityHistory,
  upsertPersonalHistory,
} from '@/lib/history-records';
import {
  buildInputStateSearch,
  buildResultSearch,
  defaultInputState,
  defaultPromptState,
  type QueryInputState,
} from '@/lib/query-state';
import { getTimeIndexFromClock } from '@/utils/dateUtils';
import { UNKNOWN_TIME_INDEX } from '@/lib/birth-time-reverse';

const SELF_FIELD_MAP = {
  name: 'name',
  gender: 'gender',
  dateType: 'dateType',
  year: 'year',
  month: 'month',
  day: 'day',
  timeIndex: 'timeIndex',
  isLeapMonth: 'isLeapMonth',
  useTrueSolarTime: 'useTrueSolarTime',
  birthHour: 'birthHour',
  birthMinute: 'birthMinute',
  birthPlace: 'birthPlace',
  birthLongitude: 'birthLongitude',
} as const;

const PARTNER_FIELD_MAP = {
  name: 'partnerName',
  gender: 'partnerGender',
  dateType: 'partnerDateType',
  year: 'partnerYear',
  month: 'partnerMonth',
  day: 'partnerDay',
  timeIndex: 'partnerTimeIndex',
  isLeapMonth: 'partnerIsLeapMonth',
  useTrueSolarTime: 'partnerUseTrueSolarTime',
  birthHour: 'partnerBirthHour',
  birthMinute: 'partnerBirthMinute',
  birthPlace: 'partnerBirthPlace',
  birthLongitude: 'partnerBirthLongitude',
} as const;

function getFieldKey(role: PersonRole, key: keyof typeof SELF_FIELD_MAP) {
  return role === 'self' ? SELF_FIELD_MAP[key] : PARTNER_FIELD_MAP[key];
}

function getPersonValue(form: QueryInputState, role: PersonRole, key: keyof typeof SELF_FIELD_MAP) {
  return form[getFieldKey(role, key)];
}

type BirthPlaceCascadeModule = typeof import('@/utils/core/birthPlaceCascade');
type InputEntryMode = 'single' | 'compatibility' | 'divination';

const LazyDivinationPanel = lazy(async () => {
  const module = await import('@/components/DivinationPanel');
  return { default: module.DivinationPanel };
});

export function InputPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<QueryInputState>(defaultInputState);
  const [entryMode, setEntryMode] = useState<InputEntryMode>('single');
  const [error, setError] = useState('');
  const [isBirthPlaceModalOpen, setIsBirthPlaceModalOpen] = useState(false);
  const [activeBirthPlaceTarget, setActiveBirthPlaceTarget] = useState<PersonRole>('self');
  const [birthPlaceSearch, setBirthPlaceSearch] = useState('');
  const [draftProvinceId, setDraftProvinceId] = useState('');
  const [draftCityId, setDraftCityId] = useState('');
  const [draftDistrictId, setDraftDistrictId] = useState('');
  const [birthPlaceCascadeModule, setBirthPlaceCascadeModule] =
    useState<BirthPlaceCascadeModule | null>(null);
  const [isBirthPlaceDataLoading, setIsBirthPlaceDataLoading] = useState(false);

  const provinceOptions = useMemo(
    () => birthPlaceCascadeModule?.getBirthPlaceProvinceOptions() ?? [],
    [birthPlaceCascadeModule],
  );
  const cityOptions = useMemo(
    () => birthPlaceCascadeModule?.getBirthPlaceCityOptions(draftProvinceId) ?? [],
    [birthPlaceCascadeModule, draftProvinceId],
  );
  const districtOptions = useMemo(
    () => birthPlaceCascadeModule?.getBirthPlaceDistrictOptions(draftCityId) ?? [],
    [birthPlaceCascadeModule, draftCityId],
  );

  async function ensureBirthPlaceCascadeModule() {
    if (birthPlaceCascadeModule) {
      return birthPlaceCascadeModule;
    }

    setIsBirthPlaceDataLoading(true);
    try {
      const module = await import('@/utils/core/birthPlaceCascade');
      setBirthPlaceCascadeModule(module);
      return module;
    } finally {
      setIsBirthPlaceDataLoading(false);
    }
  }

  useEffect(() => {
    const nextEntryMode =
      searchParams.get('mode') === 'compatibility'
        ? 'compatibility'
        : searchParams.get('mode') === 'divination'
          ? 'divination'
          : 'single';
    setEntryMode(nextEntryMode);

    if (nextEntryMode === 'divination') {
      return;
    }

    setForm((current) =>
      current.analysisMode === nextEntryMode
        ? current
        : {
            ...current,
            analysisMode: nextEntryMode,
          },
    );
  }, [searchParams]);

  useEffect(() => {
    if (!isBirthPlaceModalOpen || birthPlaceCascadeModule) {
      return;
    }

    void ensureBirthPlaceCascadeModule();
  }, [birthPlaceCascadeModule, isBirthPlaceModalOpen]);

  useEffect(() => {
    if (!birthPlaceCascadeModule) {
      return;
    }

    const birthPlace = String(getPersonValue(form, activeBirthPlaceTarget, 'birthPlace') || '');
    const matched = birthPlace
      ? birthPlaceCascadeModule.findBirthPlaceCascadeByDisplayName(birthPlace)
      : null;

    setDraftProvinceId(matched?.province.id || '');
    setDraftCityId(matched?.city.id || '');
    setDraftDistrictId(matched?.district.id || '');
  }, [activeBirthPlaceTarget, birthPlaceCascadeModule, form]);

  useEffect(() => {
    if (!isBirthPlaceModalOpen || birthPlaceSearch) {
      return;
    }

    const timer = window.setTimeout(() => {
      document
        .getElementById(`birth-place-province-${draftProvinceId}`)
        ?.scrollIntoView({ block: 'center', inline: 'nearest' });
      document
        .getElementById(`birth-place-city-${draftCityId}`)
        ?.scrollIntoView({ block: 'center', inline: 'nearest' });
      document
        .getElementById(`birth-place-district-${draftDistrictId}`)
        ?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, 30);

    return () => window.clearTimeout(timer);
  }, [birthPlaceSearch, draftCityId, draftDistrictId, draftProvinceId, isBirthPlaceModalOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      upsertPersonalHistory(form);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    form.name,
    form.gender,
    form.dateType,
    form.year,
    form.month,
    form.day,
    form.timeIndex,
    form.isLeapMonth,
    form.useTrueSolarTime,
    form.birthHour,
    form.birthMinute,
    form.birthPlace,
    form.birthLongitude,
  ]);

  useEffect(() => {
    if (form.analysisMode !== 'compatibility') {
      return;
    }

    const timer = window.setTimeout(() => {
      upsertCompatibilityHistory(form);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    form.analysisMode,
    form.partnerName,
    form.partnerGender,
    form.partnerDateType,
    form.partnerYear,
    form.partnerMonth,
    form.partnerDay,
    form.partnerTimeIndex,
    form.partnerIsLeapMonth,
    form.partnerUseTrueSolarTime,
    form.partnerBirthHour,
    form.partnerBirthMinute,
    form.partnerBirthPlace,
    form.partnerBirthLongitude,
  ]);

  const filteredDistrictResults = useMemo(() => {
    const query = birthPlaceSearch.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const results: Array<{
      districtId: string;
      provinceLabel: string;
      cityLabel: string;
      districtLabel: string;
    }> = [];

    for (const province of provinceOptions) {
      for (const city of province.cities) {
        for (const district of city.districts) {
          const text = [
            province.label,
            city.label,
            district.label,
            district.displayName,
            district.pinyin,
          ]
            .join('|')
            .toLowerCase();

          if (!text.includes(query)) {
            continue;
          }

          results.push({
            districtId: district.id,
            provinceLabel: province.label,
            cityLabel: city.label,
            districtLabel: district.label,
          });

          if (results.length >= 60) {
            return results;
          }
        }
      }
    }

    return results;
  }, [birthPlaceSearch, provinceOptions]);

  function updateField<K extends keyof QueryInputState>(key: K, value: QueryInputState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePersonField(
    role: PersonRole,
    key: keyof typeof SELF_FIELD_MAP,
    value: QueryInputState[keyof QueryInputState],
  ) {
    const fieldKey = getFieldKey(role, key) as keyof QueryInputState;
    updateField(fieldKey, value as QueryInputState[keyof QueryInputState]);
  }

  function updateNumericField(
    role: PersonRole,
    key: 'year' | 'month' | 'day' | 'birthHour' | 'birthMinute',
    value: string,
  ) {
    if (value === '' || /^\d*$/.test(value)) {
      updatePersonField(role, key, value);
    }
  }

  function getTrueSolarTimeLabel(role: PersonRole) {
    const hour = Number(getPersonValue(form, role, 'birthHour'));
    const minute = Number(getPersonValue(form, role, 'birthMinute'));

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return '';
    }

    const timeIndex = getTimeIndexFromClock(hour, minute);
    const matched = BIRTH_TIME_OPTIONS[timeIndex];
    return matched ? `当前对应时辰：${matched.label}（${matched.range}）` : '';
  }

  function handleSubmit() {
    setError('');
    const selfLabel = getPersonReferenceLabel(form.analysisMode, 'self');

    if (!form.year || !form.month || !form.day) {
      setError(`请填写完整的${selfLabel}信息`);
      return;
    }

    if (!form.useTrueSolarTime && form.timeIndex === '') {
      setError(`请选择${selfLabel}的出生时辰`);
      return;
    }

    if (form.useTrueSolarTime && (form.birthHour === '' || form.birthMinute === '')) {
      setError(`请填写${selfLabel}的精准出生时间`);
      return;
    }

    if (form.useTrueSolarTime && (!form.birthPlace.trim() || !form.birthLongitude.trim())) {
      setError(`请先为${selfLabel}选择出生地`);
      return;
    }

    if (form.analysisMode === 'compatibility') {
      if (!form.partnerYear || !form.partnerMonth || !form.partnerDay) {
        setError('请填写完整的第二人信息');
        return;
      }

      if (!form.partnerUseTrueSolarTime && form.partnerTimeIndex === '') {
        setError('请选择第二人的出生时辰');
        return;
      }

      if (
        form.partnerUseTrueSolarTime &&
        (form.partnerBirthHour === '' || form.partnerBirthMinute === '')
      ) {
        setError('请填写第二人的精准出生时间');
        return;
      }

      if (
        form.partnerUseTrueSolarTime &&
        (!form.partnerBirthPlace.trim() || !form.partnerBirthLongitude.trim())
      ) {
        setError('请先为第二人选择出生地');
        return;
      }
    }

    navigate({
      pathname: '/result',
      search: `?${buildResultSearch(form, {
        ...defaultPromptState,
        tab: 'bazi',
        promptSource: 'bazi',
        baziShortcutMode: form.analysisMode === 'compatibility' ? '合婚' : defaultPromptState.baziShortcutMode,
        baziPresetId:
          form.analysisMode === 'compatibility' ? 'ai-compat-marriage' : defaultPromptState.baziPresetId,
      })}`,
    });
  }

  function updateBirthTime(role: PersonRole, value: string) {
    if (!value) {
      updatePersonField(role, 'birthHour', '');
      updatePersonField(role, 'birthMinute', '');
      return;
    }

    const [hour, minute] = value.split(':');
    updatePersonField(role, 'birthHour', hour);
    updatePersonField(role, 'birthMinute', minute);
  }

  function openBirthPlaceModal(role: PersonRole) {
    setActiveBirthPlaceTarget(role);
    setBirthPlaceSearch('');
    setIsBirthPlaceModalOpen(true);
    void ensureBirthPlaceCascadeModule();
  }

  function closeBirthPlaceModal() {
    setBirthPlaceSearch('');
    setIsBirthPlaceModalOpen(false);
  }

  function handleProvinceSelect(provinceId: string) {
    setDraftProvinceId(provinceId);
    setDraftCityId('');
    setDraftDistrictId('');
  }

  function handleCitySelect(cityId: string) {
    setDraftCityId(cityId);
    setDraftDistrictId('');
  }

  function handleDistrictSelect(districtId: string) {
    setDraftDistrictId(districtId);
  }

  function selectDistrictFromSearch(districtId: string) {
    const matched = birthPlaceCascadeModule?.findBirthPlaceCascadeByDistrictId(districtId) ?? null;
    if (!matched) {
      return;
    }

    setDraftProvinceId(matched.province.id);
    setDraftCityId(matched.city.id);
    setDraftDistrictId(matched.district.id);
    setBirthPlaceSearch('');
  }

  function confirmBirthPlaceSelection() {
    const matched =
      draftDistrictId && birthPlaceCascadeModule
        ? birthPlaceCascadeModule.findBirthPlaceCascadeByDistrictId(draftDistrictId)
        : null;
    if (!matched) {
      return;
    }

    setForm((current) => {
      const next = { ...current };
      const placeKey = getFieldKey(activeBirthPlaceTarget, 'birthPlace');
      const longitudeKey = getFieldKey(activeBirthPlaceTarget, 'birthLongitude');
      next[placeKey] = matched.district.displayName as never;
      next[longitudeKey] = String(matched.district.longitude) as never;
      return next;
    });
    closeBirthPlaceModal();
  }

  function openBirthTimeReversePage(role: PersonRole) {
    const selfLabel = getPersonReferenceLabel(form.analysisMode, role);

    if (
      !String(getPersonValue(form, role, 'year')).trim() ||
      !String(getPersonValue(form, role, 'month')).trim() ||
      !String(getPersonValue(form, role, 'day')).trim()
    ) {
      setError(`请先填写完整的${selfLabel}出生日期`);
      return;
    }

    navigate({
      pathname: '/birth-time-reverse',
      search: `?${buildInputStateSearch(form)}&target=${role}`,
    });
  }

  function updateEntryMode(value: InputEntryMode) {
    setEntryMode(value);

    if (value !== 'divination') {
      updateField('analysisMode', value);
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('mode', value);
    setSearchParams(nextSearchParams, { replace: true });
  }

  function renderPersonForm(role: PersonRole) {
    const birthTimeValue =
      getPersonValue(form, role, 'birthHour') !== '' && getPersonValue(form, role, 'birthMinute') !== ''
        ? `${String(getPersonValue(form, role, 'birthHour')).padStart(2, '0')}:${String(
            getPersonValue(form, role, 'birthMinute'),
          ).padStart(2, '0')}`
        : '';
    const isLunar = getPersonValue(form, role, 'dateType') === 'lunar';
    const useTrueSolarTime = Boolean(getPersonValue(form, role, 'useTrueSolarTime'));
    const historyHint = role === 'self' ? '录入姓名后会自动保存。' : '合盘模式下会自动生成合盘历史。';

    return (
      <section className={`person-section ${role === 'partner' ? 'second-person' : ''}`}>
        <div className="person-section-head">
          <h2>{getPersonSectionTitle(form.analysisMode, role)}</h2>
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

          <div className="form-row">
            <label className="checkbox-label" htmlFor={`${role}-true-solar-time-input`}>
              <input
                id={`${role}-true-solar-time-input`}
                checked={useTrueSolarTime}
                type="checkbox"
                className="checkbox-input"
                onChange={(event) => updatePersonField(role, 'useTrueSolarTime', event.target.checked)}
              />
              <span>使用真太阳时</span>
            </label>
          </div>

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
                  {getTrueSolarTimeLabel(role) ? (
                    <div className="birth-time-hint">{getTrueSolarTimeLabel(role)}</div>
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
                  value={getPersonValue(form, role, 'timeIndex') === '' ? '' : Number(getPersonValue(form, role, 'timeIndex'))}
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
                {form.analysisMode === 'single' && role === 'self' ? (
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
  }

  const draftSummary = `${provinceOptions.find((item) => item.id === draftProvinceId)?.label || '未选择省份'} / ${
    cityOptions.find((item) => item.id === draftCityId)?.label || '未选择城市'
  } / ${districtOptions.find((item) => item.id === draftDistrictId)?.label || '未选择区县'}`;

  const divinationPanelFallback = (
    <div className="divination-panel-shell input-mode-loading" aria-hidden="true">
      <section className="person-section divination-form-card input-mode-loading-card">
        <div className="person-section-head input-mode-loading-head">
          <span className="skeleton-block input-mode-loading-title" />
          <span className="skeleton-block input-mode-loading-line" />
        </div>
        <div className="input-mode-loading-methods">
          {Array.from({ length: 7 }, (_, index) => (
            <span className="skeleton-block input-mode-loading-method" key={index} />
          ))}
        </div>
        <span className="skeleton-block input-mode-loading-textarea" />
        <div className="input-mode-loading-controls">
          <span className="skeleton-block input-mode-loading-control" />
          <span className="skeleton-block input-mode-loading-control" />
          <span className="skeleton-block input-mode-loading-chip" />
        </div>
        <div className="input-mode-loading-meta">
          <span className="skeleton-block input-mode-loading-field" />
          <span className="skeleton-block input-mode-loading-field" />
        </div>
      </section>
      <div className="form-actions page-submit-actions" aria-hidden="true">
        <span className="skeleton-block input-mode-loading-action" />
        <span className="skeleton-block input-mode-loading-action" />
      </div>
    </div>
  );

  return (
    <div className="page-shell input-page-shell">
      <div className="bazi-view-container">
        <div className="analysis-mode-strip">
          <div className="top-switch-control">
            <SegmentedControl
              value={entryMode}
              options={[
                { label: '个人', value: 'single' as const },
                { label: '合盘', value: 'compatibility' as const },
                { label: '占卜', value: 'divination' as const },
              ]}
              onChange={updateEntryMode}
            />
          </div>
        </div>

        <div className="analysis-view">
          {entryMode === 'divination' ? (
            <Suspense fallback={divinationPanelFallback}>
              <LazyDivinationPanel />
            </Suspense>
          ) : (
            <div className="form-wrapper">
              {renderPersonForm('self')}
              {entryMode === 'compatibility' ? renderPersonForm('partner') : null}

              {error ? <div className="form-error-text global-form-error">{error}</div> : null}

              <div
                className="form-actions page-submit-actions"
                style={{ width: '100%', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', justifyItems: 'stretch' }}
              >
                <button
                  className="secondary-page-button"
                  type="button"
                  style={{ width: '100%' }}
                  onClick={() =>
                    navigate(`/records?tab=${entryMode === 'compatibility' ? 'compatibility' : 'personal'}`)
                  }
                >
                  历史记录
                </button>
                <button
                  className="primary-button start-submit-button"
                  type="button"
                  onClick={handleSubmit}
                  style={{ width: '100%' }}
                >
                  开始排盘
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="input-page-bottom-tools">
          <div className="tutorial-entry-card">
            <div className="tutorial-entry-copy">
              <strong>第一次使用？先看教程</strong>
              <p>里面会说明三种模式分别怎么用，以及从录入到查看结果的完整步骤。</p>
            </div>
            <button
              type="button"
              className="tutorial-entry-button"
              onClick={() => navigate('/tutorial')}
            >
              查看教程
            </button>
          </div>
        </div>
      </div>

      {isBirthPlaceModalOpen ? (
        <div className="modal-backdrop" onClick={closeBirthPlaceModal}>
          <div className="modal-card birth-place-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="birth-place-modal-head">
              <h2>选择出生地</h2>
            </div>

            <div className="birth-place-modal">
              <div className="draft-selection-tip">当前暂选：{draftSummary}</div>

              <div className="birth-place-search">
                <input
                  value={birthPlaceSearch}
                  type="text"
                  className="form-input"
                  placeholder="搜索全国城市及地区"
                  onChange={(event) => setBirthPlaceSearch(event.target.value)}
                />
              </div>

              {isBirthPlaceDataLoading && provinceOptions.length === 0 ? (
                <div className="birth-place-skeleton" aria-hidden="true">
                  <span className="skeleton-block birth-place-skeleton-line" />
                  <span className="skeleton-block birth-place-skeleton-line birth-place-skeleton-line-short" />
                  <div className="birth-place-skeleton-columns">
                    {Array.from({ length: 3 }, (_, index) => (
                      <div className="birth-place-skeleton-column" key={index}>
                        <span className="skeleton-block birth-place-skeleton-title" />
                        {Array.from({ length: 5 }, (_, itemIndex) => (
                          <span
                            className="skeleton-block birth-place-skeleton-item"
                            key={itemIndex}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : birthPlaceSearch ? (
                <div className="search-results">
                  {filteredDistrictResults.map((item) => (
                    <button
                      key={item.districtId}
                      type="button"
                      className="search-result-item"
                      onClick={() => selectDistrictFromSearch(item.districtId)}
                    >
                      <span className="search-result-main">{item.districtLabel}</span>
                      <span className="search-result-sub">
                        {item.provinceLabel} / {item.cityLabel}
                      </span>
                    </button>
                  ))}
                  {filteredDistrictResults.length === 0 ? (
                    <div className="search-empty">未找到匹配地区，请换个关键词。</div>
                  ) : null}
                </div>
              ) : (
                <div className="cascade-panel">
                  <div className="cascade-column">
                    <div className="cascade-title">省份</div>
                    {provinceOptions.map((province) => (
                      <button
                        key={province.id}
                        id={`birth-place-province-${province.id}`}
                        type="button"
                        className={`cascade-item ${province.id === draftProvinceId ? 'active' : ''}`}
                        onClick={() => handleProvinceSelect(province.id)}
                      >
                        {province.label}
                      </button>
                    ))}
                  </div>
                  <div className="cascade-column">
                    <div className="cascade-title">城市</div>
                    {cityOptions.map((city) => (
                      <button
                        key={city.id}
                        id={`birth-place-city-${city.id}`}
                        type="button"
                        className={`cascade-item ${city.id === draftCityId ? 'active' : ''}`}
                        onClick={() => handleCitySelect(city.id)}
                      >
                        {city.label}
                      </button>
                    ))}
                  </div>
                  <div className="cascade-column">
                    <div className="cascade-title">区县</div>
                    {districtOptions.map((district) => (
                      <button
                        key={district.id}
                        id={`birth-place-district-${district.id}`}
                        type="button"
                        className={`cascade-item ${district.id === draftDistrictId ? 'active' : ''}`}
                        onClick={() => handleDistrictSelect(district.id)}
                      >
                        {district.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="modal-btn modal-btn-secondary" onClick={closeBirthPlaceModal}>
                  取消
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn-primary"
                  disabled={!draftDistrictId}
                  onClick={confirmBirthPlaceSelection}
                >
                  确认选择
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
