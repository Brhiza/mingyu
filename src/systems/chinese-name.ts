import type { z } from 'zod';
import type { chineseNameInput } from '../schema';
import type { CharacterShardLoader } from '../character-data';
import { sameJsonValue } from '../json-value';
import { birthFacts, birthForNaming, nameFacts, nameStructure, namingDetails, namingPreferences, namingPromptSelection, splitSurname } from './naming-foundation';

type Input = z.infer<typeof chineseNameInput>;
type Source = Omit<Input, 'question' | 'currentTime'>;
async function dataFor(input: Source, loadShard?: CharacterShardLoader) {
  const { chars, surnameLength, surname, given } = splitSurname(input.fullName, input.surnameLength);
  if (chars.some((char) => !/\p{Script=Han}/u.test(char))) throw new Error('姓名只能包含汉字。');
  if (chars.length <= surnameLength || chars.length > surnameLength + 2) throw new Error('姓名需由一至二字姓氏和一至二字名字组成。');
  const [details, birthContext] = await Promise.all([namingDetails(chars, loadShard), birthForNaming(input.birth, input.birthRange)]);
  const preference = namingPreferences(input.preferredElements, birthContext);
  const analysis = nameStructure(surname, given, details, preference.stable, preference.conditional);
  return { input, birthContext, preference, analysis };
}
type Data = Awaited<ReturnType<typeof dataFor>>;
function render(data: Data, question: string, options: Input['prompt']) {
  const text = [`【姓名资料与计算】\n${nameFacts(data.analysis)}`, `【出生与五行参考】\n五行方向来源：${data.preference.source}。\n${birthFacts(data.birthContext)}`,
    '【传统语境】\n《左传·桓公六年》记载命名五法；五格三才为后世姓名学数理取象，两者并非同一套规则。字库和资料来源仍需独立校勘。',
    namingPromptSelection(options, 'name-analysis'), '【任务】\n根据实际姓名、字义、读音、字形、五格三才和已列出生资料回答问题。分开说明字义与姓名学取象，具体读音以本人及家族用法为准；不要把数理或条件模型写成现实必然结果，不要虚构未提供的出生资料。', `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function chineseName(input: Input, loadShard?: CharacterShardLoader) {
  const { question, currentTime: _time, ...source } = input;
  const data = await dataFor(source, loadShard);
  return { data, summary: { title: '姓名分析', lines: [`${data.analysis.surname}${data.analysis.given}`, `三才：${data.analysis.sancaiEvidence.combo}`] }, prompt: render(data, question, input.prompt) };
}
export async function promptForSavedChineseName(data: unknown, source: Source, question: string, options: Input['prompt'], loadShard?: CharacterShardLoader) {
  const expected = await dataFor(source, loadShard);
  if (!sameJsonValue(data, expected)) throw new Error('姓名分析结果与输入不一致。');
  return render(expected, question, options ?? source.prompt);
}
