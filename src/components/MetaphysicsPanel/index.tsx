import { useMemo, useState } from 'react';
import { analyzeBaZhai } from '@core/ba_zhai';
import { getSitFacingFromFacingDegree, type SitFacingPosition } from '@core/direction';
import { generateQizheng } from '@core/qi_zheng';
import { buildMetaphysicsPrompt } from '@/lib/metaphysics-prompt';

export type ChartExtensionMethod = 'bazhai' | 'qizheng';

interface MetaphysicsPanelProps {
  method: ChartExtensionMethod;
}

const currentDate = new Date();

function readInteger(value: string, label: string, min: number, max: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label}应填写 ${min} 至 ${max} 之间的整数。`);
  }
  return number;
}

function readNumber(value: string, label: string, min: number, max: number) {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label}应填写 ${min} 至 ${max} 之间的数字。`);
  }
  return number;
}

function createSolarDate(year: number, month: number, day: number, hour: number, minute: number) {
  const date = new Date(year, month - 1, day, hour, minute, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error('日期或时间无效，请检查后重试。');
  }
  return date;
}

function readDirectionPreview(value: string): {
  position: SitFacingPosition | null;
  error: string;
} {
  if (!value.trim()) {
    return { position: null, error: '请填写房屋朝向度数。' };
  }

  try {
    return {
      position: getSitFacingFromFacingDegree(readNumber(value, '房屋朝向度数', 0, 360)),
      error: '',
    };
  } catch (error) {
    return {
      position: null,
      error: error instanceof Error ? error.message : '房屋朝向度数无效。',
    };
  }
}

export function MetaphysicsPanel({ method }: MetaphysicsPanelProps) {
  const [question, setQuestion] = useState('');
  const [currentSituation, setCurrentSituation] = useState('');
  const [currentState, setCurrentState] = useState('');
  const [knownFacts, setKnownFacts] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [constraints, setConstraints] = useState('');
  const [birthYear, setBirthYear] = useState('1990');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [facingDegree, setFacingDegree] = useState('180');
  const [year, setYear] = useState(String(currentDate.getFullYear()));
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [day, setDay] = useState(String(currentDate.getDate()));
  const [hour, setHour] = useState(String(currentDate.getHours()));
  const [minute, setMinute] = useState(String(currentDate.getMinutes()));
  const [latitude, setLatitude] = useState('39.9042');
  const [longitude, setLongitude] = useState('116.4074');
  const [timezone, setTimezone] = useState('8');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [copyText, setCopyText] = useState('复制提示词');

  const directionPreview = useMemo(() => readDirectionPreview(facingDegree), [facingDegree]);

  const boundaryMessage = useMemo(() => {
    const facing = directionPreview.position?.facing;
    if (!facing?.isBoundary || !facing.boundaryMountains) return '';
    return `当前度数正好位于${facing.boundaryMountains[0]}向与${facing.boundaryMountains[1]}向的分界线，请重新测量并填写稍偏离分界线的实际度数。`;
  }, [directionPreview]);

  const resultText = useMemo(() => {
    if (!result) return '';
    const display = { ...result };
    delete display.prompt;
    return JSON.stringify(display, null, 2);
  }, [result]);

  function generate() {
    setError('');
    setResult(null);
    setPrompt('');
    setCopyText('复制提示词');

    try {
      let nextResult: Record<string, unknown> & { prompt: string };
      let measurement = '';

      if (method === 'bazhai') {
        if (!directionPreview.position) {
          throw new Error(directionPreview.error);
        }
        if (directionPreview.position.facing.isBoundary) {
          throw new Error(boundaryMessage);
        }

        const { facing, sit, label } = directionPreview.position;
        measurement = `测量方式：站在屋内面向大门外。房屋朝向 ${facing.degree}° 为${facing.mountain}向；相反方向的坐山 ${sit.degree}° 为${sit.mountain}山，换算结果为${label}。`;
        const bazhaiResult = analyzeBaZhai({
          birthYear: readInteger(birthYear, '出生年份', 1900, 2100),
          gender,
          sitMountain: sit.mountain,
        }) as unknown as Record<string, unknown> & { prompt: string };
        nextResult = {
          ...bazhaiResult,
          directionMeasurement: {
            method: '站在屋内面向大门外测量朝向',
            facingDegree: facing.degree,
            facingMountain: facing.mountain,
            sitDegree: sit.degree,
            sitMountain: sit.mountain,
            label,
          },
        };
      } else {
        const targetYear = readInteger(year, '年份', 1900, 2200);
        const targetMonth = readInteger(month, '月份', 1, 12);
        const targetDay = readInteger(day, '日期', 1, 31);
        const targetHour = readInteger(hour, '小时', 0, 23);
        const targetMinute = readInteger(minute, '分钟', 0, 59);
        createSolarDate(targetYear, targetMonth, targetDay, targetHour, targetMinute);

        nextResult = generateQizheng({
          year: targetYear,
          month: targetMonth,
          day: targetDay,
          hour: targetHour,
          minute: targetMinute,
          latitude: readNumber(latitude, '纬度', -90, 90),
          longitude: readNumber(longitude, '经度', -180, 180),
          timezone: readNumber(timezone, '时区', -12, 14),
        }) as unknown as Record<string, unknown> & { prompt: string };
      }

      setResult(nextResult);
      setPrompt(
        buildMetaphysicsPrompt(nextResult.prompt, question, {
          measurement,
          context: { currentSituation, currentState, knownFacts, desiredOutcome, constraints },
        }),
      );
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : '生成失败，请检查输入。');
    }
  }

  async function copyPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyText('已复制');
    } catch {
      setCopyText('复制失败');
    }
  }

  const title = method === 'bazhai' ? '八宅排盘' : '七政四余排盘';
  const description =
    method === 'bazhai'
      ? '输入容易测量的房屋朝向度数，系统会自动换算坐山和二十四山。'
      : '按出生时间、地点与时区生成七政四余、十二宫与神煞。';

  return (
    <div className="metaphysics-panel-shell">
      <section className="person-section divination-form-card">
        <div className="person-section-head">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="person-info-form">
          {method === 'bazhai' ? (
            <>
              <div className="form-row">
                <div className="form-item">
                  <label htmlFor="metaphysics-birth-year">出生年份</label>
                  <input
                    id="metaphysics-birth-year"
                    className="form-input"
                    inputMode="numeric"
                    value={birthYear}
                    onChange={(event) => setBirthYear(event.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="metaphysics-gender">性别</label>
                  <select
                    id="metaphysics-gender"
                    className="form-input"
                    value={gender}
                    onChange={(event) => setGender(event.target.value as 'male' | 'female')}
                  >
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                </div>
                <div className="form-item">
                  <label htmlFor="metaphysics-facing-degree">房屋朝向度数</label>
                  <input
                    id="metaphysics-facing-degree"
                    className="form-input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="360"
                    step="0.1"
                    value={facingDegree}
                    onChange={(event) => setFacingDegree(event.target.value)}
                  />
                  <span className="birth-time-hint">
                    站在屋内面向大门外，填写手机指南针显示的 0° 至 360°。
                  </span>
                </div>
              </div>

              <div
                className={`metaphysics-direction-preview ${boundaryMessage ? 'is-warning' : ''}`}
                role={boundaryMessage || directionPreview.error ? 'alert' : 'status'}
              >
                {boundaryMessage ? (
                  <strong>{boundaryMessage}</strong>
                ) : directionPreview.position ? (
                  <>
                    <strong>{directionPreview.position.label}</strong>
                    <span>
                      朝向 {directionPreview.position.facing.degree}° 为
                      {directionPreview.position.facing.mountain}向；坐山{' '}
                      {directionPreview.position.sit.degree}° 为
                      {directionPreview.position.sit.mountain}山。
                    </span>
                  </>
                ) : (
                  <span>{directionPreview.error}</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="form-row metaphysics-date-row">
                <div className="form-item">
                  <label htmlFor="metaphysics-year">年份</label>
                  <input
                    id="metaphysics-year"
                    className="form-input"
                    inputMode="numeric"
                    value={year}
                    onChange={(event) => setYear(event.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="metaphysics-month">月份</label>
                  <input
                    id="metaphysics-month"
                    className="form-input"
                    inputMode="numeric"
                    value={month}
                    onChange={(event) => setMonth(event.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="metaphysics-day">日期</label>
                  <input
                    id="metaphysics-day"
                    className="form-input"
                    inputMode="numeric"
                    value={day}
                    onChange={(event) => setDay(event.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="metaphysics-hour">小时</label>
                  <input
                    id="metaphysics-hour"
                    className="form-input"
                    inputMode="numeric"
                    value={hour}
                    onChange={(event) => setHour(event.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="metaphysics-minute">分钟</label>
                  <input
                    id="metaphysics-minute"
                    className="form-input"
                    inputMode="numeric"
                    value={minute}
                    onChange={(event) => setMinute(event.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-item">
                  <label htmlFor="metaphysics-latitude">纬度</label>
                  <input
                    id="metaphysics-latitude"
                    className="form-input"
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="metaphysics-longitude">经度</label>
                  <input
                    id="metaphysics-longitude"
                    className="form-input"
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label htmlFor="metaphysics-timezone">时区</label>
                  <input
                    id="metaphysics-timezone"
                    className="form-input"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="form-item metaphysics-question-field">
              <label htmlFor="metaphysics-question">希望 AI 重点解读的问题（可选）</label>
              <textarea
                id="metaphysics-question"
                rows={3}
                className="form-input divination-textarea"
                value={question}
                placeholder="例如：请重点看今年适合主动推进什么，哪些风险需要回避？"
                onChange={(event) => setQuestion(event.target.value)}
              />
            </div>
          </div>
          <details className="form-item divination-context-fields">
            <summary>补充现实信息（可选，填写越具体越利于解读）</summary>
            <div className="form-row">
              {[
                ['当前情况', currentSituation, setCurrentSituation, '正在发生什么、有哪些选择'],
                ['当前状态', currentState, setCurrentState, '目前的进度、情绪或资源状态'],
                ['已知事实', knownFacts, setKnownFacts, '已经确认的人、事、时间和结果'],
                ['期望结果', desiredOutcome, setDesiredOutcome, '最希望实现的结果'],
                ['现实限制', constraints, setConstraints, '时间、预算、地点或责任限制'],
              ].map(([label, value, setter, placeholder]) => (
                <div className="form-item" key={label as string}>
                  <label>{label as string}</label>
                  <textarea
                    rows={2}
                    className="form-input divination-textarea"
                    value={value as string}
                    placeholder={placeholder as string}
                    onChange={(event) =>
                      (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </details>
        </div>

        {error ? <div className="form-error-text global-form-error">{error}</div> : null}

        <div className="form-actions page-submit-actions metaphysics-submit-actions">
          <button
            className="primary-button start-submit-button"
            type="button"
            onClick={generate}
            disabled={method === 'bazhai' && Boolean(boundaryMessage)}
          >
            开始排盘
          </button>
        </div>
      </section>

      {result ? (
        <div className="workspace-grid divination-output-grid metaphysics-output-grid">
          <section className="panel divination-result-panel">
            <div className="panel-head">
              <div>
                <h2>排盘结果</h2>
                <p>以下数据由本地算法生成，不会上传出生信息。</p>
              </div>
            </div>
            <pre className="result-pre">{resultText}</pre>
          </section>

          <section className="panel panel-output divination-result-panel">
            <div className="panel-head divination-prompt-head">
              <div>
                <h2>解读提示词</h2>
                <p>复制整段后，可发送到常用 AI 继续分析。</p>
              </div>
              <button className="copy-button secondary-button" type="button" onClick={copyPrompt}>
                {copyText}
              </button>
            </div>
            <pre className="result-pre">{prompt}</pre>
          </section>
        </div>
      ) : null}
    </div>
  );
}
