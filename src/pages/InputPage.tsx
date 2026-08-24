import { useEffect, useState, useTransition } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PrivacyHint } from '@/components/PrivacyHint';
import { getPersonReferenceLabel, type PersonRole } from '@/lib/input-labels';
import { upsertCompatibilityHistory, upsertPersonalHistory } from '@/lib/history-records';
import {
  defaultInputState,
  defaultPromptState,
  parseInputState,
  type PromptSourceKey,
  type QueryInputState,
  type ResultTabKey,
} from '@/lib/query-state';
import {
  buildChartRecordPath,
  CHART_RECORD_PARAM,
  normalizeChartInputForSource,
} from '@/lib/case-navigation';
import { clampNumericField, validateBirthInput } from '@/lib/input-validation';
import { useBirthPlace } from '@/hooks/useBirthPlace';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { isChartWorkspaceId, type ChartWorkspaceId } from '@/lib/workspace';
import type { InstantTimeStandard } from 'mingyu-core/instant';
import {
  buildFrontendInstantObserver,
  buildInstantResultPath,
  getInstantChartTypeForWorkspace,
  instantChartNeedsObserver,
} from '@/lib/instant-chart';
import { BirthPlaceModal } from './InputPage.BirthPlaceModal';
import { PersonForm } from './InputPage.PersonForm';
import {
  WorkspaceButton,
  WorkspaceDialog,
  WorkspacePage,
} from '@/components/workspace/WorkspaceUI';
import { getFieldKey, type SELF_FIELD_MAP } from './InputPage.field-helpers';

type ChartToolConfig = {
  label: string;
  chartType: QueryInputState['chartType'];
  promptSource: PromptSourceKey;
  resultTab: ResultTabKey;
  preciseBirthData: boolean;
  compatibility: boolean;
};

const CHART_TOOL_CONFIG: Record<ChartWorkspaceId, ChartToolConfig> = {
  bazi: {
    label: '八字',
    chartType: 'bazi',
    promptSource: 'bazi',
    resultTab: 'bazi',
    preciseBirthData: false,
    compatibility: false,
  },
  ziwei: {
    label: '紫微斗数',
    chartType: 'ziwei',
    promptSource: 'ziwei',
    resultTab: 'ziwei',
    preciseBirthData: false,
    compatibility: false,
  },
  'bazi-ziwei': {
    label: '八字紫微合参',
    chartType: 'bazi',
    promptSource: 'bazi-ziwei',
    resultTab: 'bazi',
    preciseBirthData: false,
    compatibility: false,
  },
  astrolabe: {
    label: '西洋星盘',
    chartType: 'astrolabe',
    promptSource: 'astrolabe',
    resultTab: 'astrolabe',
    preciseBirthData: true,
    compatibility: false,
  },
  qizheng: {
    label: '七政四余',
    chartType: 'astrolabe',
    promptSource: 'qizheng',
    resultTab: 'qizheng',
    preciseBirthData: true,
    compatibility: false,
  },
  bazhai: {
    label: '八宅风水',
    chartType: 'bazi',
    promptSource: 'bazhai',
    resultTab: 'bazhai',
    preciseBirthData: false,
    compatibility: false,
  },
  compatibility: {
    label: '双人合盘',
    chartType: 'bazi',
    promptSource: 'bazi',
    resultTab: 'bazi',
    preciseBirthData: false,
    compatibility: true,
  },
};

function createFormForTool(config: ChartToolConfig): QueryInputState {
  return {
    ...defaultInputState,
    analysisMode: config.compatibility ? 'compatibility' : 'single',
    chartType: config.chartType,
    useTrueSolarTime: false,
  };
}

function normalizeFormForTool(input: QueryInputState, config: ChartToolConfig): QueryInputState {
  return {
    ...normalizeChartInputForSource(input, config.promptSource),
    analysisMode: config.compatibility ? 'compatibility' : 'single',
  };
}

export function InputPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tool: toolParam } = useParams();
  const [searchParams] = useSearchParams();
  const [, startSubmitTransition] = useTransition();
  const tool = isChartWorkspaceId(toolParam) ? toolParam : null;
  const config = tool ? CHART_TOOL_CONFIG[tool] : CHART_TOOL_CONFIG.bazi;
  const { activeCaseId } = useActivePersonalCase();
  const routeCaseId = searchParams.get(CHART_RECORD_PARAM);
  const [form, setForm] = useState<QueryInputState>(() => {
    const hasInputSnapshot = searchParams.has('y') || searchParams.has('year');
    return hasInputSnapshot
      ? normalizeFormForTool(parseInputState(searchParams), config)
      : createFormForTool(config);
  });
  const [error, setError] = useState('');
  const [isInstantDialogOpen, setIsInstantDialogOpen] = useState(false);
  const [instantTimeStandard, setInstantTimeStandard] = useState<InstantTimeStandard>('beijing');
  const [resumeInstantDialogAfterPlace, setResumeInstantDialogAfterPlace] = useState(false);
  const birthPlace = useBirthPlace({ form, setForm });
  const instantType = getInstantChartTypeForWorkspace(tool ?? '');

  useEffect(() => {
    if (!tool) return;
    const nextConfig = CHART_TOOL_CONFIG[tool];
    setError('');
    const hasInputSnapshot = searchParams.has('y') || searchParams.has('year');
    setForm(
      hasInputSnapshot
        ? normalizeFormForTool(parseInputState(searchParams), nextConfig)
        : createFormForTool(nextConfig),
    );
  }, [location.key, searchParams, tool]);

  useEffect(() => {
    if (!resumeInstantDialogAfterPlace || birthPlace.isBirthPlaceModalOpen) return;
    if (buildFrontendInstantObserver(form)) {
      setIsInstantDialogOpen(true);
    }
    setResumeInstantDialogAfterPlace(false);
  }, [birthPlace.isBirthPlaceModalOpen, form, resumeInstantDialogAfterPlace]);

  if (!tool) {
    return <Navigate to="/chart/bazi" replace />;
  }

  function updateField<K extends keyof QueryInputState>(key: K, value: QueryInputState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
      updatePersonField(role, key, clampNumericField(key, value));
    }
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

  function validatePerson(role: PersonRole) {
    const isPartner = role === 'partner';
    const label = getPersonReferenceLabel(form.analysisMode, role);
    const year = isPartner ? form.partnerYear : form.year;
    const month = isPartner ? form.partnerMonth : form.month;
    const day = isPartner ? form.partnerDay : form.day;
    const timeIndex = isPartner ? form.partnerTimeIndex : form.timeIndex;
    const useTrueSolarTime = isPartner ? form.partnerUseTrueSolarTime : form.useTrueSolarTime;
    const birthHour = isPartner ? form.partnerBirthHour : form.birthHour;
    const birthMinute = isPartner ? form.partnerBirthMinute : form.birthMinute;
    const birthPlaceText = isPartner ? form.partnerBirthPlace : form.birthPlace;
    const birthLongitude = isPartner ? form.partnerBirthLongitude : form.birthLongitude;
    const dateType = isPartner ? form.partnerDateType : form.dateType;

    if (!year || !month || !day) return `请填写完整的${label}信息`;
    if (!useTrueSolarTime && timeIndex === '') return `请选择${label}的出生时辰`;
    if (useTrueSolarTime && (birthHour === '' || birthMinute === '')) {
      return `请填写${label}的精准出生时间`;
    }
    if (useTrueSolarTime && (!birthPlaceText.trim() || !birthLongitude.trim())) {
      return `请先为${label}选择出生地`;
    }

    const result = validateBirthInput(
      {
        year,
        month,
        day,
        dateType,
        useTrueSolarTime,
        birthHour,
        birthMinute,
        birthLongitude,
      },
      label,
    );
    return result.ok ? '' : result.message;
  }

  function handleSubmit() {
    setError('');
    const selfError = validatePerson('self');
    if (selfError) {
      setError(selfError);
      return;
    }
    let recordId: string | undefined;
    if (config.compatibility) {
      const partnerError = validatePerson('partner');
      if (partnerError) {
        setError(partnerError);
        return;
      }
      recordId = upsertCompatibilityHistory(form)[0]?.id;
    } else {
      recordId = upsertPersonalHistory(
        form,
        config.promptSource,
        routeCaseId ?? activeCaseId ?? undefined,
      )[0]?.id;
    }

    startSubmitTransition(() => {
      navigate(
        buildChartRecordPath(
          form,
          {
            ...defaultPromptState,
            tab: config.resultTab,
            promptSource: config.promptSource,
            baziShortcutMode: config.compatibility ? '合婚' : defaultPromptState.baziShortcutMode,
            baziPresetId: config.compatibility
              ? 'ai-compat-marriage'
              : defaultPromptState.baziPresetId,
          },
          recordId,
        ),
      );
    });
  }

  function openInstantLocationPicker() {
    setIsInstantDialogOpen(false);
    setResumeInstantDialogAfterPlace(true);
    birthPlace.openBirthPlaceModal('self');
  }

  function handleInstantSubmit() {
    if (!instantType) return;
    setError('');
    const observer = buildFrontendInstantObserver(form);
    if (instantChartNeedsObserver(instantType, instantTimeStandard) && !observer) {
      setError('请先选择观测地点，再使用这一时间口径即时起盘。');
      openInstantLocationPicker();
      return;
    }
    setIsInstantDialogOpen(false);
    startSubmitTransition(() => {
      navigate(
        buildInstantResultPath({
          type: instantType,
          timeStandard: instantTimeStandard,
          observer,
        }),
      );
    });
  }

  return (
    <div className={`workspace-input-page${config.compatibility ? ' is-compatibility' : ''}`}>
      <WorkspacePage
        title={config.label}
        width={config.compatibility ? 'wide' : 'default'}
        action={
          instantType ? (
            <WorkspaceButton size="small" onClick={() => setIsInstantDialogOpen(true)}>
              即时起盘
            </WorkspaceButton>
          ) : null
        }
      >
        <PrivacyHint />
        <div className={`workspace-ui-form-layout${config.compatibility ? ' is-two-column' : ''}`}>
          <PersonForm
            role="self"
            form={form}
            updatePersonField={updatePersonField}
            updateNumericField={updateNumericField}
            updateBirthTime={updateBirthTime}
            openBirthPlaceModal={birthPlace.openBirthPlaceModal}
            sectionTitle={config.compatibility ? '本人资料' : '出生资料'}
            forcePreciseBirthPlace={config.preciseBirthData}
          />
          {config.compatibility ? (
            <PersonForm
              role="partner"
              form={form}
              updatePersonField={updatePersonField}
              updateNumericField={updateNumericField}
              updateBirthTime={updateBirthTime}
              openBirthPlaceModal={birthPlace.openBirthPlaceModal}
              sectionTitle="对方资料"
            />
          ) : null}
        </div>

        {error ? <div className="workspace-ui-form-error">{error}</div> : null}

        <div className="workspace-ui-form-actions is-sticky-mobile">
          <WorkspaceButton variant="primary" size="large" block onClick={handleSubmit}>
            查看完整{config.label}盘面
          </WorkspaceButton>
        </div>
      </WorkspacePage>

      {birthPlace.isBirthPlaceModalOpen ? (
        <BirthPlaceModal
          birthPlace={birthPlace}
          purpose={resumeInstantDialogAfterPlace ? 'observer' : 'birth'}
        />
      ) : null}
      {isInstantDialogOpen && instantType ? (
        <WorkspaceDialog
          className="workspace-instant-dialog"
          labelledBy="workspace-instant-dialog-title"
          onClose={() => setIsInstantDialogOpen(false)}
        >
          <header className="workspace-ui-dialog-header">
            <div>
              <h2 id="workspace-instant-dialog-title">即时起盘</h2>
              <p>以点击起盘时的当前时刻生成，不加入案例。</p>
            </div>
          </header>
          <div className="workspace-ui-dialog-body workspace-instant-dialog-body">
            <div
              className="workspace-instant-standard is-dialog"
              role="group"
              aria-label="时间口径"
            >
              <button
                type="button"
                className={instantTimeStandard === 'beijing' ? 'is-active' : ''}
                aria-pressed={instantTimeStandard === 'beijing'}
                onClick={() => setInstantTimeStandard('beijing')}
              >
                <strong>北京时间</strong>
                <small>按东八区当前时刻</small>
              </button>
              <button
                type="button"
                className={instantTimeStandard === 'true-solar' ? 'is-active' : ''}
                aria-pressed={instantTimeStandard === 'true-solar'}
                onClick={() => setInstantTimeStandard('true-solar')}
              >
                <strong>真太阳时</strong>
                <small>按地点经度校正</small>
              </button>
            </div>
            {instantChartNeedsObserver(instantType, instantTimeStandard) ? (
              <button
                type="button"
                className="workspace-instant-place is-dialog"
                onClick={openInstantLocationPicker}
              >
                <span>观测地点</span>
                <strong>{form.birthPlace || '选择地点'}</strong>
                <span aria-hidden="true">›</span>
              </button>
            ) : null}
          </div>
          <footer className="workspace-ui-dialog-footer">
            <WorkspaceButton onClick={() => setIsInstantDialogOpen(false)}>取消</WorkspaceButton>
            <WorkspaceButton variant="primary" onClick={handleInstantSubmit}>
              立即起盘
            </WorkspaceButton>
          </footer>
        </WorkspaceDialog>
      ) : null}
    </div>
  );
}
