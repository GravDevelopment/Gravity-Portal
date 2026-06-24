import { useState, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { dataverseScopes, DATAVERSE_URL } from './msalConfig';

const SELECT = [
  'crc41_portalpermissionid',
  '_crc41_portalcompany_value',
  '_crc41_portaluser_value',
  'crc41_canviewhome',
  'crc41_canviewtrainingdata',
  'crc41_venuefilter',
  'crc41_statusfilter',
  'crc41_companyfilter',
  'crc41_islevel',
].join(',');

async function fetchPerms(instance, account, email) {
  const { accessToken } = await instance.acquireTokenSilent({
    scopes: dataverseScopes,
    account,
  });

  const headers = {
    Authorization:      `Bearer ${accessToken}`,
    Accept:             'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version':    '4.0',
  };

  // 1. Find the portal user record matching this email
  const userRes = await fetch(
    `${DATAVERSE_URL}/crc41_portalusers?$select=crc41_portaluserid,_crc41_portalcompany_value&$filter=crc41_email eq '${encodeURIComponent(email)}'&$top=1`,
    { headers },
  );
  if (!userRes.ok) throw new Error(`Portal user lookup failed: ${userRes.status}`);
  const userJson = await userRes.json();
  const portalUser = userJson.value?.[0] ?? null;
  if (!portalUser) return null; // no portal user record → no restrictions

  const userId    = portalUser.crc41_portaluserid;
  const companyId = portalUser._crc41_portalcompany_value;

  // 2. Load company-level and user-level permissions in one call
  const clauses = [];
  if (companyId) clauses.push(`_crc41_portalcompany_value eq '${companyId}'`);
  clauses.push(`_crc41_portaluser_value eq '${userId}'`);

  const permRes = await fetch(
    `${DATAVERSE_URL}/crc41_portalpermissions?$select=${SELECT}&$filter=${clauses.join(' or ')}`,
    { headers },
  );
  if (!permRes.ok) throw new Error(`Permission lookup failed: ${permRes.status}`);
  const permJson = await permRes.json();
  const perms = permJson.value ?? [];

  const companyPerm = perms.find(p => p.crc41_islevel === 'company') ?? null;
  const userPerm    = perms.find(p => p.crc41_islevel === 'user')    ?? null;

  // user-level overrides company-level; fall back to company-level
  const effective = userPerm ?? companyPerm ?? null;
  return effective;
}

export function useEffectivePermissions() {
  const { instance, accounts } = useMsal();
  const isAuthenticated        = useIsAuthenticated();
  const [perms,   setPerms]    = useState(null);   // null = not loaded yet
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState(null);

  const account = accounts[0] ?? null;
  const email   = (account?.username ?? '').toLowerCase();

  useEffect(() => {
    if (!isAuthenticated || !account) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPerms(instance, account, email)
      .then(p  => { if (!cancelled) { setPerms(p); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; };
  }, [isAuthenticated, account, email, instance]);

  // parse comma-separated filters into arrays (empty array = no restriction)
  const allowedCompanies = perms?.crc41_companyfilter
    ? perms.crc41_companyfilter.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const allowedVenues = perms?.crc41_venuefilter
    ? perms.crc41_venuefilter.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const allowedStatuses = perms?.crc41_statusfilter
    ? perms.crc41_statusfilter.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return {
    loading,
    error,
    canViewHome:     perms?.crc41_canviewhome         ?? true,
    canViewTraining: perms?.crc41_canviewtrainingdata ?? true,
    allowedCompanies,   // [] = all
    allowedVenues,      // [] = all
    allowedStatuses,    // [] = all
    hasPortalRecord: perms !== null,
  };
}
