import { useState, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';

const photoCache = new Map();

export function useProfilePhoto() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !accounts.length) return;

    const accountId = accounts[0].localAccountId;
    if (photoCache.has(accountId)) {
      setPhotoUrl(photoCache.get(accountId));
      return;
    }

    let objectUrl = null;
    async function fetchPhoto() {
      try {
        const { accessToken } = await instance.acquireTokenSilent({
          scopes: ['User.Read'],
          account: accounts[0],
        });
        const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return; // user has no photo — stay null
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        photoCache.set(accountId, objectUrl);
        setPhotoUrl(objectUrl);
      } catch {
        // silently fail — fallback avatar will show
      }
    }

    fetchPhoto();
    // no cleanup needed — objectUrl is cached for the session
  }, [isAuthenticated, accounts, instance]);

  return photoUrl;
}
