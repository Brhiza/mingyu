import type { QimenData } from '../types/divination';
import { isKe, isSheng, STEM_WUXING, TIAN_GAN_HE, TIAN_GAN_CHONG } from '../ganzhi';
import { getDunJiaStem, hasTianPanStem } from '../divination/algorithms/qimen/helpers/palace-utils';

type Palace = QimenData['jiuGongGe'][number];

/** 同干在两层盘中的实际位置，供采用追干判法时核对起点与落点。 */
export function formatQimenStemLocations(data: QimenData): string[] {
  const stems = new Set(
    data.jiuGongGe
      .flatMap((palace) => [palace.tianPan.stem, palace.tianPan.companionStem, palace.diPan.stem])
      .filter((stem): stem is string => Boolean(stem)),
  );
  return [...stems].sort().map((stem) => {
    const sky = data.jiuGongGe.filter((palace) => hasTianPanStem(palace, stem));
    const earth = data.jiuGongGe.filter((palace) => palace.diPan.stem === stem);
    return `${stem}：天盘${sky.map((palace) => `${palace.name}${palace.tianPan.companionStem === stem ? '（寄干）' : ''}`).join('、') || '未列'}；地盘${earth.map((palace) => palace.name).join('、') || '未列'}`;
  });
}

function elementRelation(a: string, ae: string, b: string, be: string): string {
  if (ae === be) return `${a}与${b}同五行，比和`;
  if (isSheng(ae, be)) return `${a}生${b}`;
  if (isSheng(be, ae)) return `${b}生${a}`;
  if (isKe(ae, be)) return `${a}克${b}`;
  if (isKe(be, ae)) return `${b}克${a}`;
  return '';
}

export function formatQimenHourStem(data: QimenData): string {
  const hourStem = data.ganzhi.hour.charAt(0);
  const locatedStem = getDunJiaStem(data.ganzhi.hour);
  const sky = data.jiuGongGe.filter((palace) => hasTianPanStem(palace, locatedStem));
  const earth = data.jiuGongGe.filter((palace) => palace.diPan.stem === locatedStem);
  return [
    `时干${hourStem}${hourStem === '甲' ? `（${data.ganzhi.hour}遁于${locatedStem}）` : ''}`,
    `天盘${locatedStem}：${sky.map((palace) => palace.name).join('、') || '未见落宫'}`,
    `地盘${locatedStem}：${earth.map((palace) => palace.name).join('、') || '未见落宫'}`,
  ].join('；');
}

export function formatQimenRelationFacts(
  zhiFu: Palace | undefined,
  zhiShi: Palace | undefined,
  useful: Palace | undefined,
): string[] {
  const lines: string[] = [];
  if (zhiFu && zhiShi) {
    lines.push(
      `值符宫与值使宫五行：${elementRelation(`值符宫${zhiFu.name}${zhiFu.element}`, zhiFu.element, `值使宫${zhiShi.name}${zhiShi.element}`, zhiShi.element)}`,
    );
  }
  if (useful) {
    for (const sky of [useful.tianPan.stem, useful.tianPan.companionStem].filter(Boolean)) {
      const earth = useful.diPan.stem;
      const skyElement = STEM_WUXING[sky!];
      const earthElement = STEM_WUXING[earth];
      if (!skyElement || !earthElement) continue;
      const relation = elementRelation(
        `天盘${sky}${skyElement}`,
        skyElement,
        `地盘${earth}${earthElement}`,
        earthElement,
      );
      const combine =
        TIAN_GAN_HE[sky!]?.partner === earth ? `；天干五合：${sky}与${earth}相合` : '';
      const clash = TIAN_GAN_CHONG[sky!] === earth ? `；天干相冲：${sky}与${earth}相冲` : '';
      lines.push(`${useful.name}天地盘干：${relation}${combine}${clash}`);
    }
  }
  return lines;
}
