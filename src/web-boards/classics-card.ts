import { asArray, asNumber, asRecord, asString, createBoardModalTrigger, el, type UnknownRecord } from './dom';
import type { ClassicExcerpt } from '../systems/classics/types';

function cleanConditionText(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw
    .replace(/\bmovingCount\s*=\s*(\d+)/g, '共 $1 爻发动')
    .trim();
  if (!trimmed || /^[a-z_]{3,}\s*=/.test(trimmed)) return undefined;
  return trimmed;
}

interface ClassicsMatchData {
  title: string;
  excerpts: readonly ClassicExcerpt[];
  zhouyiLines: readonly string[];
}

function buildClassicsInnerNodes(
  excerpts: readonly ClassicExcerpt[],
  zhouyiLines: readonly string[] = [],
): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (zhouyiLines.length > 0) {
    const zhouyiBox = el('div', 'wb-classics-zhouyi');
    for (const line of zhouyiLines) {
      zhouyiBox.append(el('p', 'wb-classics-zhouyi-line', line));
    }
    frag.append(zhouyiBox);
  }

  if (excerpts.length > 0) {
    const grid = el('div', 'wb-classics-grid');
    for (const item of excerpts.slice(0, 8)) {
      const box = el('article', 'wb-classics-item');
      const top = el('div', 'wb-classics-item-top');
      const sourceText = item.chapter ? `《${item.book}·${item.chapter}》` : `《${item.book}》`;
      top.append(el('span', 'wb-classics-book', sourceText));
      const cond = cleanConditionText(item.condition);
      if (cond) {
        top.append(el('span', 'wb-classics-cond', cond));
      }
      box.append(top);
      box.append(el('strong', 'wb-classics-title', item.title));
      if (item.quote) {
        box.append(el('blockquote', 'wb-classics-quote', `「${item.quote}」`));
      }
      if (item.explanation) {
        box.append(el('p', 'wb-classics-exp', item.explanation));
      }
      grid.append(box);
    }
    frag.append(grid);
  }
  return frag;
}

function buildClassicsBlock(
  title: string,
  excerpts: readonly ClassicExcerpt[],
  zhouyiLines: readonly string[] = [],
): HTMLElement | null {
  if (excerpts.length === 0 && zhouyiLines.length === 0) return null;

  const card = el('section', 'board-card wb-classics-card');
  card.setAttribute('aria-label', title);

  const head = el('div', 'board-head wb-classics-head');
  const titleGroup = el('div', 'board-title-group');
  titleGroup.append(el('h3', 'board-title', title));
  const totalCount = excerpts.length + zhouyiLines.length;
  head.append(titleGroup);

  const books = [...new Set(excerpts.map((item) => `《${item.book}》`))];
  if (zhouyiLines.length > 0 && !books.includes('《周易》')) {
    books.unshift('《周易》');
  }
  const chips = el('div', 'board-chips');
  chips.append(el('span', 'board-chip', `${totalCount} 条`));
  for (const book of books.slice(0, 4)) {
    chips.append(el('span', 'board-chip is-accent', book));
  }
  head.append(chips);
  card.append(head);
  card.append(buildClassicsInnerNodes(excerpts, zhouyiLines));

  return card;
}

async function resolveBoardClassicsData(
  method: string,
  data: unknown,
): Promise<ClassicsMatchData | null> {
  const rec = asRecord(data);
  if (!rec) return null;

  try {
    switch (method) {
      case 'bazi':
      case 'bazi-ziwei': {
        const chartsRec = asRecord(rec.charts);
        const chart =
          asRecord(asRecord(chartsRec?.bazi)?.chart) ??
          asRecord(asRecord(rec.bazi)?.chart) ??
          asRecord(rec.chart) ??
          rec;
        const pillars = asRecord(chart.pillars);
        const dayStem = asString(asRecord(pillars?.day)?.gan) ?? '';
        const monthBranch = asString(asRecord(pillars?.month)?.zhi);
        const patternOverview = asRecord(chart.patternOverview);
        const patternName = asString(patternOverview?.pattern);
        if (!dayStem && !patternName) return null;
        const { selectBaziClassics } = await import('../systems/classics/bazi');
        const excerpts = selectBaziClassics(dayStem, patternName, monthBranch);
        return { title: '经典古籍参断（八字）', excerpts, zhouyiLines: [] };
      }
      case 'ziwei': {
        const natal = asRecord(rec.natal) ?? asRecord(asRecord(rec.chart)?.natal) ?? rec;
        const palaces = asArray(natal.palaces).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
        const mingIdx = palaces.findIndex((p) => asString(p.name)?.includes('命宫') || p.isMing === true);
        const coreIdx = mingIdx >= 0 ? mingIdx : 0;
        const sanFangIndices = [coreIdx, (coreIdx + 4) % 12, (coreIdx + 8) % 12, (coreIdx + 6) % 12];
        const collectStars = (pal: UnknownRecord | undefined) => [
          ...asArray(pal?.majorStars),
          ...asArray(pal?.minorStars),
          ...asArray(pal?.adjectiveStars),
        ].map((s) => asString(asRecord(s)?.name) ?? asString(s)).filter((x): x is string => Boolean(x));
        const starNames = [
          ...collectStars(palaces[coreIdx]),
          ...sanFangIndices.slice(1).flatMap((idx) => collectStars(palaces[idx])),
        ];
        const { selectZiweiClassics } = await import('../systems/classics/ziwei');
        const excerpts = selectZiweiClassics(starNames, 6);
        return { title: '经典古籍参断（紫微斗数）', excerpts, zhouyiLines: [] };
      }
      case 'liuyao': {
        const originalName = asString(rec.originalName) ?? '';
        const changedName = asString(rec.changedName) ?? originalName;
        const changing = asArray(rec.changingYaos)
          .map(asRecord)
          .filter((y) => Boolean(y?.isChanging))
          .map((y) => asNumber(y?.position))
          .filter((n): n is number => typeof n === 'number');
        const yaosDetail = asArray(rec.yaosDetail).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
        const changeTypes = yaosDetail
          .filter((y) => Boolean(y.isChanging))
          .flatMap((y) => [
            asString(y.changeDirection),
            ...asArray(y.changeRelations).map(asString),
          ])
          .filter((x): x is string => Boolean(x));
        const ev = asRecord(rec.evidenceAnalysis);
        const hiddenCount = asArray(ev?.hiddenSpiritFacts).length;
        const structText = asArray(ev?.structureFacts)
          .map((s) => asString(asRecord(s)?.promptText) ?? '')
          .join(' ');
        const topic = asString(ev?.topic);
        const [{ selectLiuyaoClassics }, { ensureYilinLoaded }, { ensureZhouyiLoaded, findHexagram }] = await Promise.all([
          import('../systems/classics/liuyao'),
          import('../systems/classics/yilin'),
          import('../systems/zhouyi-text'),
        ]);
        await Promise.all([ensureZhouyiLoaded(), ensureYilinLoaded()]);
        const zhouyiLines: string[] = [];
        const orig = originalName ? findHexagram(originalName) : undefined;
        const chg = changedName ? findHexagram(changedName) : undefined;
        if (orig) {
          zhouyiLines.push(`本卦《${orig.name}》卦辞：${orig.guaCi}；${orig.daXiang}`);
          for (const pos of changing) {
            const line = orig.yaos.find((y) => y.position === pos);
            if (line) zhouyiLines.push(`${line.positionName}爻辞：${line.yaoCi}；${line.xiaoXiang}`);
          }
        }
        if (chg && orig && chg.id !== orig.id) {
          zhouyiLines.push(`变卦《${chg.name}》卦辞：${chg.guaCi}；${chg.daXiang}`);
        }
        const excerpts = selectLiuyaoClassics({
          movingCount: changing.length,
          hasFuShen: hiddenCount > 0,
          category: topic && topic !== 'general' ? topic : undefined,
          changeTypes,
          isSixClash: structText.includes('六冲'),
          isSixHarmony: structText.includes('六合'),
          fanFuYin: structText,
          originalHexagram: originalName || undefined,
          changedHexagram: changedName || undefined,
        });
        return { title: '《周易》经文与古籍断诀', excerpts, zhouyiLines };
      }
      case 'meihua': {
        const originalName = asString(rec.originalName) ?? '';
        const changedName = asString(rec.changedName) ?? originalName;
        const movingPos = asNumber(asRecord(rec.movingYao)?.position);
        const tiName = asString(asRecord(rec.tiGua)?.name) ?? '';
        const yongName = asString(asRecord(rec.yongGua)?.name) ?? '';
        const relation = asString(asRecord(rec.analysis)?.tiYongRaw) ?? '';
        const [{ selectMeihuaClassics }, { ensureYilinLoaded }, { ensureZhouyiLoaded, findHexagram }] = await Promise.all([
          import('../systems/classics/meihua'),
          import('../systems/classics/yilin'),
          import('../systems/zhouyi-text'),
        ]);
        await Promise.all([ensureZhouyiLoaded(), ensureYilinLoaded()]);
        const zhouyiLines: string[] = [];
        const orig = originalName ? findHexagram(originalName) : undefined;
        const chg = changedName ? findHexagram(changedName) : undefined;
        if (orig) {
          zhouyiLines.push(`本卦《${orig.name}》卦辞：${orig.guaCi}；${orig.daXiang}`);
          if (movingPos !== undefined) {
            const line = orig.yaos.find((y) => y.position === movingPos);
            if (line) zhouyiLines.push(`动爻 ${line.positionName}：${line.yaoCi}；${line.xiaoXiang}`);
          }
        }
        if (chg && orig && chg.id !== orig.id) {
          zhouyiLines.push(`变卦《${chg.name}》卦辞：${chg.guaCi}`);
        }
        const excerpts = selectMeihuaClassics({
          trigrams: [tiName, yongName].filter(Boolean),
          relation,
          originalHexagram: originalName || undefined,
          changedHexagram: changedName || undefined,
        });
        return { title: '《周易》卦爻辞与梅花古诀', excerpts, zhouyiLines };
      }
      case 'qimen':
      case 'qimen-lifetime': {
        const chart = asRecord(rec.baseChart) ?? rec;
        const gongs = asArray(chart.jiuGongGe).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
        const deities = gongs.map((g) => asString(asRecord(g.shenPan)?.god)).filter((x): x is string => Boolean(x));
        const stemPairs = gongs.flatMap((g) => {
          const tian = asString(asRecord(g.tianPan)?.stem);
          const comp = asString(asRecord(g.tianPan)?.companionStem);
          const di = asString(asRecord(g.diPan)?.stem);
          const out: string[] = [];
          if (tian && di) out.push(`${tian}${di}`);
          if (comp && di) out.push(`${comp}${di}`);
          return out;
        });
        const { selectQimenClassics } = await import('../systems/classics/qimen');
        const excerpts = selectQimenClassics({
          zhiFu: asString(chart.zhiFu) ?? '',
          zhiShi: asString(chart.zhiShi) ?? '',
          deities,
          stemPairs,
        });
        return { title: '奇门经典古籍参考', excerpts, zhouyiLines: [] };
      }
      case 'liuren': {
        const transmissions = asArray(rec.threeTransmissions)
          .map(asRecord)
          .filter((x): x is UnknownRecord => Boolean(x));
        const fourLessons = asArray(rec.fourLessons)
          .map(asRecord)
          .filter((x): x is UnknownRecord => Boolean(x));
        const generals = [
          ...transmissions.map((t) => asString(t.god) ?? asString(t.general)),
          ...fourLessons.map((l) => asString(l.god)),
        ].filter((x): x is string => Boolean(x));
        const lessonPatterns = [
          ...asArray(rec.guaTi).map(asString),
          ...asArray(rec.patternTags).map(asString),
          asString(rec.transmissionPattern),
        ].filter((x): x is string => Boolean(x));
        const { selectLiurenClassics } = await import('../systems/classics/liuren');
        const excerpts = selectLiurenClassics({
          transmissionRule: asString(rec.transmissionRule),
          generals,
          lessonPatterns,
        });
        return { title: '《大六壬指南》典籍参考', excerpts, zhouyiLines: [] };
      }
      case 'jinkoujue': {
        const movements = asArray(rec.movements)
          .map((m) => asString(asRecord(m)?.name) ?? asString(m))
          .filter((x): x is string => Boolean(x));
        const { selectJinkoujueClassics } = await import('../systems/classics/jinkoujue');
        const excerpts = selectJinkoujueClassics({ movements });
        return { title: '金口诀经典古诀参考', excerpts, zhouyiLines: [] };
      }
      case 'xiaoliuren': {
        const pName = asString(asRecord(rec.primary)?.name) ?? '';
        const { selectXiaoliurenClassics } = await import('../systems/classics/xiaoliuren');
        return { title: '小六壬掌诀古义', excerpts: selectXiaoliurenClassics(pName), zhouyiLines: [] };
      }
      case 'taiyi': {
        const chart = asRecord(rec.chart) ?? rec;
        const { selectTaiyiClassics } = await import('../systems/classics/taiyi');
        const tags = ['太乙'];
        if (asString(chart.wenChangPosition) ?? asNumber(chart.wenChangPalace) !== undefined) tags.push('文昌');
        if (asString(chart.shiJiPosition) ?? asNumber(chart.shiJiPalace) !== undefined) tags.push('始击');
        if (asNumber(chart.lordGeneral) !== undefined) tags.push('主大将');
        if (asNumber(chart.guestGeneral) !== undefined) tags.push('客大将');
        return { title: '太乙神数古籍参考', excerpts: selectTaiyiClassics(tags), zhouyiLines: [] };
      }
      case 'huangji':
      case 'huangji-jingshi': {
        const { selectHuangjiClassics } = await import('../systems/classics/huangji');
        return {
          title: '《皇极经世》元会运世古义',
          excerpts: selectHuangjiClassics(['元', '会', '运', '世']),
          zhouyiLines: [],
        };
      }
      case 'wuyun-liuqi': {
        const chart = asRecord(rec.chart) ?? rec;
        const { selectWuyunClassics } = await import('../systems/classics/wuyun');
        const factors = [
          asString(asRecord(chart.annualMovement)?.name),
          asString(asRecord(chart.sitian)?.name),
          asString(asRecord(chart.zaiquan)?.name),
        ].filter((x): x is string => Boolean(x));
        return { title: '五运六气经典参考', excerpts: selectWuyunClassics(factors), zhouyiLines: [] };
      }
      case 'bazhai': {
        const starList = asArray(asRecord(asArray(rec.mingPalaces)[0])?.starPalaces)
          .map(asRecord)
          .filter((x): x is UnknownRecord => Boolean(x));
        const stars = [
          ...starList.map((s) => asString(s.label)),
          ...starList.map((s) => asString(s.star)),
        ].filter((x): x is string => Boolean(x));
        const { selectBazhaiClassics } = await import('../systems/classics/fengshui');
        return { title: '八宅明镜古籍参考', excerpts: selectBazhaiClassics(stars), zhouyiLines: [] };
      }
      case 'xuankong': {
        const firstChart = asRecord(asArray(rec.charts)[0]) ?? asRecord(rec.chart) ?? rec;
        const grid = asArray(firstChart.palaces)
          .map(asRecord)
          .filter((x): x is UnknownRecord => Boolean(x))
          .flatMap((p) => [
            asNumber(p.mountain) ?? asNumber(p.mountainStar),
            asNumber(p.water) ?? asNumber(p.facingStar),
            asNumber(p.period) ?? asNumber(p.timeStar),
          ])
          .filter((n): n is number => typeof n === 'number');
        const { selectXuankongClassics } = await import('../systems/classics/fengshui');
        return {
          title: '玄空飞星古籍参考',
          excerpts: selectXuankongClassics([...new Set(grid)].slice(0, 5)),
          zhouyiLines: [],
        };
      }
      case 'qizheng': {
        const { selectQizhengClassics } = await import('../systems/classics/qizheng');
        const mingZhu = asString(rec.mingZhu);
        const duZhu = asString(asRecord(rec.mingDu)?.duZhu);
        const chartStars = asArray(rec.stars)
          .map(asRecord)
          .filter((x): x is UnknownRecord => Boolean(x))
          .filter((s) => asString(s.palace) === '命宫' || /庙|旺/.test(asString(s.dignity) ?? ''))
          .map((s) => asString(s.name))
          .filter((x): x is string => Boolean(x));
        const orderedStars = [
          mingZhu,
          duZhu,
          ...chartStars,
          '太阳', '太阴', '木星', '火星', '土星', '金星', '水星', '紫炁', '月孛', '罗睺', '计都',
        ].filter((x): x is string => Boolean(x));
        return { title: '《果老星宗》古籍参考', excerpts: selectQizhengClassics(orderedStars), zhouyiLines: [] };
      }
      case 'almanac': {
        const officers = asArray(rec.days)
          .map((d) => asString(asRecord(d)?.dayOfficer) ?? asString(asRecord(d)?.jianchu))
          .filter((x): x is string => Boolean(x));
        const { selectAlmanacClassics } = await import('../systems/classics/almanac');
        return {
          title: '《协纪辨方书》建除古义',
          excerpts: selectAlmanacClassics([...new Set(officers)].slice(0, 4)),
          zhouyiLines: [],
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function buildBoardClassicsCard(
  method: string,
  data: unknown,
): Promise<HTMLElement | null> {
  const matched = await resolveBoardClassicsData(method, data);
  if (!matched) return null;
  return buildClassicsBlock(matched.title, matched.excerpts, matched.zhouyiLines);
}

export async function buildBoardClassicsTrigger(
  method: string,
  data: unknown,
): Promise<HTMLButtonElement | null> {
  const matched = await resolveBoardClassicsData(method, data);
  if (!matched) return null;
  const totalCount = matched.excerpts.length + matched.zhouyiLines.length;
  if (totalCount === 0) return null;
  return createBoardModalTrigger(
    '经典古籍参断',
    matched.title,
    () => buildClassicsInnerNodes(matched.excerpts, matched.zhouyiLines),
    `${totalCount}条`,
  );
}
