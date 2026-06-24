import { useState, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useApiTrainingRecords as useTrainingRecords } from '../auth/useApiTrainingRecords';
import TrainingChart, { GROUP_OPTIONS } from '../components/TrainingChart';
import { useRowTooltip, RowTooltip } from '../components/RowTooltip';
import LoadingScreen from '../components/LoadingScreen';
import './TrainingData.css';

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ZA');
}

function expiryClass(dateStr) {
  if (!dateStr) return '';
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 0)          return '';
  if (diff <= 90)        return 'td-expiry-red';
  if (diff <= 180)       return 'td-expiry-orange';
  return 'td-expiry-green';
}

function TableIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M2 4a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2z"/>
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
    </svg>
  );
}

function SortIcon({ dir }) {
  if (!dir) return <span className="sort-icon sort-icon--none">⇅</span>;
  return <span className="sort-icon">{dir === 'asc' ? '↑' : '↓'}</span>;
}

const FIXED_COLS = [
  { key: 'company',   label: 'Company' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName',  label: 'Last Name' },
  { key: 'idNumber',  label: 'ID Number' },
];

const PAGE_SIZE = 200;

export default function TrainingData() {
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('All');
  const [venue, setVenue]       = useState('All');
  const [course, setCourse]     = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [view, setView]         = useState('table');
  const [groupBy, setGroupBy]   = useState('status');
  const [sortKey, setSortKey]   = useState('latestDate');
  const [sortDir, setSortDir]   = useState('desc');
  const [page, setPage]         = useState(0);

  const { records, loading, error } = useTrainingRecords();
  const { user } = useAuth0();
  const isGravity  = (user?.email ?? '').toLowerCase().endsWith('@gravitygh.co.za');
  const companyName = user?.name ?? null;
  const { tooltip, show, hide }     = useRowTooltip();

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const statuses = useMemo(() => {
    const u = [...new Set(records.map(r => r.status).filter(Boolean))].sort();
    return ['All', ...u];
  }, [records]);

  const venues = useMemo(() => {
    const u = [...new Set(records.map(r => r.venue).filter(Boolean))].sort();
    return ['All', ...u];
  }, [records]);

  const courses = useMemo(() => {
    const u = [...new Set(records.map(r => r.course).filter(Boolean))].sort();
    return ['All', ...u];
  }, [records]);

  const activeFilterCount = [status !== 'All', venue !== 'All', course !== 'All', !!dateFrom, !!dateTo, !!search].filter(Boolean).length;

  function clearFilters() {
    setSearch(''); setStatus('All'); setVenue('All'); setCourse('All');
    setDateFrom(''); setDateTo(''); setPage(0);
  }

  // filter individual enrollment records
  const filtered = useMemo(() => {
    setPage(0);
    const q = search.toLowerCase();
    return records.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (venue  !== 'All' && r.venue  !== venue)  return false;
      if (course !== 'All' && r.course !== course) return false;
      if (dateFrom && r.trainingDate < dateFrom) return false;
      if (dateTo   && r.trainingDate > dateTo)   return false;
      if (q && !(
        r._search.includes(q) ||
        r.course.toLowerCase().includes(q) ||
        (r.company && r.company.toLowerCase().includes(q)) ||
        (r.idNumber && r.idNumber.toLowerCase().includes(q))
      )) return false;
      return true;
    });
  }, [records, search, status, venue, course, dateFrom, dateTo]);

  // group by learner — one row per person
  const learnerRows = useMemo(() => {
    const map = new Map();
    filtered.forEach(r => {
      const key = r.idNumber || r.candidateName;
      if (!map.has(key)) {
        const parts = r.candidateName.trim().split(/\s+/);
        map.set(key, {
          key,
          company:    r.company ?? '—',
          firstName:  parts[0] ?? '',
          lastName:   parts.slice(1).join(' ') || '—',
          idNumber:   r.idNumber || '—',
          latestDate: r.trainingDate ?? '',
          _search:    r._search,
          courses:    [],
        });
      }
      const row = map.get(key);
      if (r.trainingDate && r.trainingDate > row.latestDate) row.latestDate = r.trainingDate;
      row.courses.push({
        course:     r.course,
        expiryDate: r.expiryDate,
        status:     r.status,
      });
    });
    return Array.from(map.values());
  }, [filtered]);

  const sorted = useMemo(() => {
    return [...learnerRows].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = sortKey === 'latestDate'
        ? av < bv ? -1 : av > bv ? 1 : 0
        : av.toLowerCase() < bv.toLowerCase() ? -1 : av.toLowerCase() > bv.toLowerCase() ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [learnerRows, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalCols  = FIXED_COLS.length + 3;

  if (loading) return <LoadingScreen message="Fetching training records…" />;
  if (error)   return <main className="page page--full"><p style={{color:'#d2232a', padding:'2rem 0'}}>Dataverse error: {error}</p></main>;

  return (
    <main className="page page--full">
      <div className="td-header">
        <div>
          <h1>{isGravity ? 'Gravity' : (companyName ?? 'Training Data')}</h1>
          <p>Training records</p>
        </div>
        <div className="td-view-controls">
          {view === 'chart' && (
            <div className="td-filter-group">
              <label className="td-filter-label">Lines by</label>
              <div className="td-pills">
                {GROUP_OPTIONS.map(o => (
                  <button key={o.value} className={`filter-btn${groupBy === o.value ? ' filter-btn--active' : ''}`} onClick={() => setGroupBy(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="view-toggle">
            <button className={`view-btn${view === 'table' ? ' view-btn--active' : ''}`} onClick={() => setView('table')} title="Table view"><TableIcon /></button>
            <button className={`view-btn${view === 'chart' ? ' view-btn--active' : ''}`} onClick={() => setView('chart')} title="Chart view"><ChartIcon /></button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="td-filterbar">
        <input className="td-search" type="search" placeholder="Search name, ID, course, company…" value={search} onChange={e => setSearch(e.target.value)} />

        <div className="td-filter-group">
          <label className="td-filter-label">Status</label>
          <div className="td-pills">
            {statuses.map(s => (
              <button key={s} className={`filter-btn${status === s ? ' filter-btn--active' : ''}`} onClick={() => setStatus(s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="td-filter-group">
          <label className="td-filter-label">Venue</label>
          <select className="td-select" value={venue} onChange={e => setVenue(e.target.value)}>
            {venues.map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        <div className="td-filter-group">
          <label className="td-filter-label">Course</label>
          <select className="td-select" value={course} onChange={e => setCourse(e.target.value)}>
            {courses.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="td-filter-group">
          <label className="td-filter-label">From</label>
          <input className="td-date" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>

        <div className="td-filter-group">
          <label className="td-filter-label">To</label>
          <input className="td-date" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>

        {activeFilterCount > 0 && (
          <button className="td-clear" onClick={clearFilters}>Clear filters ({activeFilterCount})</button>
        )}
      </div>

      {view === 'table' ? (
        <>
          <div className="td-table-wrap">
            <table className="td-table td-table--grouped">
              <thead>
                <tr>
                  {FIXED_COLS.map(col => (
                    <th key={col.key} className={`th-sortable${sortKey === col.key ? ' th-sorted' : ''}`} onClick={() => handleSort(col.key)}>
                      <span className="th-inner">{col.label}<SortIcon dir={sortKey === col.key ? sortDir : null} /></span>
                    </th>
                  ))}
                  <th>Course</th>
                  <th>Status</th>
                  <th>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={7} className="td-empty">No records match your filters.</td></tr>
                ) : (
                  paginated.map(r => {
                    const courses = r.courses.length > 0 ? r.courses : [null];
                    return courses.map((c, i) => (
                      <tr key={`${r.key}-${i}`}
                        className={i === 0 ? 'tr-learner-first' : 'tr-learner-cont'}
                        onMouseEnter={e => show(e, [
                          { label: 'Company',   value: r.company },
                          { label: 'Name',      value: `${r.firstName} ${r.lastName}`.trim() },
                          { label: 'ID Number', value: r.idNumber },
                          ...r.courses.map((c, j) => ([
                            { label: `Course ${j + 1}`, value: c.course },
                            { label: `Expiry ${j + 1}`, value: c.expiryDate ? fmt(c.expiryDate) : null },
                          ])).flat().filter(l => l.value),
                        ])}
                        onMouseLeave={hide}
                      >
                        {i === 0 && <>
                          <td rowSpan={courses.length} className="td-group-cell">{r.company}</td>
                          <td rowSpan={courses.length} className="td-group-cell">{r.firstName}</td>
                          <td rowSpan={courses.length} className="td-group-cell">{r.lastName}</td>
                          <td rowSpan={courses.length} className="td-group-cell td-id">{r.idNumber}</td>
                        </>}
                        <td>{c ? c.course : '—'}</td>
                        <td>{c ? (
                          <span className={`badge badge--${(c.status || '').replace(' ','-').toLowerCase()}`}>{c.status || '—'}</span>
                        ) : '—'}</td>
                        <td className={c ? expiryClass(c.expiryDate) : ''}>{c ? fmt(c.expiryDate) : '—'}</td>
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="td-pagination">
            <span className="td-count">
              {learnerRows.length} learner{learnerRows.length !== 1 ? 's' : ''} ({filtered.length} enrolments)
              {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
            </span>
            {totalPages > 1 && (
              <div className="td-page-controls">
                <button className="td-page-btn" onClick={() => setPage(0)} disabled={page === 0}>««</button>
                <button className="td-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}>‹ Prev</button>
                <button className="td-page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next ›</button>
                <button className="td-page-btn" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»»</button>
              </div>
            )}
          </div>
        </>
      ) : (
        <TrainingChart records={filtered} groupBy={groupBy} />
      )}
      <RowTooltip tooltip={tooltip} />
    </main>
  );
}
