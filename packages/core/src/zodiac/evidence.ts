import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { TaiSuiConflict, ZodiacYearFortune } from './index';
import { getBranchWuxing, getStemWuxing } from '../ganzhi';

export interface ZodiacRelationEvidence {
  key: string;
  category: '流年同支' | '地支冲突' | '地支助缘' | '年干五行';
  relation: string;
  source: string;
  sources: string[];
  role: '主证' | '辅证';
  detail: string;
  operands: Array<{ label: string; value: string; wuxing?: string }>;
  rule: string;
  promptText: string;
  limitation: '生肖年支与流年干支关系只证明传统关系表或五行生克条件命中；不证明现实事件、个人命运、他人行为、吉凶概率、固定应期或化解效果';
}

export interface ZodiacEvidenceAnalysis {
  calculationChain: string[];
  relations: ZodiacRelationEvidence[];
  primaryEvidence: ZodiacRelationEvidence[];
  supportingEvidence: ZodiacRelationEvidence[];
  counterEvidence: string[];
  limitations: string[];
  sources: Array<{ title: string; evidence: string; role: '传统关系表' | '公共算法' }>;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const RELATION_FACT_LIMITATION =
  '生肖年支与流年干支关系只证明传统关系表或五行生克条件命中；不证明现实事件、个人命运、他人行为、吉凶概率、固定应期或化解效果' as const;

function conflictEvidence(conflict: TaiSuiConflict, zodiacBranch: string): ZodiacRelationEvidence {
  const rule =
    conflict.type === '值太岁'
      ? '两支相同'
      : `十二地支${conflict.type.replace('太岁', '')}固定关系表命中`;
  return {
    key: `关系:${conflict.type}:${zodiacBranch}:${conflict.with}`,
    category: conflict.type === '值太岁' ? '流年同支' : '地支冲突',
    relation: conflict.type,
    source: '生肖年支与流年年支的同支、六冲、相刑、六害、六破关系',
    sources: ['十二地支同支、六冲、相刑、六害与六破固定关系表', '命语干支关系公共算法'],
    role: '主证',
    detail: conflict.desc,
    operands: [
      { label: '生肖年支', value: zodiacBranch, wuxing: getBranchWuxing(zodiacBranch) },
      { label: '流年年支', value: conflict.with, wuxing: getBranchWuxing(conflict.with) },
    ],
    rule,
    promptText: `生肖年支${zodiacBranch}与流年年支${conflict.with}逐项核验，按“${rule}”命中${conflict.type}传统关系分类`,
    limitation: RELATION_FACT_LIMITATION,
  };
}

export function analyzeZodiacEvidence(
  data: Omit<ZodiacYearFortune, 'evidenceAnalysis' | 'prompt'>,
): ZodiacEvidenceAnalysis {
  const relations: ZodiacRelationEvidence[] = [
    ...data.conflicts.map((conflict) => conflictEvidence(conflict, data.zodiacBranch)),
    ...(data.noble
      ? [
          {
            key: `关系:${data.noble}:${data.zodiacBranch}:${data.yearBranch}`,
            category: '地支助缘' as const,
            relation: data.noble,
            source: '生肖年支与流年年支的六合或三合关系',
            sources: ['十二地支六合与三合固定关系表', '命语干支关系公共算法'],
            role: '辅证' as const,
            detail: '只表示传统关系表中的相合条件，不证明现实中必然出现贵人。',
            operands: [
              {
                label: '生肖年支',
                value: data.zodiacBranch,
                wuxing: getBranchWuxing(data.zodiacBranch),
              },
              {
                label: '流年年支',
                value: data.yearBranch,
                wuxing: getBranchWuxing(data.yearBranch),
              },
            ],
            rule: data.noble.startsWith('六合') ? '十二地支六合表命中' : '十二地支三合组命中',
            promptText: `生肖年支${data.zodiacBranch}与流年年支${data.yearBranch}逐项核验，按“${data.noble.startsWith('六合') ? '十二地支六合表命中' : '十二地支三合组命中'}”得到${data.noble}传统关系分类`,
            limitation: RELATION_FACT_LIMITATION,
          },
        ]
      : []),
    {
      key: `关系:年干五行:${data.yearGanZhi[0]}:${data.zodiacBranch}`,
      category: '年干五行',
      relation: data.relation,
      source: '流年天干五行与生肖地支本气五行的生克关系',
      sources: ['天干五行与地支本气五行映射表', '命语五行生克公共算法'],
      role: '辅证',
      detail: '年干五行只作生肖层补充，不等同完整八字十神。',
      operands: [
        { label: '流年年干', value: data.yearGanZhi[0], wuxing: getStemWuxing(data.yearGanZhi[0]) },
        {
          label: '生肖年支本气',
          value: data.zodiacBranch,
          wuxing: getBranchWuxing(data.zodiacBranch),
        },
      ],
      rule: '五行同类、生克关系逐项判断',
      promptText: `流年年干${data.yearGanZhi[0]}属${getStemWuxing(data.yearGanZhi[0])}，生肖年支${data.zodiacBranch}本气属${getBranchWuxing(data.zodiacBranch)}；按五行同类与生克方向逐项判断为“${data.relation}”`,
      limitation: RELATION_FACT_LIMITATION,
    },
  ];
  const primaryEvidence = relations.filter((item) => item.role === '主证');
  const supportingEvidence = relations.filter((item) => item.role === '辅证');
  const counterEvidence = [
    ...(data.conflicts.length === 0
      ? ['本年未命中值、冲、刑、害、破关系，不应为了形成结论而补造“犯太岁”']
      : []),
    ...(!data.noble ? ['本年未命中六合或三合关系，不应泛称有“生肖贵人”'] : []),
    '生肖只取出生年支，同生肖者仍可能因出生月、日、时和现实条件不同而表现完全不同',
  ];
  const limitations = [
    '生肖流年只使用一个出生年支，信息量远低于完整四柱，不得替代八字或现实资料',
    '值、冲、刑、害、破和三合六合是传统关系分类，不是现代统计概率或事件因果证明',
    '年干与生肖地支的五行关系不是严格的个人十神关系，不得直接套用个人十神结论',
    '不得输出吉凶总分、成功率、灾祸概率、固定应期或保证有效的化解方案',
    '现实建议必须落到合同、健康、出行、财务和沟通等可核验条件，不得仅凭“犯太岁”制造恐惧',
  ];
  const sources: ZodiacEvidenceAnalysis['sources'] = [
    {
      title: '十二地支关系表',
      evidence: '同支、六冲、相刑、六害、六破、六合与三合的固定关系',
      role: '传统关系表',
    },
    {
      title: '命语干支与五行公共模块',
      evidence: '六十甲子合法性、天干地支五行及地支关系函数',
      role: '公共算法',
    },
  ];
  const items: PromptEvidenceItem[] = [
    ...primaryEvidence.map((item): PromptEvidenceItem => ({
      level: '主证',
      title: item.relation,
      detail: `${item.promptText}；现实复核提示：${item.detail}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.operands.map((operand) => `${operand.label}${operand.value}${operand.wuxing ? `属${operand.wuxing}` : ''}`).join('与')}；规则${item.rule}`,
      tags: [item.category, item.relation],
    })),
    ...supportingEvidence.map((item): PromptEvidenceItem => ({
      level: '辅证',
      title: item.relation,
      detail: `${item.promptText}；现实复核提示：${item.detail}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.operands.map((operand) => `${operand.label}${operand.value}${operand.wuxing ? `属${operand.wuxing}` : ''}`).join('与')}；规则${item.rule}`,
      tags: [item.category, item.relation],
    })),
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: '生肖层证据缺口',
      detail,
      source: '当前生肖年支与流年干支逐项核验',
    })),
    {
      level: '限制',
      title: '生肖流年信息量与解释边界',
      detail: limitations.join('；'),
      source: '传统关系事实与个人现实结论分离原则',
      tags: ['轻量模型', '现实复核'],
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '生肖流年关系矩阵结构化证据', items };
  const calculationChain = [
    `生肖${data.zodiac}换算为年支${data.zodiacBranch}`,
    `流年${data.yearGanZhi}拆分为年干${data.yearGanZhi[0]}与年支${data.yearBranch}`,
    '年支逐项核验同支、六冲、相刑、六害、六破、六合与三合',
    '年干五行与生肖地支本气五行单独作为辅助关系',
  ];
  const promptText = [
    '【生肖流年关系矩阵结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `有利关系：${data.favorableRelations.join('；') || '未命中三合六合或明确年干辅助关系'}。`,
    `风险关系：${data.riskRelations.join('；') || '未命中值、冲、刑、害、破关系'}。`,
    `反证限制：${counterEvidence.join('；')}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');
  return {
    calculationChain,
    relations,
    primaryEvidence,
    supportingEvidence,
    counterEvidence,
    limitations,
    sources,
    evidence,
    promptText,
    methodology: [
      '先只计算生肖年支与流年年支的固定关系，不混入完整八字结论。',
      '冲突关系作为主证，三合六合与年干五行作为辅证，未命中关系保留反证。',
      '所有传统关系只转换为可观察条件和稳妥行动，不转换为分数、概率或必然事件。',
    ],
  };
}
