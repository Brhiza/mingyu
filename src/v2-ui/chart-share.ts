export interface ShareCardPayload {
  title: string;
  subtitle?: string;
  methodLabel: string;
  question?: string;
  tags?: readonly string[];
  lines: readonly string[];
  excerptText?: string;
  redactPrivacy?: boolean;
}

/**
 * 隐藏真实姓名、具体公农历出生日期时间与出生地点经纬度，仅保留盘面干支/星曜等结构用于社群安全分享。
 */
export function redactSharePayload(input: ShareCardPayload): ShareCardPayload {
  const maskLine = (text: string) =>
    text
      .replace(/(出生当地钟表|真实出生瞬时|出生地钟表|排盘钟表|当地公历日|出生\s*UTC|安星日|起课|参考当地)[：:\s]*[^；\n]+/gu, '$1：[已脱敏]')
      .replace(/(经度|纬度)\s*-?\d+(?:\.\d+)?°/gu, '$1 [已脱敏]')
      .replace(/\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?\b/g, '[日期已脱敏]');

  return {
    ...input,
    title: `${input.methodLabel}（已脱敏）`,
    subtitle: input.subtitle ? '生辰与出生地点已隐私脱敏' : undefined,
    lines: input.lines.map(maskLine),
    excerptText: input.excerptText ? maskLine(input.excerptText) : undefined,
  };
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const result: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) {
      result.push('');
      continue;
    }
    let current = '';
    for (const ch of line) {
      const candidate = current + ch;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        result.push(current);
        current = ch;
      } else {
        current = candidate;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 在浏览器本地把当前排盘摘要与核心资料绘制为素宣纸长图并触发 PNG 下载。
 */
export async function downloadChartShareImage(rawInput: ShareCardPayload): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const input = rawInput.redactPrivacy ? redactSharePayload(rawInput) : rawInput;
  const width = 880;
  const padX = 48;
  const innerWidth = width - padX * 2;
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) return false;

  const fontFamily = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  mctx.font = `16px ${fontFamily}`;

  const excerptLines = (input.excerptText ?? '')
    .split(/\n{2,}/)
    .filter((block) => !/^【(?:限制|任务|限制与任务|问题)】/.test(block))
    .slice(0, 6)
    .flatMap((block) => [...wrapLine(mctx, block, innerWidth - 44), ''])
    .slice(0, 28);

  const summaryWrapped = input.lines.flatMap((l) => wrapLine(mctx, `• ${l}`, innerWidth - 40));
  const questionWrapped = input.question ? wrapLine(mctx, `所问：${input.question}`, innerWidth - 40) : [];

  const headerHeight = 148;
  const questionHeight = questionWrapped.length ? questionWrapped.length * 26 + 32 : 0;
  const summaryHeight = summaryWrapped.length ? summaryWrapped.length * 26 + 44 : 0;
  const excerptHeight = excerptLines.length ? excerptLines.length * 24 + 54 : 0;
  const footerHeight = 84;
  const totalHeight = Math.max(
    520,
    headerHeight + questionHeight + summaryHeight + excerptHeight + footerHeight + 64,
  );

  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = totalHeight * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(dpr, dpr);

  // 背景素宣底色
  ctx.fillStyle = '#f6f3ec';
  ctx.fillRect(0, 0, width, totalHeight);

  // 外框线
  ctx.strokeStyle = '#dfd6c7';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 20, 20, width - 40, totalHeight - 40, 20);
  ctx.stroke();

  let cursorY = 56;

  // 印章 + 品牌标题
  ctx.fillStyle = '#a63428';
  drawRoundedRect(ctx, padX, cursorY, 44, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('命', padX + 22, cursorY + 23);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#241d16';
  ctx.font = `bold 26px ${fontFamily}`;
  ctx.fillText(input.title || input.methodLabel, padX + 58, cursorY + 24);

  ctx.fillStyle = '#75685a';
  ctx.font = `14px ${fontFamily}`;
  const sub = [input.methodLabel, input.subtitle, new Date().toLocaleDateString('zh-CN')].filter(Boolean).join(' · ');
  ctx.fillText(sub, padX + 58, cursorY + 46);
  cursorY += 76;

  // 标签
  if (input.tags?.length) {
    let tagX = padX;
    ctx.font = `13px ${fontFamily}`;
    for (const tag of input.tags.slice(0, 5)) {
      const tw = ctx.measureText(tag).width + 20;
      if (tagX + tw > width - padX) break;
      ctx.fillStyle = '#ece5d8';
      drawRoundedRect(ctx, tagX, cursorY, tw, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#5c4e3e';
      ctx.fillText(tag, tagX + 10, cursorY + 17);
      tagX += tw + 8;
    }
    cursorY += 42;
  }

  // 问题框
  if (questionWrapped.length) {
    const h = questionWrapped.length * 26 + 24;
    ctx.fillStyle = '#fffdf8';
    ctx.strokeStyle = '#e5dccb';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, padX, cursorY, innerWidth, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#31281f';
    ctx.font = `bold 16px ${fontFamily}`;
    questionWrapped.forEach((line, i) => {
      ctx.fillText(line, padX + 18, cursorY + 30 + i * 26);
    });
    cursorY += h + 18;
  }

  // 核心摘要
  if (summaryWrapped.length) {
    const h = summaryWrapped.length * 26 + 28;
    ctx.fillStyle = '#fbf8f1';
    ctx.strokeStyle = '#e5dccb';
    drawRoundedRect(ctx, padX, cursorY, innerWidth, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2d241c';
    ctx.font = `16px ${fontFamily}`;
    summaryWrapped.forEach((line, i) => {
      ctx.fillText(line, padX + 18, cursorY + 32 + i * 26);
    });
    cursorY += h + 18;
  }

  // 核心盘面资料摘录
  if (excerptLines.length) {
    const h = excerptLines.length * 24 + 36;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e8dfd0';
    drawRoundedRect(ctx, padX, cursorY, innerWidth, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#43382e';
    ctx.font = `15px ${fontFamily}`;
    excerptLines.forEach((line, i) => {
      ctx.fillText(line, padX + 20, cursorY + 30 + i * 24);
    });
    cursorY += h + 24;
  }

  // 底部免责与水印
  ctx.fillStyle = '#8b7d6e';
  ctx.font = `13px ${fontFamily}`;
  ctx.fillText('命语 · 东方数术与星占工作台（仅供参考与文化研究，不构成医疗、法律或投资建议）', padX, totalHeight - 40);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mingyu-${input.methodLabel.replace(/\s+/g, '-')}-${Date.now()}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
