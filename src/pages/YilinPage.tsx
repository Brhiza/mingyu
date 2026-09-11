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
  { value: 'both', label: '两本对读' },
  { value: 'wikisource', label: '四库全书本（维基文库）' },
  { value: 'kanripo', label: '文渊阁本（汉籍库）' },
];

function formatSourceLabel(source: YilinQueryResult['sources']['wikisource']) {
  return `卷${source.volume}${source.page ? ` · ${source.page}` : ''} · 转录第${source.line}行`;
}

function SourceCard({
  title,
  source,
  target,
  href,
}: {
  title: string;
  source: YilinQueryResult['sources']['wikisource'];
  target: string;
  href: string;
}) {
  return (
    <article className="yilin-source-card">
      <header>
        <h3>{title}</h3>
        <span>{formatSourceLabel(source)}</span>
        <a href={href} target="_blank" rel="noreferrer">
          查看底本
        </a>
      </header>
      {source.observedLabel !== target ? (
        <dl>
          <div>
            <dt>原标卦名</dt>
            <dd>{source.rawLabel}</dd>
          </div>
          <div>
            <dt>对应卦名</dt>
            <dd>{target}</dd>
          </div>
        </dl>
      ) : null}
      <p className="yilin-source-text">{source.text}</p>
    </article>
  );
}

export function YilinPage() {
  const [baseHexagram, setBaseHexagram] = useState('乾');
  const [targetHexagram, setTargetHexagram] = useState('乾');
  const [source, setSource] = useState<YilinSourcePreference>('both');
  const [result, setResult] = useState<YilinQueryResult | null>(null);
  const [resultSource, setResultSource] = useState<YilinSourcePreference>('both');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      setResult(queryYilinEntry(baseHexagram, targetHexagram, source));
      setResultSource(source);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : '焦氏易林索引查询失败。');
    }
  }

  return (
    <WorkspacePage title="焦氏易林" width="wide" className="yilin-page">
      <p className="yilin-intro">选择本卦与之卦，查阅林辞或对照两份底本文字。</p>

      <div className="yilin-workspace">
        <form className="yilin-query-panel workspace-ui-surface" onSubmit={handleSubmit}>
          <div className="yilin-section-heading">
            <div>
              <h2>选择卦对</h2>
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
        </form>

        <WorkspaceSurface className="yilin-result-panel">
          <div className="yilin-section-heading">
            <div>
              <h2>查询结果</h2>
              {result ? <p>{result.key}</p> : null}
            </div>
          </div>
          {error ? (
            <div className="yilin-error" role="alert">
              {error}
            </div>
          ) : null}
          {result ? (
            <YilinResult result={result} source={resultSource} />
          ) : (
            <div className="yilin-empty">选择卦对后查询林辞。</div>
          )}
        </WorkspaceSurface>
      </div>
    </WorkspacePage>
  );
}

function YilinResult({
  result,
  source,
}: {
  result: YilinQueryResult;
  source: YilinSourcePreference;
}) {
  return (
    <div className="yilin-result">
      <div className="yilin-result-meta">
        <span>{result.dataStatus}</span>
      </div>
      <div className="yilin-source-grid">
        {source !== 'kanripo' ? (
          <SourceCard
            title="四库全书本（维基文库）"
            source={result.sources.wikisource}
            target={result.target}
            href={`https://zh.wikisource.org/w/index.php?oldid=${result.edition.sourceProvenance.wikisource.revisionIds[result.sources.wikisource.source]}`}
          />
        ) : null}
        {source !== 'wikisource' ? (
          <SourceCard
            title="文渊阁本（汉籍库）"
            source={result.sources.kanripo}
            target={result.target}
            href={`https://www.kanripo.org/ed/KR3g0029/WYG/${String(result.sources.kanripo.volume).padStart(3, '0')}`}
          />
        ) : null}
      </div>
      {result.gaps.length ? (
        <section className="yilin-gap-list">
          <h3>字形与卦名</h3>
          {result.gaps.map((gap, index) => (
            <p key={`${gap.kind}-${gap.key}-${index}`}>
              {gap.kind === 'label-order' ? '原标卦名与所在卦序有异' : '底本含待辨字形'}
              {gap.observedRaw ? `：原标“${gap.observedRaw}”` : ''}
              {gap.wikisourceSKchars?.length
                ? `；字形标记 ${gap.wikisourceSKchars.join('、')}`
                : ''}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
