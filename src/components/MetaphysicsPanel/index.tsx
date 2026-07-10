import { useMemo, useState } from 'react';
import { analyzeBaZhai } from '@core/ba_zhai';
import { getGanZhiFromDate, EARTHLY_BRANCHES, ZODIACS } from '@core/ganzhi';
import { TWENTY_FOUR_MOUNTAINS } from '@core/direction';
import { getZodiacYearFortune } from '@core/zodiac';
import { generateTaiyi } from '@core/taiyi';
import { generateTieban } from '@core/tie_ban';
import { generateQizheng } from '@core/qi_zheng';

type MetaphysicsMethod = 'bazhai' | 'zodiac' | 'taiyi' | 'tieban' | 'qizheng';

const METHOD_OPTIONS: Array<{
  value: MetaphysicsMethod;
  label: string;
  description: string;
}> = [
  { value: 'bazhai', label: '八宅', description: '按命卦与坐山查看四吉四凶方。' },
  { value: 'zodiac', label: '生肖', description: '查看流年犯太岁、贵人与运程等级。' },
  { value: 'taiyi', label: '太乙', description: '生成太乙局数、主客算与十六神盘。' },
  { value: 'tieban', label: '铁板', description: '按出生时刻生成先后天卦与公开条文。' },
  { value: 'qizheng', label: '七政四余', description: '生成七政四余、十二宫与神煞。' },
];

const currentYear = new Date().getFullYear();

function readInteger(value: string, label: string, min: number, max: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label}应填写 ${min} 至 ${max} 之间的整数。`);
  }
  return number;
}

function readNumber(value: string, label: string, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
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

function buildPrompt(prompt: string, question: string) {
  const normalizedQuestion = question.trim() || '请综合解读本次排盘的重点、风险与行动建议。';
  return [
    prompt,
    '',
    '【问题】',
    normalizedQuestion,
    '',
    '【任务】',
    '只依据上方排盘信息进行分析，先给结论，再说明依据、限制与建议。',
    '',
    '【输出要求】',
    '使用简体中文；不要编造盘面没有提供的信息；资料不足时明确说明不确定性。',
  ].join('\n');
}

export function MetaphysicsPanel() {
  const [method, setMethod] = useState<MetaphysicsMethod>('bazhai');
  const [question, setQuestion] = useState('');
  const [birthYear, setBirthYear] = useState('1990');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [sitMountain, setSitMountain] = useState('子');
  const [zodiacBranch, setZodiacBranch] = useState('子');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState('1');
  const [day, setDay] = useState('1');
  const [hour, setHour] = useState('12');
  const [minute, setMinute] = useState('0');
  const [scope, setScope] = useState<'year' | 'month' | 'day' | 'hour'>('year');
  const [keOffset, setKeOffset] = useState('0');
  const [latitude, setLatitude] = useState('39.9042');
  const [longitude, setLongitude] = useState('116.4074');
  const [timezone, setTimezone] = useState('8');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [copyText, setCopyText] = useState('复制提示词');

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

      if (method === 'bazhai') {
        nextResult = analyzeBaZhai({
          birthYear: readInteger(birthYear, '出生年份', 1900, 2100),
          gender,
          sitMountain,
        }) as unknown as Record<string, unknown> & { prompt: string };
      } else if (method === 'zodiac') {
        const targetYear = readInteger(year, '流年', 1900, 2200);
        const yearGanZhi = getGanZhiFromDate(new Date(targetYear, 1, 10, 12)).year;
        nextResult = getZodiacYearFortune(zodiacBranch, yearGanZhi) as unknown as Record<
          string,
          unknown
        > & { prompt: string };
      } else {
        const targetYear = readInteger(year, '年份', 1900, 2200);
        const targetMonth = readInteger(month, '月份', 1, 12);
        const targetDay = readInteger(day, '日期', 1, 31);
        const targetHour = readInteger(hour, '小时', 0, 23);
        const targetMinute = readInteger(minute, '分钟', 0, 59);
        const date = createSolarDate(targetYear, targetMonth, targetDay, targetHour, targetMinute);

        if (method === 'taiyi') {
          nextResult = generateTaiyi({
            scope,
            year: targetYear,
            date,
          }) as unknown as Record<string, unknown> & { prompt: string };
        } else if (method === 'tieban') {
          nextResult = generateTieban({
            date,
            minute: targetMinute,
            gender,
            keOffset: readInteger(keOffset, '考刻校正', -3, 3),
          }) as unknown as Record<string, unknown> & { prompt: string };
        } else {
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
      }

      setResult(nextResult);
      setPrompt(buildPrompt(nextResult.prompt, question));
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

  const showDateFields = method === 'taiyi' || method === 'tieban' || method === 'qizheng';

  return (
    <div className="metaphysics-panel-shell">
      <section className="person-section divination-form-card">
        <div className="person-section-head">
          <h2>传统术数</h2>
          <p>五个新增系统已可直接在网页排盘，并生成可复制给 AI 的结构化提示词。</p>
        </div>

        <div className="divination-method-grid metaphysics-method-grid">
          {METHOD_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`divination-method-btn ${method === item.value ? 'is-active' : ''}`}
              onClick={() => {
                setMethod(item.value);
                setResult(null);
                setPrompt('');
                setError('');
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>

        <div className="person-info-form">
          {method === 'bazhai' ? (
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
                <label htmlFor="metaphysics-mountain">住宅坐山</label>
                <select
                  id="metaphysics-mountain"
                  className="form-input"
                  value={sitMountain}
                  onChange={(event) => setSitMountain(event.target.value)}
                >
                  {TWENTY_FOUR_MOUNTAINS.map((mountain) => (
                    <option key={mountain} value={mountain}>
                      {mountain}山
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {method === 'zodiac' ? (
            <div className="form-row">
              <div className="form-item">
                <label htmlFor="metaphysics-zodiac">生肖</label>
                <select
                  id="metaphysics-zodiac"
                  className="form-input"
                  value={zodiacBranch}
                  onChange={(event) => setZodiacBranch(event.target.value)}
                >
                  {EARTHLY_BRANCHES.map((branch, index) => (
                    <option key={branch} value={branch}>
                      {ZODIACS[index]}（{branch}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-item">
                <label htmlFor="metaphysics-zodiac-year">流年</label>
                <input
                  id="metaphysics-zodiac-year"
                  className="form-input"
                  inputMode="numeric"
                  value={year}
                  onChange={(event) => setYear(event.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
            </div>
          ) : null}

          {showDateFields ? (
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
          ) : null}

          {method === 'taiyi' ? (
            <div className="form-row">
              <div className="form-item">
                <label htmlFor="metaphysics-scope">太乙家数</label>
                <select
                  id="metaphysics-scope"
                  className="form-input"
                  value={scope}
                  onChange={(event) => setScope(event.target.value as typeof scope)}
                >
                  <option value="year">年家</option>
                  <option value="month">月家</option>
                  <option value="day">日家</option>
                  <option value="hour">时家</option>
                </select>
              </div>
            </div>
          ) : null}

          {method === 'tieban' ? (
            <div className="form-row">
              <div className="form-item">
                <label htmlFor="metaphysics-tieban-gender">性别</label>
                <select
                  id="metaphysics-tieban-gender"
                  className="form-input"
                  value={gender}
                  onChange={(event) => setGender(event.target.value as 'male' | 'female')}
                >
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>
              <div className="form-item">
                <label htmlFor="metaphysics-ke-offset">考刻校正（-3 至 3）</label>
                <input
                  id="metaphysics-ke-offset"
                  className="form-input"
                  inputMode="numeric"
                  value={keOffset}
                  onChange={(event) => setKeOffset(event.target.value.replace(/[^\d-]/g, ''))}
                />
              </div>
            </div>
          ) : null}

          {method === 'qizheng' ? (
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
          ) : null}

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
        </div>

        {error ? <div className="form-error-text global-form-error">{error}</div> : null}

        <div className="form-actions page-submit-actions metaphysics-submit-actions">
          <button className="primary-button start-submit-button" type="button" onClick={generate}>
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
