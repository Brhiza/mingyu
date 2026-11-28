import * as React from 'react';
import { Badge } from '../../../components/ui';

export interface HouseOrientationDiagramProps {
  facingDegree: number;
  measurementTarget: 'balcony' | 'door';
  directionLabel: string;
  isSensitive?: boolean;
}

export function HouseOrientationDiagram({
  facingDegree,
  measurementTarget,
  directionLabel,
  isSensitive = false,
}: HouseOrientationDiagramProps) {
  const normalizedDeg = Math.round((((facingDegree % 360) + 360) % 360) * 10) / 10;
  const targetLabel = measurementTarget === 'door' ? '大门外' : '阳台/窗外';

  return (
    <div className="fs-orientation-diagram">
      <svg
        viewBox="0 0 260 260"
        role="img"
        aria-label={`房屋朝向示意图：${directionLabel}，面向${normalizedDeg}°`}
        className="h-[220px] w-[220px] max-w-full select-none"
      >
        {/* 外圈固定罗盘方位（上北下南） */}
        <circle
          cx="130"
          cy="130"
          r="112"
          fill="var(--surface-soft)"
          stroke="var(--border-soft)"
          strokeWidth="1.5"
        />
        <circle
          cx="130"
          cy="130"
          r="92"
          fill="var(--surface-elevated-strong)"
          stroke="var(--border-soft)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />

        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const x1 = 130 + Math.cos(rad) * 106;
          const y1 = 130 + Math.sin(rad) * 106;
          const x2 = 130 + Math.cos(rad) * 112;
          const y2 = 130 + Math.sin(rad) * 112;
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--text-muted)"
              strokeWidth={deg % 90 === 0 ? '2' : '1'}
            />
          );
        })}

        <text x="130" y="14" fill="var(--danger-text)" fontSize="11.5" fontWeight="800" textAnchor="middle">
          北 0°
        </text>
        <text x="242" y="134" fill="var(--text-muted)" fontSize="11" fontWeight="700" textAnchor="middle">
          东 90°
        </text>
        <text x="130" y="253" fill="var(--text-muted)" fontSize="11" fontWeight="700" textAnchor="middle">
          南 180°
        </text>
        <text x="18" y="134" fill="var(--text-muted)" fontSize="11" fontWeight="700" textAnchor="middle">
          西 270°
        </text>

        {/* 随面向角度旋转的房子与测量站位箭头 */}
        <g
          transform={`rotate(${normalizedDeg} 130 130)`}
          style={{ transition: 'transform 180ms ease-out' }}
        >
          {/* 房屋轮廓（上方为朝向开口，下方为坐山实墙） */}
          <rect
            x="92"
            y="84"
            width="76"
            height="92"
            rx="10"
            fill="var(--surface-soft)"
            stroke="var(--border-contrast)"
            strokeWidth="2"
          />
          {/* 坐山厚背墙 */}
          <line
            x1="96"
            y1="176"
            x2="164"
            y2="176"
            stroke="var(--text-strong)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          {/* 朝向开口（阳台/大门） */}
          <line
            x1="106"
            y1="84"
            x2="154"
            y2="84"
            stroke="var(--accent-strong)"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* 站在屋内的测量人 + 手机指南针方向箭头 */}
          <circle cx="130" cy="142" r="7" fill="var(--accent-strong)" />
          <path
            d="M 118 158 C 118 150, 142 150, 142 158"
            fill="var(--accent-strong)"
            fillOpacity="0.85"
          />

          <line
            x1="130"
            y1="132"
            x2="130"
            y2="46"
            stroke="var(--danger-text)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M 130 34 L 122 50 L 130 46 L 138 50 Z" fill="var(--danger-text)" />

          {/* 面向目标指示牌（反向旋转确保文字在任何角度下均正向可读） */}
          <g transform={`rotate(${-normalizedDeg} 130 64)`}>
            <rect
              x="98"
              y="55"
              width="64"
              height="18"
              rx="9"
              fill="var(--surface-elevated-strong)"
              stroke="var(--accent)"
              strokeWidth="1.2"
            />
            <text
              x="130"
              y="64"
              fill="var(--accent-strong)"
              fontSize="10"
              fontWeight="800"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {targetLabel}
            </text>
          </g>
        </g>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Badge variant="accent">{`${directionLabel} · 面向 ${normalizedDeg}°`}</Badge>
        {isSensitive ? (
          <Badge variant="warn">靠近分界线，建议避开铁门退两步再测</Badge>
        ) : null}
      </div>
    </div>
  );
}
