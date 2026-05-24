import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function ReportSection({ title, icon, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="report-section">
      <div
        className="report-section-header"
        onClick={() => setIsOpen(prev => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(prev => !prev)}
      >
        <div className="report-section-title">
          {icon && <span className="report-section-icon">{icon}</span>}
          <h3>{title}</h3>
        </div>
        <ChevronDown size={20} className={`report-section-toggle ${isOpen ? 'open' : ''}`} />
      </div>
      <div className={`report-section-body ${isOpen ? 'open' : ''}`}>
        <div className="report-section-content">
          {children}
        </div>
      </div>
    </div>
  );
}
