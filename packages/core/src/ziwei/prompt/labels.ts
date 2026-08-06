import type { ScopeType } from '../../types/analysis';

export function formatPalaceName(name: string) {
  return name.endsWith('宫') ? name : `${name}宫`;
}

export function normalizePalaceName(name: string) {
  return name.endsWith('宫') ? name.slice(0, -1) : name;
}

export function mapZiweiTopicLabel(topic: string) {
  const labels: Record<string, string> = {
    destiny: '命局解读',
    relationship: '婚姻感情',
    'relationship-push': '关系推进',
    'relationship-decision': '关系去留',
    children: '子女亲缘',
    'career-wealth': '事业财运',
    'job-change': '工作变动',
    'startup-partnership': '创业合作',
    'investment-partnership': '投资合作',
    recent: '近期趋势',
    family: '六亲家庭',
    'home-move': '搬家置业',
    'settle-relocate': '定居换城',
    social: '人际合作',
    emotion: '情绪调节',
    health: '健康养护',
    study: '学业成长',
    'study-advance': '考证进修',
    'exam-landing': '考试上岸',
    'reconciliation-decision': '复合判断',
    growth: '成长课题',
    talent: '天赋优势',
    life: '人生解析',
    chat: '自由聊天',
  };

  return labels[topic] ?? '提示词解读';
}

export function mapZiweiReportTypeLabel(reportType: string) {
  const labels: Record<string, string> = {
    'destiny-overview': '命局综述',
    palace: '宫位详解',
    scope: '阶段报告',
    relationship: '婚姻感情专题',
    'relationship-push': '关系推进专题',
    'relationship-decision': '关系去留专题',
    children: '子女亲缘专题',
    'career-wealth': '事业财运专题',
    'job-change': '工作变动专题',
    'startup-partnership': '创业合作专题',
    'investment-partnership': '投资合作专题',
    recent: '近期趋势专题',
    family: '六亲家庭专题',
    'home-move': '搬家置业专题',
    'settle-relocate': '定居换城专题',
    social: '人际合作专题',
    emotion: '情绪调节专题',
    health: '健康养护专题',
    study: '学业成长专题',
    'study-advance': '考证进修专题',
    'exam-landing': '考试上岸专题',
    'reconciliation-decision': '复合判断专题',
    growth: '成长课题专题',
    talent: '天赋优势专题',
    life: '人生解析专题',
    chat: '自由问答',
  };

  return labels[reportType] ?? 'AI 解读报告';
}

export function mapZiweiScopeLabel(scope: ScopeType) {
  const labels: Record<ScopeType, string> = {
    origin: '本命',
    decadal: '大限',
    yearly: '流年',
    monthly: '流月',
    daily: '流日',
    hourly: '流时',
    age: '小限',
  };
  return labels[scope];
}
