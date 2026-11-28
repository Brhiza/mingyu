import * as React from 'react';
import { Clock, Coins, PenLine, WandSparkles } from 'lucide-react';
import type { DivinationFormMethod } from '../../../v2-ui/chart-tabs';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import { CardDrawStudio } from './CardDrawStudio';
import {
  JinkoujueStudio,
  MeihuaStudio,
  XiaoliurenStudio,
  ZhugeStudio,
} from './FolkDivinationStudios';
import { LiveChartWorkbench, type LiveChartMethod } from './LiveChartWorkbench';
import type { ShengbeiKind } from './ManualCastStudio';
import { RitualStageShell } from './RitualStageShell';
import { SsgwRitualStudio } from './SsgwRitualStudio';
import { LIVE_CHART_METHODS } from './divination-form-helpers';
import { CardOptionGrid, type DrawnCardItem } from './divination-shared';

export interface DivinationMethodRendererProps {
  method: DivinationFormMethod;
  showSubmit: boolean;
  buildPayload: () => Record<string, unknown>;
  clearRitualTimer: () => void;
  setFormError: (err: string | null) => void;
  renderUnifiedTime: (
    fieldLabel?: string,
    actionLabel?: string,
    wrapped?: boolean,
  ) => React.ReactNode;
  renderInlineYearStepper: (
    value: string,
    minYear: number,
    maxYear: number,
    onChangeYear: (next: string) => void,
  ) => React.ReactNode;
  liuyaoCastMode: 'coins' | 'manual' | 'yarrow' | 'time';
  onChangeLiuyaoCastMode: (next: 'coins' | 'manual' | 'yarrow' | 'time') => void;
  onStopLiuyaoShaking: () => void;
  liuyaoParts: {
    stepBar: React.ReactNode;
    leftExtra: React.ReactNode;
    rightContent: React.ReactNode;
    actions: React.ReactNode;
    isComplete: boolean;
  };
  meihuaCastMode: 'time' | 'number' | 'character' | 'sound' | 'direction';
  meihuaNumber: string;
  meihuaCharText: string;
  meihuaSoundCount: string;
  meihuaDirection: string;
  meihuaObjectType: string;
  onChangeMeihuaCastMode: (next: 'time' | 'number' | 'character' | 'sound' | 'direction') => void;
  onChangeMeihuaNumber: (next: string) => void;
  onChangeMeihuaCharText: (next: string) => void;
  onChangeMeihuaSoundCount: (next: string) => void;
  onChangeMeihuaDirection: (next: string) => void;
  onChangeMeihuaObjectType: (next: string) => void;
  xiaoliurenMode: 'time' | 'numbers';
  xiaoliurenNumbers: [string, string, string];
  onChangeXiaoliurenMode: (next: 'time' | 'numbers') => void;
  onChangeXiaoliurenNumbers: (next: [string, string, string]) => void;
  jinkoujueMode: 'time' | 'branch' | 'number' | 'random';
  jinkoujueBranch: string;
  jinkoujueNumber: string;
  onChangeJinkoujueMode: (next: 'time' | 'branch' | 'number' | 'random') => void;
  onChangeJinkoujueBranch: (next: string) => void;
  onChangeJinkoujueNumber: (next: string) => void;
  qimenScope: 'hour' | 'day' | 'month' | 'year';
  onChangeQimenScope: (next: 'hour' | 'day' | 'month' | 'year') => void;
  taiyiScope: 'year' | 'month' | 'day' | 'hour';
  taiyiYear: string;
  onChangeTaiyiScope: (next: 'year' | 'month' | 'day' | 'hour') => void;
  onChangeTaiyiYear: (next: string) => void;
  huangjiMode: 'year' | 'datetime' | 'six-day';
  huangjiYear: string;
  onChangeHuangjiMode: (next: 'year' | 'datetime' | 'six-day') => void;
  onChangeHuangjiYear: (next: string) => void;
  wuyunYear: string;
  onChangeWuyunYear: (next: string) => void;
  tarotSpreadId: string;
  tarotDeckScope: 'all' | 'major';
  tarotDrawMode: 'interactive' | 'random' | 'manual';
  tarotReversalMode: 'realistic' | 'balanced' | 'upright-only';
  tarotDrawnCards: DrawnCardItem[];
  onChangeTarotSpreadId: (next: string) => void;
  onChangeTarotDeckScope: (next: 'all' | 'major') => void;
  onChangeTarotDrawMode: (next: 'interactive' | 'random' | 'manual') => void;
  onChangeTarotReversalMode: (next: 'realistic' | 'balanced' | 'upright-only') => void;
  onChangeTarotDrawnCards: (next: DrawnCardItem[]) => void;
  lenormandSpreadId: string;
  lenormandDrawMode: 'interactive' | 'random' | 'manual';
  lenormandDrawnCards: DrawnCardItem[];
  onChangeLenormandSpreadId: (next: string) => void;
  onChangeLenormandDrawMode: (next: 'interactive' | 'random' | 'manual') => void;
  onChangeLenormandDrawnCards: (next: DrawnCardItem[]) => void;
  zhugeCastMode: 'text' | 'numbers' | 'coins';
  kongmingCoins: Array<'●' | '○'>;
  zhugeCharRawInputs: [string, string, string];
  zhugeNumbers: [string, string, string];
  onChangeZhugeCastMode: (next: 'text' | 'numbers' | 'coins') => void;
  onChangeKongmingCoins: (next: Array<'●' | '○'>) => void;
  onChangeZhugeCharAt: (idx: number, raw: string) => void;
  onBlurZhugeCharAt: (idx: number) => void;
  onChangeZhugeNumbers: (next: [string, string, string]) => void;
  ssgwMode: 'interactive' | 'manual' | 'random';
  ssgwNumber: string;
  ssgwConfirmed: boolean;
  ssgwBeiMessage: string;
  ssgwBeiPair: readonly ['yang' | 'yin', 'yang' | 'yin'] | undefined;
  ssgwBeiHistory: Array<{ short: string; ok: boolean; kind: ShengbeiKind }>;
  ssgwShaking: boolean;
  ssgwThrowing: boolean;
  onChangeSsgwMode: (next: 'interactive' | 'manual' | 'random') => void;
  onChangeSsgwNumber: (next: string) => void;
  onRequestSsgwShake: () => void;
  onCompleteSsgwShake: () => void;
  onRequestSsgwThrow: () => void;
}

export function DivinationMethodRenderer(p: DivinationMethodRendererProps) {
  if (p.method === 'liuyao') {
    const isTimeMode = p.liuyaoCastMode === 'time';
    return (
      <RitualStageShell
        title="六爻问卦"
        showSubmitButton={p.showSubmit}
        submitLabel="开始占卜"
        stepBar={isTimeMode ? null : p.liuyaoParts.stepBar}
        actions={isTimeMode ? undefined : p.liuyaoParts.actions}
        isComplete={isTimeMode ? true : p.liuyaoParts.isComplete}
        headerRight={
          <CardOptionGrid<'coins' | 'yarrow' | 'time' | 'manual'>
            value={p.liuyaoCastMode}
            columns={4}
            className="is-compact-ribbon"
            options={[
              { id: 'coins', label: '三钱摇卦', icon: Coins },
              { id: 'yarrow', label: '蓍草十八变', icon: WandSparkles },
              { id: 'time', label: '时间起卦', icon: Clock },
              { id: 'manual', label: '手动录爻', icon: PenLine },
            ]}
            onSelect={(val) => {
              p.clearRitualTimer();
              p.setFormError(null);
              p.onStopLiuyaoShaking();
              p.onChangeLiuyaoCastMode(val);
            }}
          />
        }
      >
        {isTimeMode ? (
          <div className="ritual-center-block">
            {p.renderUnifiedTime('起卦时间', '起卦')}
          </div>
        ) : p.liuyaoCastMode === 'manual' ? (
          <div className="liuyao-ritual-single">{p.liuyaoParts.rightContent}</div>
        ) : (
          <div className="liuyao-ritual-split">
            <div className="liuyao-ritual-pane">{p.liuyaoParts.leftExtra}</div>
            <div className="liuyao-ritual-pane">{p.liuyaoParts.rightContent}</div>
          </div>
        )}
      </RitualStageShell>
    );
  }

  if (p.method === 'meihua') {
    const canPreview =
      p.meihuaCastMode === 'time' ||
      p.meihuaCastMode === 'direction' ||
      (p.meihuaCastMode === 'number' && Number.parseInt(p.meihuaNumber, 10) > 0) ||
      (p.meihuaCastMode === 'sound' && Number.parseInt(p.meihuaSoundCount, 10) > 0) ||
      (p.meihuaCastMode === 'character' && p.meihuaCharText.trim().length > 0);
    return (
      <MeihuaStudio
        mode={p.meihuaCastMode}
        numberValue={p.meihuaNumber}
        charText={p.meihuaCharText}
        soundCount={p.meihuaSoundCount}
        direction={p.meihuaDirection}
        objectType={p.meihuaObjectType}
        previewPayload={canPreview ? p.buildPayload() : null}
        timeControl={p.renderUnifiedTime('起卦时间', '起卦')}
        showSubmitButton={p.showSubmit}
        onChangeMode={(next) => {
          p.setFormError(null);
          p.onChangeMeihuaCastMode(next);
        }}
        onChangeNumber={(val) => {
          p.setFormError(null);
          p.onChangeMeihuaNumber(val);
        }}
        onChangeCharText={(val) => {
          p.setFormError(null);
          p.onChangeMeihuaCharText(val);
        }}
        onChangeSoundCount={(val) => {
          p.setFormError(null);
          p.onChangeMeihuaSoundCount(val);
        }}
        onChangeDirection={p.onChangeMeihuaDirection}
        onChangeObjectType={p.onChangeMeihuaObjectType}
      />
    );
  }

  if (p.method === 'xiaoliuren') {
    const numsReady =
      p.xiaoliurenMode === 'time' ||
      p.xiaoliurenNumbers.every((raw) => Number.parseInt(raw, 10) >= 1);
    return (
      <XiaoliurenStudio
        mode={p.xiaoliurenMode}
        numbers={p.xiaoliurenNumbers}
        previewPayload={numsReady ? p.buildPayload() : null}
        timeControl={p.renderUnifiedTime('起课时间', '起课')}
        showSubmitButton={p.showSubmit}
        onChangeMode={(next) => {
          p.setFormError(null);
          p.onChangeXiaoliurenMode(next);
        }}
        onChangeNumbers={(next) => {
          p.setFormError(null);
          p.onChangeXiaoliurenNumbers(next);
        }}
      />
    );
  }

  if (p.method === 'jinkoujue') {
    const canPreview =
      p.jinkoujueMode === 'time' ||
      p.jinkoujueMode === 'branch' ||
      (p.jinkoujueMode === 'number' && Number.parseInt(p.jinkoujueNumber, 10) >= 1);
    return (
      <JinkoujueStudio
        mode={p.jinkoujueMode}
        branch={p.jinkoujueBranch}
        numberValue={p.jinkoujueNumber}
        previewPayload={canPreview ? p.buildPayload() : null}
        timeControl={p.renderUnifiedTime('起课时间', '起课')}
        showSubmitButton={p.showSubmit}
        onChangeMode={(next) => {
          p.setFormError(null);
          p.onChangeJinkoujueMode(next);
          p.clearRitualTimer();
        }}
        onChangeBranch={p.onChangeJinkoujueBranch}
        onChangeNumber={(v) => {
          p.setFormError(null);
          p.onChangeJinkoujueNumber(v);
        }}
      />
    );
  }

  if (LIVE_CHART_METHODS.has(p.method)) {
    const liveMethod = p.method as LiveChartMethod;
    const controls = (() => {
      if (liveMethod === 'qimen') {
        return (
          <>
            <UiSegmentedControl<'hour' | 'day' | 'month' | 'year'>
              value={p.qimenScope}
              options={[
                { value: 'hour', label: '时家' },
                { value: 'day', label: '日家' },
                { value: 'month', label: '月家' },
                { value: 'year', label: '年家' },
              ]}
              onChange={p.onChangeQimenScope}
            />
            <span className="live-chart-divider" aria-hidden="true" />
            {p.renderUnifiedTime('起局时间', '排盘', false)}
          </>
        );
      }
      if (liveMethod === 'liuren') {
        return p.renderUnifiedTime('起课时间', '起课', false);
      }
      if (liveMethod === 'taiyi') {
        return (
          <>
            <UiSegmentedControl<'year' | 'month' | 'day' | 'hour'>
              value={p.taiyiScope}
              options={[
                { value: 'year', label: '年计' },
                { value: 'month', label: '月计' },
                { value: 'day', label: '日计' },
                { value: 'hour', label: '时计' },
              ]}
              onChange={p.onChangeTaiyiScope}
            />
            <span className="live-chart-divider" aria-hidden="true" />
            {p.taiyiScope === 'year'
              ? p.renderInlineYearStepper(p.taiyiYear, 1900, 2200, p.onChangeTaiyiYear)
              : p.renderUnifiedTime('起局时间', '排盘', false)}
          </>
        );
      }
      if (liveMethod === 'huangji-jingshi') {
        return (
          <>
            <UiSegmentedControl<'year' | 'datetime' | 'six-day'>
              value={p.huangjiMode}
              options={[
                { value: 'year', label: '值年' },
                { value: 'datetime', label: '年月日时' },
                { value: 'six-day', label: '六日逐爻' },
              ]}
              onChange={p.onChangeHuangjiMode}
            />
            <span className="live-chart-divider" aria-hidden="true" />
            {p.huangjiMode === 'year'
              ? p.renderInlineYearStepper(p.huangjiYear, -3000, 9999, p.onChangeHuangjiYear)
              : p.renderUnifiedTime('推演时间', '推演', false)}
          </>
        );
      }
      return p.renderInlineYearStepper(p.wuyunYear, 1, 9999, p.onChangeWuyunYear);
    })();

    const liveTitle =
      liveMethod === 'qimen'
        ? '奇门遁甲'
        : liveMethod === 'liuren'
          ? '大六壬'
          : undefined;

    return (
      <LiveChartWorkbench
        method={liveMethod}
        title={liveTitle}
        payload={p.buildPayload()}
        controls={controls}
        showSubmitButton={p.showSubmit}
      />
    );
  }

  if (p.method === 'tarot' || p.method === 'lenormand') {
    return (
      <CardDrawStudio
        method={p.method}
        showSubmitButton={p.showSubmit}
        tarotSpreadId={p.tarotSpreadId}
        tarotDeckScope={p.tarotDeckScope}
        tarotDrawMode={p.tarotDrawMode}
        tarotReversalMode={p.tarotReversalMode}
        tarotDrawnCards={p.tarotDrawnCards}
        lenormandSpreadId={p.lenormandSpreadId}
        lenormandDrawMode={p.lenormandDrawMode}
        lenormandDrawnCards={p.lenormandDrawnCards}
        onChangeTarotSpreadId={(val) => {
          p.setFormError(null);
          p.onChangeTarotSpreadId(val);
        }}
        onChangeTarotDeckScope={(val) => {
          p.setFormError(null);
          p.onChangeTarotDeckScope(val);
        }}
        onChangeTarotDrawMode={(val) => {
          p.setFormError(null);
          p.onChangeTarotDrawMode(val);
        }}
        onChangeTarotReversalMode={(val) => {
          p.setFormError(null);
          p.onChangeTarotReversalMode(val);
        }}
        onChangeTarotDrawnCards={(cards) => {
          p.setFormError(null);
          p.onChangeTarotDrawnCards(cards);
        }}
        onChangeLenormandSpreadId={(val) => {
          p.setFormError(null);
          p.onChangeLenormandSpreadId(val);
        }}
        onChangeLenormandDrawMode={(val) => {
          p.setFormError(null);
          p.onChangeLenormandDrawMode(val);
        }}
        onChangeLenormandDrawnCards={(cards) => {
          p.setFormError(null);
          p.onChangeLenormandDrawnCards(cards);
        }}
      />
    );
  }

  if (p.method === 'zhuge') {
    return (
      <ZhugeStudio
        mode={p.zhugeCastMode}
        coins={p.kongmingCoins}
        charRawInputs={p.zhugeCharRawInputs}
        numbers={p.zhugeNumbers}
        showSubmitButton={p.showSubmit}
        onChangeMode={(next) => {
          p.setFormError(null);
          p.onChangeZhugeCastMode(next);
        }}
        onChangeCoins={(next) => {
          p.clearRitualTimer();
          p.onChangeKongmingCoins(next);
        }}
        onChangeCharAt={p.onChangeZhugeCharAt}
        onBlurCharAt={p.onBlurZhugeCharAt}
        onChangeNumbers={(next) => {
          p.setFormError(null);
          p.onChangeZhugeNumbers(next);
        }}
      />
    );
  }

  if (p.method === 'ssgw') {
    return (
      <SsgwRitualStudio
        mode={p.ssgwMode}
        candidateNumber={p.ssgwNumber}
        confirmed={p.ssgwConfirmed}
        beiMessage={p.ssgwBeiMessage}
        beiPair={p.ssgwBeiPair}
        beiHistory={p.ssgwBeiHistory}
        isShaking={p.ssgwShaking}
        isThrowingCups={p.ssgwThrowing}
        showSubmitButton={p.showSubmit}
        onChangeMode={(next) => {
          p.clearRitualTimer();
          p.onChangeSsgwMode(next);
        }}
        onChangeManualNumber={(val) => {
          p.setFormError(null);
          p.onChangeSsgwNumber(val);
        }}
        onRequestShake={p.onRequestSsgwShake}
        onShakeComplete={p.onCompleteSsgwShake}
        onRequestThrow={p.onRequestSsgwThrow}
      />
    );
  }

  // random-divination
  return (
    <div className="divination-workbench-cols is-single-col">
      <div className="divination-workbench-col is-left">
        <div className="workspace-ui-notice">
          <span>随机抽取一门术数即时起卦</span>
        </div>
      </div>
    </div>
  );
}
