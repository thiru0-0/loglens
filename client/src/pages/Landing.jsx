import { Link } from 'react-router';
import { Search, Target, Wrench, Upload, Zap, Compass } from 'lucide-react';
import '../styles/landing.css';

const valueProps = [
  {
    icon: <Search size={24} />,
    title: 'Instant Analysis',
    desc: 'Upload any log format and get structured insights in seconds',
  },
  {
    icon: <Target size={24} />,
    title: 'Root Cause Detection',
    desc: 'AI identifies probable causes with confidence levels and evidence',
  },
  {
    icon: <Wrench size={24} />,
    title: 'Actionable Fixes',
    desc: 'Get specific debugging commands and steps, not vague advice',
  },
];

const features = [
  {
    step: 1,
    icon: <Upload size={32} />,
    title: 'Upload Logs',
    desc: 'Paste your log output, upload a file, or load sample data. We support JSON, plain text, Apache, and more.',
  },
  {
    step: 2,
    icon: <Zap size={32} />,
    title: 'AI Analysis',
    desc: 'Our AI engine parses, classifies, and cross-references every log entry to detect anomalies and patterns.',
  },
  {
    step: 3,
    icon: <Compass size={32} />,
    title: 'Debug & Resolve',
    desc: 'Get a full incident report with root causes, a failure timeline, and step-by-step debugging recommendations.',
  },
];

export default function Landing() {
  return (
    <div className="landing">
      {/* Animated background */}
      <div className="landing-bg">
        <div className="landing-bg-gradient" />
        <div className="landing-grid" />
        <div className="landing-dots">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="landing-dot" />
          ))}
        </div>
      </div>

      <div className="container page">
        {/* Hero */}
        <section className="landing-hero">
          <div className="landing-badge">
            <span className="landing-badge-dot" />
            AI-Powered Log Intelligence
          </div>

          <h1>Turn API Logs Into Debugging Intelligence</h1>

          <p className="landing-subtitle">
            Paste your logs. Get a complete incident report with root causes,
            timelines, and actionable fixes — powered by AI.
          </p>

          {/* Value Props */}
          <div className="landing-props">
            {valueProps.map((prop, i) => (
              <div key={i} className="landing-prop">
                <span className="landing-prop-icon">{prop.icon}</span>
                <div className="landing-prop-text">
                  <h4>{prop.title}</h4>
                  <p>{prop.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="landing-cta">
            <Link to="/analyze" className="landing-cta-btn">
              Start Analyzing
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="landing-features">
          <div className="landing-features-heading">
            <h2>How It Works</h2>
            <p>Three simple steps from chaos to clarity</p>
          </div>

          <div className="landing-features-grid">
            {features.map((feat) => (
              <div key={feat.step} className="landing-feature-card">
                <div className="landing-feature-step">{feat.step}</div>
                <span className="landing-feature-icon">{feat.icon}</span>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
