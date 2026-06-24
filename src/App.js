import { HashRouter, Routes, Route } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { RecordsProvider } from './context/RecordsContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import TrainingData from './pages/TrainingData';
import User from './pages/User';
import Admin from './pages/Admin';
import LandingPage from './pages/LandingPage';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

function AppShell() {
  const { isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <div className={`app-root ${isDark ? 'dark' : 'light'}`}><LoadingScreen message="Signing you in…" /></div>;

  if (!isAuthenticated) {
    return (
      <div className={`app-root ${isDark ? 'dark' : 'light'}`}>
        <LandingPage />
      </div>
    );
  }

  return (
    <div className={`app-root ${isDark ? 'dark' : 'light'}`}>
      <Navbar />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/training-data" element={<TrainingData />} />
          <Route path="/user" element={<User />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <RecordsProvider>
          <AppShell />
        </RecordsProvider>
      </HashRouter>
    </ThemeProvider>
  );
}
