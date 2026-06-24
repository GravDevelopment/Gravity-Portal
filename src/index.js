import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './auth/msalConfig';
import { auth0Config } from './auth/auth0Config';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// MSAL stays for admin panel Dataverse writes only
const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().catch(console.error);
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <Auth0Provider {...auth0Config}>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </Auth0Provider>
    </React.StrictMode>
  );
}).catch(e => console.error('[MSAL] initialize failed:', e));

reportWebVitals();
