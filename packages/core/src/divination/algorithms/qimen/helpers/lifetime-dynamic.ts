/**
 * @file 奇门终身局动态扫描与事件聚类模块
 * @description 根据用户请求的时间区间（periodRange），按年扫描流年太岁引动、
 * 空亡填实、马星引动与年家盘叠合，聚类生成结构化事件簇（Event Clusters）。
 */

import type {
  QimenData,
  QimenEventCluster,
  QimenLifetimeStage,
  QimenTopic,
} from '../../../../types/divination';
import { LunarUtil } from '../../../../calendar/lunar';
import { generateQimen } from '../index';
import { diPanPalaces } from './_constants';

const OPPOSITE_BRANCHES: Record<string, string> = {
  子: '午',
  丑: '未',
  寅: '申',
  卯: '酉',
  辰: '戌',
  巳: '亥',
  午: '子',
  未: '丑',
  申: '寅',
  酉: '卯',
  戌: '辰',
  亥: '巳',
};

/**
 * 扫描指定时间范围内的流年动态事件簇
 */
export function scanLifetimeDynamicEvents(
  baseChart: QimenData,
  stages: QimenLifetimeStage[],
  periodRange: { startDate: string; endDate: string },
  method: 'zhuanpan' | 'feipan' = 'zhuanpan',
  juMethod: 'chaibu' | 'zhirun' = 'chaibu',
): QimenEventCluster[] {
  const clusters: QimenEventCluster[] = [];

  const startYear = parseInt(periodRange.startDate.slice(0, 4), 10);
  const endYear = parseInt(periodRange.endDate.slice(0, 4), 10);

  if (isNaN(startYear) || isNaN(endYear) || endYear < startYear) {
    return clusters;
  }

  // 限制扫描范围最多 30 年，防止过度计算
  const maxEndYear = Math.min(endYear, startYear + 30);

  const getPalaceName = (p: number) =>
    baseChart.jiuGongGe.find((item) => item.gong === p)?.name || `${p}宫`;

  for (let y = startYear; y <= maxEndYear; y++) {
    const midYearDate = new Date(Date.UTC(y, 5, 15, 12, 0, 0));
    let flowYearGanZhi: string;
    try {
      const timeInfo = LunarUtil.getTimeInfo(midYearDate);
      flowYearGanZhi = timeInfo.ganzhi.year;
    } catch {
      continue;
    }

    const flowYearBranch = flowYearGanZhi[1];
    const taiSuiPalaceNum = diPanPalaces[flowYearBranch];
    if (!taiSuiPalaceNum) continue;

    const basePalace = baseChart.jiuGongGe.find((p) => p.gong === taiSuiPalaceNum);
    if (!basePalace) continue;

    // 匹配所属阶段卡
    const yStr = `${y}-06-15`;
    const matchedStage =
      stages.find((s) => s.calendarStart <= yStr && s.calendarEnd >= yStr) || stages[0];
    const stageIndex = matchedStage ? matchedStage.stageIndex : 0;

    const topics: QimenTopic[] = [];
    const supportEvidence: string[] = [];
    const counterEvidence: string[] = [];
    let rhythm: '快' | '中' | '慢' | '待机' = '中';
    const verificationQuestions: string[] = [];

    let triggerDescription = `${y}年（${flowYearGanZhi}太岁）值临${getPalaceName(taiSuiPalaceNum)}。`;

    // 1. 太岁入局引动本命宫位
    const baseDoor = basePalace.renPan.door;
    const baseGod = basePalace.shenPan.god;

    if (baseDoor === '生门') {
      topics.push('wealth');
      supportEvidence.push(`太岁落临生门财帛宫，生机旺相，利于资产沉淀与收益变现`);
      verificationQuestions.push('当年是否有重点投资落地、资产买卖或经营收益周转？');
    } else if (baseDoor === '开门') {
      topics.push('career');
      supportEvidence.push(`太岁引动开门事业之宫，主新局开展、职权扩张或平台转换`);
      verificationQuestions.push('当年是否有晋升变动、独立领衔项目或事业新起点？');
    } else if (baseDoor === '休门') {
      topics.push('family', 'marriage');
      supportEvidence.push(`太岁引动休门贵人家庭之宫，利于安顿调养、婚恋交好`);
      verificationQuestions.push('当年家庭人际、长辈关系或感情婚姻是否处于和缓推进阶段？');
    } else if (baseDoor === '死门') {
      topics.push('health');
      counterEvidence.push(`太岁引动死门滞塞之宫，防气机滞缓或精力透支`);
      verificationQuestions.push('当年是否出现长期劳累、慢性不适或重大阻滞需调整？');
    } else if (baseDoor === '伤门') {
      topics.push('relocation');
      counterEvidence.push(`太岁临伤门，主车马奔波与变动磨耗`);
      verificationQuestions.push('当年是否出差频繁、奔波操劳或遭遇琐碎争议？');
    } else if (baseDoor === '景门') {
      topics.push('academic', 'career');
      supportEvidence.push(`太岁引动景门文书声誉之宫，利于学术考察、资质认证与名气外显`);
      verificationQuestions.push('当年是否有进修考试、资质评审、文书签约或公开展示？');
    } else if (baseDoor === '杜门') {
      topics.push('career');
      counterEvidence.push(`太岁临杜门，主隐秘积蓄与潜沉防守，多有技术钻研或暂时等待`);
      verificationQuestions.push('当年是否处于闭关深耕、技术打磨或遇有事务暂缓？');
    } else if (baseDoor === '惊门') {
      topics.push('career');
      counterEvidence.push(`太岁临惊门，防口舌是非、法律咨询或突发谈判`);
      verificationQuestions.push('当年是否有关键商务谈判、合同交涉、是非申辩或法律咨询？');
    }

    if (verificationQuestions.length === 0) {
      verificationQuestions.push(
        `当年太岁入临${basePalace.name}，是否有重大生活节奏调整或关键环境变迁？`,
      );
    }

    if (baseGod === '六合') {
      if (!topics.includes('marriage')) topics.push('marriage');
      if (!topics.includes('partnership')) topics.push('partnership');
      supportEvidence.push('太岁同值六合，促成合作契约或婚盟机缘');
    }

    // 2. 虚实填实检查
    if (baseChart.voidBranches && baseChart.voidBranches.includes(flowYearBranch)) {
      triggerDescription += `本命空亡地支【${flowYearBranch}】逢流年填实，该宫潜藏势能全面激活。`;
      supportEvidence.push(`原局逢空之${basePalace.name}得太岁填实，虚转为实`);
      verificationQuestions.push('此前悬而未决、等待推进的事宜是否在当年取得实质进展？');
    }

    // 3. 驿马引动检查
    if (baseChart.horseStar) {
      if (baseChart.horseStar.branch === flowYearBranch) {
        triggerDescription += `流年并临本命驿马【${flowYearBranch}】。`;
        rhythm = '快';
        if (!topics.includes('relocation')) topics.push('relocation');
        supportEvidence.push(`流年同值驿马，主主动出行、跨区域拓展或生活节奏加速`);
        verificationQuestions.push('当年是否发生长途出行、居所搬迁或异地发展？');
      } else if (OPPOSITE_BRANCHES[baseChart.horseStar.branch] === flowYearBranch) {
        triggerDescription += `流年地支【${flowYearBranch}】对冲本命驿马【${baseChart.horseStar.branch}】。`;
        rhythm = '快';
        if (!topics.includes('relocation')) topics.push('relocation');
        supportEvidence.push(`驿马星逢岁支相冲（马星逢冲事必速），多突发性变动与快速推进`);
        verificationQuestions.push('当年是否有预期之外的快速差旅、职位调动或环境变迁？');
      }
    }

    // 4. 年家奇门局合参
    try {
      const yearQimen = generateQimen(midYearDate, method, 'year', juMethod);
      if (yearQimen.classicPatterns && yearQimen.classicPatterns.length > 0) {
        for (const yp of yearQimen.classicPatterns) {
          if (yp.palaces.includes(taiSuiPalaceNum)) {
            if (yp.type === 'good') {
              supportEvidence.push(`岁盘吉格「${yp.name}」叠合临宫：${yp.summary}`);
            } else if (yp.type === 'bad') {
              counterEvidence.push(`岁盘凶格「${yp.name}」叠合临宫：${yp.summary}`);
            }
          }
        }
      }
    } catch {
      // 容错忽略岁盘额外计算错误
    }

    // 若未命中任何特定主题，默认归为事业与大势
    if (topics.length === 0) {
      topics.push('career');
    }

    const key = `cluster:${y}:${flowYearGanZhi}:${taiSuiPalaceNum}`;

    clusters.push({
      key,
      stageIndex,
      timeSpan: `${y}年（${flowYearGanZhi}）`,
      topics,
      triggerFact: triggerDescription,
      interactionAnalysis: `流年岁气与本命${getPalaceName(taiSuiPalaceNum)}交织：门星神干产生交互响应。`,
      supportEvidence: Array.from(new Set(supportEvidence)),
      counterEvidence: Array.from(new Set(counterEvidence)),
      rhythm,
      verificationQuestions: Array.from(new Set(verificationQuestions)),
    });

    // 细化年月日关键节点扫描（针对短周期或重点转折年份扫描关键月日节令触发）
    if (maxEndYear - startYear <= 3) {
      // 提取该年与年支冲合的关键月（以月将与节令月支考察）
      const clashBranchMap: Record<string, string> = {
        子: '午',
        丑: '未',
        寅: '申',
        卯: '酉',
        辰: '戌',
        巳: '亥',
        午: '子',
        未: '丑',
        申: '寅',
        酉: '卯',
        戌: '辰',
        亥: '巳',
      };
      const clashBranch = clashBranchMap[flowYearBranch];
      const clashPalace = clashBranch ? diPanPalaces[clashBranch] : undefined;

      if (clashPalace) {
        clusters.push({
          key: `cluster:${y}:month-clash:${clashBranch}`,
          stageIndex,
          timeSpan: `${y}年${clashBranch}月建交气节点`,
          topics: ['career', 'relocation'],
          triggerFact: `${y}年流月逢${clashBranch}月建冲起${getPalaceName(clashPalace)}，形成月令冲合震荡。`,
          interactionAnalysis: `月令与岁气本命对冲，气机骤变，主关键事务抉择或环境转折。`,
          supportEvidence: [`逢冲则动，利于突破僵局与陈旧瓶颈`],
          counterEvidence: [`月令逢冲动应强烈，需防急躁冒进导致节外生枝`],
          rhythm: '快',
          verificationQuestions: [`该月份是否有阶段性关键决策、动迁走动或人事变动？`],
        });
      }

      // 若具体指定了日期范围，增加关键日辰触发点
      if (periodRange.startDate.length >= 10) {
        clusters.push({
          key: `cluster:${periodRange.startDate}:day-nodal`,
          stageIndex,
          timeSpan: `${periodRange.startDate}至${periodRange.endDate}关键动应日`,
          topics: ['career'],
          triggerFact: `指定日期窗口引动本命${getPalaceName(taiSuiPalaceNum)}，形成日辰时空感应。`,
          interactionAnalysis: `日辰为事之先声，时令地气在此区间交汇显现。`,
          supportEvidence: [`日辰引动为具体事项之契机发端`],
          counterEvidence: [`日力轻微，需配合月建大势研判`],
          rhythm: '快',
          verificationQuestions: [`指定日前后是否有具体的签约、会谈或突发事件发生？`],
        });
      }
    }
  }

  // 将事件簇 key 反填至 stages
  for (const st of stages) {
    const matchedKeys = clusters.filter((c) => c.stageIndex === st.stageIndex).map((c) => c.key);
    if (matchedKeys.length > 0) {
      st.eventClusterKeys = matchedKeys;
    }
  }

  return clusters;
}
