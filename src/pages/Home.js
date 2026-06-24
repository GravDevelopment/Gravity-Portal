import { useState, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useRecords } from '../context/RecordsContext';
import { useRowTooltip, RowTooltip } from '../components/RowTooltip';
import RebookModal from '../components/RebookModal';
import LoadingScreen from '../components/LoadingScreen';
import './Home.css';

const STATUS_COLOURS = {
  Competent: '#16a34a',
  Completed: '#0ea5e9',
  Pending:   '#6b7280',
  NYC:       '#d2232a',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA');
}

function clampDate(v) {
  if (!v) return '';
  const min = '2000-01-01';
  const max = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function StatCard({ label, value, sub, accent, active, onClick }) {
  return (
    <div className={`stat-card${onClick ? ' stat-card--clickable' : ''}${active ? ' stat-card--active' : ''}`} onClick={onClick}>
      <span className="stat-value" style={accent ? { color: 'var(--accent)' } : undefined}>{value}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function DonutChart({ data, total }) {
  const cx = 80, cy = 80, r = 58, stroke = 20;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(d => {
    const dash = (d.value / total) * circumference;
    const gap  = circumference - dash;
    const slice = { ...d, dash, gap, offset };
    offset += dash;
    return slice;
  });
  return (
    <svg viewBox="0 0 160 160" width="160" height="160" style={{ display: 'block', margin: '0 auto' }}>
      {slices.map(s => (
        <circle key={s.name} cx={cx} cy={cy} r={r} fill="none"
          stroke={STATUS_COLOURS[s.name] || '#94a3b8'} strokeWidth={stroke}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset + circumference / 4}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#6b7280">enrolments</text>
    </svg>
  );
}

function StatusPieChart({ records, dateFrom, dateTo, setDateFrom, setDateTo }) {
  const hasRange = dateFrom || dateTo;
  const pieData = useMemo(() => {
    const counts = {};
    records.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [records]);
  return (
    <div className="pie-card">
      <div className="pie-card-header">
        <h2>Enrolments by Status</h2>
        <div className="pie-date-range">
          <input type="date" className="pie-date-input" value={dateFrom} min="2000-01-01" max={new Date().toISOString().slice(0,10)} onChange={e => setDateFrom(clampDate(e.target.value))} onBlur={e => setDateFrom(clampDate(e.target.value))} title="From date" />
          <span className="pie-date-sep">—</span>
          <input type="date" className="pie-date-input" value={dateTo} min={dateFrom || '2000-01-01'} max={new Date().toISOString().slice(0,10)} onChange={e => setDateTo(clampDate(e.target.value))} onBlur={e => setDateTo(clampDate(e.target.value))} title="To date" />
          {hasRange && <button className="pie-clear" onClick={() => { setDateFrom(''); setDateTo(''); }}>✕</button>}
        </div>
      </div>
      {pieData.length === 0 ? <p className="pie-empty">No records in this range.</p> : (
        <>
          <DonutChart data={pieData} total={records.length} />
          <div className="donut-legend">
            {pieData.map(d => (
              <span key={d.name} className="donut-legend-item">
                <span className="donut-legend-dot" style={{ background: STATUS_COLOURS[d.name] || '#94a3b8' }} />
                {d.name} <strong>{d.value}</strong>
              </span>
            ))}
          </div>
        </>
      )}
      <p className="pie-total">{records.length} total{hasRange ? ' in range' : ''}</p>
    </div>
  );
}

function VenueBarChart({ records, selectedVenue, onVenueClick }) {
  const { data, total } = useMemo(() => {
    const counts = {};
    records.forEach(r => {
      if (!r.venue) return;
      counts[r.venue] = (counts[r.venue] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([venue, count]) => ({ venue, count }))
      .sort((a, b) => b.count - a.count);
    return { data: sorted, total: records.filter(r => r.venue).length };
  }, [records]);
  const max = data.length ? data[0].count : 1;
  return (
    <div className="pie-card">
      <div className="pie-card-header">
        <h2>Enrolments by Venue</h2>
        {selectedVenue && (
          <button className="pie-clear" onClick={() => onVenueClick(null)} title="Clear venue filter">✕</button>
        )}
      </div>
      {data.length === 0 ? (
        <p className="pie-empty">No venue data available.</p>
      ) : (
        <div className="region-bars">
          {data.map(({ venue, count }) => {
            const active = selectedVenue === venue;
            const dimmed = selectedVenue && !active;
            return (
              <div key={venue} className={`region-bar-row region-bar-row--clickable${active ? ' region-bar-row--active' : ''}${dimmed ? ' region-bar-row--dimmed' : ''}`}
                onClick={() => onVenueClick(active ? null : venue)}
                title={`Filter by ${venue}`}
              >
                <span className="region-bar-label">{venue}</span>
                <div className="region-bar-track"><div className="region-bar-fill" style={{ width: `${(count / max) * 100}%` }} /></div>
                <span className="region-bar-count">{count}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="pie-total">{selectedVenue ? `Filtered: ${selectedVenue}` : `${total} enrolments with venue data`}</p>
    </div>
  );
}

const FILTERS = {
  all:        { label: 'Recent Training',         cols: ['venue','candidate','course','date','status'] },
  completed:  { label: 'Competent Learners',       cols: ['venue','candidate','course','date'] },
  failed:     { label: 'Not Yet Competent',        cols: ['venue','candidate','course','date'] },
  pending:    { label: 'Pending Learners',         cols: ['venue','candidate','course','date'] },
  revalidation: { label: 'Revalidation Due',       cols: ['candidate','course','date','expiry'] },
};

const COL_HEADERS = {
  candidate: 'Candidate', course: 'Course', venue: 'Venue',
  date: 'Date', status: 'Status', expiry: 'Expiry Date',
};

export default function Home() {
  const { user } = useAuth0();
  const userName = user?.name ?? user?.email ?? '';
  const { records: allRecords, loading } = useRecords();
  const [activeFilter, setActiveFilter] = useState('all');
  const [venueFilter, setVenueFilter]   = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const records = useMemo(() => {
    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) && dateFrom >= '1900-01-01' ? dateFrom : '';
    const validTo   = /^\d{4}-\d{2}-\d{2}$/.test(dateTo)   && dateTo   >= '1900-01-01' ? dateTo   : '';
    if (!validFrom && !validTo && !venueFilter) return allRecords;
    return allRecords.filter(r => {
      if (validFrom && (!r.trainingDate || r.trainingDate < validFrom)) return false;
      if (validTo   && (!r.trainingDate || r.trainingDate > validTo))   return false;
      if (venueFilter && r.venue !== venueFilter) return false;
      return true;
    });
  }, [allRecords, dateFrom, dateTo, venueFilter]);
  const { tooltip, show, hide } = useRowTooltip();
  const [rebookRecord, setRebookRecord] = useState(null);

  const uniqueLearners = useMemo(() => new Set(records.map(r => r.idNumber || r.candidateName)).size, [records]);
  const completed      = useMemo(() => records.filter(r => r.status === 'Competent').length, [records]);
  const failed         = useMemo(() => records.filter(r => r.status === 'NYC').length, [records]);
  const pending        = useMemo(() => records.filter(r => r.status === 'Pending').length, [records]);
  const venues         = useMemo(() => [...new Set(records.map(r => r.venue).filter(Boolean))].length, [records]);
  const completedNoExpiry = useMemo(() => {
    const list = records.filter(r => r.status === 'Competent' && !r.expiryDate);
    if (list.length) console.warn(`[Sanity] ${list.length} Completed records have NO expiry date`, list.slice(0, 5));
    return list.length;
  }, [records]);
  // eslint-disable-next-line no-unused-vars
  const _sanity = completedNoExpiry;
  const expiringSoon   = useMemo(() => records.filter(r => {
    if (!r.expiryDate) return false;
    const diff = (new Date(r.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
    return diff <= 180;
  }).length, [records]);

  const tableRecords = useMemo(() => {
    switch (activeFilter) {
      case 'completed':
        return [...records].filter(r => r.status === 'Competent')
          .sort((a, b) => new Date(b.trainingDate) - new Date(a.trainingDate)).slice(0, 50);
      case 'failed':
        return [...records].filter(r => r.status === 'NYC')
          .sort((a, b) => new Date(b.trainingDate) - new Date(a.trainingDate)).slice(0, 50);
      case 'pending':
        return [...records].filter(r => r.status === 'Pending')
          .sort((a, b) => new Date(b.trainingDate) - new Date(a.trainingDate)).slice(0, 50);
      case 'revalidation':
        return [...records].filter(r => {
          if (!r.expiryDate) return false;
          const diff = (new Date(r.expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
          return diff <= 180;
        }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)).slice(0, 50);
      default:
        return [...records].filter(r => r.trainingDate)
          .sort((a, b) => new Date(b.trainingDate) - new Date(a.trainingDate)).slice(0, 10);
    }
  }, [records, activeFilter]);

  const cols = FILTERS[activeFilter]?.cols ?? FILTERS.all.cols;

  const filteredTableRecords = useMemo(() => {
    if (!venueFilter) return tableRecords;
    // Apply venue on top of the status-filtered base (re-derive without slice limit)
    let base = [...records];
    switch (activeFilter) {
      case 'completed':   base = base.filter(r => r.status === 'Competent'); break;
      case 'failed':      base = base.filter(r => r.status === 'NYC'); break;
      case 'pending':     base = base.filter(r => r.status === 'Pending'); break;
      case 'revalidation': base = base.filter(r => {
        if (!r.expiryDate) return false;
        return (new Date(r.expiryDate) - new Date()) / (1000 * 60 * 60 * 24) <= 180;
      }); break;
      default: base = base.filter(r => r.trainingDate); break;
    }
    return base
      .filter(r => r.venue === venueFilter)
      .sort((a, b) => new Date(b.trainingDate) - new Date(a.trainingDate))
      .slice(0, 50);
  }, [tableRecords, venueFilter, records, activeFilter]);

  const groupedRecords = useMemo(() => {
    const map = new Map();
    filteredTableRecords.forEach(r => {
      const key = r.idNumber || r.candidateName;
      if (!map.has(key)) map.set(key, { key, name: r.candidateName, rows: [] });
      map.get(key).rows.push(r);
    });
    return Array.from(map.values());
  }, [filteredTableRecords]);

  function toggle(key) {
    setActiveFilter(prev => prev === key ? 'all' : key);
  }

  function expiryClass(d) {
    if (!d) return '';
    const diff = (new Date(d) - new Date()) / (1000 * 60 * 60 * 24);
    if (diff <= 90)  return 'td-expiry-red';
    if (diff <= 180) return 'td-expiry-orange';
    return '';
  }

  if (loading) return <LoadingScreen message="Fetching your training data…" />;

  return (
    <main className="page">
      <div className="home-header">
        <div>
          <h1>Welcome back{userName ? `, ${userName.split(' ')[0]}` : ''}</h1>
          <p className="home-client-name">Here's an overview of your training activity.</p>
        </div>
      </div>

      <div className="home-body">
        <div className="home-left">
          <StatusPieChart records={records} dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />
          <VenueBarChart records={records} selectedVenue={venueFilter} onVenueClick={setVenueFilter} />
        </div>

        <div className="home-right">
          <div className="stat-grid">
            <StatCard label="Total Learners" value={uniqueLearners} sub={`${records.length} enrolments`}
              active={activeFilter === 'all'} onClick={() => toggle('all')} />
            <StatCard label="Competent" value={completed}
              active={activeFilter === 'completed'} onClick={() => toggle('completed')} />
            <StatCard label="Not Yet Competent" value={failed} accent={failed > 0}
              active={activeFilter === 'failed'} onClick={() => toggle('failed')} />
            <StatCard label="Pending" value={pending}
              active={activeFilter === 'pending'} onClick={() => toggle('pending')} />
            <StatCard label="Venues" value={venues} sub="training locations" />
            <StatCard label="Revalidation Due" value={expiringSoon} sub="expiring or expired" accent={expiringSoon > 0}
              active={activeFilter === 'revalidation'} onClick={() => toggle('revalidation')} />
          </div>

          <section className="home-section">
            <h2>{FILTERS[activeFilter]?.label ?? 'Recent Training'}{venueFilter ? ` — ${venueFilter}` : ''}</h2>
            <div className="recent-table-wrap">
              <table className="recent-table">
                <thead>
                  <tr>{cols.map(c => <th key={c}>{COL_HEADERS[c]}</th>)}</tr>
                </thead>
                <tbody>
                  {groupedRecords.map(group => (
                    group.rows.map((r, i) => {
                      const tooltipLines = [
                        { label: 'Candidate', value: r.candidateName },
                        ...group.rows.map((gr, j) => ([
                          { label: `Course ${j + 1}`, value: gr.course },
                          { label: `Date ${j + 1}`,   value: fmtDate(gr.trainingDate) },
                          { label: `Expiry ${j + 1}`, value: gr.expiryDate ? fmtDate(gr.expiryDate) : null },
                        ])).flat().filter(l => l.value),
                      ];
                      return (
                        <tr key={r.id}
                          className={i === 0 ? 'tr-learner-first' : 'tr-learner-cont'}
                          onClick={() => activeFilter === 'revalidation' && setRebookRecord(r)}
                          style={activeFilter === 'revalidation' ? { cursor: 'pointer' } : undefined}
                          onMouseEnter={e => show(e, tooltipLines)}
                          onMouseLeave={hide}
                        >
                          {cols.map(col => {
                            if (col === 'candidate') return i === 0
                              ? <td key={col} rowSpan={group.rows.length} className="td-group-cell">{r.candidateName}</td>
                              : null;
                            if (col === 'course') return <td key={col}>{r.course}</td>;
                            if (col === 'venue')  return <td key={col}>{r.venue ?? '—'}</td>;
                            if (col === 'date')   return <td key={col}>{fmtDate(r.trainingDate)}</td>;
                            if (col === 'status') return <td key={col}><span className={`badge badge--${r.status.replace(' ','-').toLowerCase()}`}>{r.status}</span></td>;
                            if (col === 'expiry') return <td key={col} className={expiryClass(r.expiryDate)}>{fmtDate(r.expiryDate)}</td>;
                            return null;
                          })}
                        </tr>
                      );
                    })
                  ))}
                </tbody>
              </table>
            </div>
            {tableRecords.length === 50 && (
              <p className="home-table-hint">Showing top 50 — go to Training Data for the full list.</p>
            )}
          </section>
        </div>
      </div>
      <RowTooltip tooltip={tooltip} />
      <RebookModal
        record={rebookRecord}
        userName={user?.name ?? user?.email ?? ''}
        userEmail={user?.email ?? ''}
        onClose={() => setRebookRecord(null)}
      />
    </main>
  );
}
