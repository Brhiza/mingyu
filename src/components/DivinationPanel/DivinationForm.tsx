import {
  ALMANAC_TOPIC_OPTIONS,
  GENERAL_DIVINATION_METHOD_OPTIONS,
  LENORMAND_SPREAD_OPTIONS,
  LIUYAO_TEMPLATE_OPTIONS,
  LIUREN_TEMPLATE_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  TAROT_SPREAD_OPTIONS,
  JINKOUJUE_METHOD_OPTIONS,
} from 'mingyu-core/divination/config';
import {
  resolveInteractiveTarotCards,
  tarotCards,
  tarotSpreads,
} from 'mingyu-core/divination/tarot';
import {
  LENORMAND_CARDS,
  LENORMAND_SPREADS,
  resolveInteractiveLenormandCards,
} from 'mingyu-core/divination/lenormand';
import { secureRandomIndexSample, secureRandomInt } from 'mingyu-core/random';
import type { DivinationDraft } from '@/lib/divination/engine';
import { createSecureId } from '@/lib/secure-id';
import { DropdownSelect } from '@/components/DropdownSelect';

const DIVINATION_TIME_MODE_OPTIONS = [
  { value: 'current', label: '当前时间' },
  { value: 'custom', label: '自定时间' },
] as const;

const LIUYAO_METHOD_OPTIONS = [
  { value: 'time', label: '时间起卦' },
  { value: 'coins', label: '手摇' },
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

const OPTIONAL_GENDER_OPTIONS = [
  { value: '', label: '不填' },
  { value: '男', label: '男' },
  { value: '女', label: '女' },
] as const;

const CALENDAR_TYPE_OPTIONS = [
  { value: 'solar', label: '公历' },
  { value: 'lunar', label: '农历' },
] as const;

const BIRTH_TIME_OPTIONS = [
  { value: '', label: '请选择' },
  { value: '0', label: '早子时' },
  { value: '1', label: '丑时' },
  { value: '2', label: '寅时' },
  { value: '3', label: '卯时' },
  { value: '4', label: '辰时' },
  { value: '5', label: '巳时' },
  { value: '6', label: '午时' },
  { value: '7', label: '未时' },
  { value: '8', label: '申时' },
  { value: '9', label: '酉时' },
  { value: '10', label: '戌时' },
  { value: '11', label: '亥时' },
  { value: '12', label: '晚子时' },
] as const;

function isTimeBasedDivinationDraft(draft: DivinationDraft) {
  if (draft.method === 'liuyao' || draft.method === 'qimen' || draft.method === 'liuren') {
    return true;
  }

  if (draft.method === 'meihua' || draft.method === 'xiaoliuren' || draft.method === 'jinkoujue') {
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
    const coins = [0, 1, 2].map(() => (secureRandomInt(2) === 0 ? 2 : 3)) as [2 | 3, 2 | 3, 2 | 3];
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
      secureRandomIndexSample(tarotCards.length - tarotInteractiveCards.length),
      secureRandomIndexSample(2),
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
      secureRandomIndexSample(LENORMAND_CARDS.length - lenormandInteractiveCards.length),
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
        id: `participant-${createSecureId()}`,
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
                          <DropdownSelect
                            id="meihua-method-select"
                            value={draft.meihuaMethod}
                            options={MEIHUA_METHOD_OPTIONS}
                            onChange={(value) =>
                              updateDraft('meihuaMethod', value as DivinationDraft['meihuaMethod'])
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'jinkoujue' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="jinkoujue-method-select">起课方式</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="jinkoujue-method-select"
                            value={draft.jinkoujueMethod}
                            options={JINKOUJUE_METHOD_OPTIONS}
                            onChange={(value) =>
                              updateDraft(
                                'jinkoujueMethod',
                                value as DivinationDraft['jinkoujueMethod'],
                              )
                            }
                          />
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
                          <DropdownSelect
                            id="liuyao-template-select"
                            value={draft.liuyaoTemplate}
                            options={LIUYAO_TEMPLATE_OPTIONS}
                            onChange={(value) =>
                              updateDraft(
                                'liuyaoTemplate',
                                value as DivinationDraft['liuyaoTemplate'],
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'liuyao' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="liuyao-method-select">起卦方式</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="liuyao-method-select"
                            value={liuyaoMethod}
                            options={LIUYAO_METHOD_OPTIONS}
                            onChange={(value) =>
                              updateDraft(
                                'liuyaoMethod',
                                value as NonNullable<DivinationDraft['liuyaoMethod']>,
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'liuren' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="liuren-template-select">问题范围</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="liuren-template-select"
                            value={draft.liurenTemplate}
                            options={LIUREN_TEMPLATE_OPTIONS}
                            onChange={(value) =>
                              updateDraft(
                                'liurenTemplate',
                                value as DivinationDraft['liurenTemplate'],
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'tarot' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="tarot-spread-select">牌阵</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="tarot-spread-select"
                            value={draft.tarotSpread}
                            options={TAROT_SPREAD_OPTIONS}
                            onChange={(value) =>
                              updateTarotSpread(value as DivinationDraft['tarotSpread'])
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'almanac' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="almanac-topic-select">择日事项</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="almanac-topic-select"
                            value={draft.almanacTopic}
                            options={ALMANAC_TOPIC_OPTIONS}
                            onChange={(value) =>
                              updateDraft('almanacTopic', value as DivinationDraft['almanacTopic'])
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    {draft.method === 'lenormand' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="lenormand-spread-select">牌阵</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="lenormand-spread-select"
                            value={draft.lenormandSpread}
                            options={LENORMAND_SPREAD_OPTIONS}
                            onChange={(value) =>
                              updateLenormandSpread(value as DivinationDraft['lenormandSpread'])
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    {isTimeBasedDivination ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="divination-time-mode-select">起卦时间</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="divination-time-mode-select"
                            value={divinationTimeMode}
                            options={DIVINATION_TIME_MODE_OPTIONS}
                            onChange={(value) =>
                              updateDraft(
                                'divinationTimeMode',
                                value as NonNullable<DivinationDraft['divinationTimeMode']>,
                              )
                            }
                          />
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
                    <DropdownSelect
                      value={draft.method}
                      options={GENERAL_DIVINATION_METHOD_OPTIONS}
                      ariaLabel="占卜类型"
                      onChange={(value) =>
                        updateDraft('method', value as DivinationDraft['method'])
                      }
                    />
                  </div>
                ) : null}

                {draft.method === 'meihua' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={draft.meihuaMethod}
                      options={MEIHUA_METHOD_OPTIONS}
                      ariaLabel="起卦方式"
                      onChange={(value) =>
                        updateDraft('meihuaMethod', value as DivinationDraft['meihuaMethod'])
                      }
                    />
                  </div>
                ) : null}

                {draft.method === 'jinkoujue' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={draft.jinkoujueMethod}
                      options={JINKOUJUE_METHOD_OPTIONS}
                      ariaLabel="金口诀起课方式"
                      onChange={(value) =>
                        updateDraft('jinkoujueMethod', value as DivinationDraft['jinkoujueMethod'])
                      }
                    />
                  </div>
                ) : null}

                {draft.method === 'liuyao' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={draft.liuyaoTemplate}
                      options={LIUYAO_TEMPLATE_OPTIONS}
                      ariaLabel="六爻问题范围"
                      onChange={(value) =>
                        updateDraft('liuyaoTemplate', value as DivinationDraft['liuyaoTemplate'])
                      }
                    />
                  </div>
                ) : null}

                {draft.method === 'liuyao' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={liuyaoMethod}
                      options={LIUYAO_METHOD_OPTIONS}
                      ariaLabel="六爻起卦方式"
                      onChange={(value) =>
                        updateDraft(
                          'liuyaoMethod',
                          value as NonNullable<DivinationDraft['liuyaoMethod']>,
                        )
                      }
                    />
                  </div>
                ) : null}

                {draft.method === 'tarot' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={draft.tarotSpread}
                      options={TAROT_SPREAD_OPTIONS}
                      ariaLabel="牌阵"
                      onChange={(value) =>
                        updateTarotSpread(value as DivinationDraft['tarotSpread'])
                      }
                    />
                  </div>
                ) : null}

                {draft.method === 'liuren' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={draft.liurenTemplate}
                      options={LIUREN_TEMPLATE_OPTIONS}
                      ariaLabel="大六壬问题范围"
                      onChange={(value) =>
                        updateDraft('liurenTemplate', value as DivinationDraft['liurenTemplate'])
                      }
                    />
                  </div>
                ) : null}

                {draft.method === 'almanac' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={draft.almanacTopic}
                      options={ALMANAC_TOPIC_OPTIONS}
                      ariaLabel="择日事项"
                      onChange={(value) =>
                        updateDraft('almanacTopic', value as DivinationDraft['almanacTopic'])
                      }
                    />
                  </div>
                ) : null}

                {draft.method === 'lenormand' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={draft.lenormandSpread}
                      options={LENORMAND_SPREAD_OPTIONS}
                      ariaLabel="雷诺曼牌阵"
                      onChange={(value) =>
                        updateLenormandSpread(value as DivinationDraft['lenormandSpread'])
                      }
                    />
                  </div>
                ) : null}

                {isTimeBasedDivination ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={divinationTimeMode}
                      options={DIVINATION_TIME_MODE_OPTIONS}
                      ariaLabel="起卦时间"
                      onChange={(value) =>
                        updateDraft(
                          'divinationTimeMode',
                          value as NonNullable<DivinationDraft['divinationTimeMode']>,
                        )
                      }
                    />
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
                    手摇一爻
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

          <details className="divination-context-fields">
            <summary>补充信息（可选）</summary>
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
                <strong>参与人出生信息（可选）</strong>
                <button type="button" className="quick-chip" onClick={addAlmanacParticipant}>
                  添加参与人
                </button>
              </div>

              <div className="almanac-participant-list">
                {draft.almanacParticipants.map((participant, index) => (
                  <div className="almanac-participant-card" key={participant.id}>
                    <div className="almanac-participant-head">
                      <strong>参与人 {index + 1}</strong>
                      <button
                        type="button"
                        className="history-action-btn"
                        onClick={() => removeAlmanacParticipant(participant.id)}
                      >
                        删除
                      </button>
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
                        <DropdownSelect
                          id={`${participant.id}-gender-select`}
                          value={participant.gender}
                          options={OPTIONAL_GENDER_OPTIONS}
                          variant="field"
                          onChange={(value) =>
                            updateAlmanacParticipant(participant.id, 'gender', value)
                          }
                        />
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
                        <DropdownSelect
                          id={`${participant.id}-calendar-select`}
                          value={participant.dateType}
                          options={CALENDAR_TYPE_OPTIONS}
                          variant="field"
                          onChange={(value) =>
                            updateAlmanacParticipant(participant.id, 'dateType', value)
                          }
                        />
                      </div>
                      <div className="form-item">
                        <label htmlFor={`${participant.id}-time-select`}>时辰</label>
                        <DropdownSelect
                          id={`${participant.id}-time-select`}
                          value={participant.timeIndex}
                          options={BIRTH_TIME_OPTIONS}
                          variant="field"
                          onChange={(value) =>
                            updateAlmanacParticipant(participant.id, 'timeIndex', value)
                          }
                        />
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
                  <DropdownSelect
                    id="astrolabe-gender-select"
                    value={draft.astrolabeGender}
                    options={OPTIONAL_GENDER_OPTIONS}
                    variant="field"
                    onChange={(value) =>
                      updateDraft('astrolabeGender', value as DivinationDraft['astrolabeGender'])
                    }
                  />
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

          {draft.method === 'qimen' ? (
            <div className="form-item divination-birth-year-field">
              <label htmlFor="divination-birth-year-input">出生年份（年命，可选）</label>
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
