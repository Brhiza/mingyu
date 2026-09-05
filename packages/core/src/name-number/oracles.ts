import { createRandomContext, randomInt, type RandomOptions } from '../shared/random';
import { CHARACTER_STROKE_TUPLES } from './generated-character-strokes';
import { ZHUGE_SIGNS } from './zhuge-signs';
import { getZhugeInterpretation } from './zhuge-interpretations';
import { getKongmingInterpretation } from './kongming-interpretations';

const characterStrokes = new Map<string, number>();
for (const [simplified, traditional, count] of CHARACTER_STROKE_TUPLES) {
  characterStrokes.set(simplified, count);
  characterStrokes.set(traditional, count);
}

const KONGMING_HEXAGRAMS = [
  ['●●●●●', '星震卦', '上上', '彩凤呈祥瑞，麒麟降帝都，祸除迎福到，喜气自然生。'],
  ['●○○○○', '从革卦', '上平', '从革宜变更，时来合运迁，龙门鱼跃过，凡骨作神仙。'],
  ['○●○○○', '曲直卦', '中平', '动作因风便，求谋可托人，若逢戊己土，事事得遂心。'],
  ['○○●○○', '润下卦', '小平', '船放江湖内，滩边获宝多，更宜将大用，灾散福来居。'],
  ['○○○●○', '炎上卦', '下下', '此卦按南方，灾难不可当，官司多不利，目下有灾殃。'],
  ['○○○○●', '稼穑卦', '中平', '且安君子分，勿用小人言，凡事皆当谨，作福保安然。'],
  ['●●○○○', '进求卦', '上上', '国治人安泰，家财见崭兴，进财求旺吉，有福亦平安。'],
  ['●○○○●', '进宝卦', '上吉', '好事承天佑，门楣喜气新，有人相助力，获福尽欢欣。'],
  ['●○●○●', '获安卦', '中吉', '目下如冬树，只待春色到，看看喜色动，渐渐发萌芽。'],
  ['●○○●○', '遂心卦', '中平', '时融逢和气，衰残物再兴，更逢微雨细，喜色又还生。'],
  ['○●●○●', '灾散卦', '大吉', '灾散福门开，无边喜气来，目下相逢处，须当得横财。'],
  ['○●○●○', '上进卦', '上平', '进取逢通达，寒儒衣锦回，何人占此卦，凡事任施为。'],
  ['○●○○●', '暗昧卦', '下凶', '井底观明月，见形却无影，钱财多散失，谨守得安宁。'],
  ['○○●●○', '安静卦', '下中', '心思多不定，求谋未得成，忍耐方为福，守分免灾星。'],
  ['○○●○●', '阻隔卦', '下凶', '枯木逢霜雪，扁舟遇大风，心事无可托，百事不遂通。'],
  ['○○○●●', '保安卦', '平吉', '日出临东海，光辉天下明，动用和合吉，百事自然成。'],
  ['●●●○○', '喜至卦', '中吉', '众恶皆消无，端然福气生，如人行暗夜，今已得天明。'],
  ['●●○●○', '保命卦', '中平', '服药将自保，缠绵词讼连，百凡宜守旧，作福自然安。'],
  ['●●○○●', '犹豫卦', '下下', '卦中多恍惚，钱财暗里磨，恩爱反成怨，人情难相和。'],
  ['●○●●○', '丰稔卦', '上吉', '根实枝叶茂，林多格式高，经营多得利，兰蕙似蓬蒿。'],
  ['●○○●●', '得禄卦', '吉', '高名居禄位，笼鸟得逃生，出入多财宝，更宜远方行。'],
  ['●○●○○', '明显卦', '吉', '明月青天上，今宵照绮筵，家家沾往泽，万里净云烟。'],
  ['○●●●○', '祐福卦', '吉', '福禄得安康，荣华保吉昌，所得皆遂意，千里共兰香。'],
  ['○●●○○', '凝滞卦', '下下', '羸马登程去，饥人走远途，前程多阻隔，后福方无忧。'],
  ['○●○●●', '显达卦', '吉', '三姓俱相伴，祥光得共生，更宜分造化，百福自然增。'],
  ['○○●●●', '福源卦', '吉', '此卦占太和，求谋喜事多，远人归故里，身乐得欢歌。'],
  ['○●●●●', '太平卦', '吉', '春雨滋苗稼，何愁不广收，自然心得乐，安然总无忧。'],
  ['●●●○●', '颠险卦', '不吉', '迢迢途中旋，云横日坠山，心事无可托，前后总皆难。'],
  ['●●○●●', '开发卦', '平', '蚌中珠自见，石内玉增光，进财求旺吉，有祸不成殃。'],
  ['●●●●○', '鹰扬卦', '吉', '天兵诛贼寇，旌旗得胜归，功成班将帅，门第有光辉。'],
  ['●○●●●', '后吉卦', '平', '履薄登冰地，危桥得渡时，重重忧险过，喜色自芳菲。'],
  ['○○○○○', '无数卦', '凶', '尘埋青铜镜，美玉陷淤泥，何时重出世，再得显光辉。'],
] as const;

export function calculateZhugeNumber(text: string) {
  const chars = [...text.trim()];
  if (chars.length !== 3) throw new Error('诸葛神数需输入恰好三个汉字');
  const strokes = chars.map((char) => characterStrokes.get(char));
  if (strokes.some((count) => count === undefined)) throw new Error('输入中含字典未收录的汉字');
  const digits = strokes.map((count) => count! % 10);
  const rawNumber = digits[0] * 100 + digits[1] * 10 + digits[2];
  const number = rawNumber % 384 || 384;
  const interpretation = getZhugeInterpretation(number);
  return {
    text: chars.join(''),
    chars,
    strokes: strokes as number[],
    digits,
    rawNumber,
    number,
    sign: {
      ...ZHUGE_SIGNS[number - 1],
      summary: interpretation?.interpretation ?? ZHUGE_SIGNS[number - 1].summary,
    },
    interpretation,
  };
}

export function castKongmingHexagram(pattern?: string, options?: RandomOptions) {
  let resolvedPattern = pattern?.trim();
  let randomTrace: ReturnType<ReturnType<typeof createRandomContext>['getTrace']> | undefined;
  if (!resolvedPattern) {
    const context = createRandomContext(options);
    resolvedPattern = Array.from({ length: 5 }, () =>
      randomInt(2, context.random) === 1 ? '●' : '○',
    ).join('');
    randomTrace = context.getTrace();
  }
  const normalized = resolvedPattern.replace(/[阳正公1]/g, '●').replace(/[阴反字0]/g, '○');
  if (!/^[●○]{5}$/.test(normalized)) throw new Error('卦象需由五个阴阳结果组成');
  const index = KONGMING_HEXAGRAMS.findIndex((item) => item[0] === normalized);
  if (index < 0) throw new Error('未找到对应卦象');
  const [symbol, name, grade, poem] = KONGMING_HEXAGRAMS[index];
  return {
    number: index + 1,
    symbol,
    name,
    grade,
    poem,
    draws: [...symbol].map((value, position) => ({
      index: position + 1,
      symbol: value,
      polarity: value === '●' ? '阳' : '阴',
    })),
    interpretation: getKongmingInterpretation(symbol),
    random: randomTrace,
  };
}

export type ZhugeNumberResult = ReturnType<typeof calculateZhugeNumber>;
export type KongmingHexagramResult = ReturnType<typeof castKongmingHexagram>;
