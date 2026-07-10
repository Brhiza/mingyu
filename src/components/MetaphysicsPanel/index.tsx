import { useEffect, useMemo, useState } from 'react';
import type { BaZhaiResult } from '@core/ba_zhai';
import {
  calculateBazhaiBaseChart,
  calculateBazhaiChart,
  resolveBazhaiDoorDirection,
  type BazhaiMeasurement,
} from '@/lib/bazhai-chart';

export type { BazhaiMeasurement } from '@/lib/bazhai-chart';

interface MetaphysicsPanelProps {
  method: 'bazhai';
  birthData: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    gender: 'male' | 'female';
    latitude?: number;
    longitude?: number;
    timezone?: number;
  };
  embedded?: boolean;
  initialFacingDegree?: string;
  onDirectionDegreeChange?: (value: string) => void;
  onResultChange?: (result: BaZhaiResult, measurement: BazhaiMeasurement | null) => void;
}

const DIRECTIONS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

function BaZhaiCompass({
  result,
  measurement,
}: {
  result: BaZhaiResult;
  measurement: BazhaiMeasurement | null;
}) {
  const palaces = result.housePalace ?? result.mingPalace;
  const palaceByDirection = new Map(palaces.map((item) => [item.direction, item]));
  return (
    <svg
      className="bazhai-compass-svg"
      viewBox="0 0 400 400"
      role="img"
      aria-label="八宅八方专业盘面"
    >
      <circle cx="200" cy="200" r="184" className="bazhai-ring" />
      <circle cx="200" cy="200" r="128" className="bazhai-ring" />
      <circle cx="200" cy="200" r="67" className="bazhai-ring bazhai-ring-core" />
      {DIRECTIONS.map((direction, index) => {
        const angle = ((index * 45 - 90) * Math.PI) / 180;
        const x = 200 + Math.cos(angle) * 153;
        const y = 200 + Math.sin(angle) * 153;
        const palace = palaceByDirection.get(direction);
        const boundaryAngle = ((index * 45 - 22.5 - 90) * Math.PI) / 180;
        return (
          <g key={direction}>
            <line
              x1="200"
              y1="200"
              x2={200 + Math.cos(boundaryAngle) * 184}
              y2={200 + Math.sin(boundaryAngle) * 184}
              className="bazhai-sector-line"
            />
            <text
              x={x}
              y={y}
              className={`bazhai-direction-label ${palace?.luck === '吉' ? 'is-lucky' : 'is-unlucky'}`}
            >
              <tspan>{direction}</tspan>
              <tspan x={x} dy="15">
                {palace?.label ?? '—'}
              </tspan>
              <tspan x={x} dy="13">
                {palace?.gua ?? ''}宫
              </tspan>
            </text>
          </g>
        );
      })}
      {measurement ? (
        <g transform={`rotate(${measurement.measuredDegree - 90} 200 200)`}>
          <path d="M 200 20 L 192 42 L 208 42 Z" className="bazhai-facing-arrow" />
          <line x1="200" y1="42" x2="200" y2="72" className="bazhai-facing-line" />
        </g>
      ) : null}
      <text x="200" y="184" className="bazhai-core-title">
        {result.houseGua ? `${result.houseGua}宅` : `${result.mingGua}命`}
      </text>
      <text x="200" y="205" className="bazhai-core-subtitle">
        {measurement
          ? `${measurement.sitMountain}山${measurement.facingMountain}向`
          : result.mingGroup}
      </text>
      <text x="200" y="224" className="bazhai-core-subtitle">
        {measurement ? `命卦 ${result.mingGua}` : '个人八方盘'}
      </text>
    </svg>
  );
}

export function MetaphysicsPanel({
  birthData,
  initialFacingDegree = '',
  onDirectionDegreeChange,
  onResultChange,
}: MetaphysicsPanelProps) {
  const baseResult = useMemo(() => calculateBazhaiBaseChart(birthData), [birthData]);
  const [facingDegree, setFacingDegree] = useState(initialFacingDegree);
  const [result, setResult] = useState<BaZhaiResult>(baseResult);
  const [measurement, setMeasurement] = useState<BazhaiMeasurement | null>(null);
  const [error, setError] = useState('');

  const directionPreview = useMemo(() => {
    if (!facingDegree.trim()) return { position: null, error: '' };
    const degree = Number(facingDegree);
    try {
      return { position: resolveBazhaiDoorDirection(degree), error: '' };
    } catch (currentError) {
      return {
        position: null,
        error: currentError instanceof Error ? currentError.message : '角度无效。',
      };
    }
  }, [facingDegree]);
  const boundaryMessage = useMemo(() => {
    const facing = directionPreview.position?.facing;
    if (!facing?.isBoundary || !facing.boundaryMountains) return '';
    return `当前度数位于${facing.boundaryMountains[0]}向与${facing.boundaryMountains[1]}向的分界线，请重新测量并填写稍偏离分界线的度数。`;
  }, [directionPreview]);

  useEffect(() => {
    if (!facingDegree.trim()) {
      setResult(baseResult);
      setMeasurement(null);
      setError('');
      onResultChange?.(baseResult, null);
      return;
    }
    if (directionPreview.error || boundaryMessage) {
      setError(directionPreview.error || boundaryMessage);
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        const next = calculateBazhaiChart(birthData, Number(facingDegree));
        setResult(next.result);
        setMeasurement(next.measurement);
        setError('');
        onResultChange?.(next.result, next.measurement);
      } catch (currentError) {
        setError(currentError instanceof Error ? currentError.message : '住宅角度换算失败。');
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    baseResult,
    birthData,
    boundaryMessage,
    directionPreview.error,
    facingDegree,
    onResultChange,
  ]);

  return (
    <div className="metaphysics-panel-shell">
      <section className="result-showcase-card bazhai-showcase-card">
        <div className="result-showcase-head">
          <div>
            <p className="result-section-kicker">八宅结果</p>
            <h2>{measurement?.label ?? '个人八宅方位'}</h2>
          </div>
          <div className="result-chip-row">
            <span className="result-chip">命卦 {result.mingGua}</span>
            {result.houseGua ? (
              <span className="result-chip">宅卦 {result.houseGua}</span>
            ) : (
              <span className="result-chip">待补住宅角度</span>
            )}
          </div>
        </div>
        <div className="result-summary-grid">
          <div className="result-stat-card result-stat-card-accent">
            <span>命卦</span>
            <strong>{result.mingGua}</strong>
            <small>{result.mingGroup}</small>
          </div>
          <div className="result-stat-card">
            <span>宅卦</span>
            <strong>{result.houseGua ?? '待补充'}</strong>
            <small>{result.houseGroup ?? '填写角度后自动生成'}</small>
          </div>
          <div className="result-stat-card">
            <span>命宅关系</span>
            <strong>{measurement ? result.match : '待合参'}</strong>
            <small>{measurement ? '结合实际动线取舍' : '个人八方信息已生成'}</small>
          </div>
          <div className="result-stat-card">
            <span>住宅坐向</span>
            <strong>
              {measurement
                ? `${measurement.sitMountain}山${measurement.facingMountain}向`
                : '尚未测量'}
            </strong>
            <small>
              {measurement ? `入户读数 ${measurement.measuredDegree}°` : '可在下方补充'}
            </small>
          </div>
        </div>
        <div className="bazhai-board-layout">
          <div className="result-side-card astrolabe-chart-shell">
            <div className="result-side-head">
              <h3>{measurement ? '命宅八方盘' : '个人八方盘'}</h3>
              <p>
                {measurement
                  ? '宅卦八方游年已生成，箭头指向从大门进入屋内的实测方向。'
                  : '先按命卦显示个人四吉四凶方；补充住宅角度后自动切换为命宅合参。'}
              </p>
            </div>
            <BaZhaiCompass result={result} measurement={measurement} />
          </div>
          <div className="bazhai-board-legend">
            <div className="result-side-card">
              <div className="result-side-head">
                <h3>盘面说明</h3>
              </div>
              <div className="result-meta-lines">
                <div>
                  <span>出生资料</span>
                  <strong>
                    {birthData.year} 年 {birthData.month} 月 {birthData.day} 日 ·{' '}
                    {birthData.gender === 'male' ? '男' : '女'}
                  </strong>
                </div>
                <div>
                  <span>命卦分组</span>
                  <strong>
                    {result.mingGua}命 · {result.mingGroup}
                  </strong>
                </div>
                {measurement ? (
                  <>
                    <div>
                      <span>大门朝向屋内</span>
                      <strong>{measurement.measuredDegree}°</strong>
                    </div>
                    <div>
                      <span>传统坐向</span>
                      <strong>
                        {measurement.sitDegree}° {measurement.sitMountain}山 ·{' '}
                        {measurement.facingDegree}° {measurement.facingMountain}向
                      </strong>
                    </div>
                    <div>
                      <span>命宅配合</span>
                      <strong>{result.match}</strong>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            <div className="result-side-card bazhai-direction-card">
              <div className="result-side-head">
                <h3>补充住宅角度</h3>
                <p>可选；填写后自动保存并生成宅卦。</p>
              </div>
              <label className="form-item" htmlFor="metaphysics-facing-degree">
                <span>从大门面向屋内的度数</span>
                <input
                  id="metaphysics-facing-degree"
                  className="form-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="360"
                  step="0.1"
                  value={facingDegree}
                  placeholder="例如：0"
                  onChange={(event) => {
                    const value = event.target.value;
                    setFacingDegree(value);
                    onDirectionDegreeChange?.(value);
                  }}
                />
                <small className="birth-time-hint">
                  站在大门处面向屋内，用手机指南针连续测三次，填写接近的平均度数。
                </small>
              </label>
              {error ? (
                <div className="form-error-text">{error}</div>
              ) : directionPreview.position ? (
                <div className="metaphysics-direction-preview">
                  <strong>{directionPreview.position.label}</strong>
                  <span>
                    坐山 {directionPreview.position.sit.degree}°{' '}
                    {directionPreview.position.sit.mountain}山；传统朝向{' '}
                    {directionPreview.position.facing.degree}°{' '}
                    {directionPreview.position.facing.mountain}向。
                  </span>
                </div>
              ) : (
                <div className="metaphysics-direction-preview">
                  <span>不填写也可查看个人命卦八方信息。</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="bazhai-result-grid">
          <div className="result-side-card">
            <div className="result-side-head">
              <h3>四吉方</h3>
              <p>{measurement ? '当前宅卦可优先利用的方向。' : '个人命卦可优先利用的方向。'}</p>
            </div>
            <div className="result-tag-cloud">
              {result.luckyDirections.map((item) => (
                <span
                  className="result-soft-tag result-soft-tag-strong"
                  key={`${item.direction}-${item.label}`}
                >
                  {item.direction} · {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="result-side-card">
            <div className="result-side-head">
              <h3>四凶方</h3>
              <p>布置时需要谨慎权衡的方向。</p>
            </div>
            <div className="result-tag-cloud">
              {result.unluckyDirections.map((item) => (
                <span className="result-soft-tag" key={`${item.direction}-${item.label}`}>
                  {item.direction} · {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="result-side-card">
          <div className="result-side-head">
            <h3>{measurement ? '命宅建议' : '基础说明'}</h3>
          </div>
          <p className="bazhai-advice">
            {measurement
              ? result.matchAdvice
              : '当前先按个人命卦八宫查看方位取舍；补充住宅角度后，会进一步结合宅卦判断命宅是否相合。'}
          </p>
          <p className="bazhai-boundary-note">{result.birthYearBoundaryNote}</p>
        </div>
      </section>
    </div>
  );
}
