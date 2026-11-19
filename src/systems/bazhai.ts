import type { z } from 'zod';
import type { bazhaiInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, type SchoolGuidanceEntry } from '../prompt-selection';
import { formatClassicExcerpts, selectBazhaiClassics } from './classics';
import { evaluateBazhaiSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { mountains, mountainTrigram, measureSitDirection } from './compass';
import { bazhaiPalaces, bazhaiStarGuidance, birthYearCandidates, compareMingHouse, guaGroup, mingGuaForYear, starPalaceRelations, trigramProfiles } from './bazhai/foundation';

type Input = z.infer<typeof bazhaiInput>;
type Source = Pick<Input, 'person' | 'house'>;
const schoolGuidance: Record<'bazhaimingjing' | 'yangzhaisanyao', SchoolGuidanceEntry> = {
  bazhaimingjing: { label: '八宅明镜', task: '依命卦与宅卦合参大游年八星吉凶，重在人宅东四西四相配与伏位起例。', basis: '《八宅明镜》游年翻卦与星宫生克' },
  yangzhaisanyao: { label: '阳宅三要', task: '重门、主、灶三要方位配合与静宅动变，结合实际门向与炉灶位置核验。', basis: '《阳宅三要》门主灶相生相克与静动宅法' },
};
function calculateData(source: Source) {
  const input = { person: source.person, ...(source.house ? { house: source.house } : {}) };
  const birth = input.person.kind === 'birth' ? birthYearCandidates(input.person) : null;
  const persons = input.person.kind === 'gua' ? [{ gua: input.person.mingGua, group: guaGroup(input.person.mingGua), year: null }]
    : birth!.years.map((year) => mingGuaForYear(year, input.person.kind === 'birth' ? input.person.gender : 'male'));
  const measurement = input.house?.kind === 'measurement' ? { reading: input.house.reading, ...measureSitDirection(input.house) } : null;
  const houses = input.house?.kind === 'mountain' ? (() => { const sitMountain = input.house.sitMountain; const houseGua = mountainTrigram(sitMountain); const index = mountains.indexOf(sitMountain); return [{ sitMountain, facingMountain: mountains[(index + 12) % 24], houseGua }]; })()
    : measurement?.candidates ?? [];
  return { input, birth, persons, measurement, houses,
    mingPalaces: persons.map((person) => ({ year: person.year, gua: person.gua, palaces: bazhaiPalaces(person.gua), starPalaces: starPalaceRelations(person.gua) })),
    housePalaces: houses.map((house) => ({ sitMountain: house.sitMountain, houseGua: house.houseGua, starPalaces: starPalaceRelations(house.houseGua) })),
    comparisons: persons.flatMap((person) => houses.map((house) => ({ year: person.year, ...compareMingHouse(person.gua, house.sitMountain) }))),
    limitation: '八宅仅列传统命卦、宅卦与八方对应，不包含玄空飞星、形峦、建筑安全或现实结果判断。' };
}
type Data = ReturnType<typeof calculateData>;
function render(data: Data, question: string, options?: Input['prompt']) {
  const people = data.mingPalaces.map((person) => `${person.year === null ? '指定命卦' : `命卦年份${person.year}`}：${person.gua}；${person.palaces.map((p) => `${p.direction}${p.label}（${p.luck}）`).join('、')}`);
  const comparisons = data.comparisons.map((item) => `命卦${item.mingGua}与${item.sitMountain}山${item.houseGua}宅：${item.match}；${item.directions.map((p) => `${p.direction}命${p.ming}、宅${p.house}`).join('；')}`);
  const starPalaces = data.housePalaces.length ? data.housePalaces.map((p) => ({ scope: `${p.sitMountain}山${p.houseGua}宅`, items: p.starPalaces })) : data.mingPalaces.map((p) => ({ scope: `${p.year === null ? '指定' : `${p.year}年`}命卦${p.gua}`, items: p.starPalaces }));
  const measurement = data.measurement ? `读数${data.measurement.input.degree}°（${data.measurement.reading === 'sit' ? '坐山' : '大门朝屋内'}）；基准${data.measurement.input.northReference}；修正后${data.measurement.correctedDegree}°；误差±${data.measurement.input.uncertaintyDegrees}°；${data.measurement.stability}。${data.measurement.warnings.join('；')}` : data.houses.length ? '按用户指定坐山。' : '未提供住宅坐山，无法比较命宅。';
  const schools = formatSchoolGuidance(options?.schools, schoolGuidance);
  const classics = options?.includeClassics
    ? formatClassicExcerpts(selectBazhaiClassics([
      ...data.mingPalaces.flatMap((p) => p.palaces.map((x) => x.label)),
      ...data.housePalaces.flatMap((p) => p.starPalaces.map((x) => x.label)),
    ]))
    : '';
  const starGuidanceLines = (data.mingPalaces[0]?.palaces ?? []).map((p) => {
    const g = bazhaiStarGuidance[p.label];
    const prof = trigramProfiles[p.gua];
    return `${p.direction}（${p.gua}宫·${prof.familyRole}·${prof.bodyParts}）临「${p.label}」：${g.rank}，主${g.domain}；${g.layoutAdvice}`;
  });
  const sanYaoAdvice = data.comparisons.map((item) => {
    const mingGood = item.directions.filter((d) => d.mingLuck === '吉').map((d) => `${d.direction}（${d.ming}）`).join('、');
    const houseGood = item.directions.filter((d) => d.houseLuck === '吉').map((d) => `${d.direction}（${d.house}）`).join('、');
    const houseBad = item.directions.filter((d) => d.houseLuck === '凶').map((d) => `${d.direction}（${d.house}）`).join('、');
    return item.match === '同组'
      ? `命卦${item.mingGua}与${item.sitMountain}山${item.houseGua}宅同属${item.mingGroup}：门、主（主卧）、灶向皆宜取 ${mingGood} 四吉方；厨卫镇压宜置 ${houseBad} 四凶方。`
      : `命卦${item.mingGua}（${item.mingGroup}）与${item.sitMountain}山${item.houseGua}宅（${item.houseGroup}）异组：按《八宅明镜》《阳宅三要》分层法，外事（大门/客厅纳气）宜顺宅卦四吉（${houseGood}），内事（个人床位/书桌/灶口朝向）宜顺命卦四吉（${mingGood}）。`;
  });
  const text = [`【八宅】\n${data.birth?.rule ?? '直接使用用户指定命卦。'}\n${people.join('\n')}`,
    `【住宅测量】\n${measurement}\n${data.houses.map((house) => `${house.sitMountain}山${house.facingMountain}向，${house.houseGua}宅`).join('；') || '未提供住宅方向。'}`,
    `【命宅逐方对照】\n${comparisons.join('\n') || '缺少住宅方向，未计算命宅对照。'}`,
    `【星宫生克】\n伏位取左辅木。\n${starPalaces.map((p) => `${p.scope}：${p.items.map((x) => `${x.direction}${x.gua}宫${x.palaceElement}，${x.label}${x.star}${x.starElement}，${x.relation}`).join('；')}`).join('\n')}`,
    `【八方六亲归宫与门主灶布局指引】\n${starGuidanceLines.join('\n')}${sanYaoAdvice.length ? `\n${sanYaoAdvice.join('\n')}` : ''}`,
    formatSchoolAlgorithmSection(evaluateBazhaiSchoolAlgorithms(data, options?.schools)),
    schools,
    classics,
    `【限制与任务】\n${data.limitation} 对多个命卦或坐山候选分别说明共同点和差异，不能选一个候选冒充已确定；结合实际空间布局和用户问题解释传统口径。`,
    `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export function bazhai(input: Input) {
  const data = calculateData(input);
  return { data, summary: { title: '八宅', lines: [`命卦候选：${data.persons.map((person) => person.gua).join('、')}`, `坐山候选：${data.houses.length}`] }, prompt: render(data, input.question, input.prompt) };
}
export function promptForSavedBazhai(data: unknown, source: Source, question: string, options?: Input['prompt']) {
  const expected = calculateData(source);
  if (!sameJsonValue(data, expected)) throw new Error('八宅结果与输入资料不一致。');
  return render(expected, question, options);
}
