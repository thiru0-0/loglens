import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Activity, AlertTriangle, XCircle, X } from 'lucide-react';
import StatusFeed from '../components/StatusFeed';
import Button from '../components/Button';
import { analyzeLog } from '../services/api';
import '../styles/processing.css';

const STEP_LABELS = [
  'Parsing log entries',
  'Detecting log format',
  'Counting errors and anomalies',
  'Aggregating endpoint statistics',
  'Running AI root cause analysis',
  'Generating debugging recommendations',
  'Compiling incident report',
];

const STEP_DELAYS = [300, 800, 1500, 2500];

export default function Processing() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState(
    STEP_LABELS.map((label, i) => ({
      label,
      status: i === 0 ? 'active' : 'pending',
    }))
  );
  const [error, setError] = useState(null);
  const apiCalledRef = useRef(false);
  const timerRefs = useRef([]);

  const cleanupTimers = useCallback(() => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }, []);

  const completeStep = useCallback((index) => {
    setSteps(prev =>
      prev.map((step, i) => {
        if (i === index) return { ...step, status: 'done' };
        if (i === index + 1) return { ...step, status: 'active' };
        return step;
      })
    );
  }, []);

  useEffect(() => {
    const logs = sessionStorage.getItem('loglens_logs');
    if (!logs) {
      navigate('/analyze', { replace: true });
      return;
    }

    if (apiCalledRef.current) return;
    apiCalledRef.current = true;

    const configStr = sessionStorage.getItem('loglens_config');
    const config = configStr ? JSON.parse(configStr) : {};

    // Animate steps 0-3 with delays
    STEP_DELAYS.forEach((delay, idx) => {
      const timer = setTimeout(() => completeStep(idx), delay);
      timerRefs.current.push(timer);
    });

    // Call the API
    analyzeLog(logs, config).then((response) => {
      if (response.error) {
        setError({ error: response.error, message: response.message || response.error });
        return;
      }

      // Store result
      sessionStorage.setItem('loglens_result', JSON.stringify(response));

      // Complete remaining steps quickly
      const baseDelay = Math.max(0, 2800 - Date.now() % 10000);
      const t1 = setTimeout(() => completeStep(4), baseDelay);
      const t2 = setTimeout(() => completeStep(5), baseDelay + 400);
      const t3 = setTimeout(() => completeStep(6), baseDelay + 700);
      const t4 = setTimeout(() => navigate('/results', { replace: true }), baseDelay + 1200);
      timerRefs.current.push(t1, t2, t3, t4);
    });

    return cleanupTimers;
  }, [navigate, completeStep, cleanupTimers]);

  const handleRetry = useCallback(() => {
    setError(null);
    apiCalledRef.current = false;
    setSteps(STEP_LABELS.map((label, i) => ({
      label,
      status: i === 0 ? 'active' : 'pending',
    })));
    cleanupTimers();

    const logs = sessionStorage.getItem('loglens_logs');
    const configStr = sessionStorage.getItem('loglens_config');
    const config = configStr ? JSON.parse(configStr) : {};

    if (!logs) {
      navigate('/analyze', { replace: true });
      return;
    }

    apiCalledRef.current = true;

    STEP_DELAYS.forEach((delay, idx) => {
      const timer = setTimeout(() => completeStep(idx), delay);
      timerRefs.current.push(timer);
    });

    analyzeLog(logs, config).then((response) => {
      if (response.error) {
        setError({ error: response.error, message: response.message || response.error });
        return;
      }

      sessionStorage.setItem('loglens_result', JSON.stringify(response));

      const t1 = setTimeout(() => completeStep(4), 500);
      const t2 = setTimeout(() => completeStep(5), 900);
      const t3 = setTimeout(() => completeStep(6), 1200);
      const t4 = setTimeout(() => navigate('/results', { replace: true }), 1700);
      timerRefs.current.push(t1, t2, t3, t4);
    });
  }, [navigate, completeStep, cleanupTimers]);

  return (
    <div className="container page">
      <div className="processing">
        <div className="processing-card">
          <div className="processing-header">
            <h2>
              <Activity size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
              Analyzing Your Logs
            </h2>
          </div>

          {!error && (
            <>
              <StatusFeed steps={steps} />
              <div className="processing-progress-bar">
                <div 
                  className="processing-progress-fill" 
                  style={{ width: `${Math.max(5, (steps.filter(s => s.status === 'done').length / steps.length) * 100)}%` }} 
                />
              </div>
            </>
          )}

          {error && error.error === 'No log entries found' && (
            <div className="processing-error parse-error-view" style={{ textAlign: 'left', marginTop: '20px' }}>
              <h3 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} /> PARSE ERROR
              </h3>
              <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '16px 0' }}/>
              <p>We were unable to recognize a valid log format in the text you provided.</p>
              <br />
              <p><strong>We tried:</strong></p>
              <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: '8px 0', color: '#94a3b8' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><X size={14} color="#ef4444" /> JSON log format</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><X size={14} color="#ef4444" /> Apache/Nginx combined log format</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><X size={14} color="#ef4444" /> Common text log patterns ([INFO], [ERROR], timestamps)</li>
              </ul>
              <br />
              <p><strong>What we need to see:</strong></p>
              <p>Your logs should contain at minimum a timestamp and an HTTP status code or error message. Any of these formats work:</p>
              <br />
              <p><strong>Format 1 (JSON):</strong></p>
              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontSize: '13px', margin: '8px 0', overflowX: 'auto' }}>
                &#123;"timestamp":"2026-05-24T10:00:00Z","endpoint":"/api/v1/users","status":200,"latency_ms":45&#125;
              </pre>
              <p><strong>Format 2 (Nginx):</strong></p>
              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontSize: '13px', margin: '8px 0', overflowX: 'auto' }}>
                127.0.0.1 - - [24/May/2026:10:00:00 +0000] "GET /api/users HTTP/1.1" 200 512 0.045
              </pre>
              <p><strong>Format 3 (Text):</strong></p>
              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontSize: '13px', margin: '8px 0', overflowX: 'auto' }}>
                [ERROR] 2026-05-24 10:00:00 - GET /api/users - 500 - Internal Server Error
              </pre>
              <br />
              <p style={{ fontStyle: 'italic', color: '#94a3b8' }}>Click "Load Sample Logs" to see a working example, or paste your actual server/gateway logs and try again.</p>

              <div className="processing-error-actions" style={{ marginTop: '24px' }}>
                <Button variant="primary" size="md" onClick={() => navigate('/analyze')}>
                  Edit Logs
                </Button>
              </div>
            </div>
          )}

          {error && error.error !== 'No log entries found' && (
            <div className="processing-error">
              <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <XCircle size={18} color="#fca5a5" /> {error.message || error.error}
              </p>
              <div className="processing-error-actions">
                <Button variant="primary" size="md" onClick={handleRetry}>
                  Retry Analysis
                </Button>
                <Button variant="ghost" size="md" onClick={() => navigate('/analyze')}>
                  Edit Logs
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
