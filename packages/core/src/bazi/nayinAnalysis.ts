
import type { NayinItem, NayinProfile } from '../types/analysis';

const NAYIN_MAP: Record<string, string> = {
  '甲子':'海中金','乙丑':'海中金','丙寅':'炉中火','丁卯':'炉中火',
  '戊辰':'大林木','己巳':'大林木','庚午':'路旁土','辛未':'路旁土',
  '壬申':'剑锋金','癸酉':'剑锋金','甲戌':'山头火','乙亥':'山头火',
  '丙子':'涧下水','丁丑':'涧下水','戊寅':'城头土','己卯':'城头土',
  '庚辰':'白蜡金','辛巳':'白蜡金','壬午':'杨柳木','癸未':'杨柳木',
  '甲申':'泉中水','乙酉':'泉中水','丙戌':'屋上土','丁亥':'屋上土',
  '戊子':'霹雳火','己丑':'霹雳火','庚寅':'松柏木','辛卯':'松柏木',
  '壬辰':'长流水','癸巳':'长流水','甲午':'沙中金','乙未':'沙中金',
  '丙申':'山下火','丁酉':'山下火','戊戌':'平地木','己亥':'平地木',
  '庚子':'壁上土','辛丑':'壁上土','壬寅':'金箔金','癸卯':'金箔金',
  '甲辰':'覆灯火','乙巳':'覆灯火','丙午':'天河水','丁未':'天河水',
  '戊申':'大驿土','己酉':'大驿土','庚戌':'钗钏金','辛亥':'钗钏金',
  '壬子':'桑柘木','癸丑':'桑柘木','甲寅':'大溪水','乙卯':'大溪水',
  '丙辰':'沙中土','丁巳':'沙中土','戊午':'天上火','己未':'天上火',
  '庚申':'石榴木','辛酉':'石榴木','壬戌':'大海水','癸亥':'大海水',
};
const NAYIN_ELEMENT: Record<string, string> = {
  金:'金',木:'木',水:'水',火:'火',土:'土',
};

export function analyzeNayinProfile(
  pillars: Array<{ gan: string; zhi: string }>,
): NayinProfile {
  const pillarNames = ['year', 'month', 'day', 'hour'];
  const items: NayinItem[] = pillars.map((p, idx) => {
    const gz = p.gan + p.zhi;
    const na = NAYIN_MAP[gz] || '未知';
    const lastChar = na.slice(-1);
    const elements: Record<string, string> = { 金:'金',木:'木',水:'水',火:'火',土:'土' };
    return { pillar: pillarNames[idx], ganZhi: gz, nayin: na, element: elements[lastChar] || '土' };
  });
  return { items, summary: items.map(i => i.nayin).join(' / ') };
}
