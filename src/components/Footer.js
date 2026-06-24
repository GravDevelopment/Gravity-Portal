export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <img src="/New-Generic.png" alt="Gravity" className="footer-logo" />
        <span className="footer-copy">© {new Date().getFullYear()} Gravity. All rights reserved.</span>
      </div>
    </footer>
  );
}
