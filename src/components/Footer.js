import logo from '../assets/New-Generic.png';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <img src={logo} alt="Gravity" className="footer-logo" />
        <span className="footer-copy">© {new Date().getFullYear()} Gravity. All rights reserved.</span>
      </div>
    </footer>
  );
}
