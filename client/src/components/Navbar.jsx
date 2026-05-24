import { Link, useLocation } from 'react-router';
import { Search } from 'lucide-react';

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/analyze', label: 'Analyze' },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-logo">
          <Search size={22} className="navbar-logo-icon" />
          <span className="navbar-logo-text">LogLens</span>
        </Link>
        <div className="navbar-links">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`navbar-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              {link.label}
              <span className="navbar-link-underline" />
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: var(--navbar-height);
          z-index: 100;
          background: rgba(10, 14, 26, 0.8);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--glass-border);
        }

        .navbar-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
        }

        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--text-primary);
          font-weight: 700;
          font-size: 1.25rem;
          transition: var(--transition-base);
        }

        .navbar-logo:hover {
          color: var(--cyan-light);
        }

        .navbar-logo-icon {
          font-size: 1.5rem;
        }

        .navbar-logo-text {
          background: linear-gradient(135deg, var(--text-primary), var(--cyan-light));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .navbar-links {
          display: flex;
          align-items: center;
          gap: var(--space-xl);
        }

        .navbar-link {
          position: relative;
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.9375rem;
          font-weight: 500;
          padding: 4px 0;
          transition: var(--transition-base);
        }

        .navbar-link:hover {
          color: var(--text-primary);
        }

        .navbar-link.active {
          color: var(--cyan-light);
        }

        .navbar-link-underline {
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--cyan);
          border-radius: 1px;
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.25s ease;
        }

        .navbar-link.active .navbar-link-underline,
        .navbar-link:hover .navbar-link-underline {
          transform: scaleX(1);
        }
      `}</style>
    </nav>
  );
}
