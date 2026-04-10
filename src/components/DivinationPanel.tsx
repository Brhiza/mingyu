import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DIVINATION_METHOD_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
} from '@/lib/divination/config';
import { generateDivinationSession, type DivinationDraft, type DivinationSession } from '@/lib/divination/engine';
import {
  DIVINATION_INSPIRATION_CONTENT,
  DIVINATION_INSPIRATION_TABS,
  getDefaultDivinationInspirationTab,
  isDivinationInspirationTabVisible,
  TAROT_SPREAD_INSPIRATION_QUESTIONS,
  type DivinationInspirationTabId,
} from '@/lib/divination/inspiration';
import { addDivinationHistory, getDivinationHistoryById } from '@/lib/history-records';
import { shouldShowPromptShareButton } from '@/lib/prompt-page-rules';
import { QuestionInspirationModal, type QuestionInspirationSection } from '@/components/QuestionInspirationModal';
import type { DivinationData } from '@/types';

const defaultDraft: DivinationDraft = {
  method: 'random',
  question: '',
  gender: '',
  birthYear: '',
  meihuaMethod: 'time',
  meihuaNumber: '',
  liurenTemplate: 'general',
  tarotSpread: 'three',
};

const methodLabelMap = Object.fromEntries(
  DIVINATION_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<DivinationDraft['method'], string>;

const meihuaMethodLabelMap = Object.fromEntries(
  MEIHUA_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['meihuaMethod']>, string>;

const tarotSpreadLabelMap = Object.fromEntries(
  TAROT_SPREAD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['tarotSpread']>, string>;

const liurenTemplateLabelMap = Object.fromEntries(
  LIUREN_TEMPLATE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<NonNullable<DivinationDraft['liurenTemplate']>, string>;

function getSummaryBlocks(method: DivinationDraft['method'], data: DivinationData) {
  switch (method) {
    case 'liuyao':
      return {
        title: '六爻起卦结果',
        tags: [
          `主卦：${'originalName' in data ? data.originalName : '未知'}`,
          `变卦：${'changedName' in data ? (data.changedName || '无') : '无'}`,
          `互卦：${'interName' in data ? (data.interName || '无') : '无'}`,
          `动爻：${'changingYaos' in data ? data.changingYaos.map((item) => item.position).join('、') || '无' : '无'}`,
        ],
        lines: [
          `宫位：${'palace' in data ? `${data.palace.name}宫` : '未知'}`,
          `特殊卦式：${'specialPattern' in data && data.specialPattern ? data.specialPattern : '常规卦'}`,
        ],
      };
    case 'meihua':
      return {
        title: '梅花起卦结果',
        tags: [
          `主卦：${'originalName' in data ? data.originalName : '未知'}`,
          `互卦：${'interName' in data ? (data.interName || '无') : '无'}`,
          `变卦：${'changedName' in data ? (data.changedName || '无') : '无'}`,
          `动爻：${'movingYao' in data ? `第${data.movingYao.position}爻` : '未知'}`,
        ],
        lines: [
          `体卦：${'tiGua' in data ? `${data.tiGua.name}（${data.tiGua.element}）` : '未知'}`,
          `用卦：${'yongGua' in data ? `${data.yongGua.name}（${data.yongGua.element}）` : '未知'}`,
        ],
      };
    case 'qimen':
      return {
        title: '奇门起局结果',
        tags: [
          `局数：${'isYangDun' in data ? `${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局` : '未知'}`,
          `值符：${'zhiFu' in data ? data.zhiFu : '未知'}`,
          `值使：${'zhiShi' in data ? data.zhiShi : '未知'}`,
        ],
        lines: [
          `节气：${'timeInfo' in data ? data.timeInfo.solarTerm : '未知'}`,
          `格局标签：${'patternTags' in data && data.patternTags?.length ? data.patternTags.join('、') : '无明显标签'}`,
        ],
      };
    case 'liuren':
      return {
        title: '大六壬起课结果',
        tags: [
          `时段：${'dayNight' in data && data.dayNight ? data.dayNight : '未知'}`,
          `月将：${'monthLeader' in data ? data.monthLeader : '未知'}`,
          `占时：${'divinationBranch' in data ? data.divinationBranch : '未知'}`,
          `初传：${'threeTransmissions' in data ? data.threeTransmissions[0]?.branch || '未知' : '未知'}`,
          `末传：${'threeTransmissions' in data ? data.threeTransmissions[2]?.branch || '未知' : '未知'}`,
        ],
        lines: [
          `贵人落地：${'noblemanBranch' in data && data.noblemanBranch ? data.noblemanBranch : '未知'}`,
          `旬空：${'xunKong' in data && data.xunKong?.length ? data.xunKong.join('、') : '未知'}`,
          `取传法：${'transmissionRule' in data && data.transmissionRule ? data.transmissionRule : '未标注'}`,
          `传态：${'transmissionPattern' in data && data.transmissionPattern ? data.transmissionPattern : '未标注'}`,
          `课体标签：${'patternTags' in data && data.patternTags?.length ? data.patternTags.join('、') : '无明显标签'}`,
          'transmissionDetail' in data && data.transmissionDetail ? `取传说明：${data.transmissionDetail}` : '',
          'lessonSummary' in data && data.lessonSummary ? `四课：${data.lessonSummary}` : '',
          'transmissionSummary' in data && data.transmissionSummary ? `三传：${data.transmissionSummary}` : '',
        ],
      };
    case 'tarot':
      return {
        title: '塔罗抽牌结果',
        tags: [
          `牌阵：${'spreadName' in data ? data.spreadName : '未知'}`,
          `张数：${'cards' in data ? `${data.cards.length} 张` : '未知'}`,
        ],
        lines:
          'cards' in data
            ? data.cards.map(
                (card) =>
                  `${card.position}：${card.name}${card.reversed ? '（逆位）' : ''}，关键词 ${card.keywords.join('、')}`,
              )
            : [],
      };
    case 'ssgw':
      return {
        title: '灵签结果',
        tags: [
          `签号：${'number' in data ? `第 ${data.number} 签` : '未知'}`,
          `签题：${'title' in data ? data.title : '未知'}`,
        ],
        lines: ['poem' in data ? `签诗：${data.poem}` : ''],
      };
    default:
      return {
        title: '占卜结果',
        tags: [],
        lines: [],
      };
  }
}

async function shareText(text: string) {
  if (navigator.share) {
    await navigator.share({ text });
    return true;
  }

  return false;
}

export function DivinationPanel() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<DivinationDraft>(defaultDraft);
  const [session, setSession] = useState<DivinationSession | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuestionInspirationModalOpen, setIsQuestionInspirationModalOpen] = useState(false);
  const [activeInspirationTab, setActiveInspirationTab] = useState<DivinationInspirationTabId>('ganqing');
  const [inspirationSearch, setInspirationSearch] = useState('');
  const [copyState, setCopyState] = useState('复制');
  const [shareState, setShareState] = useState('分享');
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);

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
  }, [session?.prompt]);

  useEffect(() => {
    if (isDivinationInspirationTabVisible(activeInspirationTab, draft)) {
      return;
    }

    setActiveInspirationTab(getDefaultDivinationInspirationTab(draft.method));
  }, [activeInspirationTab, draft]);

  useEffect(() => {
    const recordId = searchParams.get('record');
    if (!recordId) {
      return;
    }

    const record = getDivinationHistoryById(recordId);
    if (!record) {
      setError('未找到对应的占卜历史记录');
      return;
    }

    setDraft(record.draft);
    setSession(record.session);
    setError('');
    setIsSubmitting(false);

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('mode', 'divination');
    nextSearchParams.delete('record');
    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const summary = useMemo(
    () => (session ? getSummaryBlocks(session.method, session.data) : null),
    [session],
  );
  const inspirationFilters = useMemo(
    () => [
      ...(draft.method === 'tarot' ? [{ label: '牌阵', value: 'spread' as const }] : []),
      ...DIVINATION_INSPIRATION_TABS.map((item) => ({
        label: item.label,
        value: item.id,
      })),
    ],
    [draft.method],
  );
  const filteredInspirationSections = useMemo<QuestionInspirationSection[]>(() => {
    const keyword = inspirationSearch.trim();
    const includeQuestion = (question: string) => !keyword || question.includes(keyword);

    if (activeInspirationTab === 'spread') {
      const spreadName =
        TAROT_SPREAD_OPTIONS.find((item) => item.value === draft.tarotSpread)?.label || '当前牌阵';
      const items = TAROT_SPREAD_INSPIRATION_QUESTIONS[draft.tarotSpread]
        .filter(includeQuestion)
        .map((question) => ({
          id: `spread-${question}`,
          question,
        }));

      return items.length > 0
        ? [
            {
              id: 'spread',
              heading: `${spreadName}专属问题`,
              items,
            },
          ]
        : [];
    }

    return DIVINATION_INSPIRATION_CONTENT[activeInspirationTab]
      .map((section) => ({
        id: `${activeInspirationTab}-${section.heading}`,
        heading: section.heading,
        items: section.questions
          .filter(includeQuestion)
          .map((question) => ({
            id: `${section.heading}-${question}`,
            question,
          })),
      }))
      .filter((section) => section.items.length > 0);
  }, [activeInspirationTab, draft.tarotSpread, inspirationSearch]);
  const showShareButton = shouldShowPromptShareButton({
    viewportWidth,
    hasNavigatorShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  });

  function updateDraft<K extends keyof DivinationDraft>(key: K, value: DivinationDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openQuestionInspirationModal() {
    setActiveInspirationTab(getDefaultDivinationInspirationTab(draft.method));
    setInspirationSearch('');
    setIsQuestionInspirationModalOpen(true);
  }

  function applyInspiredQuestion(question: string) {
    updateDraft('question', question);
    setIsQuestionInspirationModalOpen(false);
    window.setTimeout(() => {
      questionInputRef.current?.focus();
    }, 0);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError('');
    setSession(null);

    try {
      const nextSession = await generateDivinationSession(draft);
      const savedRecord = addDivinationHistory(draft, nextSession);
      setSession(nextSession);
      if (!savedRecord) {
        return;
      }
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('mode', 'divination');
      nextSearchParams.set('record', savedRecord.id);
      setSearchParams(nextSearchParams, { replace: true });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : '占卜生成失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!session?.prompt) {
      setCopyState('暂无内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(session.prompt);
      setCopyState('已复制');
    } catch {
      setCopyState('复制失败');
    }
  }

  async function handleShare() {
    if (!session?.prompt) {
      setShareState('暂无内容');
      return;
    }

    try {
      const ok = await shareText(session.prompt);
      setShareState(ok ? '已调起系统分享' : '当前设备不支持系统分享');
    } catch {
      setShareState('分享失败');
    }
  }

  return (
    <div className="divination-panel-shell">
      <section className="person-section divination-form-card">
        <div className="person-section-head">
          <h2>传统起卦</h2>
          <p>依托传统算法，提供准确卦象。</p>
        </div>

        <div className="divination-method-grid">
          {DIVINATION_METHOD_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`divination-method-btn ${draft.method === item.value ? 'is-active' : ''}`}
              onClick={() => updateDraft('method', item.value)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>

        <div className="person-info-form">
          <div className="form-row">
            <div className="form-item">
              <label htmlFor="divination-question-input">问题</label>
              <div className="divination-question-field">
                <textarea
                  ref={questionInputRef}
                  id="divination-question-input"
                  rows={5}
                  value={draft.question}
                  className="form-input divination-textarea"
                  placeholder="例如：我现在该主动推进，还是先稳住等待更好的时机？"
                  onChange={(event) => updateDraft('question', event.target.value)}
                />

                <div className="divination-desktop-question-footer">
                  <div className="divination-desktop-question-controls">
                    {draft.method === 'meihua' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="meihua-method-select">起卦方式</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">{meihuaMethodLabelMap[draft.meihuaMethod]}</span>
                          <select
                            id="meihua-method-select"
                            value={draft.meihuaMethod}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft('meihuaMethod', event.target.value as DivinationDraft['meihuaMethod'])
                            }
                          >
                            {MEIHUA_METHOD_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'meihua' && draft.meihuaMethod === 'number' ? (
                      <div className="form-item divination-inline-field divination-inline-number-field">
                        <label htmlFor="meihua-number-input">起卦数字</label>
                        <input
                          id="meihua-number-input"
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          placeholder="例如 123"
                          value={draft.meihuaNumber}
                          onChange={(event) => updateDraft('meihuaNumber', event.target.value.replace(/[^\d]/g, ''))}
                        />
                      </div>
                    ) : null}

                    {draft.method === 'liuren' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="liuren-template-select">断课模板</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">{liurenTemplateLabelMap[draft.liurenTemplate]}</span>
                          <select
                            id="liuren-template-select"
                            value={draft.liurenTemplate}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft('liurenTemplate', event.target.value as DivinationDraft['liurenTemplate'])
                            }
                          >
                            {LIUREN_TEMPLATE_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'tarot' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="tarot-spread-select">牌阵</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">{tarotSpreadLabelMap[draft.tarotSpread]}</span>
                          <select
                            id="tarot-spread-select"
                            value={draft.tarotSpread}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft('tarotSpread', event.target.value as DivinationDraft['tarotSpread'])
                            }
                          >
                            {TAROT_SPREAD_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="quick-chip divination-desktop-inspiration-btn"
                    onClick={openQuestionInspirationModal}
                  >
                    问题灵感
                  </button>
                </div>
              </div>

              <div
                className={`divination-mobile-control-row ${
                  draft.method === 'meihua' || draft.method === 'liuren' || draft.method === 'tarot' ? 'has-secondary' : ''
                }`}
              >
                <div className="divination-mobile-method-picker">
                  <span className="divination-mobile-trigger-text divination-trigger-text">
                    {methodLabelMap[draft.method]}
                  </span>
                  <select
                    aria-label="占卜类型"
                    value={draft.method}
                    className="form-input divination-mobile-method-select divination-overlay-select"
                    onChange={(event) =>
                      updateDraft('method', event.target.value as DivinationDraft['method'])
                    }
                  >
                    {DIVINATION_METHOD_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {draft.method === 'meihua' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {meihuaMethodLabelMap[draft.meihuaMethod]}
                    </span>
                    <select
                      aria-label="起卦方式"
                      value={draft.meihuaMethod}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft('meihuaMethod', event.target.value as DivinationDraft['meihuaMethod'])
                      }
                    >
                      {MEIHUA_METHOD_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {draft.method === 'tarot' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {tarotSpreadLabelMap[draft.tarotSpread]}
                    </span>
                    <select
                      aria-label="牌阵"
                      value={draft.tarotSpread}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft('tarotSpread', event.target.value as DivinationDraft['tarotSpread'])
                      }
                    >
                      {TAROT_SPREAD_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {draft.method === 'liuren' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {liurenTemplateLabelMap[draft.liurenTemplate]}
                    </span>
                    <select
                      aria-label="断课模板"
                      value={draft.liurenTemplate}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft('liurenTemplate', event.target.value as DivinationDraft['liurenTemplate'])
                      }
                    >
                      {LIUREN_TEMPLATE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="quick-chip divination-mobile-inspiration-btn"
                  onClick={openQuestionInspirationModal}
                >
                  问题灵感
                </button>
              </div>
            </div>
          </div>

          {draft.method === 'meihua' && draft.meihuaMethod === 'number' ? (
            <div className="form-row divination-mobile-only">
              <div className="form-item">
                <label htmlFor="meihua-number-input-mobile">起卦数字</label>
                <input
                  id="meihua-number-input-mobile"
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="例如 123"
                  value={draft.meihuaNumber}
                  onChange={(event) => updateDraft('meihuaNumber', event.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
            </div>
          ) : null}

          <div className={`form-row-flex divination-meta-row ${draft.method === 'tarot' ? 'is-single' : ''}`}>
            <div className="form-item">
              <label htmlFor="divination-gender-select">性别（可选）</label>
              <select
                id="divination-gender-select"
                value={draft.gender}
                className="form-input"
                onChange={(event) => updateDraft('gender', event.target.value as DivinationDraft['gender'])}
              >
                <option value="">不填</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>

            {draft.method !== 'tarot' ? (
              <div className="form-item">
                <label htmlFor="divination-birth-year-input">出生年份（可选）</label>
                <input
                  id="divination-birth-year-input"
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="例如 1998"
                  value={draft.birthYear}
                  onChange={(event) => updateDraft('birthYear', event.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {error ? <div className="form-error-text global-form-error">{error}</div> : null}

      <div
        className="form-actions page-submit-actions"
        style={{ width: '100%', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', justifyItems: 'stretch' }}
      >
        <button
          className="secondary-page-button"
          type="button"
          onClick={() => navigate('/records?tab=divination')}
        >
          历史记录
        </button>
        <button
          className="primary-button start-submit-button"
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          开始占卜
        </button>
      </div>

      {isSubmitting ? (
        <div className="workspace-grid divination-output-grid" aria-hidden="true">
          <section className="panel divination-result-panel">
            <div className="divination-result-skeleton">
              <span className="skeleton-block divination-result-skeleton-title" />
              <div className="divination-result-skeleton-tags">
                {Array.from({ length: 4 }, (_, index) => (
                  <span className="skeleton-block divination-result-skeleton-tag" key={index} />
                ))}
              </div>
              <div className="divination-result-skeleton-list">
                {Array.from({ length: 4 }, (_, index) => (
                  <span className="skeleton-block divination-result-skeleton-line" key={index} />
                ))}
              </div>
            </div>
          </section>

          <section className="panel divination-result-panel">
            <div className="divination-result-skeleton">
              <span className="skeleton-block divination-result-skeleton-title" />
              <div className="divination-result-skeleton-list">
                {Array.from({ length: 7 }, (_, index) => (
                  <span className="skeleton-block divination-result-skeleton-line" key={index} />
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {!isSubmitting && session && summary ? (
        <div className="workspace-grid divination-output-grid">
          <section className="panel divination-result-panel">
            <div className="panel-head">
              <div>
                <h2>{summary.title}</h2>
                <p>这部分是本地算法生成的结构化结果，方便你判断本次提示词是否符合预期。</p>
              </div>
            </div>

            {session.requestedMethod === 'random' ? (
              <div className="divination-random-note">
                本次随机到：{methodLabelMap[session.method]}
              </div>
            ) : null}

            <div className="divination-tag-cloud">
              {summary.tags.map((item) => (
                <span className="result-soft-tag" key={item}>
                  {item}
                </span>
              ))}
            </div>

            <div className="divination-summary-list">
              {summary.lines.filter(Boolean).map((item) => (
                <div className="divination-summary-item" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="panel panel-output divination-result-panel">
            <div className="panel-head divination-prompt-head">
              <div>
                <h2>占卜提示词</h2>
                <p>系统要求、结构化结果和你的问题都已经合并，复制整段即可使用。</p>
              </div>
              <div className="action-row compact-actions divination-prompt-actions">
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
            <div className="prompt-send-tip">
              点击复制后，发送到你常用的在线 AI 软件继续提问。
            </div>

            <pre className="result-pre">{session.prompt}</pre>
          </section>
        </div>
      ) : null}

      {isQuestionInspirationModalOpen ? (
        <QuestionInspirationModal
          filters={inspirationFilters}
          activeFilter={activeInspirationTab}
          onFilterChange={(value) => setActiveInspirationTab(value as DivinationInspirationTabId)}
          searchValue={inspirationSearch}
          onSearchChange={setInspirationSearch}
          sections={filteredInspirationSections}
          emptyText="没有找到匹配的问题，请换个关键词或分类。"
          onSelect={applyInspiredQuestion}
          onClose={() => setIsQuestionInspirationModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
