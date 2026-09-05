import { XIAOLIUREN_RULE_OPTIONS } from 'mingyu-core/divination/xiaoliuren';
import { useState } from 'react';
import {
  DIVINATION_METHOD_OPTIONS,
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
import type { PersonalHistoryRecord } from '@/lib/history-records';
import { DropdownSelect } from '@/components/DropdownSelect';
import {
  SupplementaryInfoModal,
  type SupplementaryInfoModalField,
} from '@/components/SupplementaryInfoModal';
import { WorkspaceButton } from '@/components/workspace/WorkspaceUI';
import { AlmanacForm } from './AlmanacForm';

const DIVINATION_TIME_MODE_OPTIONS = [
  { value: 'current', label: '当前时间' },
  { value: 'custom', label: '自定时间' },
] as const;

const DIVINATION_TIME_STANDARD_OPTIONS = [
  { value: 'beijing', label: '北京时间' },
  { value: 'true-solar', label: '真太阳时' },
] as const;

const JINKOUJUE_BRANCH_OPTIONS = [
  { value: '子', label: '子' },
  { value: '丑', label: '丑' },
  { value: '寅', label: '寅' },
  { value: '卯', label: '卯' },
  { value: '辰', label: '辰' },
  { value: '巳', label: '巳' },
  { value: '午', label: '午' },
  { value: '未', label: '未' },
  { value: '申', label: '申' },
  { value: '酉', label: '酉' },
  { value: '戌', label: '戌' },
  { value: '亥', label: '亥' },
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

const DIVINATION_SUPPLEMENTARY_INFO_FIELDS = [
  {
    key: 'userSupplement',
    label: '补充说明',
    placeholder: '补充与问题直接相关的背景或细节。',
  },
  {
    key: 'currentSituation',
    label: '当前情况',
    placeholder: '例如：正在考虑换工作，已经拿到一个新机会。',
  },
  {
    key: 'currentState',
    label: '当前状态',
    placeholder: '例如：时间紧、压力较大，但仍有一定选择空间。',
  },
  {
    key: 'knownFacts',
    label: '已知事实',
    placeholder: '例如：对方已明确报价，合同尚未签署。',
  },
  {
    key: 'desiredOutcome',
    label: '期望结果',
    placeholder: '例如：希望兼顾收入提升与长期稳定。',
  },
  {
    key: 'constraints',
    label: '现实限制',
    placeholder: '例如：三个月内不能搬家，预算上限为两万元。',
  },
] as const satisfies readonly SupplementaryInfoModalField[];

const ALMANAC_SUPPLEMENTARY_INFO_FIELDS = [
  {
    key: 'question',
    label: '补充要求',
    placeholder: '例如：避开周末，优先上午，兼顾家人时间。',
    rows: 5,
  },
] as const satisfies readonly SupplementaryInfoModalField[];

function isTimeBasedDivinationDraft(draft: DivinationDraft) {
  if (draft.method === 'liuyao' || draft.method === 'qimen' || draft.method === 'liuren') {
    return true;
  }

  if (draft.method === 'taiyi') {
    return true;
  }

  if (draft.method === 'meihua' || draft.method === 'xiaoliuren' || draft.method === 'jinkoujue') {
    return true;
  }

  if (draft.method === 'huangji') {
    return true;
  }

  return false;
}

interface DivinationFormProps {
  draft: DivinationDraft;
  updateDraft: <K extends keyof DivinationDraft>(key: K, value: DivinationDraft[K]) => void;
  lockedMethod?: DivinationDraft['method'];
  isSubmitting: boolean;
  error: string;
  onSubmit: () => void | Promise<void>;
  onOpenInspiration: () => void;
  onOpenBirthPlace: () => void;
  questionInputRef: React.RefObject<HTMLTextAreaElement | null>;
  cases?: PersonalHistoryRecord[];
  showHeading?: boolean;
}

export function DivinationForm({
  draft,
  updateDraft,
  lockedMethod,
  isSubmitting,
  error,
  onSubmit,
  onOpenInspiration,
  onOpenBirthPlace,
  questionInputRef,
  cases = [],
  showHeading = true,
}: DivinationFormProps) {
  const [isSupplementaryInfoModalOpen, setIsSupplementaryInfoModalOpen] = useState(false);
  const isMethodLocked = Boolean(lockedMethod);
  const lockedMethodOption = DIVINATION_METHOD_OPTIONS.find((item) => item.value === lockedMethod);
  const formHeading = lockedMethodOption?.label ?? '传统起卦';
  const isAlmanac = draft.method === 'almanac';
  const questionLabel = '问题';
  const questionPlaceholder =
    draft.method === 'huangji'
      ? '例如：这个时点整体处于怎样的时势阶段，接下来应把握什么主线？'
      : '例如：我现在该主动推进，还是先稳住等待更好的时机？';
  const submitButtonText =
    draft.method === 'almanac'
      ? '开始择日'
      : draft.method === 'astrolabe'
        ? '生成星盘'
        : draft.method === 'huangji'
          ? '生成皇极盘'
          : '开始占卜';
  const timeActionLabel =
    draft.method === 'huangji'
      ? '起盘'
      : draft.method === 'qimen' || draft.method === 'taiyi'
        ? '起局'
        : draft.method === 'liuren' || draft.method === 'xiaoliuren' || draft.method === 'jinkoujue'
          ? '起课'
          : '起卦';
  const isTimeBasedDivination = isTimeBasedDivinationDraft(draft);
  const supportsTrueSolarTime =
    isTimeBasedDivination && !(draft.method === 'taiyi' && (draft.taiyiScope ?? 'year') === 'year');
  const divinationTimeMode = draft.divinationTimeMode ?? 'current';
  const divinationTimeStandard = draft.divinationTimeStandard ?? 'beijing';
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
  const kongmingMethod = draft.kongmingMethod ?? 'random';
  const kongmingPattern = draft.kongmingPattern ?? '';
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
      (!/^\d+$/.test(ssgwNumber) || Number(ssgwNumber) < 1 || Number(ssgwNumber) > 92)) ||
    (draft.method === 'zhuge' && [...draft.zhugeText.trim()].length !== 3) ||
    (draft.method === 'kongming' &&
      kongmingMethod === 'manual' &&
      !/^[●○]{5}$/.test(kongmingPattern));
  const supplementaryInfoCount = isAlmanac
    ? Number(Boolean(draft.question.trim()))
    : DIVINATION_SUPPLEMENTARY_INFO_FIELDS.reduce(
        (count, field) => count + Number(Boolean(draft[field.key]?.trim())),
        0,
      );
  const supplementaryInfoModal = isSupplementaryInfoModalOpen ? (
    <SupplementaryInfoModal
      fields={isAlmanac ? ALMANAC_SUPPLEMENTARY_INFO_FIELDS : DIVINATION_SUPPLEMENTARY_INFO_FIELDS}
      values={
        isAlmanac
          ? { question: draft.question }
          : Object.fromEntries(
              DIVINATION_SUPPLEMENTARY_INFO_FIELDS.map((field) => [
                field.key,
                draft[field.key] ?? '',
              ]),
            )
      }
      description={
        isAlmanac
          ? '填写日期、时段或其他个性化要求。'
          : '填写与问题直接相关的背景或限制，未填写的项目不会进入解读。'
      }
      onSave={(values) => {
        if (isAlmanac) {
          updateDraft('questionSource', 'custom');
          updateDraft('question', values.question ?? '');
          return;
        }
        DIVINATION_SUPPLEMENTARY_INFO_FIELDS.forEach((field) => {
          updateDraft(field.key, values[field.key] ?? '');
        });
      }}
      onClose={() => setIsSupplementaryInfoModalOpen(false)}
    />
  ) : null;

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

  if (isAlmanac) {
    return (
      <>
        <section className="workspace-ui-form-surface divination-form-card">
          {showHeading ? (
            <div className="workspace-ui-form-heading">
              <h2>{formHeading}</h2>
            </div>
          ) : null}

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

          <AlmanacForm
            draft={draft}
            cases={cases}
            updateDraft={updateDraft}
            supplementaryInfoCount={supplementaryInfoCount}
            onOpenSupplementaryInfo={() => setIsSupplementaryInfoModalOpen(true)}
          />
        </section>

        {error ? <div className="workspace-ui-form-error">{error}</div> : null}

        <div className="workspace-ui-form-actions is-sticky-mobile">
          <WorkspaceButton
            variant="primary"
            size="large"
            block
            disabled={isSubmitting}
            onClick={onSubmit}
          >
            {submitButtonText}
          </WorkspaceButton>
        </div>
        {supplementaryInfoModal}
      </>
    );
  }

  return (
    <>
      <section className="workspace-ui-form-surface divination-form-card">
        {showHeading ? (
          <div className="workspace-ui-form-heading">
            <h2>{formHeading}</h2>
          </div>
        ) : null}

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

                    {draft.method === 'xiaoliuren' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="xiaoliuren-rule-select">起课口径</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="xiaoliuren-rule-select"
                            value={draft.xiaoliurenRule ?? 'common'}
                            options={XIAOLIUREN_RULE_OPTIONS}
                            onChange={(value) =>
                              updateDraft(
                                'xiaoliurenRule',
                                value as DivinationDraft['xiaoliurenRule'],
                              )
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

                    {draft.method === 'jinkoujue' && draft.jinkoujueMethod === 'branch' ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="jinkoujue-branch-select">地分</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="jinkoujue-branch-select"
                            value={draft.jinkoujueBranch}
                            options={JINKOUJUE_BRANCH_OPTIONS}
                            onChange={(value) => updateDraft('jinkoujueBranch', value)}
                          />
                        </div>
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
                        <label htmlFor="divination-time-mode-select">{timeActionLabel}时间</label>
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

                    {supportsTrueSolarTime ? (
                      <div className="form-item divination-inline-field">
                        <label htmlFor="divination-time-standard-select">时间口径</label>
                        <div className="divination-select-shell divination-desktop-select-shell">
                          <DropdownSelect
                            id="divination-time-standard-select"
                            value={divinationTimeStandard}
                            options={DIVINATION_TIME_STANDARD_OPTIONS}
                            onChange={(value) =>
                              updateDraft(
                                'divinationTimeStandard',
                                value as NonNullable<DivinationDraft['divinationTimeStandard']>,
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="divination-desktop-question-actions">
                    <button
                      type="button"
                      className="workspace-ui-choice"
                      onClick={onOpenInspiration}
                    >
                      问题灵感
                    </button>
                    <button
                      type="button"
                      className={`workspace-ui-choice ${supplementaryInfoCount ? 'is-active' : ''}`}
                      aria-haspopup="dialog"
                      aria-expanded={isSupplementaryInfoModalOpen}
                      onClick={() => setIsSupplementaryInfoModalOpen(true)}
                    >
                      补充信息{supplementaryInfoCount ? ` · ${supplementaryInfoCount}项` : ''}
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`divination-mobile-control-row ${
                  draft.method === 'meihua' ||
                  draft.method === 'liuyao' ||
                  draft.method === 'jinkoujue' ||
                  draft.method === 'liuren' ||
                  draft.method === 'qimen' ||
                  draft.method === 'taiyi' ||
                  draft.method === 'huangji' ||
                  draft.method === 'tarot' ||
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

                {draft.method === 'xiaoliuren' ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={draft.xiaoliurenRule ?? 'common'}
                      options={XIAOLIUREN_RULE_OPTIONS}
                      ariaLabel="小六壬起课口径"
                      onChange={(value) =>
                        updateDraft('xiaoliurenRule', value as DivinationDraft['xiaoliurenRule'])
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
                      ariaLabel={`${timeActionLabel}时间`}
                      onChange={(value) =>
                        updateDraft(
                          'divinationTimeMode',
                          value as NonNullable<DivinationDraft['divinationTimeMode']>,
                        )
                      }
                    />
                  </div>
                ) : null}

                {supportsTrueSolarTime ? (
                  <div className="divination-mobile-secondary-picker">
                    <DropdownSelect
                      value={divinationTimeStandard}
                      options={DIVINATION_TIME_STANDARD_OPTIONS}
                      ariaLabel="时间口径"
                      onChange={(value) =>
                        updateDraft(
                          'divinationTimeStandard',
                          value as NonNullable<DivinationDraft['divinationTimeStandard']>,
                        )
                      }
                    />
                  </div>
                ) : null}

                <div className="divination-mobile-aux-actions">
                  <button type="button" className="workspace-ui-choice" onClick={onOpenInspiration}>
                    问题灵感
                  </button>
                  <button
                    type="button"
                    className={`workspace-ui-choice ${supplementaryInfoCount ? 'is-active' : ''}`}
                    aria-haspopup="dialog"
                    aria-expanded={isSupplementaryInfoModalOpen}
                    onClick={() => setIsSupplementaryInfoModalOpen(true)}
                  >
                    补充信息{supplementaryInfoCount ? ` · ${supplementaryInfoCount}` : ''}
                  </button>
                </div>
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

          {draft.method === 'jinkoujue' && draft.jinkoujueMethod === 'branch' ? (
            <div className="form-row divination-mobile-only">
              <div className="form-item">
                <label htmlFor="jinkoujue-branch-select-mobile">地分</label>
                <DropdownSelect
                  id="jinkoujue-branch-select-mobile"
                  value={draft.jinkoujueBranch}
                  options={JINKOUJUE_BRANCH_OPTIONS}
                  variant="field"
                  onChange={(value) => updateDraft('jinkoujueBranch', value)}
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
                  <WorkspaceButton
                    variant="primary"
                    className="liuyao-shake-button"
                    onClick={shakeLiuyaoYao}
                  >
                    手摇一爻
                  </WorkspaceButton>
                ) : null}
                {visibleLiuyaoYaos.length > 0 ? (
                  <WorkspaceButton
                    size="small"
                    className="manual-reset-button"
                    onClick={() =>
                      liuyaoMethod === 'coins'
                        ? updateDraft('liuyaoCoinThrows', [])
                        : updateDraft('liuyaoYaos', [])
                    }
                  >
                    重新起卦
                  </WorkspaceButton>
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
                      <WorkspaceButton
                        variant="primary"
                        className="interactive-draw-button"
                        onClick={drawTarotCard}
                      >
                        抽一张
                      </WorkspaceButton>
                    ) : null}
                    {tarotInteractiveCards.length > 0 ? (
                      <WorkspaceButton
                        size="small"
                        className="manual-reset-button"
                        onClick={resetTarotCards}
                      >
                        重新抽取
                      </WorkspaceButton>
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
                      <WorkspaceButton
                        variant="primary"
                        className="interactive-draw-button"
                        onClick={drawLenormandCard}
                      >
                        抽一张
                      </WorkspaceButton>
                    ) : null}
                    {lenormandInteractiveCards.length > 0 ? (
                      <WorkspaceButton
                        size="small"
                        className="manual-reset-button"
                        onClick={resetLenormandCards}
                      >
                        重新抽取
                      </WorkspaceButton>
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

          {draft.method === 'zhuge' ? (
            <div className="divination-extra-panel manual-entry-panel">
              <div className="form-item">
                <label htmlFor="zhuge-text-input">随念写下三个汉字</label>
                <input
                  id="zhuge-text-input"
                  type="text"
                  className="form-input"
                  placeholder="例如 顺其然"
                  value={draft.zhugeText}
                  onChange={(event) =>
                    updateDraft('zhugeText', [...event.target.value].slice(0, 3).join(''))
                  }
                />
                <small className="workspace-ui-field-hint">
                  依三个字的康熙笔画取末位数，合成签序。
                </small>
              </div>
            </div>
          ) : null}

          {draft.method === 'kongming' ? (
            <div className="divination-extra-panel manual-entry-panel">
              <div className="manual-mode-switch" role="group" aria-label="孔明神卦起卦方式">
                <button
                  type="button"
                  className={kongmingMethod === 'random' ? 'is-active' : ''}
                  onClick={() => updateDraft('kongmingMethod', 'random')}
                >
                  自动起卦
                </button>
                <button
                  type="button"
                  className={kongmingMethod === 'manual' ? 'is-active' : ''}
                  onClick={() => {
                    updateDraft('kongmingMethod', 'manual');
                    if (kongmingMethod !== 'manual') updateDraft('kongmingPattern', '-----');
                  }}
                >
                  手动取象
                </button>
              </div>
              {kongmingMethod === 'manual' ? (
                <>
                  <div className="culture-coins" aria-label="五枚硬币的正反面">
                    {[0, 1, 2, 3, 4].map((index) => {
                      const selected = kongmingPattern[index];
                      return (
                        <fieldset key={index} className="culture-coin-entry">
                          <legend>第{index + 1}枚</legend>
                          <div className="culture-coin-options">
                            {(
                              [
                                ['●', '正面', '阳'],
                                ['○', '反面', '阴'],
                              ] as const
                            ).map(([symbol, face, polarity]) => (
                              <button
                                key={symbol}
                                type="button"
                                className={selected === symbol ? 'is-active' : ''}
                                aria-pressed={selected === symbol}
                                aria-label={`第${index + 1}枚，${face}，${polarity}`}
                                onClick={() => {
                                  const next = [...kongmingPattern.padEnd(5, '-').slice(0, 5)];
                                  next[index] = symbol;
                                  updateDraft('kongmingPattern', next.join(''));
                                }}
                              >
                                <strong>{face}</strong>
                                <small>{polarity}</small>
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                  <small className="workspace-ui-field-hint">
                    摇出五枚硬币后，按摆放顺序逐枚记录；正面为阳，反面为阴。
                  </small>
                </>
              ) : (
                <small className="workspace-ui-field-hint">
                  系统独立取得五枚硬币的阴阳结果并组成卦象。
                </small>
              )}
            </div>
          ) : null}

          {isTimeBasedDivination && divinationTimeMode === 'custom' ? (
            draft.method === 'taiyi' && (draft.taiyiScope ?? 'year') === 'year' ? (
              <div className="divination-extra-panel divination-time-panel">
                <div className="form-row">
                  <div className="form-item">
                    <label htmlFor="taiyi-year-input">{timeActionLabel}年份</label>
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
            ) : (
              <div className="divination-extra-panel divination-time-panel">
                <div className="form-row-flex">
                  <div className="form-item">
                    <label htmlFor="custom-divination-date-input">{timeActionLabel}日期</label>
                    <input
                      id="custom-divination-date-input"
                      type="date"
                      className="form-input"
                      value={draft.customDivinationDate ?? ''}
                      onChange={(event) => updateDraft('customDivinationDate', event.target.value)}
                    />
                  </div>
                  <div className="form-item">
                    <label htmlFor="custom-divination-time-input">
                      {timeActionLabel}时间（北京时间）
                    </label>
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
            )
          ) : null}

          {supportsTrueSolarTime && divinationTimeStandard === 'true-solar' ? (
            <div className="divination-extra-panel divination-time-panel divination-solar-place-panel">
              <div className="form-row">
                <div className="form-item">
                  <label htmlFor="divination-birth-place-input">起局地点</label>
                  <button
                    id="divination-birth-place-input"
                    type="button"
                    className="form-input address-trigger"
                    onClick={onOpenBirthPlace}
                  >
                    <span>{draft.birthPlace || '请选择起局地点'}</span>
                    <span className="address-trigger-arrow">选择</span>
                  </button>
                  <small className="workspace-ui-field-hint">
                    按地点经度校正当前时间或自定时间
                  </small>
                </div>
              </div>
            </div>
          ) : null}

          {draft.method !== 'almanac' &&
          draft.method !== 'astrolabe' &&
          draft.method !== 'huangji' ? (
            <div className="form-row-flex divination-subject-fields">
              <div className="form-item">
                <label htmlFor="divination-gender-select">性别（可选）</label>
                <DropdownSelect
                  id="divination-gender-select"
                  value={draft.gender ?? ''}
                  options={OPTIONAL_GENDER_OPTIONS}
                  variant="field"
                  onChange={(value) => updateDraft('gender', value as DivinationDraft['gender'])}
                />
              </div>
              <div className="form-item">
                <label htmlFor="divination-birth-year-input">出生年份（可选）</label>
                <input
                  id="divination-birth-year-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  className="form-input"
                  placeholder="例如 1998"
                  value={draft.birthYear}
                  onChange={(event) =>
                    updateDraft('birthYear', event.target.value.replace(/[^\d]/g, '').slice(0, 4))
                  }
                />
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
        </div>
      </section>

      {error ? <div className="workspace-ui-form-error">{error}</div> : null}

      <div className="workspace-ui-form-actions is-sticky-mobile">
        <WorkspaceButton
          variant="primary"
          size="large"
          block
          disabled={isSubmitting || isManualInputIncomplete}
          onClick={onSubmit}
        >
          {submitButtonText}
        </WorkspaceButton>
      </div>
      {supplementaryInfoModal}
    </>
  );
}
