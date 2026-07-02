export function analyzeShenShaWithTenGod(shenShaList: string[], tenGod: string): string[] {
  const analysis: string[] = [];

  if (shenShaList.includes('驿马')) {
    if (tenGod === '偏财' || tenGod === '正财') {
      analysis.push('驿马逢财星，传统多视为资源流动、外出求财或交易机会增加。');
    }
    if (tenGod === '正官' || tenGod === '七杀') {
      analysis.push('驿马逢官杀，传统多视为职责压力、奔波执行或外部约束增强。');
    }
    if (tenGod === '食神' || tenGod === '伤官') {
      analysis.push('驿马逢食伤，传统多视为表达输出、创作项目或走动频率增加。');
    }
    if (tenGod === '正印' || tenGod === '偏印') {
      analysis.push('驿马逢印星，传统多视为求学进修、环境转换或学习迁动增加。');
    }
  }

  if (shenShaList.includes('桃花')) {
    if (tenGod === '七杀') {
      analysis.push('桃花逢七杀，传统多视为情感吸引与压力并见，需留意边界和关系复杂度。');
    }
    if (tenGod === '正官') {
      analysis.push('桃花逢正官，传统多视为关系正式化、名声互动或伴侣议题被放大。');
    }
    if (tenGod === '比肩' || tenGod === '劫财') {
      analysis.push('桃花逢比劫，传统多视为社交竞争、人情开销或边界拉扯增多。');
    }
    if (tenGod === '正财' || tenGod === '偏财') {
      analysis.push('桃花逢财星，传统多视为人缘、合作往来或商业资源更易被带动。');
    }
  }

  if (shenShaList.includes('羊刃')) {
    if (tenGod === '七杀') {
      analysis.push('羊刃逢七杀，传统多视为执行力、压强与果断性增强，需结合制化判断。');
    }
    if (tenGod === '正官') {
      analysis.push('羊刃逢正官，传统多视为责任、规则与掌控议题增强，需结合制化判断。');
    }
    if (tenGod === '伤官') {
      analysis.push('羊刃逢伤官，传统多视为表达锋芒较强，也要留意冲动与摩擦。');
    }
  }

  if (shenShaList.includes('天乙贵人')) {
    if (tenGod === '食神') {
      analysis.push('天乙贵人逢食神，传统多视为表达、人缘与助力较易接上。');
    }
    if (tenGod === '正官') {
      analysis.push('天乙贵人逢正官，传统多视为规则体系、职位机会或贵人提携较易被看见。');
    }
  }

  return analysis;
}
