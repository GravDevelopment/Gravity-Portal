import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import {
  usePortalCompanies,
  usePortalUsers,
  usePortalPermissions,
  useTrainingCompanies,
  saveCompany,
  deleteCompany,
  saveUser,
  deleteUser,
  savePermission,
} from '../auth/usePortalAdmin';
import './Admin.css';

// ── small helpers ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Completed', 'Failed', 'Pending', 'Cancelled'];

function Toggle({ checked, onChange, label }) {
  return (
    <label className="adm-toggle">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className="adm-toggle-track"><span className="adm-toggle-thumb" /></span>
      {label && <span className="adm-toggle-label">{label}</span>}
    </label>
  );
}

function InlineError({ msg }) {
  if (!msg) return null;
  return <p className="adm-error">{msg}</p>;
}

function InlineInfo({ msg }) {
  if (!msg) return null;
  return <p className="adm-info">{msg}</p>;
}

// ── Permission form (shared for company-level and user-level) ─────────────────

function PermissionForm({ perm, islevel, companyId, userId, onSaved }) {
  const { instance, accounts } = useMsal();
  const { companies: allCompanies, loading: companiesLoading } = useTrainingCompanies();

  const [canHome,        setCanHome]        = useState(perm?.crc41_canviewhome         ?? true);
  const [canTraining,    setCanTraining]    = useState(perm?.crc41_canviewtrainingdata ?? true);
  const [venueFilter,    setVenueFilter]    = useState(perm?.crc41_venuefilter         ?? '');
  const [companyFilter,  setCompanyFilter]  = useState(() => {
    const s = perm?.crc41_companyfilter ?? '';
    return s ? s.split(',').map(x => x.trim()).filter(Boolean) : [];
  });
  const [statusSel,      setStatusSel]      = useState(() => {
    const s = perm?.crc41_statusfilter ?? '';
    return s ? s.split(',').map(x => x.trim()).filter(Boolean) : [];
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [saved,  setSaved]  = useState(false);

  // sync when perm changes (e.g. after reload)
  useEffect(() => {
    setCanHome(perm?.crc41_canviewhome         ?? true);
    setCanTraining(perm?.crc41_canviewtrainingdata ?? true);
    setVenueFilter(perm?.crc41_venuefilter         ?? '');
    const cf = perm?.crc41_companyfilter ?? '';
    setCompanyFilter(cf ? cf.split(',').map(x => x.trim()).filter(Boolean) : []);
    const s = perm?.crc41_statusfilter ?? '';
    setStatusSel(s ? s.split(',').map(x => x.trim()).filter(Boolean) : []);
  }, [perm]);

  function toggleStatus(s) {
    setStatusSel(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  function toggleCompany(name) {
    setCompanyFilter(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false);
    try {
      await savePermission(instance, accounts, {
        crc41_portalpermissionid:  perm?.crc41_portalpermissionid,
        companyId,
        userId,
        crc41_canviewhome:         canHome,
        crc41_canviewtrainingdata: canTraining,
        crc41_venuefilter:         venueFilter.trim(),
        crc41_companyfilter:       companyFilter.join(','),
        crc41_statusfilter:        statusSel.join(','),
        crc41_islevel:             islevel,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-perm-form">
      <div className="adm-perm-row">
        <Toggle checked={canHome}     onChange={setCanHome}     label="View Home" />
        <Toggle checked={canTraining} onChange={setCanTraining} label="View Training Data" />
      </div>

      <div className="adm-field-row">
        <label className="adm-field-label">Company filter <span className="adm-muted">(none selected = all companies)</span></label>
        {companiesLoading ? (
          <p className="adm-muted">Loading companies…</p>
        ) : allCompanies.length === 0 ? (
          <p className="adm-muted">No companies found.</p>
        ) : (
          <>
            <div className="adm-pills adm-pills--scroll">
              {allCompanies.map(c => (
                <button
                  key={c.accountid}
                  type="button"
                  className={`filter-btn${companyFilter.includes(c.name) ? ' filter-btn--active' : ''}`}
                  onClick={() => toggleCompany(c.name)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {companyFilter.length > 0 && (
              <p className="adm-muted" style={{ marginTop: '6px', fontSize: '12px' }}>
                {companyFilter.length} selected — users see only these companies' data
              </p>
            )}
          </>
        )}
      </div>

      <div className="adm-field-row">
        <label className="adm-field-label">Venue filter <span className="adm-muted">(comma-separated, blank = all)</span></label>
        <input
          className="adm-input"
          type="text"
          value={venueFilter}
          onChange={e => setVenueFilter(e.target.value)}
          placeholder="e.g. Joburg, Cape Town"
        />
      </div>

      <div className="adm-field-row">
        <label className="adm-field-label">Status filter <span className="adm-muted">(none checked = all)</span></label>
        <div className="adm-pills">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              type="button"
              className={`filter-btn${statusSel.includes(s) ? ' filter-btn--active' : ''}`}
              onClick={() => toggleStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <InlineError msg={error} />
      {saved && <InlineInfo msg="Saved." />}

      <button className="adm-btn adm-btn--primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Permissions'}
      </button>
    </div>
  );
}

// ── User permission override panel ────────────────────────────────────────────

function UserPermPanel({ user, companyId, onClose }) {
  const { companyPerm, userPerm, loading, error, reload } =
    usePortalPermissions(companyId, user.crc41_portaluserid);

  const [useOverride, setUseOverride] = useState(false);

  // once loaded, detect if an override already exists
  useEffect(() => {
    if (!loading) setUseOverride(!!userPerm);
  }, [loading, userPerm]);

  return (
    <div className="adm-user-perm-panel">
      <div className="adm-user-perm-header">
        <span className="adm-user-perm-title">Permissions for {user.crc41_displayname || user.crc41_email}</span>
        <button className="adm-icon-btn" onClick={onClose} title="Close">✕</button>
      </div>

      {loading && <p className="adm-muted">Loading…</p>}
      {error   && <InlineError msg={error} />}

      {!loading && (
        <>
          <div className="adm-perm-mode-row">
            <Toggle
              checked={useOverride}
              onChange={v => setUseOverride(v)}
              label="Override company permissions for this user"
            />
          </div>

          {useOverride ? (
            <PermissionForm
              perm={userPerm}
              islevel="user"
              companyId={null}
              userId={user.crc41_portaluserid}
              onSaved={reload}
            />
          ) : (
            <p className="adm-muted adm-inherit-note">
              This user inherits the company-level permissions shown above.
              {userPerm && ' (Toggle override on to edit user-specific rules.)'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Users section ─────────────────────────────────────────────────────────────

function UsersSection({ companyId }) {
  const { instance, accounts }            = useMsal();
  const { users, loading, error, reload } = usePortalUsers(companyId);

  const [editingUser, setEditingUser]     = useState(null); // null | {} (new) | {user}
  const [permUser, setPermUser]           = useState(null); // user row whose perms are open
  const [opError, setOpError]             = useState(null);

  const blank = { crc41_email: '', crc41_displayname: '', crc41_isactive: true };

  function startNew()  { setEditingUser({ ...blank }); setPermUser(null); }
  function startEdit(u){ setEditingUser({ ...u });      setPermUser(null); }
  function cancel()    { setEditingUser(null); setOpError(null); }

  async function handleSaveUser(formData) {
    setOpError(null);
    try {
      await saveUser(instance, accounts, { ...formData, companyId });
      setEditingUser(null);
      reload();
    } catch (err) {
      setOpError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this user?')) return;
    setOpError(null);
    try {
      await deleteUser(instance, accounts, id);
      if (permUser?.crc41_portaluserid === id) setPermUser(null);
      reload();
    } catch (err) {
      setOpError(err.message);
    }
  }

  function togglePermPanel(u) {
    setPermUser(prev => prev?.crc41_portaluserid === u.crc41_portaluserid ? null : u);
  }

  return (
    <div className="adm-users-section">
      <div className="adm-section-header">
        <h3>Users</h3>
        <button className="adm-btn adm-btn--ghost" onClick={startNew}>+ Add User</button>
      </div>

      {loading && <p className="adm-muted">Loading users…</p>}
      {error   && <InlineError msg={error} />}
      {opError && <InlineError msg={opError} />}

      {/* inline add/edit form */}
      {editingUser && (
        <UserForm
          initial={editingUser}
          onSave={handleSaveUser}
          onCancel={cancel}
          error={opError}
        />
      )}

      {!loading && users.length === 0 && !editingUser && (
        <p className="adm-muted">No users yet.</p>
      )}

      {users.length > 0 && (
        <table className="td-table adm-user-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <>
                <tr
                  key={u.crc41_portaluserid}
                  className={`adm-user-row${permUser?.crc41_portaluserid === u.crc41_portaluserid ? ' adm-user-row--selected' : ''}`}
                  onClick={() => togglePermPanel(u)}
                  title="Click to view/edit permissions"
                >
                  <td>{u.crc41_email}</td>
                  <td>{u.crc41_displayname || '—'}</td>
                  <td>
                    <span className={`adm-badge ${u.crc41_isactive ? 'adm-badge--active' : 'adm-badge--inactive'}`}>
                      {u.crc41_isactive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="adm-actions" onClick={e => e.stopPropagation()}>
                    <button className="adm-icon-btn" title="Edit" onClick={() => startEdit(u)}>✎</button>
                    <button className="adm-icon-btn adm-icon-btn--danger" title="Delete" onClick={() => handleDelete(u.crc41_portaluserid)}>✕</button>
                  </td>
                </tr>

                {permUser?.crc41_portaluserid === u.crc41_portaluserid && (
                  <tr key={`${u.crc41_portaluserid}-perm`} className="adm-perm-row-tr">
                    <td colSpan={4} className="adm-perm-row-td">
                      <UserPermPanel
                        user={u}
                        companyId={companyId}
                        onClose={() => setPermUser(null)}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Inline user form ──────────────────────────────────────────────────────────

function UserForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      await onSave(form);
    } catch (ex) {
      setErr(ex.message);
      setSaving(false);
    }
  }

  return (
    <form className="adm-inline-form" onSubmit={submit}>
      <input
        className="adm-input"
        type="email"
        placeholder="Email *"
        required
        value={form.crc41_email}
        onChange={e => set('crc41_email', e.target.value)}
      />
      <input
        className="adm-input"
        type="text"
        placeholder="Display name"
        value={form.crc41_displayname}
        onChange={e => set('crc41_displayname', e.target.value)}
      />
      <Toggle
        checked={form.crc41_isactive}
        onChange={v => set('crc41_isactive', v)}
        label="Active"
      />
      {err && <InlineError msg={err} />}
      <div className="adm-form-actions">
        <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
          {saving ? 'Saving…' : (initial.crc41_portaluserid ? 'Update User' : 'Add User')}
        </button>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Company detail panel ──────────────────────────────────────────────────────

function CompanyDetail({ company, onSaved, onDeleted }) {
  const { instance, accounts }                      = useMsal();
  const { companyPerm, loading: permLoading, error: permError, reload: reloadPerm } =
    usePortalPermissions(company?.crc41_portalcompanyid, null);

  const [name,   setName]   = useState(company?.crc41_name        ?? '');
  const [desc,   setDesc]   = useState(company?.crc41_description ?? '');
  const [active, setActive] = useState(company?.crc41_isactive    ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error,  setError]  = useState(null);
  const [saved,  setSaved]  = useState(false);

  // sync when company prop changes
  useEffect(() => {
    setName(company?.crc41_name        ?? '');
    setDesc(company?.crc41_description ?? '');
    setActive(company?.crc41_isactive  ?? true);
    setError(null);
    setSaved(false);
  }, [company?.crc41_portalcompanyid]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError(null); setSaved(false);
    try {
      await saveCompany(instance, accounts, {
        crc41_portalcompanyid: company?.crc41_portalcompanyid,
        crc41_name:            name.trim(),
        crc41_description:     desc.trim(),
        crc41_isactive:        active,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete company "${name}"? This cannot be undone.`)) return;
    setDeleting(true); setError(null);
    try {
      await deleteCompany(instance, accounts, company.crc41_portalcompanyid);
      onDeleted?.();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  if (!company) {
    return (
      <div className="adm-detail-empty">
        <p className="adm-muted">Select a company to view details.</p>
      </div>
    );
  }

  return (
    <div className="adm-detail">
      {/* ── Company fields ── */}
      <form onSubmit={handleSave}>
        <div className="adm-detail-section">
          <h2 className="adm-detail-title">
            {company.crc41_portalcompanyid ? 'Edit Company' : 'New Company'}
          </h2>

          <div className="adm-field-row">
            <label className="adm-field-label">Name</label>
            <input
              className="adm-input"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Company name"
            />
          </div>

          <div className="adm-field-row">
            <label className="adm-field-label">Description</label>
            <textarea
              className="adm-textarea"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="adm-field-row adm-field-row--inline">
            <label className="adm-field-label">Active</label>
            <Toggle checked={active} onChange={setActive} />
          </div>

          <InlineError msg={error} />
          {saved && <InlineInfo msg="Company saved." />}

          <div className="adm-form-actions">
            <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Company'}
            </button>
            {company.crc41_portalcompanyid && (
              <button
                type="button"
                className="adm-btn adm-btn--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete Company'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ── Default permissions ── */}
      {company.crc41_portalcompanyid && (
        <div className="adm-detail-section">
          <h3 className="adm-section-title">Default Permissions <span className="adm-muted">(all users in this company)</span></h3>
          {permLoading && <p className="adm-muted">Loading permissions…</p>}
          {permError   && <InlineError msg={permError} />}
          {!permLoading && (
            <PermissionForm
              perm={companyPerm}
              islevel="company"
              companyId={company.crc41_portalcompanyid}
              userId={null}
              onSaved={reloadPerm}
            />
          )}
        </div>
      )}

      {/* ── Users ── */}
      {company.crc41_portalcompanyid && (
        <div className="adm-detail-section">
          <UsersSection companyId={company.crc41_portalcompanyid} />
        </div>
      )}
    </div>
  );
}

// ── Main Admin page ───────────────────────────────────────────────────────────

export default function Admin() {
  const { companies, loading, error, reload } = usePortalCompanies();
  const { instance, accounts }                = useMsal();

  const [selected, setSelected]   = useState(null); // company object
  const [addingNew, setAddingNew] = useState(false);
  const [opError, setOpError]     = useState(null);

  function selectCompany(c) {
    setSelected(c);
    setAddingNew(false);
    setOpError(null);
  }

  function startNewCompany() {
    setSelected(null);
    setAddingNew(true);
    setOpError(null);
  }

  async function handleNewCompanySaved() {
    setAddingNew(false);
    reload();
  }

  function handleCompanySaved() {
    reload();
  }

  function handleCompanyDeleted() {
    setSelected(null);
    reload();
  }

  // active object for the detail panel
  const detailCompany = addingNew
    ? { crc41_name: '', crc41_description: '', crc41_isactive: true }
    : selected;

  return (
    <main className="page page--full adm-page">
      <div className="adm-layout">

        {/* ── Sidebar: company list ── */}
        <aside className="adm-sidebar">
          <div className="adm-sidebar-header">
            <span className="adm-sidebar-title">Companies</span>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={startNewCompany}>
              + Add
            </button>
          </div>

          {loading && <p className="adm-muted adm-sidebar-msg">Loading…</p>}
          {error   && <InlineError msg={error} />}
          {opError && <InlineError msg={opError} />}

          {!loading && companies.length === 0 && (
            <p className="adm-muted adm-sidebar-msg">No companies yet.</p>
          )}

          <ul className="adm-company-list">
            {companies.map(c => (
              <li
                key={c.crc41_portalcompanyid}
                className={`adm-company-item${selected?.crc41_portalcompanyid === c.crc41_portalcompanyid ? ' adm-company-item--active' : ''}`}
                onClick={() => selectCompany(c)}
              >
                <span className="adm-company-name">{c.crc41_name}</span>
                {!c.crc41_isactive && <span className="adm-badge adm-badge--inactive">Inactive</span>}
                <span className="adm-company-chevron">›</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Detail panel ── */}
        <section className="adm-main">
          <CompanyDetail
            company={detailCompany}
            onSaved={addingNew ? handleNewCompanySaved : handleCompanySaved}
            onDeleted={handleCompanyDeleted}
          />
        </section>
      </div>
    </main>
  );
}
