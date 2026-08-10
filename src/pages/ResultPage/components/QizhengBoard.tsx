import { memo } from 'react';
import type { QizhengAspect, QizhengResult, QizhengStar } from 'mingyu-core/qizheng';

const SIGN_INDEXES = Array.from({ length: 12 }, (_, index) => index);
const STAR_STYLES: Array<{ match: string; symbol: string; color: string }> = [
  { match: '太阳', symbol: '日', color: '#d97706' },
  { match: '太阴', symbol: '月', color: '#64748b' },
  { match: '岁星', symbol: '木', color: '#15803d' },
  { match: '荧惑', symbol: '火', color: '#dc2626' },
  { match: '镇星', symbol: '土', color: '#a16207' },
  { match: '太白', symbol: '金', color: '#ca8a04' },
  { match: '辰星', symbol: '水', color: '#2563eb' },
  { match: '罗睺', symbol: '罗', color: '#7c3aed' },
  { match: '计都', symbol: '计', color: '#9333ea' },
  { match: '月孛', symbol: '孛', color: '#db2777' },
  { match: '紫炁', symbol: '炁', color: '#0891b2' },
];

function getStarStyle(name: string) {
  return (
    STAR_STYLES.find((item) => name.startsWith(item.match)) ?? {
      match: name,
      symbol: name.slice(0, 1),
      color: '#475569',
    }
  );
}

function polarPoint(longitude: number, radius: number) {
  const angle = ((longitude - 90) * Math.PI) / 180;
  return { x: 200 + Math.cos(angle) * radius, y: 200 + Math.sin(angle) * radius };
}

function starPoint(star: QizhengStar) {
  return polarPoint(star.longitude, star.kind === '七政' ? 132 : 105);
}

function aspectLine(aspect: QizhengAspect, stars: QizhengStar[]) {
  const first = stars.find((star) => star.name === aspect.star1);
  const second = stars.find((star) => star.name === aspect.star2);
  if (!first || !second) return null;
  const start = starPoint(first);
  const end = starPoint(second);
  return { start, end };
}

function aspectOpacity(aspect: QizhengAspect) {
  if (aspect.closeness === '紧密') return 0.72;
  if (aspect.closeness === '中等') return 0.5;
  return 0.32;
}

function QizhengChart({ data }: { data: QizhengResult }) {
  const palaceBySign = new Map(data.twelvePalaces.map((item) => [item.signIndex, item]));
  return (
    <svg
      className="qizheng-chart-svg"
      viewBox="0 0 400 400"
      role="img"
      aria-label="七政四余十二宫圆盘"
    >
      <circle cx="200" cy="200" r="184" className="qizheng-ring" />
      <circle cx="200" cy="200" r="148" className="qizheng-ring" />
      <circle cx="200" cy="200" r="78" className="qizheng-ring qizheng-ring-core" />
      {SIGN_INDEXES.map((index) => {
        const palace = palaceBySign.get(index);
        const line = polarPoint(index * 30, 184);
        const inner = polarPoint(index * 30, 78);
        const label = polarPoint(index * 30 + 15, 166);
        return (
          <g key={index}>
            <line
              x1={inner.x}
              y1={inner.y}
              x2={line.x}
              y2={line.y}
              className="qizheng-sector-line"
            />
            <text x={label.x} y={label.y} className="qizheng-palace-label">
              <tspan>{palace?.signBranch}</tspan>
              <tspan x={label.x} dy="11">
                {palace?.palace}
              </tspan>
            </text>
          </g>
        );
      })}
      {data.aspects.slice(0, 12).map((aspect) => {
        const line = aspectLine(aspect, data.stars);
        return line ? (
          <line
            key={`${aspect.star1}-${aspect.star2}-${aspect.type}`}
            x1={line.start.x}
            y1={line.start.y}
            x2={line.end.x}
            y2={line.end.y}
            className={`qizheng-aspect-line qizheng-aspect-${aspect.type}`}
            style={{ opacity: aspectOpacity(aspect) }}
          />
        ) : null;
      })}
      {data.stars.map((star) => {
        const point = starPoint(star);
        return (
          <g key={star.name} transform={`translate(${point.x} ${point.y})`}>
            <circle
              r={star.kind === '七政' ? 13 : 12}
              fill={getStarStyle(star.name).color}
              className="qizheng-star-dot"
            />
            <text className="qizheng-star-label">{getStarStyle(star.name).symbol}</text>
            {star.retrograde ? (
              <text y="22" className="qizheng-retrograde-label">
                逆
              </text>
            ) : null}
          </g>
        );
      })}
      <text x="200" y="184" className="qizheng-core-title">
        命宫 {palaceBySign.get(data.mingGong)?.signBranch}
      </text>
      <text x="200" y="202" className="qizheng-core-title">
        身宫 {palaceBySign.get(data.shenGong)?.signBranch}
      </text>
      <text x="200" y="220" className="qizheng-core-subtitle">
        命主 {data.mingZhu}
      </text>
    </svg>
  );
}

export const QizhengBoard = memo(function QizhengBoard({
  title,
  name,
  data,
}: {
  title: string;
  name: string;
  data: QizhengResult;
}) {
  const strongestAspects = data.aspects.slice(0, 8);
  const ziqiStar = data.stars.find((star) => star.name.startsWith('紫炁'));
  return (
    <section className="result-showcase-card qizheng-showcase-card">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">七政四余 {data.stars.length} 星</span>
          <span className="result-chip">吊照 {data.aspects.length} 组</span>
        </div>
      </div>
      <div className="result-summary-grid">
        <div className="result-stat-card result-stat-card-accent">
          <span>命宫</span>
          <strong>
            {data.twelvePalaces.find((item) => item.signIndex === data.mingGong)?.signBranch}宫
          </strong>
          <small>
            {data.twelvePalaces.find((item) => item.signIndex === data.mingGong)?.palace}
          </small>
        </div>
        <div className="result-stat-card">
          <span>身宫</span>
          <strong>
            {data.twelvePalaces.find((item) => item.signIndex === data.shenGong)?.signBranch}宫
          </strong>
          <small>
            {data.twelvePalaces.find((item) => item.signIndex === data.shenGong)?.palace}
          </small>
        </div>
        <div className="result-stat-card">
          <span>命主</span>
          <strong>{data.mingZhu}</strong>
          <small>按命宫十二支取主星</small>
        </div>
        <div className="result-stat-card">
          <span>紫炁</span>
          <strong>{ziqiStar ? `${ziqiStar.xiu}${ziqiStar.xiuDegree.toFixed(2)}°` : '—'}</strong>
          <small>周期进度 {(data.ziqi.cycleProgress * 100).toFixed(1)}%</small>
        </div>
      </div>
      <div className="astrolabe-board-layout">
        <div className="astrolabe-board-main">
          <div className="result-side-card astrolabe-chart-shell">
            <div className="result-side-head">
              <h3>十二宫星盘</h3>
              <p>外圈为十二支宫位，实线与虚线呈现主要吊照关系。</p>
            </div>
            <QizhengChart data={data} />
          </div>
        </div>
        <div className="astrolabe-board-side">
          <div className="result-side-card">
            <div className="result-side-head">
              <h3>星曜落点</h3>
            </div>
            <div className="qizheng-star-list">
              {data.stars.map((star) => (
                <div className="qizheng-star-item" key={star.name}>
                  <span
                    className="qizheng-star-name"
                    style={{ color: getStarStyle(star.name).color }}
                  >
                    {star.name}
                  </span>
                  <strong>
                    {star.signBranch}宫{star.palace} · {star.xiu}
                    {star.xiuDegree.toFixed(2)}°
                  </strong>
                  <small>
                    {star.kind}
                    {star.dignity ? ` · ${star.dignity}` : ''}
                    {star.retrograde ? ' · 逆行' : ' · 顺行'}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <div className="result-side-card">
            <div className="result-side-head">
              <h3>主要吊照</h3>
              <p>按距精确相位的容许度位置排列。</p>
            </div>
            <div className="astrolabe-aspect-list">
              {strongestAspects.map((aspect) => (
                <div
                  className="astrolabe-aspect-item"
                  key={`${aspect.star1}-${aspect.star2}-${aspect.type}`}
                >
                  <strong>
                    {aspect.star1}－{aspect.star2}
                  </strong>
                  <span>
                    {aspect.type} · {aspect.closeness} · 偏差 {aspect.orb.toFixed(2)}°
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="qizheng-detail-grid">
        <div className="result-side-card">
          <div className="result-side-head">
            <h3>神煞</h3>
          </div>
          <div className="result-tag-cloud">
            {data.shensha.map((item) => (
              <span className="result-soft-tag" key={item.name}>
                {item.name} · {item.value}
              </span>
            ))}
          </div>
        </div>
        <div className="result-side-card">
          <div className="result-side-head">
            <h3>紫炁位置</h3>
          </div>
          <div className="result-meta-lines">
            <div>
              <span>恒星黄经</span>
              <strong>{data.ziqi.siderealLongitude.toFixed(4)}°</strong>
            </div>
            <div>
              <span>回归黄经</span>
              <strong>{data.ziqi.tropicalLongitude.toFixed(4)}°</strong>
            </div>
            <div>
              <span>运行方向</span>
              <strong>{data.ziqi.direction}</strong>
            </div>
            <div>
              <span>一周周期</span>
              <strong>{data.ziqiModel.periodDays.toFixed(4)} 日</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
