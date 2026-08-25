import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import {
  WorkspaceButton,
  WorkspaceConfirmDialog,
  WorkspaceDialog,
  WorkspacePage,
  WorkspaceSurface,
} from '@/components/workspace/WorkspaceUI';
import { getFieldKey, type SELF_FIELD_MAP } from './InputPage.field-helpers';
import type { PersonRole } from '@/lib/input-labels';
import { DropdownSelect } from '@/components/DropdownSelect';

type CaseSortMode = 'recent' | 'name' | 'birth';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { cases, activeCaseId, selectCase } = useActivePersonalCase();
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<CaseSortMode>('recent');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonalHistoryRecord | null>(null);
  const [form, setForm] = useState<QueryInputState>(createNewCaseForm);
  const [error, setError] = useState('');
  const [openMenuCaseId, setOpenMenuCaseId] = useState<string | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<PersonalHistoryRecord | null>(null);
  const birthPlace = useBirthPlace({ form, setForm });
  const shouldOpenNewCase = searchParams.get('new') === '1';

  useEffect(() => {
    if (!shouldOpenNewCase) return;
    setEditingRecord(null);
    setForm(createNewCaseForm());
    setError('');
    setIsEditorOpen(true);
    setSearchParams({}, { replace: true });
  }, [setSearchParams, shouldOpenNewCase]);

  useEffect(() => {
    if (!openMenuCaseId) return;
    const closeMenu = () => setOpenMenuCaseId(null);
    const closeMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeMenuWithEscape);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeMenuWithEscape);
    };
  }, [openMenuCaseId]);

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
        if (sortMode === 'name') {
          return left.name.localeCompare(right.name, 'zh-CN', {
            numeric: true,
            sensitivity: 'base',
          });
        }
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
      { allowIdentityChange: true },
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
    setCaseToDelete(record);
  }

  function confirmDeleteCase() {
    if (!caseToDelete) return;
    removePersonalHistory(caseToDelete.id);
    setCaseToDelete(null);
  }

  return (
    <div className="workspace-case-page">
      <WorkspacePage
        title="案例"
        width="wide"
        action={
          <WorkspaceButton variant="primary" onClick={openNewCaseEditor}>
            新建案例
          </WorkspaceButton>
        }
      >
        <WorkspaceSurface variant="plain" className="case-page-section">
          <div className="case-page-toolbar">
            <input
              type="search"
              className="workspace-ui-control"
              value={searchText}
              placeholder="搜索姓名、日期或出生地"
              aria-label="搜索案例"
              onChange={(event) => setSearchText(event.target.value)}
            />
            <DropdownSelect
              value={sortMode}
              ariaLabel="案例排序"
              variant="field"
              options={[
                { value: 'recent', label: '最近使用' },
                { value: 'name', label: '姓名顺序' },
                { value: 'birth', label: '出生日期' },
              ]}
              onChange={setSortMode}
            />
          </div>

          {visibleCases.length ? (
            <div className="case-card-grid">
              {visibleCases.map((record) => (
                <article
                  className={`case-card${activeCaseId === record.id ? ' is-active' : ''}`}
                  key={record.id}
                >
                  <button
                    type="button"
                    className="case-card-open"
                    onClick={() => openCase(record)}
                    aria-label={`打开案例 ${record.name}，${record.birthText}`}
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
                  </button>
                  <div className="case-card-menu" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="case-card-menu-trigger"
                      aria-label={`管理案例 ${record.name}`}
                      aria-haspopup="menu"
                      aria-expanded={openMenuCaseId === record.id}
                      onClick={() =>
                        setOpenMenuCaseId((current) => (current === record.id ? null : record.id))
                      }
                    >
                      ···
                    </button>
                    {openMenuCaseId === record.id ? (
                      <div className="case-card-menu-popover" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuCaseId(null);
                            openCaseEditor(record);
                          }}
                        >
                          编辑资料
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuCaseId(null);
                            togglePersonalHistoryPin(record.id);
                          }}
                        >
                          {record.pinned ? '取消置顶' : '置顶案例'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="is-danger"
                          onClick={() => {
                            setOpenMenuCaseId(null);
                            deleteCase(record);
                          }}
                        >
                          删除案例
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="workspace-ui-empty">
              {cases.length ? '没有匹配的案例' : '还没有案例'}
            </div>
          )}
        </WorkspaceSurface>
      </WorkspacePage>

      {isEditorOpen ? (
        <WorkspaceDialog
          className="case-editor-modal"
          backdropClassName="case-editor-backdrop"
          labelledBy="case-editor-title"
          onClose={closeEditor}
        >
          <header className="workspace-ui-dialog-header case-editor-head">
            <h2 id="case-editor-title">{editingRecord ? '编辑案例' : '新建案例'}</h2>
            <WorkspaceButton
              variant="ghost"
              size="small"
              aria-label="关闭案例编辑"
              onClick={closeEditor}
            >
              关闭
            </WorkspaceButton>
          </header>
          <div className="workspace-ui-dialog-body case-editor-body">
            <PersonForm
              role="self"
              form={form}
              updatePersonField={updatePersonField}
              updateNumericField={updateNumericField}
              updateBirthTime={updateBirthTime}
              openBirthPlaceModal={birthPlace.openBirthPlaceModal}
              sectionTitle="出生资料"
            />
            {error ? <div className="workspace-ui-form-error">{error}</div> : null}
          </div>
          <footer className="workspace-ui-dialog-footer case-editor-actions">
            <WorkspaceButton onClick={closeEditor}>取消</WorkspaceButton>
            <WorkspaceButton variant="primary" onClick={saveCase}>
              保存案例
            </WorkspaceButton>
          </footer>
        </WorkspaceDialog>
      ) : null}

      {caseToDelete ? (
        <WorkspaceConfirmDialog
          title="删除案例"
          message={`确定删除“${caseToDelete.name}”吗？删除后无法恢复。`}
          onClose={() => setCaseToDelete(null)}
          onConfirm={confirmDeleteCase}
        />
      ) : null}

      <BirthPlaceModal birthPlace={birthPlace} backdropClassName="case-birth-place-backdrop" />
    </div>
  );
}
