import type { ReactNode } from 'react';
import type { AstrolabeData } from '@/types/divination';
import type { QueryInputState, PromptSourceKey } from '@/lib/query-state';
import type { QizhengResult } from 'mingyu-core/qizheng';
import type { BaziCalculations } from '../hooks/useBaziCalculations';
import type { ZiweiCalculations } from '../hooks/useZiweiCalculations';
import { BaziChartBoard } from './BaziChartBoard';
import { ZiweiBoard } from './ZiweiBoard';
import { AstrolabeBoard } from './AstrolabeBoard';
import { QizhengBoard } from './QizhengBoard';
import { InlineSkeleton, ZiweiBoardSkeleton } from './skeletons';

export type PromptChartSourceOption = {
  value: PromptSourceKey;
  label: string;
  symbol: string;
  description: string;
};

export function PromptChartSourceCards(props: {
  options: PromptChartSourceOption[];
  value: PromptSourceKey;
  expandedValue: PromptSourceKey | null;
  onSelect: (value: PromptSourceKey) => void;
}) {
  return (
    <div className="prompt-source-card-grid" role="group" aria-label="排盘来源">
      {props.options.map((option) => {
        const isActive = props.value === option.value;
        const isExpanded = props.expandedValue === option.value;

        return (
          <button
            key={option.value}
            type="button"
            className={`prompt-source-card${isActive ? ' is-active' : ''}${isExpanded ? ' is-expanded' : ''}`}
            aria-pressed={isActive}
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? 'prompt-chart-preview' : undefined}
            onClick={() => props.onSelect(option.value)}
          >
            <span className="prompt-source-card-symbol" aria-hidden="true">
              {option.symbol}
            </span>
            <span className="prompt-source-card-copy">
              <strong>{option.label}</strong>
              <small>{isExpanded ? '收起完整盘面' : option.description}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type PromptChartPreviewProps = {
  source: PromptSourceKey;
  label: string;
  inputState: QueryInputState;
  bazi: BaziCalculations;
  ziwei: Pick<
    ZiweiCalculations,
    | 'ziweiRuntime'
    | 'partnerZiweiRuntime'
    | 'ziweiError'
    | 'primaryZiweiInput'
    | 'partnerZiweiInput'
    | 'currentZiweiPayload'
    | 'partnerZiweiPayload'
  >;
  astrolabeData: AstrolabeData | null;
  astrolabeError: string;
  qizhengData: QizhengResult | null;
  qizhengError: string;
  residentialPanel: ReactNode;
  onClose: () => void;
};

function BaziPreview(props: { inputState: QueryInputState; bazi: BaziCalculations }) {
  const { inputState, bazi } = props;
  if (bazi.baziError) return <p className="error-text">{bazi.baziError}</p>;

  if (inputState.analysisMode === 'compatibility') {
    return (
      <div className="result-dual-layout">
        {bazi.baziResult ? (
          <BaziChartBoard
            title="第一人八字"
            name={inputState.name || '第一人'}
            result={bazi.baziResult}
          />
        ) : (
          <InlineSkeleton />
        )}
        {bazi.partnerBaziResult ? (
          <BaziChartBoard
            title="第二人八字"
            name={inputState.partnerName || '第二人'}
            result={bazi.partnerBaziResult}
          />
        ) : (
          <InlineSkeleton />
        )}
      </div>
    );
  }

  return bazi.baziResult ? (
    <BaziChartBoard
      title="八字总览"
      name={inputState.name || '当前命盘'}
      result={bazi.baziResult}
    />
  ) : (
    <InlineSkeleton />
  );
}

function ZiweiPreview(props: {
  inputState: QueryInputState;
  ziwei: PromptChartPreviewProps['ziwei'];
}) {
  const { inputState, ziwei } = props;
  if (ziwei.ziweiError) return <p className="error-text">{ziwei.ziweiError}</p>;

  if (inputState.analysisMode === 'compatibility') {
    return (
      <div className="result-dual-layout">
        {ziwei.ziweiRuntime && ziwei.primaryZiweiInput && ziwei.currentZiweiPayload ? (
          <ZiweiBoard
            title="第一人紫微"
            name={inputState.name || '第一人'}
            payload={ziwei.currentZiweiPayload}
            chartInput={ziwei.primaryZiweiInput}
            runtime={ziwei.ziweiRuntime}
          />
        ) : (
          <ZiweiBoardSkeleton title="第一人紫微" name={inputState.name || '第一人'} />
        )}
        {ziwei.partnerZiweiRuntime && ziwei.partnerZiweiInput && ziwei.partnerZiweiPayload ? (
          <ZiweiBoard
            title="第二人紫微"
            name={inputState.partnerName || '第二人'}
            payload={ziwei.partnerZiweiPayload}
            chartInput={ziwei.partnerZiweiInput}
            runtime={ziwei.partnerZiweiRuntime}
          />
        ) : (
          <ZiweiBoardSkeleton title="第二人紫微" name={inputState.partnerName || '第二人'} />
        )}
      </div>
    );
  }

  return ziwei.ziweiRuntime && ziwei.primaryZiweiInput && ziwei.currentZiweiPayload ? (
    <ZiweiBoard
      title="紫微总览"
      name={inputState.name || '当前命盘'}
      payload={ziwei.currentZiweiPayload}
      chartInput={ziwei.primaryZiweiInput}
      runtime={ziwei.ziweiRuntime}
    />
  ) : (
    <ZiweiBoardSkeleton title="紫微总览" name={inputState.name || '当前命盘'} />
  );
}

function PromptChartPreviewBody(props: PromptChartPreviewProps) {
  if (props.source === 'bazi') {
    return <BaziPreview inputState={props.inputState} bazi={props.bazi} />;
  }

  if (props.source === 'bazi-ziwei') {
    return (
      <div className="prompt-chart-combined">
        <BaziPreview inputState={props.inputState} bazi={props.bazi} />
        <ZiweiPreview inputState={props.inputState} ziwei={props.ziwei} />
      </div>
    );
  }

  if (props.source === 'ziwei') {
    return <ZiweiPreview inputState={props.inputState} ziwei={props.ziwei} />;
  }

  if (props.source === 'astrolabe') {
    if (props.astrolabeError) return <p className="error-text">{props.astrolabeError}</p>;
    return props.astrolabeData ? (
      <AstrolabeBoard
        title="星盘总览"
        name={props.astrolabeData.birth.name || props.inputState.name || '当前命盘'}
        data={props.astrolabeData}
      />
    ) : (
      <InlineSkeleton />
    );
  }

  if (props.source === 'qizheng') {
    if (props.qizhengError) return <p className="error-text">{props.qizhengError}</p>;
    return props.qizhengData ? (
      <QizhengBoard
        title="七政四余本命盘"
        name={props.inputState.name || '本人'}
        data={props.qizhengData}
      />
    ) : (
      <InlineSkeleton />
    );
  }

  return props.residentialPanel;
}

export function PromptChartPreview(props: PromptChartPreviewProps) {
  return (
    <section id="prompt-chart-preview" className="prompt-chart-preview" aria-label={props.label}>
      <div className="prompt-chart-preview-head">
        <div>
          <span>当前排盘</span>
          <h2>{props.label}</h2>
        </div>
        <button type="button" onClick={props.onClose}>
          收起盘面
        </button>
      </div>
      <div className="prompt-chart-preview-body">
        <PromptChartPreviewBody {...props} />
      </div>
    </section>
  );
}
