import type { MingluArticle } from 'mingyu-core/minglu';

export function formatMingluPatternCopy(article: MingluArticle): string {
  const { pattern, usefulGods } = article.patternUsefulGodSection;
  const transformation = pattern.transformation;
  let md = `\n## 三、格局成败与用神\n`;
  md += `- 主格：${pattern.name}\n`;
  if (transformation) {
    md += `- 化气判定：${transformation.status}；化神${transformation.element}\n`;
    md += `- 化气依据：${transformation.basis}\n`;
    transformation.evidence.forEach((item) => {
      md += `- 化气证据：${item}\n`;
    });
    transformation.conditions.forEach((item) => {
      md += `- 化气条件：${item}\n`;
    });
    if (transformation.status === '成化') {
      md += `- 取用主体：化神${transformation.element}；原日主旺衰与十神作为本命事实，取用按化神及其条件核验。\n`;
    }
  }
  md +=
    transformation?.status === '成化'
      ? `- 原日主十神映射：${usefulGods.primaryUseful}（本命事实）\n`
      : `- 核心用神：${usefulGods.primaryUseful}\n`;
  md += `- 核心忌神：${usefulGods.primaryAvoid}\n`;
  return md;
}
