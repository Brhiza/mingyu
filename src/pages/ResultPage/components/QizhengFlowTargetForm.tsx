import { useState, type FormEvent } from 'react';
import { parseQizhengFlowTarget, type QizhengFlowTarget } from '@/lib/qizheng-flow-target';
import './QizhengFlowTargetForm.css';

export function QizhengFlowTargetForm({
  target,
  onApply,
}: {
  target: QizhengFlowTarget;
  onApply: (target: QizhengFlowTarget) => void;
}) {
  const today = new Date();
  const [mode, setMode] = useState(
    target.flowDay !== undefined
      ? 'daily'
      : target.flowMonth !== undefined
        ? 'monthly'
        : target.flowYear !== undefined
          ? 'yearly'
          : 'natal',
  );
  const [year, setYear] = useState(String(target.flowYear ?? today.getFullYear()));
  const [month, setMonth] = useState(String(target.flowMonth ?? today.getMonth() + 1));
  const [day, setDay] = useState(String(target.flowDay ?? today.getDate()));
  const [time, setTime] = useState(
    `${String(target.flowHour ?? 12).padStart(2, '0')}:${String(target.flowMinute ?? 0).padStart(2, '0')}`,
  );
  const [error, setError] = useState('');
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const [hour, minute] = time.split(':').map(Number);
      const next = parseQizhengFlowTarget(
        JSON.stringify(
          mode === 'natal'
            ? {}
            : {
                flowYear: Number(year),
                ...(mode !== 'yearly' ? { flowMonth: Number(month) } : {}),
                ...(mode === 'daily'
                  ? { flowDay: Number(day), flowHour: hour, flowMinute: minute }
                  : {}),
              },
        ),
      );
      setError('');
      onApply(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请选择有效的流曜目标。');
    }
  };
  return (
    <form
      className="result-side-card qizheng-flow-target"
      onSubmit={submit}
      aria-label="七政流曜目标"
    >
      <div className="qizheng-flow-target-fields">
        <label>
          查看范围
          <select
            aria-label="七政查看范围"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="natal">本命</option>
            <option value="yearly">流年</option>
            <option value="monthly">流月</option>
            <option value="daily">流日</option>
          </select>
        </label>
        {mode !== 'natal' ? (
          <label>
            年份
            <input
              aria-label="流曜年份"
              type="number"
              min="1900"
              max="2200"
              required
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                const lastDay = new Date(
                  Date.UTC(Number(event.target.value), Number(month), 0),
                ).getUTCDate();
                if (Number(day) > lastDay) setDay(String(lastDay));
              }}
            />
          </label>
        ) : null}
        {mode === 'monthly' || mode === 'daily' ? (
          <label>
            月份
            <select
              aria-label="流曜月份"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setDay('1');
              }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}月
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {mode === 'daily' ? (
          <>
            <label>
              日期
              <select
                aria-label="流曜日期"
                value={day}
                onChange={(event) => setDay(event.target.value)}
              >
                {Array.from({ length: Number.isFinite(days) ? days : 31 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}日
                  </option>
                ))}
              </select>
            </label>
            <label>
              目标时刻
              <input
                aria-label="流曜时刻"
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
          </>
        ) : null}
        <button type="submit" className="result-chip result-chip-highlight">
          应用时段
        </button>
      </div>
      <p className="qizheng-flow-target-note">
        流年以立春为界，流月按公历月、流日按公历日查看周期事件。出生区间会保留各分段的流曜、吊照和行限差异。
      </p>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}
