import React, { useState } from 'react';
import type { MingluGlossaryEntry } from 'mingyu-core/minglu';

interface Props {
  entries: MingluGlossaryEntry[];
}

export const MingluGlossarySection: React.FC<Props> = ({ entries }) => {
  const [filterCategory, setFilterCategory] = useState<string>('全部');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const categories = [
    '全部',
    '干支',
    '十神',
    '五行',
    '格局',
    '神煞',
    '星曜',
    '宫位',
    '占星',
    '风水',
  ];

  const filteredEntries = entries.filter((e) => {
    const matchesCategory = filterCategory === '全部' || e.category === filterCategory;
    const matchesSearch =
      !searchTerm.trim() ||
      e.term.includes(searchTerm) ||
      e.shortDesc.includes(searchTerm) ||
      e.fullDesc.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  return (
    <section id="glossary-encyclopedia" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">13</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第十三章：命理全息术语百科词典</h2>
          <p className="minglu-section-subtitle">
            传统术数经典核心概念权威释义与考证（共收录 {entries.length} 个词条）
          </p>
        </div>
      </div>

      {/* 词典过滤栏 */}
      <div className="minglu-glossary-filter-bar">
        <div className="minglu-glossary-categories">
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              className={`minglu-category-btn ${filterCategory === c ? 'is-active' : ''}`}
              onClick={() => setFilterCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="minglu-glossary-search-input"
          placeholder="搜索词条名称或释义..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 词典卡片网格 */}
      <div className="minglu-card-grid minglu-card-grid-2">
        {filteredEntries.map((e) => (
          <div key={e.term} id={e.anchorId} className="minglu-card minglu-glossary-card">
            <div className="flex justify-between items-center mb-1">
              <div>
                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">{e.term}</h4>
                {e.pinyin && <span className="text-xs text-slate-400 font-mono">{e.pinyin}</span>}
              </div>
              <span className="minglu-pill is-primary">{e.category}</span>
            </div>

            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
              {e.shortDesc}
            </p>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              {e.fullDesc}
            </p>

            {e.classicSource && (
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/80 p-2 rounded mb-2">
                <span className="font-bold">典籍考证：</span>
                {e.classicSource}
              </div>
            )}

            {e.relatedTerms && e.relatedTerms.length > 0 && (
              <div className="text-xs text-slate-400">相关词条：{e.relatedTerms.join(' · ')}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
