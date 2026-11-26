'use client';

import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Flame, Menu, Play, SlidersHorizontal, TimerReset, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';

type Direction = 'split' | 'field';

const days = [
  { label: 'M', date: '09', status: 'done', value: 'Run' },
  { label: 'T', date: '10', status: 'active', value: 'Ride' },
  { label: 'W', date: '11', status: 'planned', value: 'Rest' },
  { label: 'T', date: '12', status: 'planned', value: 'Run' },
  { label: 'F', date: '13', status: 'planned', value: 'Swim' },
  { label: 'S', date: '14', status: 'planned', value: 'Long run' },
  { label: 'S', date: '15', status: 'planned', value: 'Rest' },
];

const activities = [
  { sport: 'Run', title: 'Tempo intervals', meta: 'Yesterday – 48 min', value: '8.4 km', color: 'orange' },
  { sport: 'Ride', title: 'Endurance spin', meta: 'Mon – 1 hr 12 min', value: '32.1 km', color: 'blue' },
  { sport: 'Swim', title: 'Technique + aerobic', meta: 'Sun – 38 min', value: '1,600 m', color: 'purple' },
];

const blocks = [
  { kind: 'Warm up', value: '10 min', detail: 'Easy – Zone 1–2', tone: 'soft' },
  { kind: 'Work', value: '4 × 6 min', detail: 'Threshold – Zone 4', tone: 'signal' },
  { kind: 'Recovery', value: '4 × 3 min', detail: 'Easy – Zone 2', tone: 'cool' },
  { kind: 'Cool down', value: '8 min', detail: 'Easy – Zone 1', tone: 'soft' },
];

export function WattonautDirectionDemo({ direction }: { direction: Direction }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isSplit = direction === 'split';

  return (
    <main className={`wattonaut-demo wattonaut-demo--${direction}`}>
      <div className="wattonaut-demo__announcement">
        <span>Design direction preview</span>
        <span className="wattonaut-demo__announcement-separator">/</span>
        <span>{isSplit ? '01 – Split board' : '02 – Field notes'}</span>
        <Link href={isSplit ? '/design/wattonaut-field' : '/design/wattonaut-split'}>
          Compare {isSplit ? 'field notes' : 'split board'} <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="wattonaut-demo__layout">
        <aside className={`wattonaut-demo__sidebar ${menuOpen ? 'is-open' : ''}`}>
          <div className="wattonaut-demo__brand-row">
            <Link href="/design/wattonaut-split" className="wattonaut-demo__brand" aria-label="Wattonaut design previews">
              <span className="wattonaut-demo__brand-mark"><span /></span>
              <span>Wattonaut</span>
            </Link>
            <button type="button" className="wattonaut-demo__close-menu" onClick={() => setMenuOpen(false)} aria-label="Close navigation">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Design preview navigation" className="wattonaut-demo__nav">
            <p className="wattonaut-demo__nav-label">Your week</p>
            <a href="#today" className="wattonaut-demo__nav-item is-active" onClick={() => setMenuOpen(false)}><span className="wattonaut-demo__nav-icon"><TrendingUp size={16} /></span>Home</a>
            <a href="#week" className="wattonaut-demo__nav-item" onClick={() => setMenuOpen(false)}><span className="wattonaut-demo__nav-icon"><CalendarDays size={16} /></span>Calendar</a>
            <a href="#workout" className="wattonaut-demo__nav-item" onClick={() => setMenuOpen(false)}><span className="wattonaut-demo__nav-icon"><TimerReset size={16} /></span>Workouts</a>
            <a href="#activity" className="wattonaut-demo__nav-item" onClick={() => setMenuOpen(false)}><span className="wattonaut-demo__nav-icon"><Flame size={16} /></span>Activity</a>
          </nav>

          <div className="wattonaut-demo__sidebar-bottom">
            <a href="#settings" className="wattonaut-demo__nav-item"><span className="wattonaut-demo__nav-icon"><SlidersHorizontal size={16} /></span>Settings</a>
            <div className="wattonaut-demo__profile">
              <span className="wattonaut-demo__avatar">MC</span>
              <span><strong>Mia Chen</strong><small>Athlete</small></span>
              <ChevronRight size={15} aria-hidden="true" />
            </div>
          </div>
        </aside>

        <section className="wattonaut-demo__content">
          <header className="wattonaut-demo__topbar">
            <div>
              <button type="button" className="wattonaut-demo__menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
              <p className="wattonaut-demo__date">Tuesday, September 10, 2026</p>
              <h1>Good morning, Mia<span className="wattonaut-demo__punctuation">.</span></h1>
              <p className="wattonaut-demo__lede">One clear session today. Let&apos;s make it count.</p>
            </div>
            <div className="wattonaut-demo__topbar-actions">
              <button type="button" className="wattonaut-demo__icon-button" aria-label="Help"><CircleHelp size={19} /></button>
              <span className="wattonaut-demo__top-avatar">MC</span>
            </div>
          </header>

          <div className="wattonaut-demo__content-grid">
            <section id="today" className="wattonaut-demo__today-panel">
              <div className="wattonaut-demo__section-heading">
                <div><p className="wattonaut-demo__section-kicker">Today</p><h2>Your next move</h2></div>
                <span className="wattonaut-demo__status-chip"><span />On track</span>
              </div>
              <div className="wattonaut-demo__next-card">
                <div className="wattonaut-demo__next-card-head">
                  <div className="wattonaut-demo__sport-mark"><span className="wattonaut-demo__sport-glyph">↗</span><span>Bike – Threshold</span></div>
                  <span className="wattonaut-demo__duration"><Clock3 size={15} /> 58 min</span>
                </div>
                <h3>Four corners</h3>
                <p className="wattonaut-demo__next-description">A focused set of threshold efforts. Smooth power, patient breathing, strong finish.</p>
                <div className="wattonaut-demo__metric-row">
                  <div><span>Target</span><strong>220–245 <small>W</small></strong></div>
                  <div><span>Load</span><strong>68 <small>TSS</small></strong></div>
                  <div><span>Focus</span><strong>Zone 4</strong></div>
                </div>
                <div className="wattonaut-demo__block-list" aria-label="Workout blocks">
                  {blocks.map((block) => <div className={`wattonaut-demo__block wattonaut-demo__block--${block.tone}`} key={block.kind}>
                    <span className="wattonaut-demo__block-line" /><span className="wattonaut-demo__block-kind">{block.kind}</span><strong>{block.value}</strong><small>{block.detail}</small>
                  </div>)}
                </div>
                <div className="wattonaut-demo__next-actions">
                  <button type="button" className="wattonaut-demo__primary-button" onClick={() => setStarted((value) => !value)}>
                    {started ? <><Check size={17} /> Workout started</> : <><Play size={17} fill="currentColor" /> Start workout</>}
                  </button>
                  <button type="button" className="wattonaut-demo__secondary-button" onClick={() => setDetailsOpen((value) => !value)}>
                    {detailsOpen ? 'Hide details' : 'View details'} <ChevronRight size={16} />
                  </button>
                </div>
                {detailsOpen ? <div className="wattonaut-demo__detail-note">Your coach suggests starting conservatively for the first effort, then building by feel. This demo state represents an expanded session note.</div> : null}
              </div>
            </section>

            <aside className="wattonaut-demo__side-column">
              <section className="wattonaut-demo__week-card" id="week">
                <div className="wattonaut-demo__section-heading"><div><p className="wattonaut-demo__section-kicker">Week of Sep 9</p><h2>Keep the rhythm</h2></div><button type="button" className="wattonaut-demo__more-button" aria-label="More week options">•••</button></div>
                <div className="wattonaut-demo__week-stats"><strong>3 <small>of 6 sessions</small></strong><span>42.5 km planned</span></div>
                <div className="wattonaut-demo__days" aria-label="Training week">
                  {days.map((day) => <div className={`wattonaut-demo__day wattonaut-demo__day--${day.status}`} key={`${day.label}-${day.date}`}><span>{day.label}</span><strong>{day.date}</strong><i aria-label={day.value} /></div>)}
                </div>
                <div className="wattonaut-demo__week-progress"><span style={{ width: '52%' }} /></div>
                <Link href="#calendar" className="wattonaut-demo__text-link">Open calendar <ArrowUpRight size={15} /></Link>
              </section>

              <section className="wattonaut-demo__activity-card" id="activity">
                <div className="wattonaut-demo__section-heading"><div><p className="wattonaut-demo__section-kicker">Recent activity</p><h2>Good work, lately</h2></div><a href="#activity" className="wattonaut-demo__text-link">See all</a></div>
                <div className="wattonaut-demo__activity-list">
                  {activities.map((activity) => <div className="wattonaut-demo__activity" key={activity.title}><span className={`wattonaut-demo__activity-dot wattonaut-demo__activity-dot--${activity.color}`} /><span className="wattonaut-demo__activity-copy"><strong>{activity.title}</strong><small>{activity.sport} – {activity.meta}</small></span><strong className="wattonaut-demo__activity-value">{activity.value}</strong></div>)}
                </div>
              </section>
            </aside>
          </div>

          <footer className="wattonaut-demo__footer"><span>Wattonaut design direction preview</span><span>Sample athlete data – not connected to your account</span></footer>
        </section>
      </div>
    </main>
  );
}
