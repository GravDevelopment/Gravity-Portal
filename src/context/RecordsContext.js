import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { API_BASE_URL } from '../auth/auth0Config';

const RecordsContext = createContext({ records: [], loading: false, error: null });

export function RecordsProvider({ children }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { setRecords([]); return; }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessTokenSilently();
        const res = await fetch(`${API_BASE_URL}/training-records`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();
        if (!cancelled) setRecords(json.records ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isAuthenticated, getAccessTokenSilently]);

  return (
    <RecordsContext.Provider value={{ records, loading, error }}>
      {children}
    </RecordsContext.Provider>
  );
}

export function useRecords() {
  return useContext(RecordsContext);
}
