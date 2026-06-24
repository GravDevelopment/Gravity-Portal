import { useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { dataverseScopes, DATAVERSE_URL } from './msalConfig';

// ── helpers ──────────────────────────────────────────────────────────────────

async function getToken(instance, accounts) {
  const { accessToken } = await instance.acquireTokenSilent({
    scopes:  dataverseScopes,
    account: accounts[0],
  });
  return accessToken;
}

function baseHeaders(token) {
  return {
    Authorization:      `Bearer ${token}`,
    Accept:             'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version':    '4.0',
  };
}

async function dvFetch(url, headers) {
  const res = await window.fetch(url, { headers });
  if (!res.ok) throw new Error(`Dataverse ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── generic read hook ─────────────────────────────────────────────────────────

function useAdminQuery(table, odata) {
  const { instance, accounts } = useMsal();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tick, setTick]       = useState(0);

  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!accounts.length || !table) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken(instance, accounts);
        const headers = {
          ...baseHeaders(token),
          Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=5000',
        };
        let url = `${DATAVERSE_URL}/${table}${odata ? `?${odata}` : ''}`;
        const all = [];
        while (url) {
          const json = await dvFetch(url, headers);
          if (Array.isArray(json?.value)) all.push(...json.value);
          else { if (!cancelled) { setData(json); setLoading(false); } return; }
          url = json['@odata.nextLink'] ?? null;
        }
        if (!cancelled) { setData(all); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [instance, accounts, table, odata, tick]);

  return { data, loading, error, reload };
}

// ── public hooks ──────────────────────────────────────────────────────────────

export function usePortalCompanies() {
  const { data, loading, error, reload } = useAdminQuery(
    'crc41_portalcompanies',
    '$select=crc41_portalcompanyid,crc41_name,crc41_isactive,crc41_description&$orderby=crc41_name asc',
  );
  return { companies: data ?? [], loading, error, reload };
}

export function usePortalUsers(companyId) {
  const filter = companyId
    ? `$filter=_crc41_portalcompany_value eq '${companyId}'`
    : null;
  const odata = [
    '$select=crc41_portaluserid,crc41_email,crc41_displayname,_crc41_portalcompany_value,crc41_isactive',
    filter,
  ].filter(Boolean).join('&');

  const { data, loading, error, reload } = useAdminQuery(
    companyId ? 'crc41_portalusers' : null,
    odata,
  );
  return { users: data ?? [], loading, error, reload };
}

export function usePortalPermissions(companyId, userId) {
  const parts = [];
  if (companyId || userId) {
    const clauses = [];
    if (companyId) clauses.push(`_crc41_portalcompany_value eq '${companyId}'`);
    if (userId)    clauses.push(`_crc41_portaluser_value eq '${userId}'`);
    parts.push(`$filter=${clauses.join(' or ')}`);
  }
  parts.push('$select=crc41_portalpermissionid,_crc41_portalcompany_value,_crc41_portaluser_value,crc41_canviewhome,crc41_canviewtrainingdata,crc41_venuefilter,crc41_statusfilter,crc41_companyfilter,crc41_islevel');

  const { data, loading, error, reload } = useAdminQuery(
    companyId || userId ? 'crc41_portalpermissions' : null,
    parts.join('&'),
  );

  const companyPerm = (data ?? []).find(p => p.crc41_islevel === 'company') ?? null;
  const userPerm    = (data ?? []).find(p => p.crc41_islevel === 'user')    ?? null;

  return { companyPerm, userPerm, loading, error, reload };
}

export function useTrainingCompanies() {
  const accountsQ = useAdminQuery(
    'accounts',
    '$select=accountid,name&$filter=statecode eq 0&$orderby=name asc',
  );
  const secondaryQ = useAdminQuery(
    'tct_enrolls',
    '$select=tct_secondarycompany&$filter=tct_secondarycompany ne null',
  );

  const seen = new Set();
  const merged = [];
  (accountsQ.data ?? []).forEach(a => {
    const key = (a.name ?? '').trim().toLowerCase();
    if (key && !seen.has(key)) { seen.add(key); merged.push({ accountid: a.accountid, name: a.name }); }
  });
  (secondaryQ.data ?? []).forEach(r => {
    const name = (r.tct_secondarycompany ?? '').trim();
    const key  = name.toLowerCase();
    if (key && !seen.has(key)) { seen.add(key); merged.push({ accountid: `sec-${key}`, name }); }
  });
  merged.sort((a, b) => a.name.localeCompare(b.name));

  return {
    companies: merged,
    loading:   accountsQ.loading || secondaryQ.loading,
    error:     accountsQ.error || secondaryQ.error,
  };
}

// ── CRUD functions ────────────────────────────────────────────────────────────

export async function saveCompany(instance, accounts, data) {
  const token = await getToken(instance, accounts);
  const { crc41_portalcompanyid, ...body } = data;

  if (crc41_portalcompanyid) {
    // PATCH
    const res = await window.fetch(
      `${DATAVERSE_URL}/crc41_portalcompanies(${crc41_portalcompanyid})`,
      {
        method:  'PATCH',
        headers: { ...baseHeaders(token), 'Content-Type': 'application/json', 'If-Match': '*' },
        body:    JSON.stringify(body),
      },
    );
    if (!res.ok) throw new Error(`Save company failed ${res.status}: ${await res.text()}`);
    return null;
  } else {
    // POST
    const res = await window.fetch(`${DATAVERSE_URL}/crc41_portalcompanies`, {
      method:  'POST',
      headers: { ...baseHeaders(token), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Create company failed ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

export async function deleteCompany(instance, accounts, id) {
  const token = await getToken(instance, accounts);
  const res = await window.fetch(`${DATAVERSE_URL}/crc41_portalcompanies(${id})`, {
    method:  'DELETE',
    headers: baseHeaders(token),
  });
  if (!res.ok) throw new Error(`Delete company failed ${res.status}: ${await res.text()}`);
}

export async function saveUser(instance, accounts, data) {
  const token = await getToken(instance, accounts);
  const { crc41_portaluserid, companyId, ...body } = data;

  // handle lookup binding
  if (companyId) {
    body['crc41_PortalCompany@odata.bind'] = `/crc41_portalcompanies(${companyId})`;
  }

  if (crc41_portaluserid) {
    const res = await window.fetch(
      `${DATAVERSE_URL}/crc41_portalusers(${crc41_portaluserid})`,
      {
        method:  'PATCH',
        headers: { ...baseHeaders(token), 'Content-Type': 'application/json', 'If-Match': '*' },
        body:    JSON.stringify(body),
      },
    );
    if (!res.ok) throw new Error(`Save user failed ${res.status}: ${await res.text()}`);
    return null;
  } else {
    const res = await window.fetch(`${DATAVERSE_URL}/crc41_portalusers`, {
      method:  'POST',
      headers: { ...baseHeaders(token), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Create user failed ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

export async function deleteUser(instance, accounts, id) {
  const token = await getToken(instance, accounts);
  const res = await window.fetch(`${DATAVERSE_URL}/crc41_portalusers(${id})`, {
    method:  'DELETE',
    headers: baseHeaders(token),
  });
  if (!res.ok) throw new Error(`Delete user failed ${res.status}: ${await res.text()}`);
}

export async function savePermission(instance, accounts, data) {
  const token = await getToken(instance, accounts);
  const { crc41_portalpermissionid, companyId, userId, ...body } = data;

  if (companyId) body['crc41_PortalCompany@odata.bind'] = `/crc41_portalcompanies(${companyId})`;
  if (userId)    body['crc41_PortalUser@odata.bind']    = `/crc41_portalusers(${userId})`;

  if (crc41_portalpermissionid) {
    const res = await window.fetch(
      `${DATAVERSE_URL}/crc41_portalpermissions(${crc41_portalpermissionid})`,
      {
        method:  'PATCH',
        headers: { ...baseHeaders(token), 'Content-Type': 'application/json', 'If-Match': '*' },
        body:    JSON.stringify(body),
      },
    );
    if (!res.ok) throw new Error(`Save permission failed ${res.status}: ${await res.text()}`);
    return null;
  } else {
    const res = await window.fetch(`${DATAVERSE_URL}/crc41_portalpermissions`, {
      method:  'POST',
      headers: { ...baseHeaders(token), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Create permission failed ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
