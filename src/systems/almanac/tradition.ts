import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from '../calendar';

const dayStemTaboos = ['甲不开仓财物耗散', '乙不栽植千株不长', '丙不修灶必见灾殃', '丁不剃头头必生疮', '戊不受田田主不祥', '己不破券二比并亡', '庚不经络织机虚张', '辛不合酱主人不尝', '壬不泱水更难提防', '癸不词讼理弱敌强'];
const dayBranchTaboos = ['子不问卜自惹祸殃', '丑不冠带主不还乡', '寅不祭祀神鬼不尝', '卯不穿井水泉不香', '辰不哭泣必主重丧', '巳不远行财物伏藏', '午不苫盖屋主更张', '未不服药毒气入肠', '申不安床鬼祟入房', '酉不会客醉坐颠狂', '戌不吃犬作怪上床', '亥不嫁娶不利新郎'];
const directions = ['正北', '东北偏北', '东北偏东', '正东', '东南偏东', '东南偏南', '正南', '西南偏南', '西南偏西', '正西', '西北偏西', '西北偏北'];
const annualGods = ['太岁', '太阳', '丧门', '太阴', '官符', '死符', '岁破', '龙德', '白虎', '福德', '吊客', '病符'];
const zodiacs = [...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
const starNames = [...'角亢氐房心尾箕斗牛女虚危室壁奎娄胃昴毕觜参井鬼柳星张翼轸'];
const starAnimals = [...'蛟龙貉兔狐虎豹獬牛蝠鼠燕猪貐狼狗雉鸡乌猴猿犴羊獐马鹿蛇蚓'];
export function almanacStarAnimal(name: string) {
  const animal = starAnimals[starNames.indexOf(name)];
  if (!animal) throw new Error('二十八宿资料缺少对应动物。');
  return animal;
}

/** 原有彭祖百忌和岁支起十二方位神，仅提供传统资料。 */
export function almanacTradition(yearBranch: string, dayGanZhi: string) {
  const year = EARTHLY_BRANCHES.indexOf(yearBranch), stem = HEAVENLY_STEMS.indexOf(dayGanZhi[0]), branch = EARTHLY_BRANCHES.indexOf(dayGanZhi[1]);
  if (year < 0 || stem < 0 || branch < 0) throw new Error('黄历传统资料需要有效年支与日干支。');
  return { zodiac: zodiacs[year], pengzu: { stem: dayStemTaboos[stem], branch: dayBranchTaboos[branch] },
    annualDirections: annualGods.map((name, offset) => { const index = (year + offset) % 12; return { name, branch: EARTHLY_BRANCHES[index], direction: directions[index] }; }),
    limitation: '仅列传统择日文字与年支方位；不作为现实结果的确定判断。' };
}
