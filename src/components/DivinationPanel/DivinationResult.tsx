import { useMemo } from 'react';
import type { DivinationDraft } from '@/lib/divination/engine';
import type { DivinationSession } from '@/lib/divination/engine';
import type { DivinationSummaryBlocks } from '@/lib/divination/summary';
import type {
  AstrolabeData,
  LiurenData,
  LiurenPlateItem,
  LiurenTransmission,
  XiaoliurenData,
  XiaoliurenPalaceDetail,
} from '@/types/divination';
import { AstrolabeChart } from '@/components/AstrolabeChart';
import { AiChatPanel } from '@/components/AiChatPanel';
import { useAiSettings } from '@/hooks/useAiSettings';
import { buildAiRequestConfig } from '@/lib/ai/settings';

interface DivinationResultProps {
  isSubmitting: boolean;
  session: DivinationSession | null;
  summary: DivinationSummaryBlocks | null;
  methodLabelMap: Record<DivinationDraft['method'], string>;
  copyState: string;
  shareState: string;
  showShareButton: boolean;
  onCopy: () => void;
  onShare: () => void;
}

const LIUREN_BRANCH_POSITIONS: Record<string, { row: number; column: number }> = {
  巳: { row: 1, column: 1 },
  午: { row: 1, column: 2 },
  未: { row: 1, column: 3 },
  申: { row: 1, column: 4 },
  酉: { row: 2, column: 4 },
  戌: { row: 3, column: 4 },
  亥: { row: 4, column: 4 },
  子: { row: 4, column: 3 },
  丑: { row: 4, column: 2 },
  寅: { row: 4, column: 1 },
  卯: { row: 3, column: 1 },
  辰: { row: 2, column: 1 },
};

const LIUREN_BRANCH_ORDER = Object.keys(LIUREN_BRANCH_POSITIONS);

function findLiurenTransmissionStage(
  transmissions: LiurenTransmission[],
  branch: string,
): LiurenTransmission['stage'] | null {
  return transmissions.find((item) => item.branch === branch)?.stage || null;
}

function XiaoliurenStageCard(props: { label: string; detail: XiaoliurenPalaceDetail }) {
  const { label, detail } = props;

  return (
    <article className="xiaoliuren-stage-card">
      <div className="xiaoliuren-stage-head">
        <span>{label}</span>
        <strong>{detail.name}</strong>
      </div>
      <p>{detail.meaning}</p>
      <div className="xiaoliuren-keyword-row">
        {detail.keywords.map((keyword) => (
          <span className="result-soft-tag" key={`${detail.name}-${keyword}`}>
            {keyword}
          </span>
        ))}
      </div>
      <small>建议：{detail.advice}</small>
    </article>
  );
}

function XiaoliurenBoard({ data }: { data: XiaoliurenData }) {
  return (
    <div className="divination-extra-panel xiaoliuren-board">
      <div className="divination-extra-head">
        <strong>小六壬三段推演</strong>
        <span>
          {data.methodLabel} · {data.hourLabel}
        </span>
      </div>

      <div className="xiaoliuren-card-grid">
        <XiaoliurenStageCard label="起因" detail={data.sequence.start} />
        <XiaoliurenStageCard label="过程" detail={data.sequence.process} />
        <XiaoliurenStageCard label="结果" detail={data.sequence.result} />
      </div>

      <div className="xiaoliuren-overview-grid">
        <div className="xiaoliuren-overview-item">
          <span>主判断</span>
          <strong>{data.primary.name}</strong>
          <p>{data.primary.tendency}</p>
        </div>
        <div className="xiaoliuren-overview-item">
          <span>问事提醒</span>
          <strong>{data.questionHint}</strong>
          <p>适合把这个判断继续交给 AI 展开细拆。</p>
        </div>
      </div>
    </div>
  );
}

function LiurenPlateCell({ data, item }: { data: LiurenData; item: LiurenPlateItem }) {
  const position = LIUREN_BRANCH_POSITIONS[item.under];
  const transmissionStage = findLiurenTransmissionStage(data.threeTransmissions, item.branch);
  const className = [
    'liuren-script-cell',
    item.under === data.divinationBranch ? 'is-hour' : '',
    item.branch === data.monthLeader ? 'is-month-leader' : '',
    item.branch === data.noblemanBranch ? 'is-nobleman' : '',
    data.xunKong?.includes(item.under) ? 'is-empty' : '',
    transmissionStage ? 'is-transmission' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={position ? { gridColumn: position.column, gridRow: position.row } : undefined}
    >
      <span>{item.god}</span>
      <strong>{item.branch}</strong>
      {transmissionStage ? <em>{transmissionStage.replace('传', '')}</em> : null}
    </div>
  );
}

function LiurenPlateGrid({ data }: { data: LiurenData }) {
  const plateMap = new Map(data.heavenlyPlate.map((item) => [item.under, item]));
  const orderedPlate = LIUREN_BRANCH_ORDER.map((branch) => plateMap.get(branch)).filter(
    (item): item is LiurenPlateItem => Boolean(item),
  );

  return (
    <div className="liuren-script-plate">
      {orderedPlate.map((item) => (
        <LiurenPlateCell data={data} item={item} key={item.under} />
      ))}
      <div className="liuren-script-center">
        <span>天地盘</span>
        <strong>
          {data.ganzhi.day}日 {data.ganzhi.hour}时
        </strong>
        <p>
          月将{data.monthLeader}加{data.divinationBranch} · {data.dayNight || '时段未知'}
        </p>
        <p>
          {data.noblemanBranch ? `贵人${data.noblemanBranch}` : '贵人未标注'}
          {data.noblemanGroundBranch ? `临${data.noblemanGroundBranch}` : ''}
          {' · '}
          {data.xunKong?.length ? `旬空${data.xunKong.join('、')}` : '旬空未知'}
        </p>
      </div>
    </div>
  );
}

function LiurenCompactMatrix({ data }: { data: LiurenData }) {
  return (
    <div className="liuren-compact-matrix">
      <section>
        <span className="liuren-matrix-title">四课</span>
        <div className="liuren-matrix-columns">
          {data.fourLessons.map((lesson) => (
            <div className="liuren-matrix-column" key={lesson.name}>
              <span>{lesson.god}</span>
              <strong>{lesson.upper}</strong>
              <b>{lesson.lower}</b>
              <small>{lesson.name}</small>
            </div>
          ))}
        </div>
      </section>

      <section>
        <span className="liuren-matrix-title">三传</span>
        <div className="liuren-matrix-columns">
          {data.threeTransmissions.map((item) => (
            <div className="liuren-matrix-column" key={item.stage}>
              <span>{item.god}</span>
              <strong>{item.branch}</strong>
              <small>{item.stage}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LiurenBoard({ data }: { data: LiurenData }) {
  const transmissionText = data.threeTransmissions
    .map((item) => `${item.stage.replace('传', '')}${item.branch}`)
    .join(' → ');

  return (
    <div className="divination-extra-panel liuren-board">
      <div className="divination-extra-head">
        <strong>大六壬参考盘</strong>
        <span>
          {data.ganzhi.day}日 · {data.ganzhi.hour}时
        </span>
      </div>

      <div className="liuren-reference-strip">
        <span>
          月将{data.monthLeader}加{data.divinationBranch}
        </span>
        <span>三传：{transmissionText || '未生成'}</span>
        <span>
          {data.transmissionRule || '取传未标注'}
          {data.xunKong?.length ? ` · 空${data.xunKong.join('、')}` : ''}
        </span>
      </div>

      <div className="liuren-script-panel">
        <LiurenPlateGrid data={data} />
        <LiurenCompactMatrix data={data} />
      </div>
    </div>
  );
}

export function DivinationResult({
  isSubmitting,
  session,
  summary,
  methodLabelMap,
  copyState,
  shareState,
  showShareButton,
  onCopy,
  onShare,
}: DivinationResultProps) {
  const [aiSettings] = useAiSettings();
  const isAiEnabled = aiSettings.enabled;
  const aiRequestConfig = useMemo(() => buildAiRequestConfig(aiSettings), [aiSettings]);
  if (isSubmitting) {
    if (isAiEnabled) {
      return (
        <div className="divination-ai-card" aria-hidden="true">
          <section className="panel divination-result-panel">
            <div className="divination-result-skeleton">
              <span className="skeleton-block divination-result-skeleton-title" />
              <div className="divination-result-skeleton-list">
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    className="skeleton-block divination-result-skeleton-line"
                    key={`ai-line-${index}`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="workspace-grid divination-output-grid" aria-hidden="true">
        <section className="panel divination-result-panel">
          <div className="divination-result-skeleton">
            <span className="skeleton-block divination-result-skeleton-title" />
            <div className="divination-result-skeleton-tags">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-tag"
                  key={`tag-${index}`}
                />
              ))}
            </div>
            <div className="divination-result-skeleton-list">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-line"
                  key={`line-a-${index}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="panel divination-result-panel">
          <div className="divination-result-skeleton">
            <span className="skeleton-block divination-result-skeleton-title" />
            <div className="divination-result-skeleton-list">
              {Array.from({ length: 7 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-line"
                  key={`line-b-${index}`}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!session || !summary) {
    return null;
  }

  const isLiurenResult = session.method === 'liuren';

  // 占卜结果区块（复用于折叠展示和原有双栏）
  const resultBlock = (
    <section className="panel divination-result-panel">
      {!isLiurenResult ? (
        <div className="panel-head">
          <div>
            <h2>{summary.title}</h2>
            <p>这部分是本地算法生成的结构化结果，方便你判断本次提示词是否符合预期。</p>
          </div>
        </div>
      ) : null}

      {session.requestedMethod === 'random' ? (
        <div className="divination-random-note">本次随机到：{methodLabelMap[session.method]}</div>
      ) : null}

      {!isLiurenResult ? (
        <>
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
        </>
      ) : null}

      {session.method === 'astrolabe' ? (
        <AstrolabeChart data={session.data as AstrolabeData} />
      ) : null}

      {session.method === 'xiaoliuren' ? (
        <XiaoliurenBoard data={session.data as XiaoliurenData} />
      ) : null}

      {session.method === 'liuren' ? <LiurenBoard data={session.data as LiurenData} /> : null}
    </section>
  );

  if (isAiEnabled) {
    return (
      <div className="divination-ai-card">
        <details className="divination-result-collapse">
          <summary>排盘结果（点开查看卦象 / 星盘）</summary>
          {resultBlock}
        </details>
        <AiChatPanel
          contextPrompt={session.prompt}
          autoStart={session.prompt}
          autoStartKey={session.prompt}
          resetKey={session.prompt}
          aiConfig={aiRequestConfig}
        />
      </div>
    );
  }

  return (
    <div className="workspace-grid divination-output-grid">
      {resultBlock}

      <section className="panel panel-output divination-result-panel">
        <div className="panel-head divination-prompt-head">
          <div>
            <h2>占卜提示词</h2>
            <p>系统要求、结构化结果和你的问题都已经合并，复制整段即可使用。</p>
          </div>
          <div className="action-row compact-actions divination-prompt-actions">
            <button className="copy-button secondary-button" type="button" onClick={onCopy}>
              {copyState}
            </button>
            {showShareButton ? (
              <button className="copy-button" type="button" onClick={onShare}>
                {shareState}
              </button>
            ) : null}
          </div>
        </div>
        <div className="prompt-send-tip">点击复制后，发送到你常用的在线 AI 软件继续提问。</div>

        <pre className="result-pre">{session.prompt}</pre>
      </section>
    </div>
  );
}
