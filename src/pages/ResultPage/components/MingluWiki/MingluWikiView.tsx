import React, { useCallback, useEffect, useState } from 'react';
import type { MingluArticle } from 'mingyu-core/minglu';
import { MingluTableOfContents } from './MingluTableOfContents';
import { MingluPillarsSection } from './MingluPillarsSection';
import { MingluFiveElementsSection } from './MingluFiveElementsSection';
import { MingluPatternUsefulGodSection } from './MingluPatternUsefulGodSection';
import { MingluInteractionsSection } from './MingluInteractionsSection';
import { MingluShenShaSection } from './MingluShenShaSection';
import { MingluTenGodsSection } from './MingluTenGodsSection';
import { MingluLifeStagesSection } from './MingluLifeStagesSection';
import { MingluLuckChronicleSection } from './MingluLuckChronicleSection';
import { MingluZiweiSection } from './MingluZiweiSection';
import { MingluAstrolabeSection } from './MingluAstrolabeSection';
import { MingluFengshuiSection } from './MingluFengshuiSection';
import { MingluCrossSynthesisSection } from './MingluCrossSynthesisSection';
import { MingluGlossarySection } from './MingluGlossarySection';
import './minglu.css';

interface MingluWikiViewProps {
  article: MingluArticle;
}

export const MingluWikiView: React.FC<MingluWikiViewProps> = ({ article }) => {
  const [activeAnchorId, setActiveAnchorId] = useState<string>('bazi-pillars-matrix');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isMobileTocOpen, setIsMobileTocOpen] = useState<boolean>(false);

  // 滚动时监听当前章节
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveAnchorId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -70% 0px' },
    );

    const sectionElements = document.querySelectorAll(
      '.minglu-section, [id^="bazi-"], [id^="ziwei-"], [id^="astrolabe-"], [id^="fengshui-"]',
    );
    sectionElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const handleSelectAnchor = useCallback((anchorId: string) => {
    const elem = document.getElementById(anchorId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveAnchorId(anchorId);
      setIsMobileTocOpen(false);
      window.history.replaceState(null, '', `#${anchorId}`);
    }
  }, []);

  // 生成并复制 Markdown 大报告
  const handleCopyMarkdownReport = async () => {
    const meta = article.metadata;
    let md = `# 【命录全息档案】${meta.subjectName} · ${meta.genderLabel}\n\n`;
    md += `> 生辰：${meta.solarDateStr} ${meta.exactBirthTime || meta.shichenName} (${meta.lunarDateStr})\n`;
    md += `> 四柱八字：${meta.baziFourPillars.year}  ${meta.baziFourPillars.month}  ${meta.baziFourPillars.day}  ${meta.baziFourPillars.hour}\n`;
    md += `> 日元格局：${meta.dayMaster.gan}(${meta.dayMaster.wuxing}) · 【${article.patternUsefulGodSection.pattern.name}】 · 旺衰：${article.fiveElementsSection.dayMasterStrength.status}\n\n`;

    md += `## 一、四柱全息矩阵\n`;
    article.pillarsSection.columns.forEach((col) => {
      md += `- **${col.label}**：${col.gan}${col.zhi}（${col.ganTenGod} / ${col.zhiTenGod}，纳音${col.nayin}，自坐${col.ziZuo}，长生${col.lifeStage}）\n`;
    });
    md += `\n## 二、五行能量打分\n`;
    article.fiveElementsSection.elements.forEach((el) => {
      md += `- ${el.wuxing}行：${el.score}分 (${el.percentage}%) [${el.seasonStatus}]\n`;
    });
    md += `\n## 三、格局成败与用神\n`;
    md += `- 主格：${article.patternUsefulGodSection.pattern.name}\n`;
    md += `- 核心用神：${article.patternUsefulGodSection.usefulGods.primaryUseful}\n`;
    md += `- 核心忌神：${article.patternUsefulGodSection.usefulGods.primaryAvoid}\n`;

    md += `\n## 四、柱间作用关系\n`;
    article.interactionsSection.forEach((item) => {
      md += `- 【${item.category}】${item.name}：${item.description}\n`;
    });

    md += `\n## 五、全息神煞\n`;
    article.shenShaSection.forEach((s) => {
      md += `- ${s.name}（${s.type}神 · ${s.pillars.join('、')}）：${s.significance}\n`;
    });

    try {
      await navigator.clipboard.writeText(md);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="minglu-wiki-wrapper">
      {/* 命录顶部工具栏 */}
      <header className="minglu-wiki-toolbar">
        <div className="minglu-toolbar-left">
          <button
            type="button"
            className="minglu-mobile-toc-toggle"
            onClick={() => setIsMobileTocOpen(!isMobileTocOpen)}
            aria-label="打开目录"
          >
            目录 ({article.tableOfContents.length})
          </button>
          <div className="minglu-toolbar-title-wrap">
            <h1 className="minglu-toolbar-title">命录 · 百科全书大报告</h1>
            <span className="minglu-toolbar-subtitle">
              {article.metadata.subjectName} · {article.metadata.genderLabel} ·{' '}
              {article.metadata.baziFourPillars.year} {article.metadata.baziFourPillars.month}{' '}
              {article.metadata.baziFourPillars.day} {article.metadata.baziFourPillars.hour}
            </span>
          </div>
        </div>

        <div className="minglu-toolbar-actions">
          <button
            type="button"
            className="minglu-toolbar-btn is-copy"
            onClick={handleCopyMarkdownReport}
            title="复制完整 Markdown 报告文本"
          >
            {copySuccess ? '已复制完整报告' : '复制 Markdown 报告'}
          </button>
          <button
            type="button"
            className="minglu-toolbar-btn is-print"
            onClick={handlePrint}
            title="打印或导出 PDF 视图"
          >
            打印 / 导出 PDF
          </button>
        </div>
      </header>

      {/* 命录主体双栏布局 */}
      <div className="minglu-wiki-body">
        {/* 左侧目录 */}
        <aside className={`minglu-wiki-sidebar ${isMobileTocOpen ? 'is-mobile-open' : ''}`}>
          <MingluTableOfContents
            items={article.tableOfContents}
            activeAnchorId={activeAnchorId}
            onSelectAnchor={handleSelectAnchor}
          />
        </aside>

        {/* 右侧主文章 */}
        <main className="minglu-wiki-content">
          {/* 小白极速读懂指南 */}
          {article.beginnerGuide && (
            <section id="minglu-beginner-guide" className="minglu-section minglu-beginner-section">
              <div className="minglu-section-header">
                <span className="minglu-section-num">导读</span>
                <div className="minglu-section-title-wrap">
                  <h2 className="minglu-section-title">
                    小白入门导读 · 一分钟极速读懂你的命理全景
                  </h2>
                  <p className="minglu-section-subtitle">
                    跳过繁复术语，用自然万物比喻与大白话直观透视你的核心能量原型与人生四部曲
                  </p>
                </div>
              </div>

              {/* 核心意象大卡片 */}
              <div className="minglu-beginner-hero-card">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="minglu-pill is-primary font-bold">你的命格核心原型</span>
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    天人合一 · 自然意象
                  </span>
                </div>
                <h3 className="text-2xl font-black text-amber-900 dark:text-amber-200 mb-2">
                  {article.beginnerGuide.coreArchetype}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                  {article.beginnerGuide.natureAnalogy}
                </p>

                {/* 旺衰白话解 */}
                <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 rounded-lg p-3 text-xs text-slate-800 dark:text-slate-200 mb-4 leading-relaxed">
                  {article.beginnerGuide.strengthPlain}
                </div>

                {/* 核心天赋与人生指引 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1">
                      <span>你的核心天赋与职场发力点</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      {article.beginnerGuide.careerTalentsPlain.map((t, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white/80 dark:bg-slate-900/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1">
                      <span>生活习惯与调和建议</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      {article.beginnerGuide.favorableHabitsPlain.map((h, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 四柱人生四部曲（根苗花果） */}
              <div className="minglu-subblock mt-6">
                <h4 className="minglu-subblock-title">人生四部曲：四柱与“根苗花果”生命节律</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="minglu-card p-3.5 bg-gradient-to-br from-amber-50/50 to-emerald-50/50 dark:from-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                      第一幕 · 家族祖荫
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {article.beginnerGuide.fourPillarsMetaphor.year}
                    </div>
                  </div>
                  <div className="minglu-card p-3.5 bg-gradient-to-br from-amber-50/50 to-sky-50/50 dark:from-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-bold text-sky-800 dark:text-sky-300 mb-1">
                      第二幕 · 青年成长
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {article.beginnerGuide.fourPillarsMetaphor.month}
                    </div>
                  </div>
                  <div className="minglu-card p-3.5 bg-gradient-to-br from-amber-50/50 to-rose-50/50 dark:from-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-bold text-rose-800 dark:text-rose-300 mb-1">
                      第三幕 · 中年立业
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {article.beginnerGuide.fourPillarsMetaphor.day}
                    </div>
                  </div>
                  <div className="minglu-card p-3.5 bg-gradient-to-br from-amber-50/50 to-purple-50/50 dark:from-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-bold text-purple-800 dark:text-purple-300 mb-1">
                      第四幕 · 晚年丰硕
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {article.beginnerGuide.fourPillarsMetaphor.hour}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <MingluPillarsSection data={article.pillarsSection} metadata={article.metadata} />
          <MingluFiveElementsSection data={article.fiveElementsSection} />
          <MingluPatternUsefulGodSection data={article.patternUsefulGodSection} />
          <MingluInteractionsSection items={article.interactionsSection} />
          <MingluShenShaSection items={article.shenShaSection} />
          <MingluTenGodsSection data={article.tenGodsSection} />
          <MingluLifeStagesSection data={article.lifeStagesSection} />
          <MingluLuckChronicleSection data={article.luckChronicleSection} />

          {article.ziweiSection && <MingluZiweiSection data={article.ziweiSection} />}
          {article.astrolabeSection && <MingluAstrolabeSection data={article.astrolabeSection} />}
          {article.fengshuiSection && <MingluFengshuiSection data={article.fengshuiSection} />}
          {article.crossSynthesisSection && (
            <MingluCrossSynthesisSection themes={article.crossSynthesisSection} />
          )}

          <MingluGlossarySection entries={article.glossary} />
        </main>
      </div>
    </div>
  );
};
