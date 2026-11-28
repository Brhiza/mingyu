import * as React from 'react';
import { BookA, Inbox, Sparkles } from 'lucide-react';
import type { Method } from '../../../core';
import { loadGlobalRules } from '../../../web-settings';
import { runCalculateInBackground } from '../../../workers/calc-runner';
import { Select } from '../../../components/ui';
import { WorkspaceSkeleton } from '../WorkspaceSkeleton';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import type { CultureToolTabId } from './culture-types';

interface NameAnalysisData {
  surname: string;
  given: string;
  chars: Array<{
    char: string;
    pinyin?: string;
    kangxiStrokes: number;
    wuxing?: string;
    definition?: string;
  }>;
  grids: Record<
    string,
    { num: number; wuxing: string; role: string; level: string; keywords: string }
  >;
  sancai: { combo: string; level: string; text: string };
}

const GRID_LABELS: Record<string, string> = {
  tian: '天格',
  ren: '人格',
  di: '地格',
  wai: '外格',
  zong: '总格',
};

const TAB_LABEL_MAP: Record<CultureToolTabId, string> = {
  'character-query': '汉字字典',
  'chinese-name': '姓名五格',
  'chinese-naming': '起名方案',
  'number-energy': '数字能量',
};

function formatFriendlyCultureError(err: unknown): string {
  const raw = err instanceof Error ? err.message.trim() : '';
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw) as Array<{
        code?: string;
        minimum?: number;
        maximum?: number;
        path?: unknown[];
      }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const issue = parsed[0];
        const field = String(issue.path?.[0] ?? '');
        const fieldLabels: Record<string, string> = {
          fullName: '完整姓名',
          surname: '姓氏',
          characters: '汉字输入',
          number: '数字',
          year: '公历年份',
          hexagram: '卦象',
        };
        const fieldLabel = fieldLabels[field] ?? '输入内容';
        if (issue.code === 'too_small' && typeof issue.minimum === 'number') {
          return `${fieldLabel}至少需要输入 ${issue.minimum} 个字符，请补充完整后再试。`;
        }
        if (issue.code === 'too_big' && typeof issue.maximum === 'number') {
          return `${fieldLabel}超出允许范围，请调整后再试。`;
        }
        return `${fieldLabel}填写有误，请检查后再试。`;
      }
    } catch {}
  }
  return raw && !/invalid input/i.test(raw) ? raw : '输入内容格式有误，请检查后重试。';
}

function NameAnalysisCard({ analysis }: { analysis: NameAnalysisData }) {
  return (
    <article className="culture-name-report">
      <header>
        <div>
          <h3>{`${analysis.surname}${analysis.given}`}</h3>
          <p>{analysis.chars.map((c) => c.pinyin ?? '读音待补').join(' · ')}</p>
        </div>
      </header>

      <div className="culture-character-list">
        {analysis.chars.map((c, idx) => (
          <div key={`${c.char}-${idx}`}>
            <strong>{c.char}</strong>
            <span>{c.pinyin ?? ''}</span>
            <small>{`康熙 ${c.kangxiStrokes} 画 · ${c.wuxing ?? '待定'}`}</small>
            {c.definition ? <p>{c.definition}</p> : null}
          </div>
        ))}
      </div>

      <div className="culture-tradition-heading">
        <strong>五格与三才</strong>
      </div>

      <div className="culture-grid-list">
        {Object.entries(analysis.grids).map(([k, g]) => (
          <div key={k}>
            <span>{`${GRID_LABELS[k] ?? k}（${g.role}）`}</span>
            <strong>{String(g.num)}</strong>
            <small>{`${g.wuxing} · ${g.level}`}</small>
            <p>{g.keywords}</p>
          </div>
        ))}
      </div>

      <div className="culture-sancai">
        <strong>{`三才配置 · ${analysis.sancai.combo}（${analysis.sancai.level}）`}</strong>
        <span>{analysis.sancai.text}</span>
      </div>
    </article>
  );
}

export interface CultureToolsPanelProps {
  initialMethod?: CultureToolTabId;
  hideHeader?: boolean;
  onChange?: (method: Method, payload: Record<string, unknown>) => void;
  onResult?: (method: Method, payload: Record<string, unknown>, result: unknown) => void;
}

export default function CultureToolsPanel({
  initialMethod = 'character-query',
  hideHeader = false,
  onChange,
  onResult,
}: CultureToolsPanelProps) {
  const activeTab: CultureToolTabId = initialMethod;

  // 1. 汉字字典状态
  const [hanziMode, setHanziMode] = React.useState<'text' | 'search'>('text');
  const [hanziText, setHanziText] = React.useState('');
  const [hanziSearchStrokes, setHanziSearchStrokes] = React.useState('');
  const [hanziSearchWuxing, setHanziSearchWuxing] = React.useState<
    '' | '金' | '木' | '水' | '火' | '土'
  >('');
  const [hanziSearchPinyin, setHanziSearchPinyin] = React.useState('');

  // 2. 姓名五格分析状态
  const [fullName, setFullName] = React.useState('');
  const [surnameLength, setSurnameLength] = React.useState<1 | 2>(1);
  const [nameQuestion, setNameQuestion] = React.useState('');

  // 3. 起名方案生成状态
  const [namingSurname, setNamingSurname] = React.useState('');
  const [namingGender, setNamingGender] = React.useState<'general' | 'male' | 'female'>('general');
  const [namingLength, setNamingLength] = React.useState<1 | 2>(2);
  const [namingPreferredChars, setNamingPreferredChars] = React.useState('');
  const [namingForbiddenChars, setNamingForbiddenChars] = React.useState('');
  const [namingGenerationChar, setNamingGenerationChar] = React.useState('');
  const [namingGenerationPos, setNamingGenerationPos] = React.useState<'first' | 'second'>('first');
  const [selectedCandidateIdx, setSelectedCandidateIdx] = React.useState(0);

  // 4. 数字能量状态
  const [numberValue, setNumberValue] = React.useState('');
  const [numberPurpose, setNumberPurpose] = React.useState<'phone' | 'plate' | 'general'>('phone');
  const [numberQuestion, setNumberQuestion] = React.useState('');

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [idleGuideMsg, setIdleGuideMsg] = React.useState<string | null>(null);
  const [resultData, setResultData] = React.useState<unknown>(undefined);

  const validateBeforeRun = React.useCallback(
    (modeOverride = hanziMode, textOverride = hanziText): string | null => {
      if (activeTab === 'character-query' && modeOverride === 'text') {
        const cleanHan = [...textOverride.trim()].filter((c) => /\p{Script=Han}/u.test(c)).join('');
        if (!cleanHan) return '请先在左侧输入 1–20 个要解析的汉字。';
      }
      if (activeTab === 'chinese-name' && !fullName.trim()) {
        return '请先在左侧输入需要测算的完整姓名。';
      }
      if (activeTab === 'chinese-naming' && !namingSurname.trim()) {
        return '请先在左侧输入姓氏后再生成起名方案。';
      }
      if (activeTab === 'number-energy' && !numberValue.trim()) {
        return '请先在左侧输入手机号码、车牌或数字编号。';
      }
      return null;
    },
    [activeTab, fullName, hanziMode, hanziText, namingSurname, numberValue],
  );

  const buildCurrentPayload = React.useCallback(
    (modeOverride = hanziMode, textOverride = hanziText): Record<string, unknown> => {
      switch (activeTab) {
        case 'character-query': {
          if (modeOverride === 'search') {
            return {
              question: '请根据筛选条件列出匹配的汉字与五行笔画。',
              query: {
                kind: 'search',
                ...(hanziSearchStrokes ? { strokes: Number(hanziSearchStrokes) } : {}),
                ...(hanziSearchWuxing ? { wuxing: hanziSearchWuxing } : {}),
                ...(hanziSearchPinyin.trim() ? { pinyin: hanziSearchPinyin.trim() } : {}),
                commonOnly: true,
                limit: 40,
              },
            };
          }
          const cleanHan = [...textOverride.trim()]
            .filter((c) => /\p{Script=Han}/u.test(c))
            .join('');
          return {
            question: `请解析汉字「${cleanHan || '待输入'}」的康熙笔画、五行与字义。`,
            query: {
              kind: 'text',
              text: cleanHan,
              includeReferences: true,
            },
          };
        }
        case 'chinese-name':
          return {
            fullName: fullName.trim(),
            surnameLength,
            question: nameQuestion.trim() || '请解析这个名字的五格三才与字义。',
          };
        case 'chinese-naming':
          return {
            surname: namingSurname.trim(),
            gender: namingGender,
            givenNameLength: namingLength,
            ...(namingPreferredChars.trim()
              ? { preferredCharacters: namingPreferredChars.trim() }
              : {}),
            ...(namingForbiddenChars.trim()
              ? { forbiddenCharacters: namingForbiddenChars.trim() }
              : {}),
            ...(namingGenerationChar.trim()
              ? {
                  generationCharacter: [...namingGenerationChar.trim()][0],
                  generationPosition: namingGenerationPos,
                }
              : {}),
            limit: 12,
            question: `请为「${namingSurname.trim()}」姓比较并推荐合适的名字方案。`,
          };
        case 'number-energy':
          return {
            value: numberValue.trim(),
            purpose: numberPurpose,
            question: numberQuestion.trim() || '这个号码有哪些传统八星磁场取象？',
          };
      }
    },
    [
      activeTab,
      fullName,
      hanziMode,
      hanziSearchPinyin,
      hanziSearchStrokes,
      hanziSearchWuxing,
      hanziText,
      nameQuestion,
      namingForbiddenChars,
      namingGender,
      namingGenerationChar,
      namingGenerationPos,
      namingLength,
      namingPreferredChars,
      namingSurname,
      numberPurpose,
      numberQuestion,
      numberValue,
      surnameLength,
    ],
  );

  const executeAndRenderCard = React.useCallback(
    async (modeOverride?: 'text' | 'search', textOverride?: string) => {
      const m = modeOverride ?? hanziMode;
      const t = textOverride ?? hanziText;
      const missingErr = validateBeforeRun(m, t);
      if (missingErr) {
        setErrorMsg(null);
        setResultData(undefined);
        setIdleGuideMsg(missingErr);
        return;
      }
      const payload = buildCurrentPayload(m, t);
      onChange?.(activeTab, payload);
      setIdleGuideMsg(null);
      setErrorMsg(null);
      setIsLoading(true);
      try {
        if (activeTab === 'chinese-name') {
          const nameVal = String(payload.fullName ?? '').trim();
          if (nameVal.length < 2) {
            throw new Error('请输入至少 2 个汉字的完整姓名。');
          }
        }
        const res = (await runCalculateInBackground(activeTab, payload, {
          promptGuidance: loadGlobalRules().prompt,
        })) as {
          data?: unknown;
          prompt?: { text?: string };
        };
        onResult?.(activeTab, payload, res);
        setSelectedCandidateIdx(0);
        setResultData(res.data ?? null);
      } catch (err) {
        setErrorMsg(formatFriendlyCultureError(err));
      } finally {
        setIsLoading(false);
      }
    },
    [activeTab, buildCurrentPayload, hanziMode, hanziText, onChange, onResult, validateBeforeRun],
  );

  React.useEffect(() => {
    setErrorMsg(null);
    setResultData(undefined);
    const missing = validateBeforeRun();
    if (missing) {
      setIdleGuideMsg(null);
    } else {
      setIdleGuideMsg(null);
      void executeAndRenderCard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const renderResultPanel = () => {
    if (isLoading) {
      return <WorkspaceSkeleton variant="calendar" />;
    }
    if (errorMsg) {
      return (
        <div className="culture-tools-error" role="alert">
          {errorMsg}
        </div>
      );
    }
    if (idleGuideMsg !== null || resultData === undefined) {
      return (
        <div className="culture-tools-empty">
          <span aria-hidden="true">
            <BookA />
          </span>
          <h3>等待输入</h3>
          {idleGuideMsg ? <p>{idleGuideMsg}</p> : null}
        </div>
      );
    }
    if (!resultData || typeof resultData !== 'object') {
      return (
        <div className="culture-tools-empty">
          <span aria-hidden="true">
            <Inbox />
          </span>
          <h3>暂无结果</h3>
        </div>
      );
    }

    if (activeTab === 'character-query') {
      const d = resultData as {
        result?: {
          characters?: Array<{
            char: string;
            detail?: {
              pinyin?: string;
              kangxiStrokes?: number;
              simplifiedStrokes?: number;
              wuxing?: string;
              radical?: string;
              structure?: string;
              definition?: string;
              kangxiText?: string;
            } | null;
          }>;
          items?: Array<{
            char: string;
            kangxiStrokes: number;
            wuxing?: string;
            definition?: string;
          }>;
        };
      };

      return (
        <>
          <header className="culture-tools-section-heading">
            <div>
              <h2>字典结果</h2>
            </div>
          </header>
          {d.result?.characters ? (
            <div className="culture-character-list is-analysis">
              {d.result.characters.map((item, idx) => {
                const det = item.detail;
                return (
                  <div key={`${item.char}-${idx}`}>
                    <strong>{item.char}</strong>
                    {det ? (
                      <>
                        <span>{det.pinyin ?? '读音待补'}</span>
                        <small>{`简体 ${det.simplifiedStrokes ?? '—'} 画 · 部首 ${det.radical ?? '—'} · ${det.structure ?? '—'}`}</small>
                        <small>{`姓名学康熙 ${det.kangxiStrokes ?? '—'} 画 · 五行属${det.wuxing ?? '待定'}`}</small>
                        <p>{det.definition ?? '暂无释义'}</p>
                        {det.kangxiText ? (
                          <details className="culture-character-classic">
                            <summary>康熙字典原文</summary>
                            <p>{det.kangxiText}</p>
                          </details>
                        ) : null}
                      </>
                    ) : (
                      <p>字典暂未收录这个字。</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : d.result?.items ? (
            <div className="culture-character-pool">
              <h3>{`符合条件的字（共 ${d.result.items.length} 字，点击查看详情）`}</h3>
              <div>
                {d.result.items.map((item) => (
                  <button
                    key={item.char}
                    type="button"
                    title={item.definition ?? ''}
                    onClick={() => {
                      setHanziMode('text');
                      setHanziText(item.char);
                      void executeAndRenderCard('text', item.char);
                    }}
                  >
                    <strong>{item.char}</strong>
                    <small>{`${item.kangxiStrokes}画 · ${item.wuxing ?? '待定'}`}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      );
    }

    if (activeTab === 'chinese-name') {
      const d = resultData as { analysis?: NameAnalysisData };
      if (!d.analysis) return null;
      return (
        <>
          <header className="culture-tools-section-heading">
            <div>
              <h2>综合结果</h2>
            </div>
          </header>
          <NameAnalysisCard analysis={d.analysis} />
        </>
      );
    }

    if (activeTab === 'chinese-naming') {
      const d = resultData as {
        candidates?: Array<{ fullName: string; analysis: NameAnalysisData }>;
      };
      const cands = d.candidates ?? [];
      const activeIdx = selectedCandidateIdx < cands.length ? selectedCandidateIdx : 0;
      return (
        <>
          <header className="culture-tools-section-heading">
            <div>
              <h2>候选比较</h2>
            </div>
          </header>
          {!cands.length ? (
            <div className="culture-tools-empty">
              <span aria-hidden="true">
                <Sparkles />
              </span>
              <h3>暂无候选名字</h3>
            </div>
          ) : (
            <>
              <div className="culture-name-grid">
                {cands.map((cand, idx) => {
                  const wuxings = cand.analysis.chars
                    .slice(cand.analysis.surname.length)
                    .map((c) => c.wuxing ?? '')
                    .join('');
                  return (
                    <button
                      key={`${cand.fullName}-${idx}`}
                      type="button"
                      className={idx === activeIdx ? 'is-selected' : ''}
                      onClick={() => setSelectedCandidateIdx(idx)}
                    >
                      <strong>{cand.fullName}</strong>
                      <small>{`${cand.analysis.sancai.combo} · ${wuxings}`}</small>
                    </button>
                  );
                })}
              </div>
              <NameAnalysisCard analysis={cands[activeIdx]!.analysis} />
            </>
          )}
        </>
      );
    }

    if (activeTab === 'number-energy') {
      const d = resultData as {
        alphanumeric?: string;
        energySequence?: string;
        energyFormula?: string;
        dominantFields?: string[];
        primaryIndex?: number;
        primaryNumerology?: { poem: string; level: string };
        magneticSummary?: {
          pairCount: number;
          supportiveCount: number;
          steadyCount: number;
          challengingCount: number;
        };
        magneticDistribution?: Array<{ name: string; nature: string; count: number }>;
        energyPairs?: Array<{
          span: string;
          name: string;
          nature: string;
          keywords: string[];
          meaning: string;
        }>;
      };
      return (
        <>
          <header className="culture-tools-section-heading">
            <div>
              <h2>磁场结果</h2>
            </div>
          </header>
          <article className="culture-number-report">
            <div className="culture-number-main">
              <span>能量序列</span>
              <strong>{d.energySequence ?? ''}</strong>
              <p>
                {`数字字母：${d.alphanumeric ?? numberValue} · 八十一数理 #${
                  d.primaryIndex ?? ''
                }（${d.primaryNumerology?.level ?? ''}：${d.primaryNumerology?.poem ?? ''}）`}
              </p>
              <h3>
                {d.dominantFields?.length
                  ? `高频磁场 · ${d.dominantFields.join('、')}`
                  : '均衡分布磁场'}
              </h3>
            </div>

            {d.magneticSummary ? (
              <div className="culture-number-stats">
                <div>
                  <span>磁场组合</span>
                  <strong>{String(d.magneticSummary.pairCount)}</strong>
                </div>
                <div>
                  <span>助益 / 守成</span>
                  <strong>
                    {`${d.magneticSummary.supportiveCount} / ${d.magneticSummary.steadyCount}`}
                  </strong>
                </div>
                <div>
                  <span>考验组合</span>
                  <strong>{String(d.magneticSummary.challengingCount)}</strong>
                </div>
              </div>
            ) : null}

            {d.magneticDistribution?.length ? (
              <section className="culture-number-distribution">
                <h3>磁场分布</h3>
                <div>
                  {d.magneticDistribution.map((item) => (
                    <span key={item.name} data-nature={item.nature}>
                      <strong>{item.name}</strong>
                      <small>{`${item.count} 组`}</small>
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {d.energyPairs?.length ? (
              <section className="culture-number-pairs">
                <h3>逐组磁场</h3>
                <div>
                  {d.energyPairs.map((p, idx) => (
                    <article key={`${p.span}-${idx}`}>
                      <div className="culture-number-pair-index">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="culture-number-pair-code">
                        <strong>{p.span}</strong>
                        <small>{p.nature}</small>
                      </div>
                      <div className="culture-number-pair-copy">
                        <header>
                          <strong>{p.name}</strong>
                          <span>{p.nature}</span>
                        </header>
                        <p>{p.keywords.join('、')}</p>
                        <small>{p.meaning}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {d.energyFormula ? (
              <div className="culture-number-rule">
                <strong>换算规则</strong>
                <span>{d.energyFormula}</span>
              </div>
            ) : null}
          </article>
        </>
      );
    }

    return null;
  };

  return (
    <div className="workspace-culture-page w-full min-w-0">
      <div className="workspace-focused-page workspace-culture-page">
        <div className="workspace-ui-page workspace-ui-screen is-wide culture-tools-page">
          {!hideHeader ? (
            <header className="workspace-ui-page-header">
              <div>
                <h1>{`择吉字理 · ${TAB_LABEL_MAP[activeTab] ?? '综合工具'}`}</h1>
              </div>
            </header>
          ) : null}

          <div className="culture-tools-workspace">
            <section className="workspace-ui-form-surface culture-tools-input-panel">
              {activeTab === 'character-query' ? (
                <>
                  <header className="culture-tools-section-heading">
                    <div>
                      <h2>查字与选字</h2>
                    </div>
                  </header>
                  <UiSegmentedControl<'text' | 'search'>
                    value={hanziMode}
                    options={[
                      { value: 'text', label: '按汉字查笔画/五行' },
                      { value: 'search', label: '按条件筛选字库' },
                    ]}
                    onChange={setHanziMode}
                  />
                  {hanziMode === 'text' ? (
                    <label className="culture-tools-field workspace-ui-field">
                      <span>汉字（1–20字）</span>
                      <input
                        type="text"
                        className="workspace-ui-control"
                        placeholder="输入待查询的汉字"
                        value={hanziText}
                        onChange={(e) => setHanziText(e.target.value)}
                      />
                    </label>
                  ) : (
                    <div className="culture-tools-fields is-three">
                      <label className="culture-tools-field workspace-ui-field">
                        <span>康熙笔画</span>
                        <input
                          type="text"
                          className="workspace-ui-control"
                          placeholder="输入笔画数（不限留空）"
                          value={hanziSearchStrokes}
                          onChange={(e) =>
                            setHanziSearchStrokes(e.target.value.replace(/[^\d]/g, ''))
                          }
                        />
                      </label>
                      <label className="culture-tools-field workspace-ui-field">
                        <span>五行</span>
                        <Select
                          value={hanziSearchWuxing}
                          onValueChange={(val) =>
                            setHanziSearchWuxing(val as typeof hanziSearchWuxing)
                          }
                        >
                          <option value="">不限</option>
                          <option value="金">金</option>
                          <option value="木">木</option>
                          <option value="水">水</option>
                          <option value="火">火</option>
                          <option value="土">土</option>
                        </Select>
                      </label>
                      <label className="culture-tools-field workspace-ui-field">
                        <span>拼音</span>
                        <input
                          type="text"
                          className="workspace-ui-control"
                          placeholder="输入拼音（不限留空）"
                          value={hanziSearchPinyin}
                          onChange={(e) => setHanziSearchPinyin(e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </>
              ) : null}

              {activeTab === 'chinese-name' ? (
                <>
                  <header className="culture-tools-section-heading">
                    <div>
                      <h2>姓名资料</h2>
                    </div>
                  </header>
                  <div className="culture-tools-fields is-two">
                    <label className="culture-tools-field workspace-ui-field">
                      <span>完整姓名</span>
                      <input
                        type="text"
                        className="workspace-ui-control"
                        placeholder="输入完整姓名"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </label>
                    <label className="culture-tools-field workspace-ui-field">
                      <span>姓氏长度</span>
                      <Select
                        value={String(surnameLength)}
                        onValueChange={(val) => setSurnameLength(Number(val) as 1 | 2)}
                      >
                        <option value="1">单姓</option>
                        <option value="2">复姓</option>
                      </Select>
                    </label>
                  </div>
                  <label className="culture-tools-field workspace-ui-field">
                    <span>想重点了解什么</span>
                    <textarea
                      className="workspace-ui-control"
                      rows={3}
                      placeholder="输入你想重点分析的使用场景或关注方向（可选）"
                      value={nameQuestion}
                      onChange={(e) => setNameQuestion(e.target.value)}
                    />
                  </label>
                </>
              ) : null}

              {activeTab === 'chinese-naming' ? (
                <>
                  <header className="culture-tools-section-heading">
                    <div>
                      <h2>基础偏好</h2>
                    </div>
                  </header>
                  <div className="culture-tools-fields is-three">
                    <label className="culture-tools-field workspace-ui-field">
                      <span>姓氏</span>
                      <input
                        type="text"
                        className="workspace-ui-control"
                        placeholder="输入姓氏"
                        value={namingSurname}
                        onChange={(e) => setNamingSurname(e.target.value)}
                      />
                    </label>
                    <label className="culture-tools-field workspace-ui-field">
                      <span>名字气质</span>
                      <Select
                        value={namingGender}
                        onValueChange={(val) => setNamingGender(val as typeof namingGender)}
                      >
                        <option value="general">自然通用</option>
                        <option value="male">偏阳刚</option>
                        <option value="female">偏柔和</option>
                      </Select>
                    </label>
                    <label className="culture-tools-field workspace-ui-field">
                      <span>名字字数</span>
                      <Select
                        value={String(namingLength)}
                        onValueChange={(val) => setNamingLength(Number(val) as 1 | 2)}
                      >
                        <option value="2">双字名</option>
                        <option value="1">单字名</option>
                      </Select>
                    </label>
                  </div>
                  <div className="culture-tools-fields is-two">
                    <label className="culture-tools-field workspace-ui-field">
                      <span>偏好字</span>
                      <input
                        type="text"
                        className="workspace-ui-control"
                        placeholder="如：明 朗（空格分隔）"
                        value={namingPreferredChars}
                        onChange={(e) => setNamingPreferredChars(e.target.value)}
                      />
                    </label>
                    <label className="culture-tools-field workspace-ui-field">
                      <span>忌用字</span>
                      <input
                        type="text"
                        className="workspace-ui-control"
                        placeholder="如：尘 寒（可选）"
                        value={namingForbiddenChars}
                        onChange={(e) => setNamingForbiddenChars(e.target.value)}
                      />
                    </label>
                    <label className="culture-tools-field workspace-ui-field">
                      <span>辈分字</span>
                      <input
                        type="text"
                        className="workspace-ui-control"
                        placeholder="单个汉字（可选）"
                        value={namingGenerationChar}
                        onChange={(e) => setNamingGenerationChar(e.target.value)}
                      />
                    </label>
                    <label className="culture-tools-field workspace-ui-field">
                      <span>辈分字位置</span>
                      <Select
                        value={namingGenerationPos}
                        onValueChange={(val) =>
                          setNamingGenerationPos(val as 'first' | 'second')
                        }
                      >
                        <option value="first">名字首字</option>
                        <option value="second">名字末字</option>
                      </Select>
                    </label>
                  </div>
                </>
              ) : null}

              {activeTab === 'number-energy' ? (
                <>
                  <header className="culture-tools-section-heading">
                    <div>
                      <h2>输入内容</h2>
                    </div>
                  </header>
                  <UiSegmentedControl<'phone' | 'plate' | 'general'>
                    value={numberPurpose}
                    options={[
                      { value: 'phone', label: '手机号' },
                      { value: 'plate', label: '车牌号' },
                      { value: 'general', label: '其他编号' },
                    ]}
                    onChange={setNumberPurpose}
                  />
                  <label className="culture-tools-field workspace-ui-field">
                    <span>数字或字母</span>
                    <input
                      type="text"
                      className="workspace-ui-control"
                      placeholder={
                        numberPurpose === 'plate'
                          ? '输入车牌号码'
                          : numberPurpose === 'phone'
                            ? '输入手机号码'
                            : '输入数字或编号序列'
                      }
                      value={numberValue}
                      onChange={(e) => setNumberValue(e.target.value)}
                    />
                  </label>
                  <label className="culture-tools-field workspace-ui-field">
                    <span>想重点了解什么</span>
                    <textarea
                      className="workspace-ui-control"
                      rows={3}
                      placeholder="输入你想重点关注的使用场景或方面（可选）"
                      value={numberQuestion}
                      onChange={(e) => setNumberQuestion(e.target.value)}
                    />
                  </label>
                </>
              ) : null}

              <button
                type="button"
                className="culture-tools-primary workspace-ui-button is-primary is-large is-block"
                onClick={() => void executeAndRenderCard()}
              >
                {activeTab === 'character-query'
                  ? hanziMode === 'text'
                    ? '解析汉字'
                    : '筛选汉字'
                  : activeTab === 'chinese-name'
                    ? '解析姓名'
                    : activeTab === 'chinese-naming'
                      ? '生成候选名'
                      : '解析数字'}
              </button>
            </section>

            <section className="workspace-ui-form-surface culture-tools-result-panel">
              {renderResultPanel()}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
