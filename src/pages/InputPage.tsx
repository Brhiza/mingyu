import { useEffect, useState, useTransition } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PrivacyHint } from '@/components/PrivacyHint';
import { getPersonReferenceLabel, type PersonRole } from '@/lib/input-labels';
import { upsertCompatibilityHistory, upsertPersonalHistory } from '@/lib/history-records';
import {
  buildResultSearch,
  defaultInputState,
  defaultPromptState,
  parseInputState,
  type PromptSourceKey,
  type QueryInputState,
  type ResultTabKey,
} from '@/lib/query-state';
import { clampNumericField, validateBirthInput } from '@/lib/input-validation';
import { useBirthPlace } from '@/hooks/useBirthPlace';
import { isChartWorkspaceId, type ChartWorkspaceId } from '@/lib/workspace';
import { BirthPlaceModal } from './InputPage.BirthPlaceModal';
import { PersonForm } from './InputPage.PersonForm';
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
    useTrueSolarTime: config.preciseBirthData,
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
  const [form, setForm] = useState<QueryInputState>(() => {
    const hasInputSnapshot = searchParams.has('y') || searchParams.has('year');
    return hasInputSnapshot ? parseInputState(searchParams) : createFormForTool(config);
  });
  const [error, setError] = useState('');
  const birthPlace = useBirthPlace({ form, setForm });

  useEffect(() => {
    if (!tool) return;
    const nextConfig = CHART_TOOL_CONFIG[tool];
    setError('');
    const hasInputSnapshot = searchParams.has('y') || searchParams.has('year');
    setForm(hasInputSnapshot ? parseInputState(searchParams) : createFormForTool(nextConfig));
  }, [location.key, searchParams, tool]);

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
    if (config.compatibility) {
      const partnerError = validatePerson('partner');
      if (partnerError) {
        setError(partnerError);
        return;
      }
      upsertCompatibilityHistory(form);
    } else {
      upsertPersonalHistory(form, config.promptSource);
    }

    startSubmitTransition(() => {
      navigate({
        pathname: '/result',
        search: `?${buildResultSearch(form, {
          ...defaultPromptState,
          tab: config.resultTab,
          promptSource: config.promptSource,
          baziShortcutMode: config.compatibility ? '合婚' : defaultPromptState.baziShortcutMode,
          baziPresetId: config.compatibility
            ? 'ai-compat-marriage'
            : defaultPromptState.baziPresetId,
        })}`,
      });
    });
  }

  return (
    <div className="page-shell input-page-shell workspace-input-page">
      <div className="bazi-view-container">
        <PrivacyHint />
        <div className="workspace-form-intro">
          <div>
            <span>新建{config.label}案例</span>
          </div>
          <button type="button" onClick={() => navigate('/records?tab=personal')}>
            从案例库选择
          </button>
        </div>

        <div className={`form-wrapper${config.compatibility ? ' is-compatibility' : ''}`}>
          <PersonForm
            role="self"
            form={form}
            updatePersonField={updatePersonField}
            updateNumericField={updateNumericField}
            updateBirthTime={updateBirthTime}
            openBirthPlaceModal={birthPlace.openBirthPlaceModal}
            sectionTitle={config.compatibility ? '本人资料' : '出生资料'}
            historyHint="排盘完成后会保存到当前浏览器的案例库。"
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
              historyHint="双方资料会作为一个合盘案例保存。"
            />
          ) : null}
        </div>

        {error ? <div className="form-error-text global-form-error">{error}</div> : null}

        <div className="workspace-form-actions">
          <button
            type="button"
            className="secondary-page-button"
            onClick={() => navigate('/records')}
          >
            案例库
          </button>
          <button type="button" className="primary-button" onClick={handleSubmit}>
            查看完整{config.label}盘面
          </button>
        </div>
      </div>

      {birthPlace.isBirthPlaceModalOpen ? <BirthPlaceModal birthPlace={birthPlace} /> : null}
    </div>
  );
}
