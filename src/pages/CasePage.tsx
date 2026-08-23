import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';
import {
  removePersonalHistory,
  togglePersonalHistoryPin,
  upsertPersonalHistory,
  type PersonalHistoryRecord,
} from '@/lib/history-records';
import { buildPersonalRecordPath } from '@/lib/case-navigation';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { useBirthPlace } from '@/hooks/useBirthPlace';
import { clampNumericField, validateBirthInput } from '@/lib/input-validation';
import { defaultInputState, type QueryInputState } from '@/lib/query-state';
import { BirthPlaceModal } from './InputPage.BirthPlaceModal';
import { PersonForm } from './InputPage.PersonForm';
import { getFieldKey, type SELF_FIELD_MAP } from './InputPage.field-helpers';
import type { PersonRole } from '@/lib/input-labels';

type CaseSortMode = 'recent' | 'birth';

function createNewCaseForm(): QueryInputState {
  return {
    ...defaultInputState,
    analysisMode: 'single',
    chartType: 'bazi',
    useTrueSolarTime: false,
  };
}

function getCaseActivityTime(record: PersonalHistoryRecord) {
  return record.lastUsedAt ?? record.updatedAt;
}

function formatActivityTime(record: PersonalHistoryRecord) {
  const value = getCaseActivityTime(record);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatBirthTime(record: PersonalHistoryRecord) {
  if (record.input.useTrueSolarTime) {
    if (record.input.birthHour === '' || record.input.birthMinute === '') return '时间待补充';
    return `${String(record.input.birthHour).padStart(2, '0')}:${String(
      record.input.birthMinute,
    ).padStart(2, '0')}`;
  }
  if (record.input.timeIndex === '') return '时辰待补充';
  return BIRTH_TIME_OPTIONS[Number(record.input.timeIndex)]?.label ?? '时辰待补充';
}

function compareBirthDate(left: PersonalHistoryRecord, right: PersonalHistoryRecord) {
  const leftDate =
    Number(left.input.year) * 10000 + Number(left.input.month) * 100 + Number(left.input.day);
  const rightDate =
    Number(right.input.year) * 10000 + Number(right.input.month) * 100 + Number(right.input.day);
  return rightDate - leftDate;
}

export function CasePage() {
  const navigate = useNavigate();
  const { cases, activeCaseId, selectCase } = useActivePersonalCase();
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<CaseSortMode>('recent');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonalHistoryRecord | null>(null);
  const [form, setForm] = useState<QueryInputState>(createNewCaseForm);
  const [error, setError] = useState('');
  const birthPlace = useBirthPlace({ form, setForm });

  const visibleCases = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return cases
      .filter((record) =>
        `${record.name} ${record.birthText} ${record.input.birthPlace}`
          .toLowerCase()
          .includes(keyword),
      )
      .sort((left, right) => {
        if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1;
        if (sortMode === 'birth') return compareBirthDate(left, right);
        return getCaseActivityTime(right).localeCompare(getCaseActivityTime(left));
      });
  }, [cases, searchText, sortMode]);

  function openNewCaseEditor() {
    setEditingRecord(null);
    setForm(createNewCaseForm());
    setError('');
    setIsEditorOpen(true);
  }

  function openCaseEditor(record: PersonalHistoryRecord) {
    setEditingRecord(record);
    setForm({ ...record.input, analysisMode: 'single' });
    setError('');
    setIsEditorOpen(true);
  }

  function closeEditor() {
    birthPlace.closeBirthPlaceModal();
    setIsEditorOpen(false);
    setEditingRecord(null);
    setError('');
  }

  function updatePersonField(
    role: PersonRole,
    key: keyof typeof SELF_FIELD_MAP,
    value: QueryInputState[keyof QueryInputState],
  ) {
    const fieldKey = getFieldKey(role, key) as keyof QueryInputState;
    setForm((current) => ({ ...current, [fieldKey]: value }));
  }

  function updateNumericField(
    role: PersonRole,
    key: 'year' | 'month' | 'day' | 'birthHour' | 'birthMinute',
    value: string,
  ) {
    if (value === '' || /^\d*$/.test(value)) {
      updatePersonField(role, key, clampNumericField(key, value));
    }
  }

  function updateBirthTime(_role: PersonRole, value: string) {
    if (!value) {
      setForm((current) => ({ ...current, birthHour: '', birthMinute: '' }));
      return;
    }
    const [hour, minute] = value.split(':');
    setForm((current) => ({ ...current, birthHour: hour, birthMinute: minute }));
  }

  function validateCase() {
    if (!form.year || !form.month || !form.day) return '请填写完整出生日期';
    if (!form.useTrueSolarTime && form.timeIndex === '') return '请选择出生时辰';
    if (form.useTrueSolarTime && (form.birthHour === '' || form.birthMinute === '')) {
      return '请填写精准出生时间';
    }
    if (form.useTrueSolarTime && (!form.birthPlace.trim() || !form.birthLongitude.trim())) {
      return '请先选择出生地';
    }

    const result = validateBirthInput(
      {
        year: form.year,
        month: form.month,
        day: form.day,
        dateType: form.dateType,
        useTrueSolarTime: form.useTrueSolarTime,
        birthHour: form.birthHour,
        birthMinute: form.birthMinute,
        birthLongitude: form.birthLongitude,
      },
      '案例',
    );
    return result.ok ? '' : result.message;
  }

  function saveCase() {
    const validationError = validateCase();
    if (validationError) {
      setError(validationError);
      return;
    }

    const records = upsertPersonalHistory(
      form,
      editingRecord?.workspaceSource ?? 'bazi',
      editingRecord?.id,
    );
    const savedRecord = editingRecord
      ? records.find((record) => record.id === editingRecord.id)
      : records[0];
    if (savedRecord) selectCase(savedRecord.id);
    closeEditor();
  }

  function openCase(record: PersonalHistoryRecord) {
    selectCase(record.id);
    navigate(buildPersonalRecordPath(record));
  }

  function deleteCase(record: PersonalHistoryRecord) {
    if (!window.confirm(`确定删除“${record.name}”吗？删除后无法恢复。`)) return;
    removePersonalHistory(record.id);
  }

  return (
    <div className="page-shell input-page-shell workspace-case-page">
      <div className="bazi-view-container">
        <header className="workspace-task-header case-page-header">
          <h1>案例</h1>
          <button
            type="button"
            className="primary-button case-create-button"
            onClick={openNewCaseEditor}
          >
            新建案例
          </button>
        </header>

        <section className="history-page-section case-page-section">
          <div className="case-page-toolbar">
            <input
              type="search"
              className="form-input"
              value={searchText}
              placeholder="搜索姓名、日期或出生地"
              aria-label="搜索案例"
              onChange={(event) => setSearchText(event.target.value)}
            />
            <select
              className="form-input case-sort-select"
              value={sortMode}
              aria-label="案例排序"
              onChange={(event) => setSortMode(event.target.value as CaseSortMode)}
            >
              <option value="recent">最近使用</option>
              <option value="birth">出生日期</option>
            </select>
          </div>

          {visibleCases.length ? (
            <div className="case-card-grid">
              {visibleCases.map((record) => (
                <article
                  className={`case-card${activeCaseId === record.id ? ' is-active' : ''}`}
                  key={record.id}
                >
                  <div className="case-card-head">
                    <div>
                      <h2>{record.name}</h2>
                      <span>{record.gender === 'male' ? '男' : '女'}</span>
                    </div>
                    <div className="case-card-status">
                      {record.pinned ? <span>置顶</span> : null}
                      {activeCaseId === record.id ? <span>当前</span> : null}
                    </div>
                  </div>
                  <div className="case-card-meta">
                    <span>{record.input.dateType === 'lunar' ? '农历' : '公历'}</span>
                    <strong>{record.birthText}</strong>
                    <span>{formatBirthTime(record)}</span>
                    {record.input.birthPlace ? <span>{record.input.birthPlace}</span> : null}
                  </div>
                  <div className="case-card-last-used">最近使用 {formatActivityTime(record)}</div>
                  <div className="case-card-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => openCase(record)}
                    >
                      打开
                    </button>
                    <button type="button" onClick={() => openCaseEditor(record)}>
                      编辑
                    </button>
                    <button type="button" onClick={() => togglePersonalHistoryPin(record.id)}>
                      {record.pinned ? '取消置顶' : '置顶'}
                    </button>
                    <button type="button" className="is-danger" onClick={() => deleteCase(record)}>
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="records-empty-card">
              {cases.length ? '没有匹配的案例' : '还没有案例'}
              {!cases.length ? (
                <button type="button" className="primary-button" onClick={openNewCaseEditor}>
                  新建案例
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {isEditorOpen ? (
        <div className="modal-backdrop case-editor-backdrop" onClick={closeEditor}>
          <div
            className="modal-card case-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="case-editor-head">
              <h2 id="case-editor-title">{editingRecord ? '编辑案例' : '新建案例'}</h2>
              <button type="button" aria-label="关闭案例编辑" onClick={closeEditor}>
                ×
              </button>
            </header>
            <PersonForm
              role="self"
              form={form}
              updatePersonField={updatePersonField}
              updateNumericField={updateNumericField}
              updateBirthTime={updateBirthTime}
              openBirthPlaceModal={birthPlace.openBirthPlaceModal}
              sectionTitle="出生资料"
            />
            {error ? <div className="form-error-text global-form-error">{error}</div> : null}
            <div className="case-editor-actions">
              <button type="button" onClick={closeEditor}>
                取消
              </button>
              <button type="button" className="primary-button" onClick={saveCase}>
                保存案例
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BirthPlaceModal birthPlace={birthPlace} backdropClassName="case-birth-place-backdrop" />
    </div>
  );
}
