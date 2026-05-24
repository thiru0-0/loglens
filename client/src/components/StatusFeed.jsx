import { Check } from 'lucide-react';
import '../styles/processing.css';

export default function StatusFeed({ steps }) {
  return (
    <div className="status-feed">
      {steps.map((step, i) => (
        <div key={i} className={`status-step ${step.status}`}>
          <div className="status-step-icon">
            {step.status === 'done' && <Check size={14} strokeWidth={3} />}
            {step.status === 'active' && <div className="status-dot active" />}
            {step.status === 'pending' && <div className="status-dot pending" />}
          </div>
          <span className="status-step-label">{step.label}</span>
        </div>
      ))}
    </div>
  );
}
