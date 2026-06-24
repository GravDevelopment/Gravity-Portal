import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth0 } from '@auth0/auth0-react';
import { ADMIN_EMAILS } from '../auth/auth0Config';
import logo from '../assets/New-Generic.png';
import './Navbar.css';

export default function Navbar() {
  const { isDark, toggle } = useTheme();
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  const userName = user?.name ?? user?.email ?? '';
  const isAdmin  = ADMIN_EMAILS.includes((user?.email ?? '').toLowerCase());
  const photoUrl = user?.picture ?? null;

  function signIn() {
    loginWithRedirect({
      authorizationParams: {
        redirect_uri: window.location.origin,
        connection: 'gravity-entra',
      },
    }).catch(e => console.error('[Auth0] login error:', e));
  }
  function signInClient() {
    loginWithRedirect({
      authorizationParams: {
        redirect_uri: window.location.origin,
      },
    }).catch(e => console.error('[Auth0] login error:', e));
  }
  function signOut() {
    logout({ logoutParams: { returnTo: window.location.origin } });
  }
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [hidden, setHidden]             = useState(false);
  const dropdownRef  = useRef(null);
  const lastScrollY  = useRef(0);

  // close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // hide on scroll down, show on scroll up
  useEffect(() => {
    function onScroll() {
      const cur = window.scrollY;
      setHidden(cur > lastScrollY.current && cur > 60);
      lastScrollY.current = cur;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // close mobile menu on route change / resize
  useEffect(() => {
    function onResize() { if (window.innerWidth > 640) setMenuOpen(false); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function closeMenu() { setMenuOpen(false); }

  return (
    <>
      <nav className={`navbar${hidden ? ' navbar--hidden' : ''}`}>
        <div className="navbar-brand">
          <img src={logo} alt="Gravity" className="navbar-logo" />
        </div>

        {/* desktop links */}
        <ul className="navbar-links">
          <li><NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink></li>
          <li><NavLink to="/training-data" className={({ isActive }) => isActive ? 'active' : ''}>Training Data</NavLink></li>
          {isAdmin && <li><NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink></li>}
        </ul>

        <div className="navbar-right">
          {!isAuthenticated && (
            <>
              <button className="auth-btn auth-btn--in" onClick={signInClient}>Client Login</button>
              <button className="auth-btn auth-btn--in" onClick={signIn}>Gravity Staff</button>
            </>

          )}
          {/* user avatar + dropdown */}
          <div className="navbar-user" ref={dropdownRef}>
            <button className="user-avatar" onClick={() => setDropdownOpen(p => !p)} aria-label="User menu">
              {photoUrl
                ? <img src={photoUrl} alt={userName} className="user-avatar-img" />
                : <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
              }
            </button>
            {dropdownOpen && (
              <div className="user-dropdown">
                {isAuthenticated && (
                  <div className="dropdown-section dropdown-user-info">
                    <span className="dropdown-user-name">{userName}</span>
                  </div>
                )}
                <div className="dropdown-section">
                  <span className="dropdown-label">Theme</span>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={isDark} onChange={toggle} />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                    <span className="toggle-text">{isDark ? 'Dark' : 'Light'}</span>
                  </label>
                </div>
                <div className="dropdown-section">
                  {isAuthenticated
                    ? <button className="auth-btn auth-btn--out" onClick={signOut}>Sign out</button>
                    : <button className="auth-btn auth-btn--in"  onClick={signIn}>Sign in</button>
                  }
                </div>
              </div>
            )}
          </div>

          {/* hamburger — mobile only */}
          <button
            className={`hamburger${menuOpen ? ' hamburger--open' : ''}`}
            onClick={() => setMenuOpen(p => !p)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* mobile drawer — only rendered when open, CSS controls display */}
      {menuOpen && (
        <div className="mobile-drawer">
          <NavLink to="/" end onClick={closeMenu} className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink>
          <NavLink to="/training-data" onClick={closeMenu} className={({ isActive }) => isActive ? 'active' : ''}>Training Data</NavLink>
          {isAdmin && <NavLink to="/admin" onClick={closeMenu} className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>}
          <div className="drawer-divider" />
          <div className="drawer-theme-row">
            <span className="dropdown-label">Theme</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={isDark} onChange={toggle} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span className="toggle-text">{isDark ? 'Dark' : 'Light'}</span>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
