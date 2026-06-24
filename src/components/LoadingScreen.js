import './LoadingScreen.css';

export default function LoadingScreen({ message = 'Fetching data…' }) {
  return (
    <main className="page page--full loading-screen">
      <div className="loading-spinner" />
      <span className="loading-text">{message}</span>
    </main>
  );
}
