import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { dataverseScopes, DATAVERSE_URL } from './msalConfig';

// Module-level cache — survives page navigation within the same session
const sessionCache = new Map();
// In-flight promise dedup — prevents the same query running twice simultaneously
const inFlight = new Map();

async function fetchAllPages(url, headers) {
  const results = [];
  let next = url;
  while (next) {
    const res = await window.fetch(next, { headers });
    if (!res.ok) throw new Error(`Dataverse error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    results.push(...(json.value ?? []));
    next = json['@odata.nextLink'] ?? null;
  }
  return results;
}

async function fetchWithDedup(cacheKey, url, headers) {
  if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey);
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const promise = fetchAllPages(url, headers).then(results => {
    sessionCache.set(cacheKey, results);
    inFlight.delete(cacheKey);
    return results;
  }).catch(err => {
    inFlight.delete(cacheKey);
    throw err;
  });

  inFlight.set(cacheKey, promise);
  return promise;
}

export function clearDataverseCache() {
  sessionCache.clear();
  inFlight.clear();
}

export function useDataverse(table, odata = '') {
  const { instance, accounts } = useMsal();
  const [data, setData]     = useState(() => {
    const key = `${table}?${odata}`;
    return sessionCache.get(key) ?? null;
  });
  const [loading, setLoading] = useState(() => !sessionCache.has(`${table}?${odata}`));
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!accounts.length || !table) {
      setLoading(false);
      return;
    }

    const cacheKey = `${table}?${odata}`;

    if (sessionCache.has(cacheKey)) {
      setData(sessionCache.get(cacheKey));
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { accessToken } = await instance.acquireTokenSilent({
          scopes:  dataverseScopes,
          account: accounts[0],
        });

        const headers = {
          Authorization:      `Bearer ${accessToken}`,
          Accept:             'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version':    '4.0',
          'Prefer':           'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        };

        const url = `${DATAVERSE_URL}/${table}${odata ? `?${odata}` : ''}`;
        const results = await fetchWithDedup(cacheKey, url, headers);

        if (!cancelled) {
          setData(results);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [instance, accounts, table, odata]);

  return { data, loading, error };
}
