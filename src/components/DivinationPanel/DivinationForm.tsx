import {
  ALMANAC_TOPIC_OPTIONS,
  GENERAL_DIVINATION_METHOD_OPTIONS,
  LENORMAND_SPREAD_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
  XIAOLIUREN_METHOD_OPTIONS,
} from '@core/divination/config';
import type { DivinationDraft } from '@/lib/divination/engine';
import {
  almanacTopicLabelMap,
  lenormandSpreadLabelMap,
  liuyaoTemplateLabelMap,
  liurenTemplateLabelMap,
  meihuaMethodLabelMap,
  methodLabelMap,
  tarotSpreadLabelMap,
  xiaoliurenMethodLabelMap,
} from './constants';

const DIVINATION_TIME_MODE_OPTIONS = [
  { value: 'current', label: '当前时间' },
  { value: 'custom', label: '自定时间' },
] as const;

const divinationTimeModeLabelMap: Record<
  NonNullable<DivinationDraft['divinationTimeMode']>,
  string
> = {
  current: '当前时间',
  custom: '自定时间',
};

function isTimeBasedDivinationDraft(draft: DivinationDraft) {
  if (draft.method === 'liuyao' || draft.method === 'qimen' || draft.method === 'liuren') {
    return true;
  }

  if (draft.method === 'meihua' || draft.method === 'xiaoliuren') {
    return true;
  }

  return false;
}

interface DivinationFormProps {
  draft: DivinationDraft;
  updateDraft: <K extends keyof DivinationDraft>(key: K, value: DivinationDraft[K]) => void;
  lockedMethod?: Extract<DivinationDraft['method'], 'almanac' | 'astrolabe'>;
  isSubmitting: boolean;
  error: string;
  onSubmit: () => void | Promise<void>;
  onOpenInspiration: () => void;
  onNavigateToHistory: () => void;
  questionInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function DivinationForm({
  draft,
  updateDraft,
  lockedMethod,
  isSubmitting,
  error,
  onSubmit,
  onOpenInspiration,
  onNavigateToHistory,
  questionInputRef,
}: DivinationFormProps) {
  const isMethodLocked = Boolean(lockedMethod);
  const formHeading =
    lockedMethod === 'astrolabe' ? '星盘' : lockedMethod === 'almanac' ? '择日' : '传统起卦';
  const formDescription =
    lockedMethod === 'astrolabe'
      ? '生成星体、宫位与相位，并提供可视星盘作为解读依据。'
      : lockedMethod === 'almanac'
        ? '按事项、日期范围和参与人八字，筛选更合适的行动日。'
        : '依托传统算法，提供准确卦象。';
  const isAlmanac = draft.method === 'almanac';
  const questionLabel = isAlmanac ? '补充信息（可选）' : '问题';
  const questionPlaceholder = isAlmanac
    ? '例如：希望避开周末，优先上午办事，尽量兼顾家人时间。'
    : '例如：我现在该主动推进，还是先稳住等待更好的时机？';
  const submitButtonText =
    draft.method === 'almanac'
      ? '开始择日'
      : draft.method === 'astrolabe'
        ? '生成星盘'
        : '开始占卜';
  const isTimeBasedDivination = isTimeBasedDivinationDraft(draft);
  const divinationTimeMode = draft.divinationTimeMode ?? 'current';

  function updateAlmanacParticipant(
    id: string,
    key: keyof DivinationDraft['almanacParticipants'][number],
    value: string | boolean,
  ) {
    updateDraft(
      'almanacParticipants',
      draft.almanacParticipants.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    );
  }

  function addAlmanacParticipant() {
    updateDraft('almanacParticipants', [
      ...draft.almanacParticipants,
      {
        id: `participant-${Date.now()}`,
        name: '',
        gender: '',
        year: '',
        month: '',
        day: '',
        timeIndex: '',
        dateType: 'solar',
        isLeapMonth: false,
      },
    ]);
  }

  function removeAlmanacParticipant(id: string) {
    updateDraft(
      'almanacParticipants',
      draft.almanacParticipants.filter((item) => item.id !== id),
    );
  }

  return (
    <>
      <section className="person-section divination-form-card">
        <div className="person-section-head">
          <h2>{formHeading}</h2>
          <p>{formDescription}</p>
        </div>

        {!isMethodLocked ? (
          <div className="divination-method-grid">
            {GENERAL_DIVINATION_METHOD_OPTIONS.map((item) => (
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
        ) : null}

        <div className="person-info-form">
          <div className="form-row">
            <div className="form-item">
              <label htmlFor="divination-question-input">{questionLabel}</label>
              <div className="divination-question-field">
                <textarea
                  ref={questionInputRef}
                  id="divination-question-input"
                  rows={5}
                  value={draft.question}
                  className="form-input divination-textarea"
                  placeholder={questionPlaceholder}
                  onChange={(event) => {
                    updateDraft('questionSource', 'custom');
                    updateDraft('question', event.target.value);
                  }}
                />

                <div className="divination-desktop-question-footer">
                  <div className="divination-desktop-question-controls">
                    {draft.method === 'meihua' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="meihua-method-select">起卦方式</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {meihuaMethodLabelMap[draft.meihuaMethod]}
                          </span>
                          <select
                            id="meihua-method-select"
                            value={draft.meihuaMethod}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'meihuaMethod',
                                event.target.value as DivinationDraft['meihuaMethod'],
                              )
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

                    {draft.method === 'xiaoliuren' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="xiaoliuren-method-select">起课方式</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {xiaoliurenMethodLabelMap[draft.xiaoliurenMethod]}
                          </span>
                          <select
                            id="xiaoliuren-method-select"
                            value={draft.xiaoliurenMethod}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'xiaoliurenMethod',
                                event.target.value as DivinationDraft['xiaoliurenMethod'],
                              )
                            }
                          >
                            {XIAOLIUREN_METHOD_OPTIONS.map((item) => (
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
                          onChange={(event) =>
                            updateDraft('meihuaNumber', event.target.value.replace(/[^\d]/g, ''))
                          }
                        />
                      </div>
                    ) : null}

                    {draft.method === 'xiaoliuren' && draft.xiaoliurenMethod === 'number' ? (
                      <div className="form-item divination-inline-field divination-inline-number-field">
                        <label htmlFor="xiaoliuren-number-input">起课数字</label>
                        <input
                          id="xiaoliuren-number-input"
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          placeholder="例如 18"
                          value={draft.xiaoliurenNumber}
                          onChange={(event) =>
                            updateDraft(
                              'xiaoliurenNumber',
                              event.target.value.replace(/[^\d]/g, ''),
                            )
                          }
                        />
                      </div>
                    ) : null}

                    {draft.method === 'liuyao' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="liuyao-template-select">问题范围</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {liuyaoTemplateLabelMap[draft.liuyaoTemplate]}
                          </span>
                          <select
                            id="liuyao-template-select"
                            value={draft.liuyaoTemplate}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'liuyaoTemplate',
                                event.target.value as DivinationDraft['liuyaoTemplate'],
                              )
                            }
                          >
                            {LIUYAO_TEMPLATE_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'liuren' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="liuren-template-select">问题范围</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {liurenTemplateLabelMap[draft.liurenTemplate]}
                          </span>
                          <select
                            id="liuren-template-select"
                            value={draft.liurenTemplate}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'liurenTemplate',
                                event.target.value as DivinationDraft['liurenTemplate'],
                              )
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
                          <span className="divination-trigger-text">
                            {tarotSpreadLabelMap[draft.tarotSpread]}
                          </span>
                          <select
                            id="tarot-spread-select"
                            value={draft.tarotSpread}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'tarotSpread',
                                event.target.value as DivinationDraft['tarotSpread'],
                              )
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

                    {draft.method === 'almanac' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="almanac-topic-select">择日事项</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {almanacTopicLabelMap[draft.almanacTopic]}
                          </span>
                          <select
                            id="almanac-topic-select"
                            value={draft.almanacTopic}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'almanacTopic',
                                event.target.value as DivinationDraft['almanacTopic'],
                              )
                            }
                          >
                            {ALMANAC_TOPIC_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'lenormand' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="lenormand-spread-select">牌阵</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {lenormandSpreadLabelMap[draft.lenormandSpread]}
                          </span>
                          <select
                            id="lenormand-spread-select"
                            value={draft.lenormandSpread}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'lenormandSpread',
                                event.target.value as DivinationDraft['lenormandSpread'],
                              )
                            }
                          >
                            {LENORMAND_SPREAD_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {isTimeBasedDivination ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="divination-time-mode-select">起卦时间</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {divinationTimeModeLabelMap[divinationTimeMode]}
                          </span>
                          <select
                            id="divination-time-mode-select"
                            value={divinationTimeMode}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'divinationTimeMode',
                                event.target.value as NonNullable<
                                  DivinationDraft['divinationTimeMode']
                                >,
                              )
                            }
                          >
                            {DIVINATION_TIME_MODE_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {!isAlmanac ? (
                    <button
                      type="button"
                      className="quick-chip divination-desktop-inspiration-btn"
                      onClick={onOpenInspiration}
                    >
                      问题灵感
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                className={`divination-mobile-control-row ${
                  draft.method === 'meihua' ||
                  draft.method === 'liuyao' ||
                  draft.method === 'xiaoliuren' ||
                  draft.method === 'liuren' ||
                  draft.method === 'tarot' ||
                  draft.method === 'almanac' ||
                  draft.method === 'lenormand'
                    ? 'has-secondary'
                    : ''
                }`}
              >
                {!isMethodLocked ? (
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
                      {GENERAL_DIVINATION_METHOD_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

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
                        updateDraft(
                          'meihuaMethod',
                          event.target.value as DivinationDraft['meihuaMethod'],
                        )
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

                {draft.method === 'xiaoliuren' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {xiaoliurenMethodLabelMap[draft.xiaoliurenMethod]}
                    </span>
                    <select
                      aria-label="起课方式"
                      value={draft.xiaoliurenMethod}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft(
                          'xiaoliurenMethod',
                          event.target.value as DivinationDraft['xiaoliurenMethod'],
                        )
                      }
                    >
                      {XIAOLIUREN_METHOD_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {draft.method === 'liuyao' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {liuyaoTemplateLabelMap[draft.liuyaoTemplate]}
                    </span>
                    <select
                      aria-label="六爻问题范围"
                      value={draft.liuyaoTemplate}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft(
                          'liuyaoTemplate',
                          event.target.value as DivinationDraft['liuyaoTemplate'],
                        )
                      }
                    >
                      {LIUYAO_TEMPLATE_OPTIONS.map((item) => (
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
                        updateDraft(
                          'tarotSpread',
                          event.target.value as DivinationDraft['tarotSpread'],
                        )
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
                      aria-label="大六壬问题范围"
                      value={draft.liurenTemplate}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft(
                          'liurenTemplate',
                          event.target.value as DivinationDraft['liurenTemplate'],
                        )
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

                {draft.method === 'almanac' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {almanacTopicLabelMap[draft.almanacTopic]}
                    </span>
                    <select
                      aria-label="择日事项"
                      value={draft.almanacTopic}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft(
                          'almanacTopic',
                          event.target.value as DivinationDraft['almanacTopic'],
                        )
                      }
                    >
                      {ALMANAC_TOPIC_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {draft.method === 'lenormand' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {lenormandSpreadLabelMap[draft.lenormandSpread]}
                    </span>
                    <select
                      aria-label="雷诺曼牌阵"
                      value={draft.lenormandSpread}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft(
                          'lenormandSpread',
                          event.target.value as DivinationDraft['lenormandSpread'],
                        )
                      }
                    >
                      {LENORMAND_SPREAD_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {isTimeBasedDivination ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {divinationTimeModeLabelMap[divinationTimeMode]}
                    </span>
                    <select
                      aria-label="起卦时间"
                      value={divinationTimeMode}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft(
                          'divinationTimeMode',
                          event.target.value as NonNullable<DivinationDraft['divinationTimeMode']>,
                        )
                      }
                    >
                      {DIVINATION_TIME_MODE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {!isAlmanac ? (
                  <button
                    type="button"
                    className="quick-chip divination-mobile-inspiration-btn"
                    onClick={onOpenInspiration}
                  >
                    问题灵感
                  </button>
                ) : null}
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
                  onChange={(event) =>
                    updateDraft('meihuaNumber', event.target.value.replace(/[^\d]/g, ''))
                  }
                />
              </div>
            </div>
          ) : null}

          {draft.method === 'xiaoliuren' && draft.xiaoliurenMethod === 'number' ? (
            <div className="form-row divination-mobile-only">
              <div className="form-item">
                <label htmlFor="xiaoliuren-number-input-mobile">起课数字</label>
                <input
                  id="xiaoliuren-number-input-mobile"
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="例如 18"
                  value={draft.xiaoliurenNumber}
                  onChange={(event) =>
                    updateDraft('xiaoliurenNumber', event.target.value.replace(/[^\d]/g, ''))
                  }
                />
              </div>
            </div>
          ) : null}

          {isTimeBasedDivination && divinationTimeMode === 'custom' ? (
            <div className="divination-extra-panel divination-time-panel">
              <div className="form-row-flex">
                <div className="form-item">
                  <label htmlFor="custom-divination-date-input">起卦日期</label>
                  <input
                    id="custom-divination-date-input"
                    type="date"
                    className="form-input"
                    value={draft.customDivinationDate ?? ''}
                    onChange={(event) => updateDraft('customDivinationDate', event.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="custom-divination-time-input">起卦时间（北京时间）</label>
                  <input
                    id="custom-divination-time-input"
                    type="time"
                    className="form-input"
                    value={draft.customDivinationTime ?? ''}
                    onChange={(event) => updateDraft('customDivinationTime', event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {draft.method === 'taiyi' ? (
            <div className="divination-extra-panel">
              <div className="form-row">
                <div className="form-item">
                  <label htmlFor="taiyi-year-input">要观察的年份</label>
                  <input
                    id="taiyi-year-input"
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="例如 2026"
                    value={draft.taiyiYear}
                    onChange={(event) =>
                      updateDraft('taiyiYear', event.target.value.replace(/[^\d]/g, ''))
                    }
                  />
                  <div className="birth-time-hint">
                    当前只提供已完整校核的年家太乙，用于观察该年的整体气运、动静与时宜。
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <details className="form-item divination-context-fields">
            <summary>补充现实信息（可选，填写越具体越利于解读）</summary>
            <div className="form-row">
              {[
                ['currentSituation', '当前情况', '例如：正在考虑换工作，已经拿到一个新机会。'],
                ['currentState', '当前状态', '例如：时间紧、压力较大，但仍有一定选择空间。'],
                ['knownFacts', '已知事实', '例如：对方已明确报价，合同尚未签署。'],
                ['desiredOutcome', '期望结果', '例如：希望兼顾收入提升与长期稳定。'],
                ['constraints', '现实限制', '例如：三个月内不能搬家，预算上限为两万元。'],
              ].map(([key, label, placeholder]) => (
                <div className="form-item" key={key}>
                  <label htmlFor={`divination-${key}`}>{label}</label>
                  <textarea
                    id={`divination-${key}`}
                    rows={2}
                    value={(draft[key as keyof DivinationDraft] as string | undefined) ?? ''}
                    className="form-input divination-textarea"
                    placeholder={placeholder}
                    onChange={(event) =>
                      updateDraft(key as keyof DivinationDraft, event.target.value as never)
                    }
                  />
                </div>
              ))}
            </div>
          </details>

          {draft.method === 'almanac' ? (
            <div className="divination-extra-panel">
              <div className="form-row-flex">
                <div className="form-item">
                  <label htmlFor="almanac-start-date-input">开始日期</label>
                  <input
                    id="almanac-start-date-input"
                    type="date"
                    className="form-input"
                    value={draft.almanacStartDate}
                    onChange={(event) => updateDraft('almanacStartDate', event.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="almanac-end-date-input">结束日期</label>
                  <input
                    id="almanac-end-date-input"
                    type="date"
                    className="form-input"
                    value={draft.almanacEndDate}
                    onChange={(event) => updateDraft('almanacEndDate', event.target.value)}
                  />
                </div>
              </div>

              <div className="divination-extra-head">
                <strong>参与人出生信息</strong>
                <button type="button" className="quick-chip" onClick={addAlmanacParticipant}>
                  添加参与人
                </button>
              </div>

              <div className="almanac-participant-list">
                {draft.almanacParticipants.map((participant, index) => (
                  <div className="almanac-participant-card" key={participant.id}>
                    <div className="almanac-participant-head">
                      <strong>参与人 {index + 1}</strong>
                      {draft.almanacParticipants.length > 1 ? (
                        <button
                          type="button"
                          className="history-action-btn"
                          onClick={() => removeAlmanacParticipant(participant.id)}
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                    <div className="form-row-flex">
                      <div className="form-item">
                        <label htmlFor={`${participant.id}-name-input`}>称呼</label>
                        <input
                          id={`${participant.id}-name-input`}
                          className="form-input"
                          value={participant.name}
                          placeholder="例如 本人"
                          onChange={(event) =>
                            updateAlmanacParticipant(participant.id, 'name', event.target.value)
                          }
                        />
                      </div>
                      <div className="form-item">
                        <label htmlFor={`${participant.id}-gender-select`}>性别</label>
                        <select
                          id={`${participant.id}-gender-select`}
                          className="form-input"
                          value={participant.gender}
                          onChange={(event) =>
                            updateAlmanacParticipant(participant.id, 'gender', event.target.value)
                          }
                        >
                          <option value="">不填</option>
                          <option value="男">男</option>
                          <option value="女">女</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row-flex has-third-item">
                      {(['year', 'month', 'day'] as const).map((key) => (
                        <div className="form-item" key={key}>
                          <label htmlFor={`${participant.id}-${key}-input`}>
                            {key === 'year' ? '年' : key === 'month' ? '月' : '日'}
                          </label>
                          <input
                            id={`${participant.id}-${key}-input`}
                            className="form-input"
                            inputMode="numeric"
                            value={participant[key]}
                            onChange={(event) =>
                              updateAlmanacParticipant(
                                participant.id,
                                key,
                                event.target.value.replace(/[^\d]/g, ''),
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div className="form-row-flex">
                      <div className="form-item">
                        <label htmlFor={`${participant.id}-calendar-select`}>日历</label>
                        <select
                          id={`${participant.id}-calendar-select`}
                          className="form-input"
                          value={participant.dateType}
                          onChange={(event) =>
                            updateAlmanacParticipant(participant.id, 'dateType', event.target.value)
                          }
                        >
                          <option value="solar">公历</option>
                          <option value="lunar">农历</option>
                        </select>
                      </div>
                      <div className="form-item">
                        <label htmlFor={`${participant.id}-time-select`}>时辰</label>
                        <select
                          id={`${participant.id}-time-select`}
                          className="form-input"
                          value={participant.timeIndex}
                          onChange={(event) =>
                            updateAlmanacParticipant(
                              participant.id,
                              'timeIndex',
                              event.target.value,
                            )
                          }
                        >
                          <option value="">请选择</option>
                          <option value="0">早子时</option>
                          <option value="1">丑时</option>
                          <option value="2">寅时</option>
                          <option value="3">卯时</option>
                          <option value="4">辰时</option>
                          <option value="5">巳时</option>
                          <option value="6">午时</option>
                          <option value="7">未时</option>
                          <option value="8">申时</option>
                          <option value="9">酉时</option>
                          <option value="10">戌时</option>
                          <option value="11">亥时</option>
                          <option value="12">晚子时</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {draft.method === 'astrolabe' ? (
            <div className="divination-extra-panel">
              <div className="form-row-flex">
                <div className="form-item">
                  <label htmlFor="astrolabe-name-input">称呼</label>
                  <input
                    id="astrolabe-name-input"
                    className="form-input"
                    value={draft.astrolabeName}
                    onChange={(event) => updateDraft('astrolabeName', event.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="astrolabe-gender-select">性别</label>
                  <select
                    id="astrolabe-gender-select"
                    className="form-input"
                    value={draft.astrolabeGender}
                    onChange={(event) =>
                      updateDraft(
                        'astrolabeGender',
                        event.target.value as DivinationDraft['astrolabeGender'],
                      )
                    }
                  >
                    <option value="">不填</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
              </div>
              <div className="form-row-flex has-third-item">
                {[
                  ['astrolabeYear', '年'],
                  ['astrolabeMonth', '月'],
                  ['astrolabeDay', '日'],
                ].map(([key, label]) => (
                  <div className="form-item" key={key}>
                    <label htmlFor={`${key}-input`}>{label}</label>
                    <input
                      id={`${key}-input`}
                      className="form-input"
                      inputMode="numeric"
                      value={String(draft[key as keyof DivinationDraft])}
                      onChange={(event) =>
                        updateDraft(
                          key as keyof DivinationDraft,
                          event.target.value.replace(/[^\d]/g, '') as never,
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="form-row-flex">
                <div className="form-item">
                  <label htmlFor="astrolabe-hour-input">小时</label>
                  <input
                    id="astrolabe-hour-input"
                    className="form-input"
                    inputMode="numeric"
                    value={draft.astrolabeHour}
                    onChange={(event) =>
                      updateDraft('astrolabeHour', event.target.value.replace(/[^\d]/g, ''))
                    }
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="astrolabe-minute-input">分钟</label>
                  <input
                    id="astrolabe-minute-input"
                    className="form-input"
                    inputMode="numeric"
                    value={draft.astrolabeMinute}
                    onChange={(event) =>
                      updateDraft('astrolabeMinute', event.target.value.replace(/[^\d]/g, ''))
                    }
                  />
                </div>
              </div>
              <div className="form-row-flex has-third-item">
                <div className="form-item">
                  <label htmlFor="astrolabe-latitude-input">纬度</label>
                  <input
                    id="astrolabe-latitude-input"
                    className="form-input"
                    value={draft.astrolabeLatitude}
                    onChange={(event) => updateDraft('astrolabeLatitude', event.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="astrolabe-longitude-input">经度</label>
                  <input
                    id="astrolabe-longitude-input"
                    className="form-input"
                    value={draft.astrolabeLongitude}
                    onChange={(event) => updateDraft('astrolabeLongitude', event.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="astrolabe-timezone-input">时区</label>
                  <input
                    id="astrolabe-timezone-input"
                    className="form-input"
                    value={draft.astrolabeTimezone}
                    onChange={(event) => updateDraft('astrolabeTimezone', event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {!isAlmanac ? (
            <div
              className={`form-row-flex divination-meta-row ${draft.method === 'tarot' ? 'is-single' : ''}`}
            >
              <div className="form-item">
                <label htmlFor="divination-gender-select">性别（可选）</label>
                <select
                  id="divination-gender-select"
                  value={draft.gender}
                  className="form-input"
                  onChange={(event) =>
                    updateDraft('gender', event.target.value as DivinationDraft['gender'])
                  }
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
                    onChange={(event) =>
                      updateDraft('birthYear', event.target.value.replace(/[^\d]/g, ''))
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {error ? <div className="form-error-text global-form-error">{error}</div> : null}

      <div
        className="form-actions page-submit-actions"
        style={{
          width: '100%',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          justifyItems: 'stretch',
        }}
      >
        <button className="secondary-page-button" type="button" onClick={onNavigateToHistory}>
          历史记录
        </button>
        <button
          className="primary-button start-submit-button"
          type="button"
          disabled={isSubmitting}
          onClick={onSubmit}
        >
          {submitButtonText}
        </button>
      </div>
    </>
  );
}
