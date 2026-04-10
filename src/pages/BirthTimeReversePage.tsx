import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageTopbar } from '@/components/PageTopbar';
import { type PersonRole } from '@/lib/input-labels';
import {
  buildInputSearch,
  parseInputState,
} from '@/lib/query-state';
import {
  DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  REVERSE_BIRTH_TIME_SELECT_FIELDS,
  REVERSE_BIRTH_TIME_TEXT_FIELDS,
  buildReverseBirthTimePrompt,
  buildThreePillarsProfile,
  type ReverseBirthTimeFormData,
} from '@/lib/birth-time-reverse';
import { shouldShowPromptShareButton } from '@/lib/prompt-page-rules';

async function shareText(text: string) {
  if (navigator.share) {
    await navigator.share({ text });
    return true;
  }

  return false;
}

export function BirthTimeReversePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copyState, setCopyState] = useState('复制');
  const [shareState, setShareState] = useState('分享');
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  const [formData, setFormData] = useState<ReverseBirthTimeFormData>(
    DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  );

  const inputState = useMemo(() => parseInputState(searchParams), [searchParams]);
  const target = (searchParams.get('target') === 'partner' ? 'partner' : 'self') as PersonRole;
  const isReverseAvailable = inputState.analysisMode === 'single' && target === 'self';
  const backSearch = useMemo(() => {
    const mode = inputState.analysisMode === 'compatibility' ? 'compatibility' : 'single';
    return `?mode=${mode}&${buildInputSearch(searchParams)}`;
  }, [inputState.analysisMode, searchParams]);

  const targetInput = target === 'partner'
    ? {
        gender: inputState.partnerGender,
        dateType: inputState.partnerDateType,
        year: inputState.partnerYear,
        month: inputState.partnerMonth,
        day: inputState.partnerDay,
        isLeapMonth: inputState.partnerIsLeapMonth,
      }
    : {
        gender: inputState.gender,
        dateType: inputState.dateType,
        year: inputState.year,
        month: inputState.month,
        day: inputState.day,
        isLeapMonth: inputState.isLeapMonth,
      };

  const profile = useMemo(() => {
    try {
      return buildThreePillarsProfile(targetInput);
    } catch {
      return null;
    }
  }, [targetInput]);

  const promptText = useMemo(() => {
    if (!profile || !isReverseAvailable) {
      return '';
    }

    return buildReverseBirthTimePrompt({
      profile,
      formData,
    });
  }, [formData, isReverseAvailable, profile]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setCopyState('复制');
    setShareState('分享');
  }, [promptText]);

  function updateFormData<K extends keyof ReverseBirthTimeFormData>(
    key: K,
    value: ReverseBirthTimeFormData[K],
  ) {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleCopy() {
    if (!promptText) {
      setCopyState('暂无内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      setCopyState('已复制');
    } catch {
      setCopyState('复制失败');
    }
  }

  async function handleShare() {
    if (!promptText) {
      setShareState('暂无内容');
      return;
    }

    try {
      const ok = await shareText(promptText);
      setShareState(ok ? '已调起系统分享' : '当前设备不支持系统分享');
    } catch {
      setShareState('分享失败');
    }
  }

  const showShareButton = shouldShowPromptShareButton({
    viewportWidth,
    hasNavigatorShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  });

  return (
    <div className="page-shell">
      <PageTopbar
        title="反推时辰"
        wide
        onBack={() => navigate(`/${backSearch}`)}
      />

      <div className="workspace-grid">
        <section className="panel input-panel">
          <div className="panel-head">
            <div>
              <h2>补充信息</h2>
              <p>所有选项都可以留空，只填写你确定的内容即可，项目会自动整理进提示词。</p>
            </div>
          </div>

          <div className="field-list">
            <div className="field-card">
              <div className="field-header">
                <span>当前对象</span>
              </div>
              <div className="prompt-send-tip">
                所有选项都可以留空，只填你确定的部分即可。
              </div>
            </div>

            {REVERSE_BIRTH_TIME_SELECT_FIELDS.map((field) => (
              <label className="field-card" key={field.id}>
                <div className="field-header">
                  <span>{field.label}</span>
                </div>
                <small className="field-helper-top">{field.helper}</small>
                <select
                  value={formData[field.id]}
                  onChange={(event) => updateFormData(field.id, event.target.value)}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            {REVERSE_BIRTH_TIME_TEXT_FIELDS.map((field) => (
              <label className="field-card" key={field.id}>
                <div className="field-header">
                  <span>{field.label}</span>
                </div>
                <small className="field-helper-top">{field.helper}</small>
                {field.inputType === 'textarea' ? (
                  <textarea
                    rows={field.rows ?? 3}
                    value={formData[field.id]}
                    placeholder={field.placeholder}
                    onChange={(event) => updateFormData(field.id, event.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData[field.id]}
                    placeholder={field.placeholder}
                    onChange={(event) => updateFormData(field.id, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        <section className="panel panel-output">
          <div className="panel-head">
            <div>
              <h2>提示词正文</h2>
              <p>把这一整段发给外部 AI，它会先基于三柱向你提问，再逐步反推最可能的时辰。</p>
            </div>
            <div className="action-row compact-actions">
              <button className="copy-button secondary-button" type="button" onClick={handleCopy}>
                {copyState}
              </button>
              {showShareButton ? (
                <button className="copy-button" type="button" onClick={handleShare}>
                  {shareState}
                </button>
              ) : null}
            </div>
          </div>

          {!isReverseAvailable ? (
            <div className="prompt-send-tip">反推时辰提示词仅支持个人模式使用。</div>
          ) : !profile ? (
            <div className="prompt-send-tip">请先返回输入页，补完整的出生年月日后再生成反推时辰提示词。</div>
          ) : (
            <>
              <div className="prompt-send-tip">
                点击复制后，发送到你常用的在线 AI 软件继续提问。
              </div>
              <pre className="result-pre">{promptText}</pre>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
