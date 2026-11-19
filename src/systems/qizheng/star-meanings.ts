// 依据旧项目对十一曜的现代整理提炼；不是经校核的古籍原文。
const meanings: Record<string, string> = {
  太阳: '光明、名位、父兄君长与领导。',
  太阴: '柔润、田宅、母亲妻子与内在感受。',
  '岁星(木)': '仁慈、学术、师友与福寿。',
  '荧惑(火)': '果决、行动、威仪与争执。',
  '镇星(土)': '稳重、土地、积累与迟滞。',
  '太白(金)': '才艺、财帛、审美与情感。',
  '辰星(水)': '思辨、文书、交流与商贸。',
  '罗睺(火余)': '权威、开拓、激烈与风险。',
  '计都(土余)': '隐伏、谋划、坚韧与阻滞。',
  '月孛(水余)': '才思、变化、情感与纠葛。',
  '紫炁(木余)': '道德、学术、清修与解困。',
};

export function renderQizhengStarMeanings(stars: readonly { name: string }[]) {
  const lines = stars.map(({ name }) => {
    const meaning = meanings[name];
    if (!meaning) throw new Error(`缺少七政星曜取象参考：${name}`);
    return `${name}：${meaning}`;
  });
  return `【十一曜传统取象参考】\n${lines.join('\n')}\n以上为项目整理的传统取象，未经古籍原文校核，不是对本盘的事实断言；须结合宫位、庙旺、吊照与资料限制分析。`;
}
