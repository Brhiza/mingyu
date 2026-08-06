import { useEffect, useMemo, useState } from 'react';
import type { BaZhaiResult } from 'mingyu-core/bazhai';
import type { ResidentialFengshuiResult } from 'mingyu-core/residential-fengshui';
import type { XuanKongResult } from 'mingyu-core/xuankong';
import {
  calculateResidentialChart,
  resolveResidentialDoorDirection,
  type ResidentialMeasurement,
} from '@/lib/residential-fengshui-chart';

export type { ResidentialMeasurement as BazhaiMeasurement } from '@/lib/residential-fengshui-chart';

interface MetaphysicsPanelProps {
  method: 'bazhai' | 'residential';
  birthData?: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    gender: 'male' | 'female';
    latitude?: number;
    longitude?: number;
    timezone?: number;
  } | null;
  embedded?: boolean;
  initialFacingDegree?: string;
  initialHouseYear?: string;
  onDirectionDegreeChange?: (value: string) => void;
  onHouseYearChange?: (value: string) => void;
  onResultChange?: (
    result: ResidentialFengshuiResult,
    measurement: ResidentialMeasurement | null,
  ) => void;
}

const DIRECTIONS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
const LO_SHU_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];

function BaZhaiCompass({
  result,
  measurement,
}: {
  result: BaZhaiResult;
  measurement: ResidentialMeasurement | null;
}) {
  const palaces = result.housePalace ?? result.mingPalace;
  const palaceByDirection = new Map(palaces.map((item) => [item.direction, item]));
  return (
    <svg className="bazhai-compass-svg" viewBox="0 0 400 400" role="img" aria-label="住宅八方盘面">
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

function XuanKongBoard({ xuankong }: { xuankong: XuanKongResult }) {
  const byGong = new Map(xuankong.palaces.map((item) => [item.gong, item]));
  return (
    <div className="result-side-card">
      <div className="result-side-head">
        <h3>玄空九宫盘</h3>
        <p>
          {xuankong.period.label} · 坐{xuankong.sitMountain}向{xuankong.facingMountain}
        </p>
      </div>
      <div className="xuankong-grid" role="img" aria-label="玄空飞星九宫盘">
        {LO_SHU_ORDER.map((gong) => {
          const palace = byGong.get(gong);
          if (!palace) return null;
          return (
            <div
              key={gong}
              className={`xuankong-cell${gong === 5 ? ' is-center' : ''}${
                palace.direction === '南' || palace.direction === '北' ? '' : ''
              }`}
            >
              <div className="xuankong-cell-head">
                <span>{palace.name}</span>
                <strong>{palace.direction}</strong>
              </div>
              <div className="xuankong-stars">
                <span className="xuankong-star xuankong-star-yun" title="运星">
                  {palace.yunStar}
                </span>
                <span className="xuankong-star xuankong-star-shan" title="山星">
                  {palace.shanStar}
                </span>
                <span className="xuankong-star xuankong-star-xiang" title="向星">
                  {palace.xiangStar}
                </span>
              </div>
              <div className="xuankong-cell-caption">运·山·向</div>
            </div>
          );
        })}
      </div>
      <div className="result-meta-lines" style={{ marginTop: 12 }}>
        <div>
          <span>到山到向</span>
          <strong>{xuankong.daoShanXiang.summary}</strong>
        </div>
        <div>
          <span>卦型</span>
          <strong>下卦</strong>
        </div>
        {xuankong.measurement?.candidateMountains?.length ? (
          <div>
            <span>边界候选</span>
            <strong>
              {xuankong.measurement.candidateMountains.map((item) => item.label).join('、')}
            </strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MetaphysicsPanel({
  birthData,
  initialFacingDegree = '',
  initialHouseYear = '',
  onDirectionDegreeChange,
  onHouseYearChange,
  onResultChange,
}: MetaphysicsPanelProps) {
  const [facingDegree, setFacingDegree] = useState(initialFacingDegree);
  const [houseYear, setHouseYear] = useState(initialHouseYear);
  const initialChart = useMemo(() => {
    try {
      if (!birthData && !initialFacingDegree.trim()) {
        return {
          result: null as ResidentialFengshuiResult | null,
          measurement: null as ResidentialMeasurement | null,
          error: '',
        };
      }
      const next = calculateResidentialChart({
        ...(birthData
          ? {
              year: birthData.year,
              month: birthData.month,
              day: birthData.day,
              gender: birthData.gender,
            }
          : {}),
        ...(initialHouseYear.trim() && Number.isInteger(Number(initialHouseYear))
          ? { houseYear: Number(initialHouseYear) }
          : {}),
        ...(initialFacingDegree.trim()
          ? { doorToInteriorDegree: Number(initialFacingDegree) }
          : {}),
      });
      return { result: next.result, measurement: next.measurement, error: '' };
    } catch (currentError) {
      return {
        result: null as ResidentialFengshuiResult | null,
        measurement: null as ResidentialMeasurement | null,
        error: currentError instanceof Error ? currentError.message : '住宅风水排盘失败。',
      };
    }
  }, [birthData, initialFacingDegree, initialHouseYear]);
  const [result, setResult] = useState<ResidentialFengshuiResult | null>(initialChart.result);
  const [measurement, setMeasurement] = useState<ResidentialMeasurement | null>(
    initialChart.measurement,
  );
  const [error, setError] = useState(initialChart.error);

  const parsedHouseYear = useMemo(() => {
    if (!houseYear.trim()) return undefined;
    const value = Number(houseYear);
    return Number.isInteger(value) ? value : undefined;
  }, [houseYear]);

  const directionPreview = useMemo(() => {
    if (!facingDegree.trim()) return { position: null, error: '' };
    const degree = Number(facingDegree);
    try {
      return { position: resolveResidentialDoorDirection(degree), error: '' };
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
    if (directionPreview.error || boundaryMessage) {
      setError(directionPreview.error || boundaryMessage);
      return;
    }

    const hasPerson = Boolean(birthData);
    const hasOrientation = Boolean(facingDegree.trim());
    if (!hasPerson && !hasOrientation) {
      setResult(null);
      setMeasurement(null);
      setError('请补充出生年月日与性别，或填写大门向屋内度数，至少一项。');
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const next = calculateResidentialChart({
          ...(birthData
            ? {
                year: birthData.year,
                month: birthData.month,
                day: birthData.day,
                gender: birthData.gender,
              }
            : {}),
          ...(parsedHouseYear != null ? { houseYear: parsedHouseYear } : {}),
          ...(facingDegree.trim() ? { doorToInteriorDegree: Number(facingDegree) } : {}),
        });
        setResult(next.result);
        setMeasurement(next.measurement);
        setError('');
        onResultChange?.(next.result, next.measurement);
      } catch (currentError) {
        setError(currentError instanceof Error ? currentError.message : '住宅风水排盘失败。');
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    birthData,
    boundaryMessage,
    directionPreview.error,
    facingDegree,
    onResultChange,
    parsedHouseYear,
  ]);

  const bazhai = result?.bazhai ?? null;
  const xuankong = result?.xuankong ?? null;

  return (
    <div className="metaphysics-panel-shell">
      <section className="result-showcase-card bazhai-showcase-card">
        <div className="result-showcase-head">
          <div>
            <p className="result-section-kicker">住宅风水</p>
            <h2>
              {result?.inputSummary.orientationText &&
              result.inputSummary.orientationText !== '未提供山向'
                ? result.inputSummary.orientationText
                : bazhai
                  ? measurement
                    ? result?.inputSummary.orientationText || '命宅合参'
                    : '个人八宅方位'
                  : '人宅与宅运分层排盘'}
            </h2>
          </div>
          <div className="result-chip-row">
            {bazhai ? <span className="result-chip">命卦 {bazhai.mingGua}</span> : null}
            {bazhai?.houseGua ? <span className="result-chip">宅卦 {bazhai.houseGua}</span> : null}
            {xuankong ? <span className="result-chip">{xuankong.period.label}</span> : null}
            {!bazhai && !xuankong ? <span className="result-chip">待补充资料</span> : null}
          </div>
        </div>

        <div className="result-summary-grid">
          <div className="result-stat-card result-stat-card-accent">
            <span>人宅层</span>
            <strong>{bazhai ? bazhai.mingGua : '待补出生'}</strong>
            <small>{bazhai ? bazhai.mingGroup : '年月日+性别即可'}</small>
          </div>
          <div className="result-stat-card">
            <span>宅卦</span>
            <strong>{bazhai?.houseGua ?? (xuankong ? '可由山向回填' : '待补充')}</strong>
            <small>{bazhai?.houseGroup ?? '填写角度后自动生成'}</small>
          </div>
          <div className="result-stat-card">
            <span>命宅关系</span>
            <strong>{bazhai && measurement ? bazhai.match : bazhai ? '待合参' : '仅宅运'}</strong>
            <small>{xuankong ? xuankong.daoShanXiang.summary : '可先只看宅运'}</small>
          </div>
          <div className="result-stat-card">
            <span>住宅坐向</span>
            <strong>
              {measurement
                ? `${measurement.sitMountain}山${measurement.facingMountain}向`
                : xuankong
                  ? `坐${xuankong.sitMountain}向${xuankong.facingMountain}`
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
              <h3>{bazhai ? (measurement ? '命宅八方盘' : '个人八方盘') : '宅运优先'}</h3>
              <p>
                {bazhai
                  ? measurement
                    ? '宅卦八方游年已生成，箭头指向从大门进入屋内的实测方向。'
                    : '先按命卦显示个人四吉四凶方；补充住宅角度后自动切换为命宅合参。'
                  : '没有出生信息时，可只看玄空宅运；补出生后会自动合参八宅。'}
              </p>
            </div>
            {bazhai ? (
              <BaZhaiCompass result={bazhai} measurement={measurement} />
            ) : (
              <div className="metaphysics-direction-preview">
                <span>当前仅展示宅运结构。补上出生年月日与性别后，会生成人宅八方盘。</span>
              </div>
            )}
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
                    {birthData
                      ? `${birthData.year} 年 ${birthData.month} 月 ${birthData.day} 日 · ${
                          birthData.gender === 'male' ? '男' : '女'
                        }`
                      : '未提供；仍可只排宅运'}
                  </strong>
                </div>
                {bazhai ? (
                  <div>
                    <span>命卦分组</span>
                    <strong>
                      {bazhai.mingGua}命 · {bazhai.mingGroup}
                    </strong>
                  </div>
                ) : null}
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
                  </>
                ) : null}
              </div>
            </div>
            <div className="result-side-card bazhai-direction-card">
              <div className="result-side-head">
                <h3>{measurement || facingDegree.trim() ? '补充住宅信息' : '补充住宅角度'}</h3>
                <p>有山向可先看宅运；有出生可看人宅。两边都有时自动合参。</p>
              </div>
              <label className="form-item" htmlFor="metaphysics-house-year">
                <span>建造或起运年</span>
                <input
                  id="metaphysics-house-year"
                  className="form-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="9999"
                  step="1"
                  value={houseYear}
                  placeholder={`默认 ${new Date().getFullYear()}`}
                  onChange={(event) => {
                    const value = event.target.value;
                    setHouseYear(value);
                    onHouseYearChange?.(value);
                  }}
                />
                <small className="birth-time-hint">不填则按当前年看玄空宅运。</small>
              </label>
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
                  <span>
                    {birthData
                      ? '不填写也可查看个人命卦八方；补角度后会自动合参玄空。'
                      : '没有出生信息时，至少填写大门度数，才能生成宅运盘。'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {xuankong ? <XuanKongBoard xuankong={xuankong} /> : null}

        {result?.agreements?.length ? (
          <div className="result-side-card">
            <div className="result-side-head">
              <h3>合参要点</h3>
              <p>八宅与玄空分层并观，有分歧时分述，不硬统一。</p>
            </div>
            <div className="result-meta-lines">
              {result.agreements.map((item) => (
                <div key={`${item.level}-${item.title}`}>
                  <span>{item.level}</span>
                  <strong>
                    {item.title}：{item.detail}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {bazhai ? (
          <div className="bazhai-result-grid">
            <div className="result-side-card">
              <div className="result-side-head">
                <h3>四吉方</h3>
                <p>{measurement ? '当前宅卦可优先利用的方向。' : '个人命卦可优先利用的方向。'}</p>
              </div>
              <div className="result-tag-cloud">
                {bazhai.luckyDirections.map((item) => (
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
                {bazhai.unluckyDirections.map((item) => (
                  <span className="result-soft-tag" key={`${item.direction}-${item.label}`}>
                    {item.direction} · {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="result-side-card">
          <div className="result-side-head">
            <h3>{result ? '合参建议' : '基础说明'}</h3>
          </div>
          {(result?.advice ?? ['请补充出生信息或大门角度后查看住宅风水。']).map((item) => (
            <p className="bazhai-advice" key={item}>
              {item}
            </p>
          ))}
          {bazhai?.birthYearBoundaryNote ? (
            <p className="bazhai-boundary-note">{bazhai.birthYearBoundaryNote}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
