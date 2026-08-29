import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { WorkspaceButton, WorkspaceDialog } from '@/components/workspace/WorkspaceUI';
import {
  lookupMetaphysicsTerm,
  type MetaphysicsTerm,
  type TermContextData,
} from '@/lib/metaphysics-terms';

export type { TermContextData };

export interface MetaphysicsTermWithContext extends MetaphysicsTerm {
  context?: TermContextData;
}

export interface TermExplanationContextValue {
  openTerm: (term: string, context?: TermContextData) => void;
}

export const TermExplanationContext = createContext<TermExplanationContextValue>({
  openTerm: () => {},
});

export function useMetaphysicsTermModal() {
  return useContext(TermExplanationContext);
}

export interface TermExplanationModalProps {
  termInfo: MetaphysicsTermWithContext;
  onClose: () => void;
}

export function TermExplanationModal({ termInfo, onClose }: TermExplanationModalProps) {
  return (
    <WorkspaceDialog
      className="term-explanation-dialog"
      labelledBy="term-explanation-title"
      onClose={onClose}
    >
      <header className="workspace-ui-dialog-header term-explanation-header">
        <div className="term-explanation-title-group">
          <div className="term-badge-row">
            <span className="term-category-badge">{termInfo.category}</span>
            {termInfo.pinyin ? <span className="term-pinyin">{termInfo.pinyin}</span> : null}
          </div>
          <h2 id="term-explanation-title" className="term-name">
            {termInfo.term}
          </h2>
        </div>
        <button
          type="button"
          className="term-explanation-close-btn"
          onClick={onClose}
          aria-label="关闭释义"
        >
          ✕
        </button>
      </header>

      <div className="workspace-ui-dialog-body term-explanation-body">
        {/* 本盘专属角色定位（实盘动态推导） */}
        {termInfo.context?.roleInChart ? (
          <div className={`term-chart-context-box is-${termInfo.context.dynamicTone || 'neutral'}`}>
            <div className="term-chart-context-head">
              <span className="term-chart-context-badge">
                本盘专属角色定位（{termInfo.context.chartTitle || '当前实盘'}）
              </span>
              {termInfo.context.pillarOrPalace ? (
                <span className="term-chart-context-pillar">{termInfo.context.pillarOrPalace}</span>
              ) : null}
            </div>
            <p className="term-chart-context-text">{termInfo.context.roleInChart}</p>
            {termInfo.context.relationshipSummary ? (
              <div className="term-chart-context-rel">
                <span>盘中推演依据：</span>
                <strong>{termInfo.context.relationshipSummary}</strong>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 核心一句话提要 */}
        <div className="term-summary-box">
          <span className="term-summary-label">核心要义</span>
          <p className="term-summary-text">{termInfo.summary}</p>
        </div>

        {/* 辩证两面性：吉顺契机 vs 风险盲点 */}
        {termInfo.positive || termInfo.negative ? (
          <div className="term-dialectic-grid">
            {termInfo.positive ? (
              <div className="term-dialectic-card is-positive">
                <div className="term-dialectic-head">
                  <span className="term-dialectic-badge is-positive">吉顺契机 / 优势赋能</span>
                </div>
                <p className="term-dialectic-text">{termInfo.positive}</p>
              </div>
            ) : null}
            {termInfo.negative ? (
              <div className="term-dialectic-card is-negative">
                <div className="term-dialectic-head">
                  <span className="term-dialectic-badge is-negative">风险警示 / 转化盲点</span>
                </div>
                <p className="term-dialectic-text">{termInfo.negative}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 辩证运用与处事指引 */}
        {termInfo.advice ? (
          <div className="term-advice-box">
            <span className="term-advice-label">辩证运用与处事指引</span>
            <p className="term-advice-text">{termInfo.advice}</p>
          </div>
        ) : null}

        {/* 详细推演与实战断法 */}
        <div className="term-detail-section">
          <h3 className="term-section-title">排盘推演与实战断法</h3>
          <p className="term-detail-text">{termInfo.detail}</p>
        </div>

        {/* 古典依据 */}
        {termInfo.classicRef ? (
          <div className="term-classic-section">
            <h3 className="term-section-title">典籍原典出处</h3>
            <blockquote className="term-classic-quote">{termInfo.classicRef}</blockquote>
          </div>
        ) : null}

        {/* 关联概念标签 */}
        {termInfo.tags && termInfo.tags.length > 0 ? (
          <div className="term-tags-row">
            <span className="term-tags-label">关联概念：</span>
            {termInfo.tags.map((tag) => (
              <span key={tag} className="term-tag-chip">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="workspace-ui-dialog-footer term-explanation-footer">
        <WorkspaceButton variant="primary" size="medium" onClick={onClose}>
          我知道了
        </WorkspaceButton>
      </footer>
    </WorkspaceDialog>
  );
}

export function TermExplanationProvider({ children }: { children: ReactNode }) {
  const [activeTerm, setActiveTerm] = useState<MetaphysicsTermWithContext | null>(null);

  const openTerm = useCallback((term: string, context?: TermContextData) => {
    if (!term || typeof term !== 'string') return;
    const cleanTerm = term.replace(/[[\]【】()（）:：\s]/g, '').trim();
    if (!cleanTerm) return;

    const found = lookupMetaphysicsTerm(cleanTerm);
    if (found) {
      setActiveTerm({ ...found, context });
    } else {
      // Dynamic intelligent fallback
      const category: MetaphysicsTerm['category'] =
        /[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/.test(cleanTerm)
          ? '八字'
          : /[星曜宫限禄权科忌]/.test(cleanTerm)
            ? '紫微'
            : /[休死伤杜惊生开景门]/.test(cleanTerm)
              ? '奇门'
              : /[卦爻世应伏飞]/.test(cleanTerm)
                ? '六爻'
                : /[将神传课]/.test(cleanTerm)
                  ? '六壬'
                  : '通论';

      setActiveTerm({
        term: cleanTerm,
        category,
        summary: `${cleanTerm}：传统术数中的推演要素。`,
        positive: `生扶得力时，主气机生发、顺应得势。`,
        negative: `逢刑冲克泄时，需防阻滞波折或消耗。`,
        advice: `权衡全局生克与旺衰制化，因势利导。`,
        detail: `【${cleanTerm}】在盘局中代表特定的时空气数与生克关系，需结合所在宫位与旺衰综合推断。`,
        tags: [cleanTerm, `${category}术语`],
        context,
      });
    }
  }, []);

  return (
    <TermExplanationContext.Provider value={{ openTerm }}>
      {children}
      {activeTerm ? (
        <TermExplanationModal termInfo={activeTerm} onClose={() => setActiveTerm(null)} />
      ) : null}
    </TermExplanationContext.Provider>
  );
}
