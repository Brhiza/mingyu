import * as React from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ImageUp,
  MapPin,
  Move,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { Badge, Button, Card, Input, Select, Slider } from '../../../components/ui';
import { copyPromptText } from '../../../external-ai-share';
import { cn } from '../../../lib/utils';
import { ExternalAiShareButtons } from '../shared/ExternalAiShareButtons';
import {
  buildComprehensiveFengShuiPrompt,
  computeAnnualFengShuiSha,
  evaluateFloorPlanMarkers,
  type WorkbenchSnapshot,
} from './fengshui-engine';
import {
  FLOOR_MARKER_META,
  PLAN_DIRECTION_OPTIONS,
  clampNumber,
  deleteFloorPlanImageBlob,
  loadFloorPlanImageBlob,
  saveFloorPlanImageBlob,
  type FloorMarkerKind,
  type FloorPlanMarker,
  type HouseProfile,
  type PlanDirection,
} from './fengshui-store';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const EXPORT_MAX_EDGE = 6000;
const MOUNTAIN_LABELS = [
  '子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙',
  '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬',
];
const SECTOR_LABELS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'] as const;
const TRIGRAM_LABELS = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'] as const;

function compassPoint(index: number, total: number, radius: number, offset = -90) {
  const angle = ((offset + (index * 360) / total) * Math.PI) / 180;
  return { x: 200 + Math.cos(angle) * radius, y: 200 + Math.sin(angle) * radius };
}

function sectorPath(
  centerX: number,
  centerY: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = centerX + Math.cos(toRad(startDeg)) * outerR;
  const y1 = centerY + Math.sin(toRad(startDeg)) * outerR;
  const x2 = centerX + Math.cos(toRad(endDeg)) * outerR;
  const y2 = centerY + Math.sin(toRad(endDeg)) * outerR;
  const x3 = centerX + Math.cos(toRad(endDeg)) * innerR;
  const y3 = centerY + Math.sin(toRad(endDeg)) * innerR;
  const x4 = centerX + Math.cos(toRad(startDeg)) * innerR;
  const y4 = centerY + Math.sin(toRad(startDeg)) * innerR;
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = url;
  });
}

export function FloorPlanOverlayTab({
  profile,
  snapshot,
  isDefaultProfile,
  onUpdateProfile,
}: {
  profile: HouseProfile;
  snapshot: WorkbenchSnapshot;
  isDefaultProfile: boolean;
  onUpdateProfile: (updater: (prev: HouseProfile) => HouseProfile) => void;
}) {
  const fp = profile.floorPlan;
  const [imageUrl, setImageUrl] = React.useState('');
  const [stageSize, setStageSize] = React.useState({ width: 0, height: 0 });
  const [activeMarkerTool, setActiveMarkerTool] = React.useState<FloorMarkerKind | null>(null);
  const [showProOptions, setShowProOptions] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [isExporting, setIsExporting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const compassSvgRef = React.useRef<SVGSVGElement | null>(null);
  const draggingCompassPointerRef = React.useRef<number | null>(null);
  const draggingMarkerRef = React.useRef<{ id: string; pointerId: number } | null>(null);
  const activeUrlRef = React.useRef('');

  const hasImage = Boolean(imageUrl && fp.imageWidth > 0 && fp.imageHeight > 0);
  const canGenerate = hasImage && fp.topDirection !== 'unknown';
  const selectedDirection =
    PLAN_DIRECTION_OPTIONS.find((item) => item.value === fp.topDirection) ??
    PLAN_DIRECTION_OPTIONS[1]!;
  const compassRotation = selectedDirection.rotation + fp.fineAngle;
  const renderedCompassSize = Math.max(
    80,
    (Math.min(stageSize.width, stageSize.height) * fp.compassSize) / 100,
  );

  const palaceByDir = React.useMemo(
    () => new Map(snapshot.palaces.map((p) => [p.direction, p])),
    [snapshot.palaces],
  );

  const markerReports = React.useMemo(
    () => evaluateFloorPlanMarkers(profile, snapshot),
    [profile, snapshot],
  );
  const markerReportMap = React.useMemo(
    () => new Map(markerReports.map((r) => [r.marker.id, r])),
    [markerReports],
  );

  const annualSha = React.useMemo(
    () => computeAnnualFengShuiSha(profile.flowYear),
    [profile.flowYear],
  );

  const promptText = React.useMemo(
    () => buildComprehensiveFengShuiPrompt(profile, snapshot, annualSha, markerReports),
    [profile, snapshot, annualSha, markerReports],
  );

  React.useEffect(() => {
    let alive = true;
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = '';
    }
    setImageUrl('');
    loadFloorPlanImageBlob(profile.id, isDefaultProfile)
      .then(async (blob) => {
        if (!alive || !blob) return;
        const url = URL.createObjectURL(blob);
        try {
          const img = await loadHtmlImage(url);
          if (!alive) {
            URL.revokeObjectURL(url);
            return;
          }
          if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
          activeUrlRef.current = url;
          setImageUrl(url);
          onUpdateProfile((prev) => {
            if (
              prev.floorPlan.imageWidth === img.naturalWidth &&
              prev.floorPlan.imageHeight === img.naturalHeight &&
              prev.floorPlan.imageName
            ) {
              return prev;
            }
            return {
              ...prev,
              floorPlan: {
                ...prev.floorPlan,
                imageName: prev.floorPlan.imageName || '已保存户型图',
                imageWidth: img.naturalWidth,
                imageHeight: img.naturalHeight,
              },
            };
          });
        } catch {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const syncSize = () => {
      const rect = el.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };
    syncSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasImage, fp.imageWidth, fp.imageHeight]);

  const updateFloorPlan = (patch: Partial<typeof fp>) => {
    onUpdateProfile((prev) => ({
      ...prev,
      floorPlan: { ...prev.floorPlan, ...patch },
    }));
  };

  const acceptFile = async (file: File) => {
    setMessage('');
    if (
      !/\.(png|jpe?g|webp)$/i.test(file.name) &&
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    ) {
      setMessage('请选择 PNG、JPEG 或 WebP 图片。');
      return;
    }
    if (!file.size || file.size > MAX_UPLOAD_BYTES) {
      setMessage('图片为空或超过 50MB。');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(url);
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('无效图片');
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = url;
      setImageUrl(url);
      updateFloorPlan({
        imageName: file.name.slice(0, 180),
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight,
        compassCenterX: 50,
        compassCenterY: 50,
        topDirection: fp.topDirection === 'unknown' ? 'north' : fp.topDirection,
        fineAngle: 0,
      });
      await saveFloorPlanImageBlob(profile.id, file);
      setMessage('户型图已载入，点下方房间按钮即可在图上标出位置。');
    } catch {
      URL.revokeObjectURL(url);
      setMessage('图片解析失败，请换一张图片。');
    }
  };

  const handleMoveCompass = (clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const halfX = (renderedCompassSize / rect.width) * 50;
    const halfY = (renderedCompassSize / rect.height) * 50;
    updateFloorPlan({
      compassCenterX: clampNumber(((clientX - rect.left) / rect.width) * 100, 50, halfX, 100 - halfX),
      compassCenterY: clampNumber(((clientY - rect.top) / rect.height) * 100, 50, halfY, 100 - halfY),
    });
  };

  const handleMoveMarker = (markerId: string, clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = clampNumber(((clientX - rect.left) / rect.width) * 100, 50, 2, 98);
    const y = clampNumber(((clientY - rect.top) / rect.height) * 100, 50, 2, 98);
    updateFloorPlan({
      markers: fp.markers.map((m) => (m.id === markerId ? { ...m, x, y } : m)),
    });
  };

  const handleStageClickForMarker = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeMarkerTool || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = clampNumber(((e.clientX - rect.left) / rect.width) * 100, 50, 3, 97);
    const y = clampNumber(((e.clientY - rect.top) / rect.height) * 100, 50, 3, 97);
    const meta = FLOOR_MARKER_META.find((k) => k.kind === activeMarkerTool)!;
    const nextMarker: FloorPlanMarker = {
      id: `mk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      kind: activeMarkerTool,
      label: meta.label,
      x,
      y,
    };
    updateFloorPlan({ markers: [...fp.markers, nextMarker], showMarkers: true });
    setActiveMarkerTool(null);
  };

  const handleExport = async () => {
    if (!canGenerate || !compassSvgRef.current) {
      setMessage('请先确认图纸上方朝向。');
      return;
    }
    setIsExporting(true);
    try {
      const source = await loadHtmlImage(imageUrl);
      const scale = Math.min(1, EXPORT_MAX_EDGE / Math.max(source.naturalWidth, source.naturalHeight));
      const width = Math.max(1, Math.round(source.naturalWidth * scale));
      const height = Math.max(1, Math.round(source.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('浏览器不支持导出');
      ctx.drawImage(source, 0, 0, width, height);

      if (fp.showNineGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(123, 49, 72, 0.5)';
        ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.0025));
        ctx.setLineDash([12, 8]);
        for (const ratio of [1 / 3, 2 / 3]) {
          ctx.beginPath();
          ctx.moveTo(width * ratio, 0);
          ctx.lineTo(width * ratio, height);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, height * ratio);
          ctx.lineTo(width, height * ratio);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (fp.showCompass || fp.showBazhaiLayer || fp.showXuankongLayer) {
        const svgClone = compassSvgRef.current.cloneNode(true) as SVGSVGElement;
        svgClone.removeAttribute('style');
        svgClone.removeAttribute('class');
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgClone.setAttribute('width', '400');
        svgClone.setAttribute('height', '400');
        const svgBlob = new Blob([new XMLSerializer().serializeToString(svgClone)], {
          type: 'image/svg+xml;charset=utf-8',
        });
        const svgUrl = URL.createObjectURL(svgBlob);
        try {
          const compassImg = await loadHtmlImage(svgUrl);
          const diameter = (Math.min(width, height) * fp.compassSize) / 100;
          const cx = (width * fp.compassCenterX) / 100;
          const cy = (height * fp.compassCenterY) / 100;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((compassRotation * Math.PI) / 180);
          ctx.globalAlpha = fp.compassOpacity / 100;
          ctx.drawImage(compassImg, -diameter / 2, -diameter / 2, diameter, diameter);
          ctx.restore();
        } finally {
          URL.revokeObjectURL(svgUrl);
        }
      }

      if (fp.showMarkers && fp.markers.length > 0) {
        const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.022));
        ctx.font = `700 ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const m of fp.markers) {
          const rep = markerReportMap.get(m.id);
          const px = (width * m.x) / 100;
          const py = (height * m.y) / 100;
          const text = `${m.label}${rep && rep.direction !== '待定' ? `·${rep.direction}` : ''}`;
          const tw = ctx.measureText(text).width + fontSize * 1.1;
          const th = fontSize * 1.65;
          ctx.fillStyle =
            rep?.status === '宜' ? '#1b6e4a' : rep?.status === '慎' ? '#a93226' : '#5b5360';
          ctx.beginPath();
          ctx.roundRect(px - tw / 2, py - th / 2, tw, th, th / 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1.5, fontSize * 0.12);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, px, py);
        }
      }

      const outBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片导出失败'))), 'image/png');
      });
      const outUrl = URL.createObjectURL(outBlob);
      const a = document.createElement('a');
      const base = (
        profile.name.trim() ||
        fp.imageName.replace(/\.[^.]+$/, '') ||
        '户型图'
      ).replace(/[\\/:*?"<>|]+/g, '-');
      a.href = outUrl;
      a.download = `${base}-户型吉凶图.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(outUrl), 1000);
      setMessage('带标注户型图已下载。');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (await copyPromptText(promptText)) {
      setCopied(true);
      setMessage('提示词已复制，可与户型图一并发给 AI 看图分析。');
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleRemoveImage = async () => {
    if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
    activeUrlRef.current = '';
    setImageUrl('');
    updateFloorPlan({ imageName: '', imageWidth: 0, imageHeight: 0 });
    await deleteFloorPlanImageBlob(profile.id, isDefaultProfile);
    setMessage('户型图已移除。');
  };

  return (
    <div className="grid gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void acceptFile(file);
        }}
      />

      {!hasImage ? (
        <Card className="p-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer?.files?.[0];
              if (file) void acceptFile(file);
            }}
            className="flex min-h-[210px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-[var(--border-contrast)] bg-[var(--surface-soft)] p-6 text-center hover:border-[var(--accent)]"
          >
            <ImageUp className="h-7 w-7 text-[var(--accent-strong)]" />
            <strong className="text-sm text-[var(--text-strong)]">上传户型图</strong>
            <span className="text-xs text-[var(--text-muted)]">PNG / JPEG / WebP，最大 50MB</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>选择图片</span>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="grid gap-3 p-3.5 text-xs">
          {/* 1. 一行简洁操作条 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[var(--text-strong)]">图纸上方是</span>
              <Select
                className="min-h-8 w-36 py-1 text-xs"
                aria-label="图纸上方朝向"
                value={fp.topDirection}
                onChange={(e) =>
                  updateFloorPlan({ topDirection: e.target.value as PlanDirection })
                }
              >
                {PLAN_DIRECTION_OPTIONS.filter((o) => o.value !== 'unknown').map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value === 'north' ? '北（上北下南）' : opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>换图</span>
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={() => void handleRemoveImage()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>移除</span>
              </Button>
            </div>
          </div>

          {/* 2. 房间标点快捷条 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 font-bold text-[var(--text-muted)]">
              <MapPin className="h-3.5 w-3.5" />
              <span>标出房间：</span>
            </span>
            {FLOOR_MARKER_META.map((item) => {
              const active = activeMarkerTool === item.kind;
              return (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => setActiveMarkerTool(active ? null : item.kind)}
                  className={cn('fs-profile-chip', active && 'is-active')}
                >
                  <span>{active ? `点图放置「${item.label}」` : `+ ${item.label}`}</span>
                </button>
              );
            })}
          </div>

          {/* 3. 主画布 */}
          <div
            ref={stageRef}
            onClick={handleStageClickForMarker}
            className={cn(
              'fs-floor-stage',
              activeMarkerTool && 'cursor-crosshair ring-2 ring-[var(--accent)]',
            )}
            style={{ aspectRatio: `${fp.imageWidth} / ${fp.imageHeight}` }}
          >
            <img
              src={imageUrl}
              alt="户型图"
              draggable={false}
              className="pointer-events-none block h-full w-full select-none object-contain"
            />

            {fp.showNineGrid ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 grid grid-cols-3 grid-rows-3"
              >
                {Array.from({ length: 9 }, (_, idx) => (
                  <div
                    key={idx}
                    className="border border-dashed border-[color-mix(in_srgb,var(--accent-strong)_45%,transparent)]"
                  />
                ))}
              </div>
            ) : null}

            {(fp.showCompass || fp.showBazhaiLayer || fp.showXuankongLayer) ? (
              <svg
                ref={compassSvgRef}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 400 400"
                role="img"
                aria-label="户型方位叠盘"
                onPointerDown={(e) => {
                  if (activeMarkerTool) return;
                  e.preventDefault();
                  draggingCompassPointerRef.current = e.pointerId;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handleMoveCompass(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (draggingCompassPointerRef.current === e.pointerId) {
                    handleMoveCompass(e.clientX, e.clientY);
                  }
                }}
                onPointerUp={(e) => {
                  if (draggingCompassPointerRef.current === e.pointerId) {
                    handleMoveCompass(e.clientX, e.clientY);
                    draggingCompassPointerRef.current = null;
                  }
                }}
                onPointerCancel={() => {
                  draggingCompassPointerRef.current = null;
                }}
                className={cn(
                  'absolute z-10 select-none touch-none',
                  activeMarkerTool
                    ? 'pointer-events-none'
                    : 'cursor-grab active:cursor-grabbing',
                )}
                style={{
                  left: `${fp.compassCenterX}%`,
                  top: `${fp.compassCenterY}%`,
                  width: `${renderedCompassSize}px`,
                  opacity: fp.compassOpacity / 100,
                  transform: `translate(-50%, -50%) rotate(${compassRotation}deg)`,
                }}
              >
                <circle
                  cx="200"
                  cy="200"
                  r="197"
                  fill="#fffdf8"
                  fillOpacity={fp.showCompass ? '0.86' : '0.35'}
                  stroke="#6d4b59"
                  strokeWidth="3.5"
                />
                <circle cx="200" cy="200" r="178" fill="none" stroke="#866774" strokeWidth="1.2" />
                <circle cx="200" cy="200" r="151" fill="none" stroke="#866774" strokeWidth="1.2" />
                <circle
                  cx="200"
                  cy="200"
                  r="124"
                  fill="#f6eee5"
                  fillOpacity="0.42"
                  stroke="#866774"
                  strokeWidth="1.2"
                />

                {fp.showBazhaiLayer
                  ? SECTOR_LABELS.map((label, idx) => {
                      const palace = palaceByDir.get(label);
                      const isGood = palace?.bazhai?.mingLuck === '吉';
                      const startDeg = -112.5 + idx * 45;
                      const endDeg = startDeg + 45;
                      const pt = compassPoint(idx, 8, 86);
                      return (
                        <g key={`bz-${label}`}>
                          <path
                            d={sectorPath(200, 200, 44, 124, startDeg, endDeg)}
                            fill={isGood ? '#1b6e4a' : '#a93226'}
                            fillOpacity="0.18"
                            stroke="#866774"
                            strokeWidth="0.7"
                          />
                          {palace?.bazhai ? (
                            <text
                              x={pt.x}
                              y={pt.y}
                              fill={isGood ? '#135337' : '#8b2319'}
                              fontSize="11.5"
                              fontWeight="800"
                              textAnchor="middle"
                              dominantBaseline="central"
                            >
                              {isGood ? '吉' : '避'}
                            </text>
                          ) : null}
                        </g>
                      );
                    })
                  : null}

                {fp.showCompass
                  ? MOUNTAIN_LABELS.map((label, idx) => {
                      const p1 = compassPoint(idx, 24, 151, -97.5);
                      const p2 = compassPoint(idx, 24, 178, -97.5);
                      const pt = compassPoint(idx, 24, 164);
                      return (
                        <g key={label}>
                          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#9b7e86" strokeWidth="1" />
                          <text
                            x={pt.x}
                            y={pt.y}
                            fill="#49343d"
                            fontSize="13"
                            fontWeight="600"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })
                  : null}

                {SECTOR_LABELS.map((label, idx) => {
                  const s1 = compassPoint(idx, 8, 124, -112.5);
                  const s2 = compassPoint(idx, 8, 151, -112.5);
                  const sp = compassPoint(idx, 8, 138);
                  const tp = compassPoint(idx, 8, fp.showBazhaiLayer ? 108 : 105);
                  const palace = palaceByDir.get(label);
                  return (
                    <g key={label}>
                      <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke="#6d4b59" strokeWidth="1.4" />
                      <text
                        x={sp.x}
                        y={sp.y}
                        fill="#7b3148"
                        fontSize="14"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {label}
                      </text>
                      {fp.showXuankongLayer && palace?.xuankong ? (
                        <text
                          x={tp.x}
                          y={tp.y}
                          fill={palace.xuankong.hasFiveSha ? '#a93226' : '#31252c'}
                          fontSize="11.5"
                          fontWeight="800"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {`${palace.xuankong.mountainStar}/${palace.xuankong.waterStar}`}
                        </text>
                      ) : (
                        <text
                          x={tp.x}
                          y={tp.y}
                          fill="#6d4b59"
                          fontSize="17"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {TRIGRAM_LABELS[idx]}
                        </text>
                      )}
                    </g>
                  );
                })}

                <path d="M200 18 L190 45 L200 40 L210 45 Z" fill="#b33e50" stroke="#fff" strokeWidth="1" />
                <circle cx="200" cy="200" r="40" fill="#fffdf8" fillOpacity="0.86" stroke="#6d4b59" strokeWidth="2" />
                <line x1="176" y1="200" x2="224" y2="200" stroke="#7b3148" strokeWidth="1.6" />
                <line x1="200" y1="176" x2="200" y2="224" stroke="#7b3148" strokeWidth="1.6" />
                <circle cx="200" cy="200" r="5" fill="#7b3148" />
              </svg>
            ) : null}

            {fp.showMarkers
              ? fp.markers.map((m) => {
                  const rep = markerReportMap.get(m.id);
                  const toneCls =
                    rep?.status === '宜' ? 'is-good' : rep?.status === '慎' ? 'is-warn' : 'is-flat';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        draggingMarkerRef.current = { id: m.id, pointerId: e.pointerId };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (
                          draggingMarkerRef.current?.id === m.id &&
                          draggingMarkerRef.current?.pointerId === e.pointerId
                        ) {
                          handleMoveMarker(m.id, e.clientX, e.clientY);
                        }
                      }}
                      onPointerUp={(e) => {
                        if (
                          draggingMarkerRef.current?.id === m.id &&
                          draggingMarkerRef.current?.pointerId === e.pointerId
                        ) {
                          handleMoveMarker(m.id, e.clientX, e.clientY);
                          draggingMarkerRef.current = null;
                        }
                      }}
                      onPointerCancel={() => {
                        draggingMarkerRef.current = null;
                      }}
                      className={cn('fs-marker-pin', toneCls)}
                      style={{ left: `${m.x}%`, top: `${m.y}%` }}
                      title={rep?.summary}
                    >
                      <span>{m.label}</span>
                      {rep && rep.direction !== '待定' ? (
                        <span className="opacity-85">{rep.direction}</span>
                      ) : null}
                    </button>
                  );
                })
              : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
              <Move className="h-3.5 w-3.5" />
              <span>拖动圆心与标点定位</span>
            </span>

            <button
              type="button"
              onClick={() => setShowProOptions((s) => !s)}
              className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent-strong)]"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>{showProOptions ? '收起设置' : '图层设置'}</span>
              {showProOptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {/* 4. 折叠的专业图层与滑块 */}
          {showProOptions ? (
            <div className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['showCompass', '二十四山'],
                      ['showBazhaiLayer', '八宅吉凶'],
                      ['showXuankongLayer', '玄空飞星'],
                      ['showNineGrid', '九宫格线'],
                      ['showMarkers', '房间标点'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateFloorPlan({ [key]: !fp[key] })}
                      className={cn('fs-profile-chip', fp[key] && 'is-active')}
                    >
                      {fp[key] ? <Check className="h-3 w-3" /> : null}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    updateFloorPlan({
                      compassCenterX: 50,
                      compassCenterY: 50,
                      compassSize: 58,
                      compassOpacity: 78,
                      fineAngle: 0,
                    })
                  }
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>复位</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="grid gap-1 font-semibold text-[var(--text-secondary)]">
                  <span className="flex justify-between">
                    <span>角度微调</span>
                    <b>{`${fp.fineAngle}°`}</b>
                  </span>
                  <Slider
                    min={-22.5}
                    max={22.5}
                    step={0.5}
                    value={fp.fineAngle}
                    onChange={(e) => updateFloorPlan({ fineAngle: Number(e.target.value) })}
                  />
                </label>

                <label className="grid gap-1 font-semibold text-[var(--text-secondary)]">
                  <span className="flex justify-between">
                    <span>罗盘大小</span>
                    <b>{`${fp.compassSize}%`}</b>
                  </span>
                  <Slider
                    min={18}
                    max={95}
                    step={1}
                    value={fp.compassSize}
                    onChange={(e) => updateFloorPlan({ compassSize: Number(e.target.value) })}
                  />
                </label>

                <label className="grid gap-1 font-semibold text-[var(--text-secondary)]">
                  <span className="flex justify-between">
                    <span>透明度</span>
                    <b>{`${fp.compassOpacity}%`}</b>
                  </span>
                  <Slider
                    min={20}
                    max={100}
                    step={1}
                    value={fp.compassOpacity}
                    onChange={(e) => updateFloorPlan({ compassOpacity: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {markerReports.length > 0 ? (
        <Card className="grid gap-2 p-3.5 text-xs">
          <strong className="text-[var(--text-strong)]">已标出房间的建议</strong>
          <div className="grid gap-2">
            {markerReports.map((rep) => (
              <div
                key={rep.marker.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5"
              >
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Input
                      className="h-7 w-28 text-xs font-bold"
                      value={rep.marker.label}
                      onChange={(e) =>
                        updateFloorPlan({
                          markers: fp.markers.map((m) =>
                            m.id === rep.marker.id ? { ...m, label: e.target.value.slice(0, 20) } : m,
                          ),
                        })
                      }
                    />
                    <Badge
                      variant={
                        rep.status === '宜' ? 'good' : rep.status === '慎' ? 'warn' : 'default'
                      }
                    >
                      {rep.status === '慎' ? '需注意' : rep.status}
                    </Badge>
                    <span className="font-semibold text-[var(--text-strong)]">
                      {rep.direction === '待定'
                        ? '待选上方朝向'
                        : rep.mountain === '中'
                          ? '房子中心'
                          : `${rep.direction}方`}
                    </span>
                  </div>
                  <p className="m-0 text-[var(--text-secondary)]">{rep.summary}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    updateFloorPlan({
                      markers: fp.markers.filter((m) => m.id !== rep.marker.id),
                    })
                  }
                  aria-label={`删除标点 ${rep.marker.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="grid gap-2.5 p-3.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canGenerate || isExporting}
            onClick={() => void handleExport()}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? '导出中…' : '导出标注图'}</span>
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={() => void handleCopyPrompt()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? '已复制' : '复制提示词'}</span>
          </Button>
          <ExternalAiShareButtons promptText={promptText} size="sm" />
        </div>
        {message ? <p className="m-0 text-[var(--text-secondary)]">{message}</p> : null}
      </Card>
    </div>
  );
}
