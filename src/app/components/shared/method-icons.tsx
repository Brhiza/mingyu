import type * as React from 'react';
import {
  BookA,
  Bot,
  CalendarDays,
  Clock,
  Coins,
  Compass,
  Crown,
  Flower2,
  FolderOpen,
  Grid3x3,
  Hand,
  Hash,
  Home,
  KeyRound,
  Layers,
  Orbit,
  Scroll,
  ScrollText,
  Sparkles,
  Star,
  SwatchBook,
  User,
  Users,
  Wind,
} from 'lucide-react';

export type MethodIconComponent = React.ComponentType<{ className?: string }>;

const METHOD_ICON_MAP: Record<string, MethodIconComponent> = {
  // 即时起卦与占卜术数
  liuren: Orbit,
  qimen: Grid3x3,
  liuyao: Coins,
  meihua: Flower2,
  xiaoliuren: Hand,
  jinkoujue: KeyRound,
  tarot: Layers,
  lenormand: SwatchBook,
  ssgw: ScrollText,
  zhuge: Scroll,
  taiyi: Star,
  'huangji-jingshi': Crown,
  'wuyun-liuqi': Wind,
  // 命盘与工作台快捷入口
  single: User,
  compatibility: Users,
  compat: Users,
  cases: FolderOpen,
  history: Clock,
  connect: Bot,
  almanac: CalendarDays,
  calendar: CalendarDays,
  fortune: CalendarDays,
  residential: Home,
  'name-char': BookA,
  'chinese-name': BookA,
  'chinese-naming': BookA,
  'character-query': BookA,
  zhouyi: BookA,
  'number-energy': Hash,
  bazi: Compass,
  ziwei: Compass,
  'bazi-ziwei': Compass,
  astrolabe: Compass,
  qizheng: Compass,
  'qimen-lifetime': Compass,
  'birth-range': Compass,
};

/** 统一解析各术数方法与工作台快捷入口对应的矢量图标 */
export function getMethodIcon(id: string): MethodIconComponent {
  return METHOD_ICON_MAP[id] ?? Sparkles;
}
