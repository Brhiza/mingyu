import { memo } from 'react';
import type { ThreePillarsProfile } from '@/lib/birth-time-reverse';

export const ThreePillarsBoard = memo(function ThreePillarsBoard(props: {
  title: string;
  name: string;
  profile: ThreePillarsProfile;
}) {
  const { title, name, profile } = props;
  const pillarRows = [
    {
      label: '天干',
      values: [
        profile.pillars.year.gan,
        profile.pillars.month.gan,
        profile.pillars.day.gan,
        '待反推',
      ],
      className: 'is-stem',
    },
    {
      label: '地支',
      values: [
        profile.pillars.year.zhi,
        profile.pillars.month.zhi,
        profile.pillars.day.zhi,
        '待反推',
      ],
      className: 'is-branch',
    },
    {
      label: '天干十神',
      values: [
        profile.pillars.year.tenGod,
        profile.pillars.month.tenGod,
        profile.pillars.day.tenGod,
        '待确认',
      ],
      className: 'is-multiline',
    },
    {
      label: '地支十神',
      values: [
        profile.pillars.year.branchTenGod,
        profile.pillars.month.branchTenGod,
        profile.pillars.day.branchTenGod,
        '待确认',
      ],
      className: 'is-multiline',
    },
    {
      label: '五行',
      values: [
        `${profile.pillars.year.ganWuxing}/${profile.pillars.year.zhiWuxing}`,
        `${profile.pillars.month.ganWuxing}/${profile.pillars.month.zhiWuxing}`,
        `${profile.pillars.day.ganWuxing}/${profile.pillars.day.zhiWuxing}`,
        '待确认',
      ],
      className: 'is-multiline',
    },
  ];

  return (
    <section className="result-showcase-card bazi-showcase-card">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">{profile.genderLabel}</span>
          <span className="result-chip">{profile.solarDateLabel}</span>
          <span className="result-chip">未知时辰</span>
        </div>
      </div>

      <div className="result-summary-grid result-summary-grid-bazi">
        <div className="result-stat-card result-stat-card-accent">
          <span>日主</span>
          <strong>{profile.dayMaster.gan}</strong>
          <small>
            {profile.dayMaster.element} · {profile.dayMaster.yinYang}
          </small>
        </div>
        <div className="result-stat-card">
          <span>年柱</span>
          <strong>{profile.pillars.year.ganZhi}</strong>
          <small>{profile.pillars.year.tenGod}</small>
        </div>
        <div className="result-stat-card">
          <span>月柱</span>
          <strong>{profile.pillars.month.ganZhi}</strong>
          <small>{profile.pillars.month.tenGod}</small>
        </div>
        <div className="result-stat-card">
          <span>日柱</span>
          <strong>{profile.pillars.day.ganZhi}</strong>
          <small>{profile.zodiac}</small>
        </div>
      </div>

      <div className="bazi-core-layout">
        <div className="bazi-pillars-card">
          <div className="bazi-pillars-header">
            <h3>三柱盘</h3>
            <p>当前时辰未知，时柱先保留为待反推。</p>
          </div>
          {profile.timeBoundaryNotes.length > 0 ? (
            <div className="prompt-send-tip">
              {profile.timeBoundaryNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}
          <div className="bazi-pillars-table">
            <div className="bazi-pillars-cell is-label is-head">信息</div>
            <div className="bazi-pillars-cell is-head">年柱</div>
            <div className="bazi-pillars-cell is-head">月柱</div>
            <div className="bazi-pillars-cell is-head is-day-master">日柱</div>
            <div className="bazi-pillars-cell is-head">时柱</div>
            {pillarRows.flatMap((row) => [
              <div key={`${row.label}-label`} className="bazi-pillars-cell is-label">
                {row.label}
              </div>,
              ...row.values.map((value, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className={`bazi-pillars-cell ${row.className ?? ''} ${
                    index === 2 ? 'is-day-master' : ''
                  }`}
                >
                  {value}
                </div>
              )),
            ])}
          </div>
        </div>

        <div className="bazi-side-panel">
          <div className="result-side-card bazi-fortune-card">
            <div className="result-side-head">
              <h3>三柱说明</h3>
              <p>这里只统计三柱六字，不把未知时柱强行补全。</p>
            </div>
            <div className="wuxing-bars">
              {Object.entries(profile.wuxingCount).map(([key, value]) => (
                <div className="wuxing-bar-row" key={key}>
                  <span className="wuxing-bar-label">{key}</span>
                  <div className="wuxing-bar-track">
                    <div className="wuxing-bar-fill" style={{ width: `${(value / 6) * 100}%` }} />
                  </div>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="fortune-focus-card">
              <span>当前状态</span>
              <strong>按三柱先看主线</strong>
              <small>涉及时柱、子女、晚年、细节应期等内容，需要反推时辰后再细化。</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
