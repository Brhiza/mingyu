import type { z } from 'zod';
import type { wuyunInput } from '../schema';
import { calculateWuyunLiuqi, formatWuyunLiuqiFacts } from './wuyun/index';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateWuyunSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { formatClassicExcerpts, selectWuyunClassics } from './classics';
import reference from './wuyun-reference.json';

type Input = z.infer<typeof wuyunInput>;
type Result = ReturnType<typeof calculateWuyunLiuqi>;

const ZAIQUAN_PATHOLOGY: Record<string, { condition: string; zangfu: string; pathology: string; guideline: string }> = {
  厥阴风木: {
    condition: '厥阴在泉，风淫于内',
    zangfu: '病本于脾',
    pathology: '洒洒振寒，善伸数欠，心痛支满，两胁里急，饮食不下，膈咽不通，食则呕，腹胀善噫',
    guideline: '治以辛凉，佐以苦，以甘缓之，以辛散之',
  },
  少阴君火: {
    condition: '少阴在泉，热淫于内',
    zangfu: '病本于肺',
    pathology: '腹中常鸣，气上冲胸，喘不能久立，寒热皮肤痛，目瞑齿痛，鼽衄',
    guideline: '治以咸寒，佐以甘苦，以酸收之，以苦发之',
  },
  太阴湿土: {
    condition: '太阴在泉，湿淫于内',
    zangfu: '病本于肾',
    pathology: '饮积心痛，耳聋，浑浑焞焞，嗌肿喉痹，阴病血见，少腹痛肿，不得小便',
    guideline: '治以苦热，佐以酸淡，以苦燥之，以淡泄之',
  },
  少阳相火: {
    condition: '少阳在泉，火淫于内',
    zangfu: '病本于肺',
    pathology: '注泄赤白，少腹痛，溺赤，甚则血便',
    guideline: '治以咸冷，佐以苦辛，以酸收之，以苦发之',
  },
  阳明燥金: {
    condition: '阳明在泉，燥淫于内',
    zangfu: '病本于肝',
    pathology: '洒洒振寒，善太息，呕苦，胸中痛，胁支满，尻阴股膝髀腨胻足病',
    guideline: '治以苦温，佐以甘辛，以苦下之',
  },
  太阳寒水: {
    condition: '太阳在泉，寒淫于内',
    zangfu: '病本于心',
    pathology: '少腹控睾，引腰脊，上冲心痛，血见，嗌痛颔肿',
    guideline: '治以甘热，佐以苦辛，以咸写之，以辛润之，以苦坚之',
  },
};

const MOVEMENT_QIJIAOBIAN_NOTES: Record<string, string> = {
  '木:太过': '《素问·气交变大论》岁木太过，风气流行，脾土受邪；《三因》五运方文献参“苓术汤”（平气参“敷和汤”）。',
  '木:不及': '《素问·气交变大论》岁木不及，燥乃大行，肝木受邪，复则炎暑流火；《三因》五运方文献参“苁蓉牛膝汤”（平气参“敷和汤”）。',
  '火:太过': '《素问·气交变大论》岁火太过，炎暑流行，肺金受邪；《三因》五运方文献参“麦门冬汤”（平气参“升明汤”）。',
  '火:不及': '《素问·气交变大论》岁火不及，寒乃大行，心火受邪，复则埃郁大雨；《三因》五运方文献参“黄芪茯神汤”（平气参“升明汤”）。',
  '土:太过': '《素问·气交变大论》岁土太过，雨湿流行，肾水受邪；《三因》五运方文献参“附子山茱萸汤”（平气参“备化汤”）。',
  '土:不及': '《素问·气交变大论》岁土不及，风乃大行，脾土受邪，复则收政严峻；《三因》五运方文献参“白术厚朴汤”（平气参“备化汤”）。',
  '金:太过': '《素问·气交变大论》岁金太过，燥气流行，肝木受邪；《三因》五运方文献参“牛膝木瓜汤”（平气参“审平汤”）。',
  '金:不及': '《素问·气交变大论》岁金不及，炎火乃行，肺金受邪，复则寒雨暴至；《三因》五运方文献参“紫菀汤”（平气参“审平汤”）。',
  '水:太过': '《素问·气交变大论》岁水太过，寒气流行，心火受邪；《三因》五运方文献参“川连茯苓汤”（平气参“静顺汤”）。',
  '水:不及': '《素问·气交变大论》岁水不及，湿乃大行，肾水受邪，复则大风暴发；《三因》五运方文献参“五味子汤”（平气参“静顺汤”）。',
};

function buildWuyunPathomechanismDetails(result: Result): string {
  const p = result.pathomechanism;
  const zq = ZAIQUAN_PATHOLOGY[result.zaiquan.name];
  const movementNote = MOVEMENT_QIJIAOBIAN_NOTES[`${result.annualMovement.element}:${result.annualMovement.strength}`] ?? '';
  const cleanSitianPath = p.climaticPathology.replace(/^[^的]+的/u, '');
  const cleanSitianGuide = p.treatmentGuideline.replace(/^[^的]+的/u, '');
  return [
    `【传统运气病机与治则文献（仅作古籍考据，非医疗处方）】`,
    `- 岁运纪运与受邪：${p.pingQiBasis}${movementNote ? ` ${movementNote}` : ''}`,
    `- 司天（上半年主气势）《至真要大论》：${p.affectedZangFu}${cleanSitianPath}${cleanSitianGuide}`,
    ...(zq
      ? [
          `- 在泉（下半年主气势）《至真要大论》：${zq.condition}时，原文称“${zq.zangfu}”；病候摘录：“${zq.pathology}”；传统治则摘录：“${zq.guideline}”。`,
        ]
      : []),
  ].join('\n');
}

function buildPrompt(result: Result, question: string, options: Input['prompt'], now: string) {
  const selection = resolvePromptSelection('wuyun-liuqi', { ...options, scope: 'yearly' });
  const schoolText = formatSchoolGuidance(options?.schools, reference.schools);
  const classics = options?.includeClassics ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n') : '';
  const movementFactor = { 土: '甲己化土', 金: '乙庚化金', 水: '丙辛化水', 木: '丁壬化木', 火: '戊癸化火' }[result.annualMovement.element];
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(
        selectWuyunClassics([movementFactor, `${result.sitian.name}司天`, `${result.zaiquan.name}在泉`]),
        '典籍片段',
      )
    : '';
  const user = [
    '【传统依据】\n按年干支定岁运、司天在泉及五步主客运、六步主客气；区分传统交司日期与现代节气参考时刻。',
    `【时间】\n提示词时间：${now}。`,
    `【年度运气资料】\n${formatWuyunLiuqiFacts(result)}`,
    buildWuyunPathomechanismDetails(result),
    `【适用边界】\n${result.limitations.join('\n')}`,
    selection ? `【解读选择】\n${selection.section}` : '',
    formatSchoolAlgorithmSection(evaluateWuyunSchoolAlgorithms(result, options?.schools)),
    schoolText,
    classics ? `【经典依据】\n${classics}` : '',
    classicExcerpts,
    `【任务】\n结合所问事项说明岁运、司天在泉与各阶段主客关系，标明传统口径、交司条件和资料不足。${selection ? `\n${selection.task}` : ''}\n年度传统模型不能推断个人诊断、疾病风险或治疗方案；病候与治则材料仅作传统文献背景。`,
    `【问题】\n${question}`,
  ].filter(Boolean).join('\n\n');
  return { text: user };
}

export function wuyun(input: Input, now: string) {
  const result = calculateWuyunLiuqi(input.wuyun);
  const chart = result;
  return {
    data: { input: input.wuyun, chart },
    summary: { title: '五运六气', tags: [result.input.yearGanZhi, `${result.annualMovement.name}${result.annualMovement.strength}`, `司天：${result.sitian.name}`, `在泉：${result.zaiquan.name}`], lines: [result.calendarDateStatus, result.annualRelation.basis] },
    prompt: buildPrompt(result, input.question, input.prompt, now),
  };
}

export function promptForWuyun(data: Record<string, unknown>, input: Input, now: string) {
  const result = calculateWuyunLiuqi(input.wuyun);
  const expected = result;
  if (!sameJsonValue(data.chart, expected)) throw new Error('五运六气盘面与年份或年干支不一致。');
  return buildPrompt(result, input.question, input.prompt, now);
}
