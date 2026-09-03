import { memo, useMemo, useState } from 'react';
import type { QimenLifetimeData, QimenTopic, QimenLifetimeStage } from '@/types/divination';

export interface QimenLifetimeBoardProps {
  title: string;
  name: string;
  data: QimenLifetimeData;
}

const QIMEN_LO_SHU_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];

const QIMEN_DOOR_ELEMENTS: Record<string, string> = {
  休门: '水',
  生门: '土',
  伤门: '木',
  杜门: '木',
  景门: '火',
  死门: '土',
  惊门: '金',
  开门: '金',
};

const QIMEN_PALACE_ELEMENTS: Record<number, string> = {
  1: '水',
  2: '土',
  3: '木',
  4: '木',
  5: '土',
  6: '金',
  7: '金',
  8: '土',
  9: '火',
};

function checkQimenKe(a: string, b: string): boolean {
  return (
    (a === '木' && b === '土') ||
    (a === '土' && b === '水') ||
    (a === '水' && b === '火') ||
    (a === '火' && b === '金') ||
    (a === '金' && b === '木')
  );
}

const QIMEN_STEM_JIXING_PALACES: Record<string, number[]> = {
  戊: [3],
  己: [2],
  庚: [8],
  辛: [9],
  壬: [4],
  癸: [4],
};

const QIMEN_STEM_RUMU_PALACES: Record<string, number[]> = {
  乙: [2],
  丙: [6],
  丁: [8],
  戊: [6],
  己: [4],
  庚: [2],
  辛: [8],
  壬: [4],
  癸: [4],
};

const TOPIC_OPTIONS: Array<{ id: QimenTopic | 'all'; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'career', label: '事业功名' },
  { id: 'wealth', label: '财帛资产' },
  { id: 'marriage', label: '婚恋配偶' },
  { id: 'health', label: '健康疾厄' },
  { id: 'academic', label: '学业名声' },
  { id: 'relocation', label: '出行迁移' },
  { id: 'family', label: '原生家庭' },
];

export const QimenLifetimeBoard = memo(function QimenLifetimeBoard({
  title,
  name,
  data,
}: QimenLifetimeBoardProps) {
  const [selectedGong, setSelectedGong] = useState<number | null>(null);
  const [activeTopic, setActiveTopic] = useState<QimenTopic | 'all'>('all');
  const [activeStageIndex, setActiveStageIndex] = useState<number | null>(null);

  const baseChart = data.baseChart;
  const palaceMap = useMemo(() => {
    return new Map(baseChart.jiuGongGe.map((item) => [item.gong, item]));
  }, [baseChart.jiuGongGe]);

  // 计算当前高亮聚焦的宫位列表
  const highlightedPalaces = useMemo<number[]>(() => {
    if (activeStageIndex !== null) {
      const st = data.stages.find((s) => s.stageIndex === activeStageIndex);
      return st ? st.dominantPalaces.map((d) => d.palace) : [];
    }
    if (activeTopic !== 'all') {
      const tc = data.topicCandidates.find((t) => t.topic === activeTopic);
      return tc ? tc.primaryPalaces : [];
    }
    return [];
  }, [activeStageIndex, activeTopic, data.stages, data.topicCandidates]);

  // 当前选中宫位的详细资料
  const selectedPalace = selectedGong ? palaceMap.get(selectedGong) : null;

  return (
    <div className="traditional-chart-layout qimen-lifetime-showcase">
      {/* 1. 终身局顶栏概览 */}
      <section className="panel traditional-chart-card qimen-lifetime-hero">
        <div className="traditional-board-header">
          <div>
            <h2>{title}</h2>
            <p className="traditional-board-meta">
              <span>{name}</span>
              <span>{data.basis.calendar}</span>
              <span>{data.basis.timeStandard}</span>
              <span>当令节气：{data.basis.solarTerm}</span>
              <span>
                {baseChart.isYangDun ? '阳遁' : '阴遁'}
                {baseChart.juShu}局（{data.basis.juMethod === 'chaibu' ? '拆补' : '置闰'}）
              </span>
            </p>
          </div>
          <div className="traditional-board-badges">
            <span className="result-soft-tag">值符：{baseChart.zhiFu}</span>
            <span className="result-soft-tag">值使：{baseChart.zhiShi}</span>
            {baseChart.voidBranches && baseChart.voidBranches.length > 0 ? (
              <span className="result-soft-tag">旬空：{baseChart.voidBranches.join('')}</span>
            ) : null}
            {baseChart.horseStar ? (
              <span className="result-soft-tag">
                驿马：{baseChart.horseStar.branch}（
                {baseChart.horseStar.name || `${baseChart.horseStar.palace}宫`}）
              </span>
            ) : null}
          </div>
        </div>

        {/* 四柱干支与个人年命核心标记卡 */}
        <div className="qimen-lifetime-marker-grid">
          <div className="qimen-lifetime-marker-item">
            <span className="marker-label">年柱（根基）</span>
            <strong>{baseChart.ganzhi.year}</strong>
            <small>
              {data.personalMarkers.find((m) => m.markerType === 'yearStem')?.palaceName ?? ''}
            </small>
          </div>
          <div className="qimen-lifetime-marker-item">
            <span className="marker-label">月柱（立业）</span>
            <strong>{baseChart.ganzhi.month}</strong>
            <small>青年开拓主轴</small>
          </div>
          <div className="qimen-lifetime-marker-item is-highlight">
            <span className="marker-label">日柱（自身）</span>
            <strong>{baseChart.ganzhi.day}</strong>
            <small>
              {data.personalMarkers.find((m) => m.markerType === 'dayStem')?.palaceName ?? ''}
            </small>
          </div>
          <div className="qimen-lifetime-marker-item">
            <span className="marker-label">时柱（归宿）</span>
            <strong>{baseChart.ganzhi.hour}</strong>
            <small>
              {data.personalMarkers.find((m) => m.markerType === 'hourStem')?.palaceName ?? ''}
            </small>
          </div>
        </div>
      </section>

      {/* 2. 主题与运限快速筛选工具栏 */}
      <section className="panel traditional-chart-card qimen-lifetime-toolbar-card">
        <div className="traditional-qimen-toolbar">
          <div className="traditional-qimen-actions">
            <span className="toolbar-title">主题聚焦：</span>
            {TOPIC_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.id}
                className={`traditional-qimen-btn ${activeTopic === opt.id && activeStageIndex === null ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveStageIndex(null);
                  setActiveTopic(opt.id);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="traditional-qimen-tip">
            {selectedGong
              ? `已选中 ${palaceMap.get(selectedGong)?.name}（点击其他宫或空白切换）`
              : highlightedPalaces.length > 0
                ? `已高亮主导宫位（红框标注）`
                : '点击九宫格任意宫位查看深度格局与克应'}
          </span>
        </div>
      </section>

      {/* 3. 奇门九宫底座盘 */}
      <section className="panel traditional-chart-card qimen-lifetime-board-card">
        <div className="traditional-qimen-grid" role="img" aria-label="奇门遁甲九宫终身底盘">
          {QIMEN_LO_SHU_ORDER.map((gong) => {
            const palace = palaceMap.get(gong);
            if (!palace) return <div className="traditional-qimen-cell is-empty" key={gong} />;

            const isVoid = baseChart.voidPalaces?.some((item) => item.palace === gong);
            const isHorse = baseChart.horseStar?.palace === gong;
            const isZhiFu =
              palace.tianPan.star === baseChart.zhiFu ||
              palace.tianPan.companionStar === baseChart.zhiFu;
            const isZhiShi = palace.renPan.door === baseChart.zhiShi;
            const isSelected = selectedGong === gong;
            const isHighlighted = highlightedPalaces.includes(gong);

            // 四害判断
            const doorEl = QIMEN_DOOR_ELEMENTS[palace.renPan.door] || '';
            const palaceEl = QIMEN_PALACE_ELEMENTS[gong] || '';
            const isMenPo = Boolean(doorEl && palaceEl && checkQimenKe(doorEl, palaceEl));

            const tianStem = palace.tianPan.stem;
            const isJiXing = Boolean(QIMEN_STEM_JIXING_PALACES[tianStem]?.includes(gong));
            const isRuMu = Boolean(QIMEN_STEM_RUMU_PALACES[tianStem]?.includes(gong));
            const isXingMu = isJiXing && isRuMu;

            const companionStem = palace.tianPan.companionStem;
            const companionIsJiXing = companionStem
              ? Boolean(QIMEN_STEM_JIXING_PALACES[companionStem]?.includes(gong))
              : false;
            const companionIsRuMu = companionStem
              ? Boolean(QIMEN_STEM_RUMU_PALACES[companionStem]?.includes(gong))
              : false;

            let stemColorClass = '';
            if (isXingMu) stemColorClass = 'is-xingmu';
            else if (isJiXing) stemColorClass = 'is-jixing';
            else if (isRuMu) stemColorClass = 'is-rumu';

            return (
              <div
                className={`traditional-qimen-cell${gong === 5 ? ' is-center' : ''}${isVoid ? ' is-void' : ''}${isHorse ? ' is-horse' : ''}${isSelected ? ' is-selected' : ''}${isHighlighted ? ' is-yongshen-focus' : ''}`}
                key={gong}
                onClick={() => setSelectedGong(selectedGong === gong ? null : gong)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedGong(selectedGong === gong ? null : gong);
                  }
                }}
                aria-label={`${palace.name}，点击查看终身合参`}
              >
                {/* 宫名 + 八神 */}
                <div className="traditional-qimen-cell-head">
                  <span className="traditional-qimen-gong-name">{palace.name}</span>
                  <span className="traditional-qimen-god-label">
                    {isVoid ? (
                      <b className="traditional-qimen-symbol-void" title="旬空">
                        ○
                      </b>
                    ) : null}
                    {palace.shenPan.god}
                    {isHorse ? (
                      <b className="traditional-qimen-symbol-horse" title="驿马">
                        马
                      </b>
                    ) : null}
                  </span>
                </div>

                {/* 天盘星 */}
                <div className={`traditional-qimen-star${isZhiFu ? ' is-zhifu' : ''}`}>
                  {palace.tianPan.companionStar ? (
                    <span title="天禽寄宫">
                      {palace.tianPan.star}
                      <small>禽</small>
                    </span>
                  ) : (
                    palace.tianPan.star
                  )}
                  {isZhiFu ? <span className="traditional-qimen-badge-zhifu">符</span> : null}
                </div>

                {/* 天地盘干 */}
                <div className="traditional-qimen-stems-row">
                  <span className={`traditional-qimen-tian-stem ${stemColorClass}`}>
                    {tianStem}
                    {companionStem ? (
                      <em
                        className={
                          companionIsJiXing && companionIsRuMu
                            ? 'is-xingmu'
                            : companionIsJiXing
                              ? 'is-jixing'
                              : companionIsRuMu
                                ? 'is-rumu'
                                : ''
                        }
                        title={`天禽携干 ${companionStem}`}
                      >
                        {companionStem}
                      </em>
                    ) : null}
                  </span>
                  <span className="traditional-qimen-di-stem">{palace.diPan.stem}</span>
                </div>

                {/* 人盘门 */}
                <div
                  className={`traditional-qimen-door${isZhiShi ? ' is-zhishi' : ''}${isMenPo ? ' is-menpo' : ''}`}
                >
                  {palace.renPan.door}
                  {isZhiShi ? <span className="traditional-qimen-badge-zhishi">使</span> : null}
                  {isMenPo ? <span className="traditional-qimen-badge-menpo">迫</span> : null}
                </div>

                {/* 四害标记徽章 */}
                <div className="traditional-qimen-harm-badges">
                  {isXingMu ? (
                    <span className="harm-badge is-xingmu" title="击刑入墓">
                      刑墓
                    </span>
                  ) : isJiXing ? (
                    <span className="harm-badge is-jixing" title="六仪击刑">
                      击刑
                    </span>
                  ) : isRuMu ? (
                    <span className="harm-badge is-rumu" title="奇仪入墓">
                      入墓
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* 选中宫位的深度解析面板 */}
        {selectedPalace ? (
          <div className="traditional-qimen-palace-inspector">
            <div className="inspector-head">
              <h3>
                {selectedPalace.name}（{selectedPalace.element}）深度合参
              </h3>
              <button
                type="button"
                className="inspector-close"
                onClick={() => setSelectedGong(null)}
              >
                关闭
              </button>
            </div>
            <div className="inspector-body">
              <p>
                <strong>四盘配置：</strong>天盘【{selectedPalace.tianPan.star}，仪干
                {selectedPalace.tianPan.stem}
                {selectedPalace.tianPan.companionStem
                  ? `(携${selectedPalace.tianPan.companionStem})`
                  : ''}
                】、人盘【{selectedPalace.renPan.door}】、神盘【{selectedPalace.shenPan.god}
                】、地盘干【{selectedPalace.diPan.stem}】
              </p>
              {baseChart.classicPatterns ? (
                <div className="inspector-patterns">
                  <strong>临宫格局：</strong>
                  <ul>
                    {baseChart.classicPatterns
                      .filter((p) => p.palaces.includes(selectedPalace.gong))
                      .map((p, idx) => (
                        <li key={idx} className={p.type === 'good' ? 'is-good' : 'is-bad'}>
                          【{p.name}】{p.summary}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {/* 4. 四柱分限人生运限卡 */}
      <section className="panel traditional-chart-card qimen-lifetime-stages-card">
        <div className="stages-header">
          <div>
            <h3>四柱分限阶段运限</h3>
            <p className="stages-subtitle">
              依据传统年柱初限（0–16岁）、月柱中前限（17–32岁）、日柱中后限（33–48岁）、时柱末限（49+岁）推演人生宏观节奏。点击卡片可高亮主导宫位。
            </p>
          </div>
        </div>

        <div className="qimen-lifetime-stages-grid">
          {data.stages.map((stage: QimenLifetimeStage) => {
            const isStageActive = activeStageIndex === stage.stageIndex;
            const domNames = stage.dominantPalaces.map((d) => d.name).join('、');
            return (
              <div
                key={stage.stageIndex}
                className={`qimen-lifetime-stage-card${isStageActive ? ' is-active' : ''}`}
                onClick={() => {
                  setActiveTopic('all');
                  setActiveStageIndex(isStageActive ? null : stage.stageIndex);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="stage-card-head">
                  <span className="stage-index-tag">阶段 {stage.stageIndex + 1}</span>
                  <h4>{stage.title}</h4>
                  <span className="stage-age">
                    {stage.ageStart} - {stage.ageEnd} 岁
                  </span>
                </div>
                <div className="stage-card-meta">
                  <span className="stage-palaces">主导宫位：{domNames}</span>
                  <p className="stage-theme">{stage.stageTheme}</p>
                </div>
                {stage.supportFacts.length > 0 ? (
                  <div className="stage-facts is-support">
                    <strong>支持吉象：</strong>
                    <ul>
                      {stage.supportFacts.map((fact, idx) => (
                        <li key={idx}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {stage.constraintFacts.length > 0 ? (
                  <div className="stage-facts is-constraint">
                    <strong>考验反证：</strong>
                    <ul>
                      {stage.constraintFacts.map((fact, idx) => (
                        <li key={idx}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. 动态流年事件簇 */}
      {data.eventClusters && data.eventClusters.length > 0 ? (
        <section className="panel traditional-chart-card qimen-lifetime-events-card">
          <div className="events-header">
            <h3>近期流年太岁与虚实引动</h3>
            <p className="events-subtitle">
              按年扫描流年太岁落宫、本命空亡填实、马星引动及年家奇门叠合，呈现关键转折与复盘验证窗口。
            </p>
          </div>

          <div className="qimen-lifetime-events-list">
            {data.eventClusters.map((cluster) => (
              <div key={cluster.key} className="qimen-lifetime-event-item">
                <div className="event-head">
                  <span className="event-time">{cluster.timeSpan}</span>
                  <span className="event-trigger">{cluster.triggerFact}</span>
                  <span className="event-rhythm">节奏：{cluster.rhythm}</span>
                </div>
                <p className="event-interaction">{cluster.interactionAnalysis}</p>
                {cluster.supportEvidence.length > 0 ? (
                  <div className="event-evidence is-good">
                    <strong>增益因素：</strong>
                    {cluster.supportEvidence.join('；')}
                  </div>
                ) : null}
                {cluster.counterEvidence.length > 0 ? (
                  <div className="event-evidence is-risk">
                    <strong>制约风险：</strong>
                    {cluster.counterEvidence.join('；')}
                  </div>
                ) : null}
                {cluster.verificationQuestions.length > 0 ? (
                  <div className="event-questions">
                    <strong>复盘核验：</strong>
                    {cluster.verificationQuestions.join(' ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
});
