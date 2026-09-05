/**
 * @file 八字《子平真诠》格局成败与病药救应推导引擎
 * @description 依据《子平真诠》卷二"论格局成败"与"论成中带败败中有成"，
 * 对八字格局进行正统理法成破推导，精确定位局中之"病"与解救之"药"（救应字）。
 */

import { HIDDEN_STEMS } from './baziDefinitions';
import type { Pillars } from './baziTypes';

export interface PatternRemedy {
  stem: string;
  pillar: 'year' | 'month' | 'day' | 'hour';
  tenGod: string;
  effect: string;
}

export interface PatternFulfillmentResult {
  patternName: string;
  status: '成格' | '破格' | '破而复成' | '平常';
  basis: string;
  contradiction: string;
  remedies: PatternRemedy[];
  summary: string;
}

type GetTenGodFn = (gan: string, dayMaster: string) => string;

interface ExposedStemInfo {
  stem: string;
  tenGod: string;
  pillar: 'year' | 'month' | 'hour';
}

function getExposedStems(
  pillars: Pillars,
  dayMaster: string,
  getTenGod: GetTenGodFn,
): ExposedStemInfo[] {
  const result: ExposedStemInfo[] = [];
  const positions: Array<'year' | 'month' | 'hour'> = ['year', 'month', 'hour'];
  for (const pos of positions) {
    const stem = pillars[pos].gan;
    result.push({
      stem,
      tenGod: getTenGod(stem, dayMaster),
      pillar: pos,
    });
  }
  return result;
}

function getAllGodCounts(
  pillars: Pillars,
  dayMaster: string,
  getTenGod: GetTenGodFn,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (stem: string) => {
    const god = getTenGod(stem, dayMaster);
    counts[god] = (counts[god] || 0) + 1;
  };

  add(pillars.year.gan);
  add(pillars.month.gan);
  add(pillars.hour.gan);

  const branches = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];
  for (const zhi of branches) {
    const stems = HIDDEN_STEMS[zhi] || [];
    for (const s of stems) {
      add(s);
    }
  }

  return counts;
}

export function evaluatePatternFulfillment(
  pillars: Pillars,
  dayMaster: string,
  patternName: string,
  getTenGod: GetTenGodFn,
): PatternFulfillmentResult {
  const exposed = getExposedStems(pillars, dayMaster, getTenGod);
  const counts = getAllGodCounts(pillars, dayMaster, getTenGod);

  const hasExposedGod = (god: string) => exposed.find((item) => item.tenGod === god);
  const findExposedGods = (gods: string[]) =>
    exposed.filter((item) => item.tenGod && gods.includes(item.tenGod));

  // 默认占位
  let status: PatternFulfillmentResult['status'] = '成格';
  let basis = '格局气纯，干支互为表里';
  let contradiction = '原局气清，未见显著刑破破败';
  const remedies: PatternRemedy[] = [];
  let summary = `【${patternName}】气象端正，顺用逆用得宜。`;

  const cleanPattern = patternName.replace(/^杂气/, '');

  // 1. 正官格
  if (cleanPattern.includes('正官')) {
    const shangGuan = hasExposedGod('伤官');
    const qiSha = hasExposedGod('七杀');
    const zhengYin = hasExposedGod('正印');
    const pianYin = hasExposedGod('偏印');
    const caiStems = findExposedGods(['正财', '偏财']);

    if (shangGuan) {
      // 破格：伤官见官
      contradiction = `官星最忌伤官相克，局中天干透出【${shangGuan.stem}】为伤官，直接克害官星贵气（伤官见官）`;
      if (zhengYin || pianYin) {
        const yin = zhengYin || pianYin!;
        status = '破而复成';
        basis = '《子平真诠》云："正官逢伤而透印以解之。"印星既透，制伤护官，转破为成';
        remedies.push({
          stem: yin.stem,
          pillar: yin.pillar,
          tenGod: yin.tenGod,
          effect: `透出【${yin.stem}】${yin.tenGod}制伤生身，护住正官根本，病重得药`,
        });
        summary = `正官格见伤官破格，喜得【${yin.stem}】${yin.tenGod}透干解救，印绶制伤护官，格局破而复成。`;
      } else {
        status = '破格';
        basis = '《子平真诠》云："正官以刑冲破害为败，伤官克官为败。"局无印星制伤，官星受制';
        summary = `正官格见【${shangGuan.stem}】伤官紧贴克官，原局无有力印星护官，格局受损破格，行事多犯小人与口舌官非。`;
      }
    } else if (qiSha) {
      // 破格：官杀混杂
      contradiction = `官多不清，局中天干正官与七杀【${qiSha.stem}】两透，官杀混杂，气局驳杂`;
      const shiShen = hasExposedGod('食神');
      const jieCai = hasExposedGod('劫财');
      if (shiShen) {
        status = '破而复成';
        basis = '《子平真诠》云："官杀混杂，透食神以清之，去杀留官。"';
        remedies.push({
          stem: shiShen.stem,
          pillar: shiShen.pillar,
          tenGod: '食神',
          effect: `食神【${shiShen.stem}】透出制杀存官，去杀留官，格转清纯`,
        });
        summary = `正官逢七杀混杂，喜得【${shiShen.stem}】食神透出制伏偏官，去杀留官，由浊转清。`;
      } else if (jieCai) {
        status = '破而复成';
        basis = '《子平真诠》云："官杀混杂，透劫财以合杀，去杀留官。"';
        remedies.push({
          stem: jieCai.stem,
          pillar: jieCai.pillar,
          tenGod: '劫财',
          effect: `劫财【${jieCai.stem}】合去七杀留正官，格转清白`,
        });
        summary = `正官逢七杀混杂，局中借劫财合杀存官，转破为成。`;
      } else {
        status = '破格';
        basis = '官杀并见无制化，主为人进退犹疑，事业多歧路';
        summary = `正官格官杀两透，原局未见字清格，官杀混杂为破格。`;
      }
    } else {
      // 成格：财印相资
      if (caiStems.length > 0 && (zhengYin || pianYin)) {
        status = '成格';
        basis = '《子平真诠》云："正官用财生印护，财印两不相碍，大贵之格。"';
        summary = `正官格财星生官、印星护身，财官印俱备，格局大成。`;
      } else if (caiStems.length > 0) {
        status = '成格';
        basis = '正官喜财星生助，真金白银资扶官贵';
        summary = `正官格得财星相生，富贵自天来。`;
      } else if (zhengYin || pianYin) {
        status = '成格';
        basis = '正官得印绶化吉生身，官印相生';
        summary = `正官配印，官印相生，文才卓然，仕途稳健。`;
      }
    }
  }

  // 2. 财格（正财格 / 偏财格）
  // 只按正财/偏财显式分派：裸“财格”子串会把劫财格误送入财格成败规则
  else if (cleanPattern.includes('偏财') || cleanPattern.includes('正财')) {
    const biJie = findExposedGods(['比肩', '劫财']);
    const shiShang = findExposedGods(['食神', '伤官']);
    const guanSha = findExposedGods(['正官', '七杀']);

    if (biJie.length > 0) {
      contradiction = `财星最忌比劫争夺，局中天干透出【${biJie.map((b) => b.stem).join('、')}】比劫分夺财星`;
      if (shiShang.length > 0) {
        const ss = shiShang[0];
        status = '破而复成';
        basis = '《子平真诠》云："财逢劫而透食以化之，格转大通。"比劫生食伤，食伤生财，通关有情';
        remedies.push({
          stem: ss.stem,
          pillar: ss.pillar,
          tenGod: ss.tenGod,
          effect: `食伤【${ss.stem}】充当通关化神，使比劫生食伤、食伤转生财星`,
        });
        summary = `财格逢比劫争财破格，喜得【${ss.stem}】${ss.tenGod}透干通关化劫生财，转破为成。`;
      } else if (guanSha.length > 0) {
        const gs = guanSha[0];
        status = '破而复成';
        basis = '《子平真诠》云："财逢劫而透官以制之，去比存财。"';
        remedies.push({
          stem: gs.stem,
          pillar: gs.pillar,
          tenGod: gs.tenGod,
          effect: `官星【${gs.stem}】克制比劫，护住财星库源`,
        });
        summary = `财格逢比劫争财，局中透出【${gs.stem}】${gs.tenGod}制比护财，破而复成。`;
      } else {
        status = '破格';
        basis = '比劫重重透干无化无制，群劫争财';
        summary = `财格逢比劫争夺，原局无食伤化劫亦无官杀制劫，群劫争财破格，主财帛难聚，多破耗。`;
      }
    } else if (hasExposedGod('七杀') && !hasExposedGod('食神') && !hasExposedGod('正印')) {
      status = '破格';
      contradiction = '财旺生杀，财星资党七杀克伐日主，财反招殃';
      basis = '《子平真诠》云："财格透杀，财党杀生祸。"';
      summary = `财格透杀而无制化，财引杀攻身，反主因财生灾破格。`;
    } else {
      status = '成格';
      basis = '财星得根明透，无重劫争财，财库充盈';
      summary = `财格真纯，得食生财或财官相通，财运亨通自成格局。`;
    }
  }

  // 3. 印绶格（正印格 / 偏印格）
  else if (
    cleanPattern.includes('印格') ||
    cleanPattern.includes('正印') ||
    cleanPattern.includes('偏印')
  ) {
    const caiStems = findExposedGods(['正财', '偏财']);
    const biJie = findExposedGods(['比肩', '劫财']);
    const guanSha = findExposedGods(['正官', '七杀']);

    if (caiStems.length > 0) {
      contradiction = `印星喜清纯生身，最畏财星重克破印（贪财坏印）`;
      if (biJie.length > 0) {
        const bj = biJie[0];
        status = '破而复成';
        basis = '《子平真诠》云："印逢财破，透劫以存印，破而复成。"';
        remedies.push({
          stem: bj.stem,
          pillar: bj.pillar,
          tenGod: bj.tenGod,
          effect: `比劫【${bj.stem}】去财护印，保全生身母气`,
        });
        summary = `印绶格逢财星破印，幸得【${bj.stem}】${bj.tenGod}克去财星存全印绶，转破为成。`;
      } else if (guanSha.length > 0) {
        const gs = guanSha[0];
        status = '破而复成';
        basis = '财生官、官生印，财星转克为生，通关有情';
        remedies.push({
          stem: gs.stem,
          pillar: gs.pillar,
          tenGod: gs.tenGod,
          effect: `官杀【${gs.stem}】化财生印，连环相生`,
        });
        summary = `印绶格虽见财星，幸有【${gs.stem}】官星通关，财生官、官生印，破而复成。`;
      } else {
        status = '破格';
        basis = '印星被克无救应，贪财坏印，名誉名声与考运受损';
        summary = `印绶格逢财星重克破格，贪财坏印，文书名声受阻。`;
      }
    } else {
      status = '成格';
      basis = '印星端正无伤，官印相生或印旺吐秀';
      summary = `印绶格气正根深，生扶有力，学养深厚，名望有成。`;
    }
  }

  // 4. 食神格
  else if (cleanPattern.includes('食神')) {
    const pianYin = hasExposedGod('偏印');
    const caiStems = findExposedGods(['正财', '偏财']);
    const qiSha = hasExposedGod('七杀');

    if (pianYin) {
      contradiction = `食神福寿之星，逢偏印枭神透干倒食（枭神夺食）`;
      if (caiStems.length > 0) {
        const cai = caiStems[0];
        status = '破而复成';
        basis = '《子平真诠》云："食神逢枭，透财以护食，转凶为吉。"';
        remedies.push({
          stem: cai.stem,
          pillar: cai.pillar,
          tenGod: cai.tenGod,
          effect: `财星【${cai.stem}】制枭护食，救回食神禄源`,
        });
        summary = `食神格逢枭神夺食破格，幸得【${cai.stem}】${cai.tenGod}制枭护食，破而复成。`;
      } else {
        status = '破格';
        basis = '枭神夺食无制，主多学少成、福气削减';
        summary = `食神格逢偏印透出夺食破格，命带枭神夺食，行事多生波折与阻碍。`;
      }
    } else if (qiSha) {
      status = '成格';
      basis = '《子平真诠》云："食神制杀，英雄独压万人。"食神制伏偏官，化煞为权';
      summary = `食神制杀格成立，食神得位克制七杀，威严与权谋兼备，成格富贵。`;
    } else if (caiStems.length > 0) {
      status = '成格';
      basis = '食神生财，秀气流行，温和致富';
      summary = `食神生财格成立，食神生财秀气发露，富裕安和。`;
    }
  }

  // 5. 七杀格 / 偏官格
  else if (cleanPattern.includes('七杀') || cleanPattern.includes('偏官')) {
    const shiShen = hasExposedGod('食神');
    const zhengYin = hasExposedGod('正印') || hasExposedGod('偏印');
    const shangGuan = hasExposedGod('伤官');
    const caiStems = findExposedGods(['正财', '偏财']);

    if (shiShen) {
      status = '成格';
      basis = '《子平真诠》云："七杀本非吉物，食神制之，煞化为权。"';
      summary = `七杀格得食神透干克制，食神制杀格大成，主刚毅果决，有勇有谋。`;
    } else if (zhengYin) {
      status = '成格';
      basis = '《子平真诠》云："杀无食制而有印化，杀印相生，贵不可言。"';
      summary = `七杀格得印绶引化，杀印相生格大成，主得长辈与权柄提携，转凶为大贵。`;
    } else if (shangGuan) {
      status = '成格';
      basis = '伤官合杀或伤官制杀，去浊留清';
      summary = `七杀格得伤官羁绊制衡，将才自见。`;
    } else {
      if (caiStems.length > 0) {
        status = '破格';
        contradiction = '七杀无食制亦无印化，财星反而滋党凶杀克身';
        basis = '财生杀党，杀无制化攻身，破格之重';
        summary = `七杀格无制无化，更逢财星滋杀破格，小人多侵、压力繁重。`;
      } else {
        status = '平常';
        contradiction = '七杀当令无显著食神克制或印星引化，煞气待运引动';
        basis = '七杀偏官，亟需后天岁运食伤制伏或印绶化合';
        summary = `七杀格待岁运制化，行食伤或印绶运方可发越。`;
      }
    }
  }

  // 6. 伤官格
  else if (cleanPattern.includes('伤官')) {
    const zhengYin = hasExposedGod('正印') || hasExposedGod('偏印');
    const caiStems = findExposedGods(['正财', '偏财']);
    const zhengGuan = hasExposedGod('正官');

    if (zhengGuan && !cleanPattern.includes('金水')) {
      contradiction = '伤官傲慢见正官，两相对冲破其清纯';
      if (zhengYin) {
        status = '破而复成';
        basis = '《子平真诠》云："伤官见官，透印以制伤存官，化解冲突。"';
        remedies.push({
          stem: zhengYin.stem,
          pillar: zhengYin.pillar,
          tenGod: zhengYin.tenGod,
          effect: `印星【${zhengYin.stem}】收敛伤官傲气，护存正官贵气`,
        });
        summary = `伤官见官本有破格之虞，幸得【${zhengYin.stem}】印星制化通融，破而复成。`;
      } else {
        status = '破格';
        basis = '伤官见官为祸百端，无印制化，多犯口舌是非、官非纠葛';
        summary = `伤官格见正官破格，行事桀骜不驯，易招是非与职场挫折。`;
      }
    } else if (zhengYin) {
      status = '成格';
      basis = '《子平真诠》云："伤官配印，贵不可言。"印绶制伤生身，主智谋高超';
      summary = `伤官配印格大成，才华与定力兼备，名利两全。`;
    } else if (caiStems.length > 0) {
      status = '成格';
      basis = '伤官生财，才思转化为滚滚财源';
      summary = `伤官生财格大成，思维敏捷，生财有道，主富厚从容。`;
    }
  }

  // 7. 阳刃格 / 月刃格
  else if (cleanPattern.includes('刃')) {
    const guanSha = findExposedGods(['正官', '七杀']);
    const caiStems = findExposedGods(['正财', '偏财']);

    if (guanSha.length > 0) {
      const gs = guanSha[0];
      status = '成格';
      basis = '《子平真诠》云："阳刃用官杀制伏，刃带杀威，权倾一时。"';
      summary = `阳刃格得【${gs.stem}】${gs.tenGod}制伏，羊刃驾杀成格，主刚决有大统帅之风。`;
    } else if (caiStems.length > 0 && guanSha.length === 0) {
      status = '破格';
      contradiction = '羊刃身极旺无官杀制，天干反而透财，羊刃无情剥夺财星';
      basis = '羊刃无制夺财破格，主破耗刑伤';
      summary = `阳刃格无官杀制伏，反而透财遭群刃争夺破格，防婚恋波折与财帛散失。`;
    } else {
      status = '平常';
      basis = '羊刃性暴，专待官杀岁运拔擢';
      summary = `阳刃旺身待制，岁运逢官杀引动方见建树。`;
    }
  }

  // 8. 劫财格 / 月刃格：月令刃劫结构已登记，成败细则尚未单列，不借用财格或建禄分支结论
  else if (cleanPattern.includes('劫财') || cleanPattern.includes('月刃')) {
    status = '平常';
    basis = '月令刃劫结构已登记，成败与救应细则尚未单列';
    summary = `【${patternName}】月令刃劫结构成立，成败判断细则待补充，暂不下破格或成格结论。`;
  }

  // 9. 建禄格
  else if (cleanPattern.includes('建禄') || cleanPattern.includes('比肩')) {
    const guanSha = findExposedGods(['正官', '七杀']);
    const caiStems = findExposedGods(['正财', '偏财']);
    const shiShang = findExposedGods(['食神', '伤官']);

    if (caiStems.length > 0 && guanSha.length > 0) {
      status = '成格';
      basis = '《子平真诠》云："建禄月劫，透财透官，财官两旺，贵之极致。"';
      summary = `建禄格透财透官，财生官旺，创业自立、富贵兼收。`;
    } else if (shiShang.length > 0 && caiStems.length > 0) {
      status = '成格';
      basis = '建禄用食伤生财，自强不息以富天下';
      summary = `建禄格食伤生财，技术创业，白手起家。`;
    } else if (
      (counts['比肩'] ?? 0) + (counts['劫财'] ?? 0) >= 3 &&
      guanSha.length === 0 &&
      caiStems.length === 0 &&
      shiShang.length === 0
    ) {
      status = '破格';
      contradiction = '建禄比劫重重，不见财官食伤吐秀，身旺无依';
      basis = '比劫重无制化，身旺无归宿';
      summary = `建禄格身过旺无财官食伤抒发，多辛劳而少成就。`;
    }
  }

  return {
    patternName,
    status,
    basis,
    contradiction,
    remedies,
    summary,
  };
}
