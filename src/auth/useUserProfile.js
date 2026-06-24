import { useState, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { dataverseScopes, DATAVERSE_URL } from './msalConfig';

const GRAVITY_DOMAIN = 'gravitygh.co.za';

export function useUserProfile() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [companyId, setCompanyId]     = useState(null);
  const [companyName, setCompanyName] = useState(null);
  const [loading, setLoading]         = useState(true);

  const account   = accounts[0] ?? null;
  const email     = account?.username ?? '';
  const isGravity = email.toLowerCase().endsWith(`@${GRAVITY_DOMAIN}`);

  useEffect(() => {
    if (!isAuthenticated || !account) { setLoading(false); return; }
    if (isGravity)                    { setLoading(false); return; }

    let cancelled = false;
    async function lookupContact() {
      try {
        const { accessToken } = await instance.acquireTokenSilent({
          scopes: dataverseScopes, account,
        });
        const url = `${DATAVERSE_URL}/contacts?$select=_parentcustomerid_value&$filter=emailaddress1 eq '${encodeURIComponent(email)}'&$top=1`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
          },
        });
        if (!res.ok) throw new Error(`Contact lookup failed: ${res.status}`);
        const json = await res.json();
        const contact = json.value?.[0];
        if (!cancelled && contact) {
          setCompanyId(contact._parentcustomerid_value ?? null);
          setCompanyName(contact['_parentcustomerid_value@OData.Community.Display.V1.FormattedValue'] ?? null);
        }
      } catch (e) {
        console.warn('[useUserProfile] contact lookup error:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    lookupContact();
    return () => { cancelled = true; };
  }, [isAuthenticated, account, isGravity, email, instance]);

  return { isGravity, companyId, companyName, email, loading };
}
