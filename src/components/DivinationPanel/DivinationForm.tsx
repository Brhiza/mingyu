import {
  ALMANAC_TOPIC_OPTIONS,
  GENERAL_DIVINATION_METHOD_OPTIONS,
  LENORMAND_SPREAD_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
  JINKOUJUE_METHOD_OPTIONS,
} from '@core/divination/config';
import { resolveInteractiveTarotCards, tarotSpreads } from '@core/divination/tarot';
import {
  LENORMAND_SPREADS,
  resolveInteractiveLenormandCards,
} from '@core/divination/algorithms/lenormand';
import type { DivinationDraft } from '@/lib/divination/engine';
import {
  almanacTopicLabelMap,
  lenormandSpreadLabelMap,
  liuyaoTemplateLabelMap,
  liurenTemplateLabelMap,
  meihuaMethodLabelMap,
  methodLabelMap,
  tarotSpreadLabelMap,
  jinkoujueMethodLabelMap,
} from './constants';

const DIVINATION_TIME_MODE_OPTIONS = [
  { value: 'current', label: '当前时间' },
  { value: 'custom', label: '自定时间' },
] as const;

const LIUYAO_METHOD_OPTIONS = [
  { value: 'time', label: '按时间模拟三钱' },
  { value: 'coins', label: '模拟三钱' },
  { value: 'manual', label: '手动录入' },
] as const;

const LIUYAO_YAO_OPTIONS = [
  { value: 6, label: '6 · 老阴（动）' },
  { value: 7, label: '7 · 少阳' },
  { value: 8, label: '8 · 少阴' },
  { value: 9, label: '9 · 老阳（动）' },
] as const;

const LIUYAO_POSITION_LABELS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] as const;

const MANUAL_METHOD_OPTIONS = [
  { value: 'random', label: '自动抽取' },
  { value: 'interactive', label: '手动抽取' },
] as const;

const liuyaoMethodLabelMap: Record<NonNullable<DivinationDraft['liuyaoMethod']>, string> = {
  time: '按时间模拟三钱',
  coins: '模拟三钱',
  manual: '手动录入',
};

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

  if (draft.method === 'meihua' || draft.method === 'xiaoliuren' || draft.method === 'jinkoujue') {
    return true;
  }

  return false;
}

function createRandomSample() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoObject.getRandomValues(value);
    return value[0] / 4294967296;
  }
  return Math.random();
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
        ? '按日期范围整理历书原始宜忌、参与人固定关系及时段资料。'
        : '生成所选方法的可复算盘面与完整 AI 核对提示词。';
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
  const liuyaoMethod = draft.liuyaoMethod ?? 'time';
  const liuyaoYaos = draft.liuyaoYaos ?? [];
  const liuyaoCoinThrows = draft.liuyaoCoinThrows ?? [];
  const visibleLiuyaoYaos =
    liuyaoMethod === 'coins' ? liuyaoCoinThrows.map((item) => item.total) : liuyaoYaos;
  const tarotMethod = draft.tarotMethod ?? 'random';
  const tarotInteractiveSamples = draft.tarotInteractiveSamples ?? [];
  const tarotSpread = tarotSpreads[draft.tarotSpread];
  const tarotInteractiveCards = resolveInteractiveTarotCards(
    draft.tarotSpread,
    tarotInteractiveSamples,
  );
  const lenormandMethod = draft.lenormandMethod ?? 'random';
  const lenormandInteractiveSamples = draft.lenormandInteractiveSamples ?? [];
  const lenormandSpread = LENORMAND_SPREADS[draft.lenormandSpread];
  const lenormandInteractiveCards = resolveInteractiveLenormandCards(
    draft.lenormandSpread,
    lenormandInteractiveSamples,
  );
  const ssgwMethod = draft.ssgwMethod ?? 'random';
  const ssgwNumber = draft.ssgwNumber ?? '';
  const isManualInputIncomplete =
    (draft.method === 'liuyao' &&
      ((liuyaoMethod === 'manual' && liuyaoYaos.length !== 6) ||
        (liuyaoMethod === 'coins' && liuyaoCoinThrows.length !== 6))) ||
    (draft.method === 'tarot' &&
      tarotMethod === 'interactive' &&
      tarotInteractiveCards.length !== tarotSpread.cardCount) ||
    (draft.method === 'lenormand' &&
      lenormandMethod === 'interactive' &&
      lenormandInteractiveCards.length !== lenormandSpread.positions.length) ||
    (draft.method === 'ssgw' &&
      ssgwMethod === 'manual' &&
      (!/^\d+$/.test(ssgwNumber) || Number(ssgwNumber) < 1 || Number(ssgwNumber) > 92));

  function appendLiuyaoYao(value: 6 | 7 | 8 | 9) {
    if (liuyaoYaos.length < 6) {
      updateDraft('liuyaoYaos', [...liuyaoYaos, value]);
    }
  }

  function shakeLiuyaoYao() {
    if (liuyaoCoinThrows.length >= 6) return;
    const coins = [0, 1, 2].map(() => (createRandomSample() < 0.5 ? 2 : 3)) as [
      2 | 3,
      2 | 3,
      2 | 3,
    ];
    const total = coins.reduce<number>((sum, coin) => sum + coin, 0) as 6 | 7 | 8 | 9;
    updateDraft('liuyaoCoinThrows', [...liuyaoCoinThrows, { coins, total }]);
  }

  function updateTarotSpread(value: DivinationDraft['tarotSpread']) {
    updateDraft('tarotSpread', value);
    updateDraft('tarotInteractiveSamples', []);
  }

  function drawTarotCard() {
    if (tarotInteractiveCards.length >= tarotSpread.cardCount) return;
    updateDraft('tarotInteractiveSamples', [
      ...tarotInteractiveSamples,
      createRandomSample(),
      createRandomSample(),
    ]);
  }

  function resetTarotCards() {
    updateDraft('tarotInteractiveSamples', []);
  }

  function updateLenormandSpread(value: DivinationDraft['lenormandSpread']) {
    updateDraft('lenormandSpread', value);
    updateDraft('lenormandInteractiveSamples', []);
  }

  function drawLenormandCard() {
    if (lenormandInteractiveCards.length >= lenormandSpread.positions.length) return;
    updateDraft('lenormandInteractiveSamples', [
      ...lenormandInteractiveSamples,
      createRandomSample(),
    ]);
  }

  function resetLenormandCards() {
    updateDraft('lenormandInteractiveSamples', []);
  }

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

                    {draft.method === 'jinkoujue' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="jinkoujue-method-select">起课方式</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {jinkoujueMethodLabelMap[draft.jinkoujueMethod]}
                          </span>
                          <select
                            id="jinkoujue-method-select"
                            value={draft.jinkoujueMethod}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'jinkoujueMethod',
                                event.target.value as DivinationDraft['jinkoujueMethod'],
                              )
                            }
                          >
                            {JINKOUJUE_METHOD_OPTIONS.map((item) => (
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

                    {draft.method === 'jinkoujue' && draft.jinkoujueMethod === 'number' ? (
                      <div className="form-item divination-inline-field divination-inline-number-field">
                        <label htmlFor="jinkoujue-number-input">起课数字</label>
                        <input
                          id="jinkoujue-number-input"
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          placeholder="例如 7"
                          value={draft.jinkoujueNumber}
                          onChange={(event) =>
                            updateDraft('jinkoujueNumber', event.target.value.replace(/[^\d]/g, ''))
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

                    {draft.method === 'liuyao' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="liuyao-method-select">起卦方式</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <span className="divination-trigger-text">
                            {liuyaoMethodLabelMap[liuyaoMethod]}
                          </span>
                          <select
                            id="liuyao-method-select"
                            value={liuyaoMethod}
                            className="form-input divination-overlay-select"
                            onChange={(event) =>
                              updateDraft(
                                'liuyaoMethod',
                                event.target.value as NonNullable<DivinationDraft['liuyaoMethod']>,
                              )
                            }
                          >
                            {LIUYAO_METHOD_OPTIONS.map((item) => (
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
                              updateTarotSpread(
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
                              updateLenormandSpread(
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
                  draft.method === 'jinkoujue' ||
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

                {draft.method === 'jinkoujue' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {jinkoujueMethodLabelMap[draft.jinkoujueMethod]}
                    </span>
                    <select
                      aria-label="金口诀起课方式"
                      value={draft.jinkoujueMethod}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft(
                          'jinkoujueMethod',
                          event.target.value as DivinationDraft['jinkoujueMethod'],
                        )
                      }
                    >
                      {JINKOUJUE_METHOD_OPTIONS.map((item) => (
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

                {draft.method === 'liuyao' ? (
                  <div className="divination-mobile-secondary-picker">
                    <span className="divination-mobile-trigger-text divination-trigger-text">
                      {liuyaoMethodLabelMap[liuyaoMethod]}
                    </span>
                    <select
                      aria-label="六爻起卦方式"
                      value={liuyaoMethod}
                      className="form-input divination-mobile-method-select divination-overlay-select"
                      onChange={(event) =>
                        updateDraft(
                          'liuyaoMethod',
                          event.target.value as NonNullable<DivinationDraft['liuyaoMethod']>,
                        )
                      }
                    >
                      {LIUYAO_METHOD_OPTIONS.map((item) => (
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
                        updateTarotSpread(event.target.value as DivinationDraft['tarotSpread'])
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
                        updateLenormandSpread(
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

          {draft.method === 'jinkoujue' && draft.jinkoujueMethod === 'number' ? (
            <div className="form-row divination-mobile-only">
              <div className="form-item">
                <label htmlFor="jinkoujue-number-input-mobile">起课数字</label>
                <input
                  id="jinkoujue-number-input-mobile"
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="例如 7"
                  value={draft.jinkoujueNumber}
                  onChange={(event) =>
                    updateDraft('jinkoujueNumber', event.target.value.replace(/[^\d]/g, ''))
                  }
                />
              </div>
            </div>
          ) : null}

          {draft.method === 'liuyao' && (liuyaoMethod === 'manual' || liuyaoMethod === 'coins') ? (
            <div className="divination-extra-panel liuyao-manual-panel">
              <div className="manual-entry-head">
                <strong>
                  {visibleLiuyaoYaos.length < 6
                    ? `下一爻：${LIUYAO_POSITION_LABELS[visibleLiuyaoYaos.length]}`
                    : '六爻已成'}
                </strong>
                <span>{visibleLiuyaoYaos.length} / 6</span>
              </div>
              <div className="liuyao-reveal-stack" aria-label="逐爻显示六爻卦象">
                {[...LIUYAO_POSITION_LABELS].reverse().map((label, reverseIndex) => {
                  const index = 5 - reverseIndex;
                  const value = visibleLiuyaoYaos[index];
                  const coinThrow = liuyaoCoinThrows[index];
                  const isYin = value === 6 || value === 8;
                  const isMoving = value === 6 || value === 9;
                  return (
                    <div
                      className={`liuyao-reveal-row ${value ? 'is-filled' : ''} ${index === visibleLiuyaoYaos.length - 1 ? 'is-latest' : ''}`}
                      key={label}
                    >
                      <span className="liuyao-reveal-label">{label}</span>
                      <span
                        className={`liuyao-reveal-line ${value ? 'is-filled' : ''} ${isYin ? 'is-yin' : 'is-yang'} ${isMoving ? 'is-moving' : ''}`}
                      >
                        {value ? (
                          isYin ? (
                            <>
                              <i />
                              <i />
                            </>
                          ) : (
                            <i />
                          )
                        ) : null}
                      </span>
                      <span className="liuyao-reveal-value">
                        {value
                          ? liuyaoMethod === 'coins' && coinThrow
                            ? `${coinThrow.coins.join(' + ')} = ${LIUYAO_YAO_OPTIONS.find((item) => item.value === value)?.label}`
                            : LIUYAO_YAO_OPTIONS.find((item) => item.value === value)?.label
                          : '待起'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {visibleLiuyaoYaos.length < 6 && liuyaoMethod === 'manual' ? (
                <div className="liuyao-cast-actions">
                  {LIUYAO_YAO_OPTIONS.map((item) => (
                    <button
                      type="button"
                      className="manual-choice-button"
                      key={item.value}
                      onClick={() => appendLiuyaoYao(item.value)}
                    >
                      <span>{item.label.split(' · ')[1]}</span>
                      <strong>{item.value}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="manual-session-actions">
                {visibleLiuyaoYaos.length < 6 && liuyaoMethod === 'coins' ? (
                  <button
                    type="button"
                    className="primary-button liuyao-shake-button"
                    onClick={shakeLiuyaoYao}
                  >
                    模拟一爻
                  </button>
                ) : null}
                {visibleLiuyaoYaos.length > 0 ? (
                  <button
                    type="button"
                    className="secondary-page-button compact-action-button manual-reset-button"
                    onClick={() =>
                      liuyaoMethod === 'coins'
                        ? updateDraft('liuyaoCoinThrows', [])
                        : updateDraft('liuyaoYaos', [])
                    }
                  >
                    重新起卦
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {draft.method === 'tarot' ? (
            <div className="divination-extra-panel manual-entry-panel">
              <div className="manual-mode-switch" role="group" aria-label="塔罗抽牌方式">
                {MANUAL_METHOD_OPTIONS.map((item) => (
                  <button
                    type="button"
                    className={tarotMethod === item.value ? 'is-active' : ''}
                    key={item.value}
                    onClick={() => updateDraft('tarotMethod', item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {tarotMethod === 'interactive' ? (
                <div className="interactive-draw-session">
                  <div className="manual-entry-head">
                    <strong>
                      {tarotInteractiveCards.length < tarotSpread.cardCount
                        ? `当前牌位：${tarotSpread.positions[tarotInteractiveCards.length]}`
                        : '牌阵已抽完'}
                    </strong>
                    <span>
                      {tarotInteractiveCards.length} / {tarotSpread.cardCount}
                    </span>
                  </div>
                  <div className="manual-record-list" aria-live="polite">
                    {tarotInteractiveCards.map((card, index) => (
                      <div className="manual-record-item is-revealed" key={`${card.id}-${index}`}>
                        <span>{tarotSpread.positions[index]}</span>
                        <strong>
                          {card.name} · {card.reversed ? '逆位' : '正位'}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="manual-session-actions">
                    {tarotInteractiveCards.length < tarotSpread.cardCount ? (
                      <button
                        type="button"
                        className="primary-button interactive-draw-button"
                        onClick={drawTarotCard}
                      >
                        抽一张
                      </button>
                    ) : null}
                    {tarotInteractiveCards.length > 0 ? (
                      <button
                        type="button"
                        className="secondary-page-button compact-action-button manual-reset-button"
                        onClick={resetTarotCards}
                      >
                        重新抽取
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {draft.method === 'lenormand' ? (
            <div className="divination-extra-panel manual-entry-panel">
              <div className="manual-mode-switch" role="group" aria-label="雷诺曼抽牌方式">
                {MANUAL_METHOD_OPTIONS.map((item) => (
                  <button
                    type="button"
                    className={lenormandMethod === item.value ? 'is-active' : ''}
                    key={item.value}
                    onClick={() => updateDraft('lenormandMethod', item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {lenormandMethod === 'interactive' ? (
                <div className="interactive-draw-session">
                  <div className="manual-entry-head">
                    <strong>
                      {lenormandInteractiveCards.length < lenormandSpread.positions.length
                        ? `当前牌位：${lenormandSpread.positions[lenormandInteractiveCards.length]}`
                        : '牌阵已抽完'}
                    </strong>
                    <span>
                      {lenormandInteractiveCards.length} / {lenormandSpread.positions.length}
                    </span>
                  </div>
                  <div className="manual-record-list" aria-live="polite">
                    {lenormandInteractiveCards.map((card, index) => (
                      <div className="manual-record-item is-revealed" key={`${card.id}-${index}`}>
                        <span>{lenormandSpread.positions[index]}</span>
                        <strong>{card.name}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="manual-session-actions">
                    {lenormandInteractiveCards.length < lenormandSpread.positions.length ? (
                      <button
                        type="button"
                        className="primary-button interactive-draw-button"
                        onClick={drawLenormandCard}
                      >
                        抽一张
                      </button>
                    ) : null}
                    {lenormandInteractiveCards.length > 0 ? (
                      <button
                        type="button"
                        className="secondary-page-button compact-action-button manual-reset-button"
                        onClick={resetLenormandCards}
                      >
                        重新抽取
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {draft.method === 'ssgw' ? (
            <div className="divination-extra-panel manual-entry-panel ssgw-manual-panel">
              <div className="manual-mode-switch" role="group" aria-label="灵签求签方式">
                <button
                  type="button"
                  className={ssgwMethod === 'random' ? 'is-active' : ''}
                  onClick={() => updateDraft('ssgwMethod', 'random')}
                >
                  自动求签
                </button>
                <button
                  type="button"
                  className={ssgwMethod === 'manual' ? 'is-active' : ''}
                  onClick={() => updateDraft('ssgwMethod', 'manual')}
                >
                  录入签号
                </button>
              </div>
              {ssgwMethod === 'manual' ? (
                <div className="form-item ssgw-number-field">
                  <label htmlFor="ssgw-number-input">签号（1-92）</label>
                  <input
                    id="ssgw-number-input"
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="例如 36"
                    value={ssgwNumber}
                    onChange={(event) =>
                      updateDraft(
                        'ssgwNumber',
                        event.target.value.replace(/[^\d]/g, '').slice(0, 2),
                      )
                    }
                  />
                </div>
              ) : null}
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
                  <label htmlFor="taiyi-year-input">年计年份</label>
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
          disabled={isSubmitting || isManualInputIncomplete}
          onClick={onSubmit}
        >
          {submitButtonText}
        </button>
      </div>
    </>
  );
}
