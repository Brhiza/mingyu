/**
 * @file 奇门终身局自包含提示词生成器
 * @description 遵循 AGENTS.md 规范，生成供在线 AI 解读的自包含完整任务书，
 * 严禁暴露内部工程术语、代码路径、字段键名或否定性限制。
 */

import type { QimenLifetimeData } from '../../../../types/divination';

/**
 * 构建终身局自包含提示词任务书
 */
export function buildLifetimePrompt(data: QimenLifetimeData, question?: string): string {
  const lines: string[] = [];
  const q = question?.trim() || '请全面推演我的人生宏观格局、核心阶段运限与关键转折窗口。';
  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. 【当前时间】
  lines.push(`【当前时间】`);
  lines.push(`${nowStr}（${data.basis.timeZoneUsed}）\n`);

  // 2. 【传统依据】
  lines.push(`【传统依据】`);
  const baseTradition = [
    `《奇门遁甲统宗》卷首：“推人年命，以局内年干为主。以正时推占，则以局内天上时干为主。查看各宫，凡奇仪之生我干者为父母，我干所生之奇仪为子息，与我干相比肩之奇仪为兄弟，奇仪之克我干者为官、为疾厄，我干所克之奇仪为妻妾、财禄、为奴仆。”`,
    `《奇门遁甲统宗》：“八将之中最喜值符贵神……太阴吉神加之皆吉，六合百事和谐，玄武疾厄少病、财帛聚财，九地幽暗利财帛，九天官禄显达。”`,
    `《遁甲演义》卷四：“夫用遁之法，不推本命行年，未见精妙，必人生年命乘本局吉星奇门生旺之方，始得神将护持。”`,
    `《奇门遁甲元灵经》：“以本人年命与日干落宫，星旺门吉有三奇吉格者，自招吉祥；若本命日干犯击刑门迫，必多挫折磨练。”`,
  ];

  const schoolNotes: Record<string, string> = {
    baojian: '《御定奇门宝鉴》：“奇门吉凶以生克为本，星门相合，吉凶乃应；年命所乘，尤关通变。”',
    tongzong: '《奇门遁甲统宗》：“推人年命，以局内年干为主；符使所指，大运周流。”',
    mingfa: '《奇门鸣法》：“凡测终身，以年命为根柢，日干为自身，时干为落脚；九宫动静，神煞相兼。”',
    yubo: '《烟波钓叟歌》：“急则从神缓从门，到处便为吉庆方；天马奔驰逢六合，阴阳顺逆理幽微。”',
  };

  if (data.input.schools && data.input.schools.length > 0) {
    for (const sc of data.input.schools) {
      if (schoolNotes[sc] && !baseTradition.includes(schoolNotes[sc])) {
        baseTradition.push(schoolNotes[sc]);
      }
    }
  }

  lines.push(`${baseTradition.join('\n')}\n`);

  // 3. 【起盘依据】
  lines.push(`【起盘依据】`);
  lines.push(`出生时刻：${data.input.birthDateTime}`);
  lines.push(`历法口径：${data.basis.calendar}`);
  lines.push(
    `时间标准：${data.basis.timeStandard}${data.basis.trueSolarOffsetSeconds !== undefined ? `（经度时差与均时差校正 ${data.basis.trueSolarOffsetSeconds} 秒）` : ''}`,
  );
  lines.push(`当令节气：${data.basis.solarTerm}`);
  lines.push(
    `排盘方法：${data.basis.method === 'zhuanpan' ? '转盘法（天禽寄坤二宫）' : '飞盘法（九星顺逆飞布）'}`,
  );
  lines.push(`定局法则：${data.basis.juMethod === 'chaibu' ? '拆补法' : '置闰法'}`);
  lines.push(
    `阶段模型：${data.basis.stagePolicy.model === 'pillarFourLimits' ? '传统四柱分限法（年柱初限、月柱中前限、日柱中后限、时柱末限）' : data.basis.stagePolicy.model === 'palaceWalk' ? '洛书九宫巡行法' : '符使卦轨大运法'}`,
  );
  if (data.input.schools && data.input.schools.length > 0) {
    const schoolLabels: Record<string, string> = {
      baojian: '宝鉴派',
      tongzong: '统宗派',
      mingfa: '鸣法派',
      yubo: '钓叟歌理路',
    };
    lines.push(`参考流派：${data.input.schools.map((s) => schoolLabels[s] || s).join('、')}`);
  }
  lines.push('');

  // 4. 【终身局基础盘】
  lines.push(`【终身局基础盘】`);
  lines.push(
    `四柱干支：${data.baseChart.ganzhi.year}年 ${data.baseChart.ganzhi.month}月 ${data.baseChart.ganzhi.day}日 ${data.baseChart.ganzhi.hour}时`,
  );
  lines.push(`遁局属性：${data.baseChart.isYangDun ? '阳遁' : '阴遁'} ${data.baseChart.juShu} 局`);
  lines.push(`值符星：${data.baseChart.zhiFu} | 值使门：${data.baseChart.zhiShi}`);
  if (data.baseChart.voidBranches && data.baseChart.voidBranches.length > 0) {
    lines.push(`旬空地支：${data.baseChart.voidBranches.join('、')}`);
  }
  if (data.baseChart.horseStar) {
    lines.push(
      `驿马星：${data.baseChart.horseStar.branch}（在${data.baseChart.horseStar.name || `${data.baseChart.horseStar.palace}宫`}）`,
    );
  }

  lines.push(`九宫四盘明细：`);
  for (const p of data.baseChart.jiuGongGe) {
    const starText = p.tianPan.companionStar
      ? `${p.tianPan.star}（携${p.tianPan.companionStar}）`
      : p.tianPan.star;
    const stemText = p.tianPan.companionStem
      ? `${p.tianPan.stem}（携${p.tianPan.companionStem}）`
      : p.tianPan.stem;
    const isVoid = data.baseChart.voidPalaces?.some((vp) => vp.palace === p.gong);
    const hasHorse = data.baseChart.horseStar?.palace === p.gong;
    const flags: string[] = [];
    if (isVoid) flags.push('旬空');
    if (hasHorse) flags.push('临马');
    lines.push(
      `  ${p.name}（${p.element}）：天盘[${starText}，干${stemText}]，人盘[${p.renPan.door}]，神盘[${p.shenPan.god}]，地盘干[${p.diPan.stem}]${flags.length > 0 ? `【${flags.join('，')}】` : ''}`,
    );
  }

  if (data.baseChart.classicPatterns && data.baseChart.classicPatterns.length > 0) {
    lines.push(`盘面吉凶格局：`);
    for (const cp of data.baseChart.classicPatterns) {
      lines.push(
        `  ${cp.name}（${cp.type === 'good' ? '吉' : cp.type === 'bad' ? '凶' : '中性'}）：${cp.summary}`,
      );
    }
  }
  lines.push('');

  // 5. 【个人标记与主题宫】
  lines.push(`【个人标记与主题宫】`);
  lines.push(`核心个人标记：`);
  const layerMap: Record<string, string> = {
    tianPan: '天盘',
    diPan: '地盘',
    renPan: '人盘',
    shenPan: '神盘',
    baseGong: '本宫',
  };
  for (const m of data.personalMarkers) {
    const layerText = layerMap[m.layer] || m.layer;
    lines.push(`  ${m.traditionalSignificance}：值临${m.palaceName}（${layerText}）`);
  }

  lines.push(`人生重点主题候选宫：`);
  for (const t of data.topicCandidates) {
    const pNames = t.primaryPalaces
      .map((g) => data.baseChart.jiuGongGe.find((item) => item.gong === g)?.name || `${g}宫`)
      .join('、');
    lines.push(`  ${t.topicName}：主落${pNames}。依据：${t.basis}`);
    if (t.patternSummary.length > 0) {
      lines.push(`    宫位现状：${t.patternSummary.join('；')}`);
    }
  }
  lines.push('');

  // 6. 【人生阶段资料】
  lines.push(`【人生阶段资料】`);
  for (const st of data.stages) {
    const domNames = st.dominantPalaces.map((d) => d.name).join('、');
    lines.push(
      `阶段${st.stageIndex + 1}：${st.title}（${st.ageStart} - ${st.ageEnd} 岁 / ${st.calendarStart} ~ ${st.calendarEnd}）`,
    );
    lines.push(`  主导宫位：${domNames}`);
    lines.push(`  阶段核心主线：${st.stageTheme}`);
    if (st.supportFacts.length > 0) {
      lines.push(`  支持吉象：${st.supportFacts.join('；')}`);
    }
    if (st.constraintFacts.length > 0) {
      lines.push(`  考验反证：${st.constraintFacts.join('；')}`);
    }
  }
  lines.push('');

  // 7. 【周期触发与事件簇】
  if (data.eventClusters && data.eventClusters.length > 0) {
    lines.push(`【周期触发与事件簇】`);
    for (const ec of data.eventClusters) {
      lines.push(`${ec.timeSpan} ${ec.triggerFact}（节奏：${ec.rhythm}）`);
      lines.push(`  动态交互：${ec.interactionAnalysis}`);
      if (ec.supportEvidence.length > 0) {
        lines.push(`  增益因素：${ec.supportEvidence.join('；')}`);
      }
      if (ec.counterEvidence.length > 0) {
        lines.push(`  制约因素：${ec.counterEvidence.join('；')}`);
      }
      if (ec.verificationQuestions.length > 0) {
        lines.push(`  核验要点：${ec.verificationQuestions.join(' ')}`);
      }
    }
    lines.push('');
  }

  // 8. 【任务】
  lines.push(`【任务】`);
  lines.push(
    `请依据奇门遁甲本命局、个人标记、阶段运限与事件动态推演终身格局与大限走向。先综述先天格局底色，再按人生阶段依次展开运限分析，最后结合流年触发窗口回答【问题】。`,
  );
  lines.push('');

  // 9. 【输出要求】
  lines.push(`【输出要求】`);
  lines.push(`先总论原局基调、日干落宫、值符值使落宫与大格局；`);
  lines.push(`依次分析各人生阶段的主导宫位、吉凶取向与发展脉络；`);
  lines.push(`结合事件簇中重大机遇与转折的流年触发窗口，给出阶段性分析；`);
  lines.push(`紧扣用户提问，基于奇门象意推导，语言严谨专业。`);
  lines.push('');

  // 10. 【问题】
  lines.push(`【问题】`);
  lines.push(`${q}`);

  return lines.join('\n');
}
