export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner container">
        <div className="footer-brand">
          <span className="footer-logo">🔍 LogLens</span>
          <span className="footer-tagline">AI-Powered Log Analysis</span>
        </div>
        <div className="footer-copy">
          &copy; {new Date().getFullYear()} LogLens. Built for developers who debug at 2 AM.
        </div>
      </div>

      <style>{`
        .footer {
          margin-top: auto;
          border-top: 1px solid var(--glass-border);
          background: rgba(10, 14, 26, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-lg) var(--space-lg);
          flex-wrap: wrap;
          gap: var(--space-md);
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .footer-logo {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .footer-tagline {
          font-size: 0.8125rem;
          color: var(--text-muted);
        }

        .footer-copy {
          font-size: 0.8125rem;
          color: var(--text-muted);
        }
      `}</style>
    </footer>
  );
}
