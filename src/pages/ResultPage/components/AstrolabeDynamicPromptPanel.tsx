import { useEffect, useRef, useState } from 'react';
import type {
  AstrolabeDynamicRangeBranch,
  AstrolabeDynamicRangeSummary,
} from 'mingyu-core/divination/astrolabe-dynamic-range';
import { usePromptCopyShare } from '@/hooks/usePromptCopyShare';
import {
  iterateAstrolabeDynamicPromptPages,
  type AstrolabeDynamicPromptOptions,
  type AstrolabeDynamicPromptPage,
} from '@/lib/astrolabe-dynamic-range-prompt';

type Props = {
  summary: AstrolabeDynamicRangeSummary;
  readBranch: (index: number) => Promise<AstrolabeDynamicRangeBranch>;
  options?: AstrolabeDynamicPromptOptions;
};

function PromptPages({ summary, readBranch, options }: Props) {
  const active = useRef<{
    controller: AbortController;
    iterator: AsyncGenerator<AstrolabeDynamicPromptPage>;
    busy: boolean;
  } | null>(null);
  const [page, setPage] = useState<AstrolabeDynamicPromptPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const { copyState, shareState, handleCopy, handleShare } = usePromptCopyShare(page?.text ?? '');
  const last = Boolean(page?.lastPageOfBranch && page.branchIndex + 1 === summary.branchCount);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = active.current;
      current?.controller.abort();
      void current?.iterator.return(undefined).catch(() => {});
    };
  }, []);

  async function next(restart = false) {
    if (active.current?.busy) return;
    if (restart) {
      active.current?.controller.abort();
      await active.current?.iterator.return(undefined);
      if (!mounted.current) return;
      active.current = null;
      setPage(null);
    }
    if (!active.current) {
      const controller = new AbortController();
      active.current = {
        controller,
        iterator: iterateAstrolabeDynamicPromptPages(summary, readBranch, {
          ...options,
          maxCharacters: 6000,
          signal: controller.signal,
        }),
        busy: false,
      };
    }
    const current = active.current;
    current.busy = true;
    setLoading(true);
    setError('');
    try {
      const result = await current.iterator.next();
      if (!current.controller.signal.aborted && !result.done) setPage(result.value);
    } catch (reason) {
      if (!current.controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : '读取解读资料失败。');
    } finally {
      current.busy = false;
      if (!current.controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <section className="result-side-card astrolabe-dynamic-range-panel" aria-label="分批解读资料">
      <h3>分批解读资料</h3>
      <p>
        每页最多 6000
        字符。逐页复制到同一解读对话，各页包含适用的出生时段；完成全部资料后再归纳共通结论。
      </p>
      <div className="result-chip-row">
        <button
          className="result-chip"
          type="button"
          disabled={loading || last || Boolean(error)}
          onClick={() => void next()}
        >
          {loading ? '正在读取资料' : page ? '下一页资料' : '准备第一页资料'}
        </button>
        {page ? (
          <>
            <button
              className="result-chip"
              type="button"
              disabled={loading}
              onClick={() => void handleCopy()}
            >
              {copyState === '复制提问内容' ? '复制本页资料' : copyState}
            </button>
            <button
              className="result-chip"
              type="button"
              disabled={loading}
              onClick={() => void handleShare()}
            >
              {shareState === '分享提问内容' ? '分享本页资料' : shareState}
            </button>
          </>
        ) : null}
        {page || error ? (
          <button
            className="result-chip"
            type="button"
            disabled={loading}
            onClick={() => void next(true)}
          >
            从第一页重新开始
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
      {page ? (
        <>
          <p role="status">
            第 {page.branchIndex + 1} / {summary.branchCount} 段，资料第 {page.pageIndex + 1}{' '}
            页，本页 {page.factCount} 项事实，{page.text.length} 字符。
            {last
              ? '已到全部资料的最后一页。'
              : page.lastPageOfBranch
                ? '本段资料已到末页，下一页进入下一段。'
                : '本段还有后续资料。'}
          </p>
          <textarea
            className="workspace-ui-control"
            aria-label="本页解读资料"
            value={page.text}
            readOnly
            rows={12}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </>
      ) : null}
    </section>
  );
}

export function AstrolabeDynamicPromptPanel(props: Props) {
  return <PromptPages key={JSON.stringify([props.summary, props.options])} {...props} />;
}
