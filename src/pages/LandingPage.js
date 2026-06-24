import { useAuth0 } from '@auth0/auth0-react';
import logo from '../assets/New-Generic.png';
import './LandingPage.css';

export default function LandingPage() {
  const { loginWithRedirect } = useAuth0();

  function signInClient() {
    loginWithRedirect({ authorizationParams: { redirect_uri: window.location.origin } });
  }

  function signInStaff() {
    loginWithRedirect({
      authorizationParams: { redirect_uri: window.location.origin, connection: 'gravity-entra' },
    });
  }

  return (
    <main className="landing">
      <div className="landing-card">
        <img src={logo} alt="Gravity Training" className="landing-logo" />
        <h1 className="landing-title">Gravity Training Portal</h1>
        <p className="landing-sub">Access your training records and certification history.</p>
        <div className="landing-btns">
          <button className="landing-btn landing-btn--primary" onClick={signInClient}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
            Client Login
          </button>
          <button className="landing-btn landing-btn--secondary" onClick={signInStaff}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 3a3 3 0 110 6 3 3 0 010-6zm6 13H6v-.5c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z"/>
            </svg>
            Gravity Staff
          </button>
        </div>
        <p className="landing-footer">Need access? Contact your Gravity administrator.</p>
      </div>
    </main>
  );
}
