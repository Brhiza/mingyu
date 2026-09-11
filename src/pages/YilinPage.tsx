import { useState, type FormEvent } from 'react';
import {
  WorkspaceButton,
  WorkspacePage,
  WorkspaceSurface,
} from '@/components/workspace/WorkspaceUI';
import {
  YILIN_HEXAGRAM_ORDER,
  queryYilinEntry,
  type YilinQueryResult,
  type YilinSourcePreference,
} from 'mingyu-core/classics';

const SOURCE_OPTIONS: Array<{ value: YilinSourcePreference; label: string }> = [
  { value: 'both', label: '双底本对读（默认）' },
  { value: 'wikisource', label: 'Wikisource 四库全书本' },
  { value: 'kanripo', label: 'Kanripo KR3g0029 WYG' },
];

function formatSourceLabel(source: YilinQueryResult['sources']['wikisource']) {
  return `${source.source} · 卷${source.volume} · 第${source.line}条`;
}

function SourceCard({
  title,
  source,
}: {
  title: string;
  source: YilinQueryResult['sources']['wikisource'];
}) {
  return (
    <article className="yilin-source-card">
      <header>
        <h3>{title}</h3>
        <span>{formatSourceLabel(source)}</span>
      </header>
      <dl>
        <div>
          <dt>原始标签</dt>
          <dd>{source.rawLabel}</dd>
        </div>
        <div>
          <dt>观察标签</dt>
          <dd>{source.observedLabel}</dd>
        </div>
        <div>
          <dt>文字状态</dt>
          <dd>{source.textNormalization === 'none' ? '原文' : '仅清理卷尾转录尾注'}</dd>
        </div>
      </dl>
      <p className="yilin-source-text">{source.text}</p>
    </article>
  );
}

export function YilinPage() {
  const [baseHexagram, setBaseHexagram] = useState('乾');
  const [targetHexagram, setTargetHexagram] = useState('乾');
  const [source, setSource] = useState<YilinSourcePreference>('both');
  const [result, setResult] = useState<YilinQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      setResult(queryYilinEntry(baseHexagram, targetHexagram, source));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : '焦氏易林索引查询失败。');
    }
  }

  return (
    <WorkspacePage title="焦氏易林" width="wide" className="yilin-page">
      <p className="yilin-intro">
        固定 W20.03 版本的 64×64
        卦对索引。输入本卦和之卦即可查看原文、两个底本的来源定位，以及已核出的字形或校勘状态。
      </p>

      <div className="yilin-workspace">
        <form className="yilin-query-panel workspace-ui-surface" onSubmit={handleSubmit}>
          <div className="yilin-section-heading">
            <span>01</span>
            <div>
              <h2>选择卦对</h2>
              <p>卦名按固定六十四卦序规范化，查询本身不承担起卦。</p>
            </div>
          </div>
          <label className="yilin-field">
            <span>本卦</span>
            <select value={baseHexagram} onChange={(event) => setBaseHexagram(event.target.value)}>
              {YILIN_HEXAGRAM_ORDER.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="yilin-field">
            <span>之卦</span>
            <select
              value={targetHexagram}
              onChange={(event) => setTargetHexagram(event.target.value)}
            >
              {YILIN_HEXAGRAM_ORDER.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="yilin-field">
            <span>文字底本</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as YilinSourcePreference)}
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <WorkspaceButton variant="primary" size="large" type="submit" block>
            查询易林条目
          </WorkspaceButton>
          <p className="yilin-edition-note">
            固定索引：{YILIN_HEXAGRAM_ORDER.length}×{YILIN_HEXAGRAM_ORDER.length} = 4096
            条；数据差异与缺字标记按底本原样报告。
          </p>
        </form>

        <WorkspaceSurface className="yilin-result-panel">
          <div className="yilin-section-heading">
            <span>02</span>
            <div>
              <h2>查询结果</h2>
              <p>{result ? result.key : '提交卦对后显示固定底本资料。'}</p>
            </div>
          </div>
          {error ? (
            <div className="yilin-error" role="alert">
              {error}
            </div>
          ) : null}
          {result ? <YilinResult result={result} /> : <div className="yilin-empty">尚未查询。</div>}
        </WorkspaceSurface>
      </div>
    </WorkspacePage>
  );
}

function YilinResult({ result }: { result: YilinQueryResult }) {
  return (
    <div className="yilin-result">
      <div className="yilin-result-meta">
        <span>{result.dataStatus}</span>
        <span>
          主显示：
          {result.selectedSource === 'wikisource'
            ? 'Wikisource 四库全书本'
            : 'Kanripo KR3g0029 WYG'}
        </span>
        {result.gaps.length ? (
          <span>已记录差异 {result.gaps.length} 项</span>
        ) : (
          <span>两个底本对读一致</span>
        )}
      </div>
      <div className="yilin-primary-text">
        <h3>主显示原文</h3>
        <p>{result.text}</p>
      </div>
      <div className="yilin-source-grid">
        <SourceCard title="Wikisource 四库全书本" source={result.sources.wikisource} />
        <SourceCard title="Kanripo KR3g0029 WYG" source={result.sources.kanripo} />
      </div>
      {result.gaps.length ? (
        <section className="yilin-gap-list">
          <h3>本条已记录的校勘状态</h3>
          {result.gaps.map((gap, index) => (
            <p key={`${gap.kind}-${gap.key}-${index}`}>
              {gap.kind}
              {gap.source ? `（${gap.source}${gap.line ? `，第${gap.line}条` : ''}）` : ''}
              {gap.observedRaw ? `：观察标签“${gap.observedRaw}”` : ''}
              {gap.wikisourceSKchars?.length
                ? `；字形标记 ${gap.wikisourceSKchars.join('、')}`
                : ''}
            </p>
          ))}
        </section>
      ) : null}
      <p className="yilin-source-footnote">
        版本统计：{result.edition.parsedPairCount}/{result.edition.expectedPairCount} 条；全库已记录{' '}
        {result.edition.gapSummary.total} 项字形或校勘状态。缺字和未确认字形不会被异版文字静默替换。
      </p>
    </div>
  );
}
