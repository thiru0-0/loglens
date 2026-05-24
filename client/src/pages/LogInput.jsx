import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Clipboard, Settings, ChevronDown, AlertTriangle, Rocket } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { SAMPLE_LOGS, SAMPLE_LOGS_DESCRIPTION } from '../utils/sampleLogs';
import '../styles/log-input.css';

export default function LogInput() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [config, setConfig] = useState({
    format: 'auto',
    timeRange: '',
    serviceName: '',
  });

  const lineCount = logs ? logs.split('\n').length : 0;
  const charCount = logs.length;

  const handleFileContent = useCallback((content) => {
    setLogs(content);
    setValidationError(null);
  }, []);

  const handleLoadSample = useCallback(() => {
    setLogs(SAMPLE_LOGS);
    setValidationError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!logs.trim()) {
      setValidationError('Please paste log data or upload a log file before analyzing.');
      return;
    }

    setValidationError(null);
    sessionStorage.setItem('loglens_logs', logs);
    sessionStorage.setItem('loglens_config', JSON.stringify(config));
    navigate('/processing');
  }, [logs, config, navigate]);

  return (
    <div className="container page">
      <div className="log-input">
        {/* Header */}
        <div className="log-input-header">
          <h1>Analyze Your Logs</h1>
          <p>Paste your API logs below, upload a file, or try our sample data to see LogLens in action.</p>
        </div>

        <div className="log-input-main">
          {/* Actions Row */}
          <div className="log-input-actions-row">
            <FileUpload onFileContent={handleFileContent} />
            <div className="log-input-actions-right">
              <button className="sample-logs-btn" onClick={handleLoadSample} title={SAMPLE_LOGS_DESCRIPTION}>
                <Clipboard size={16} />
                Load Sample Logs
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div className="log-textarea-wrapper">
            <textarea
              className="log-textarea"
              value={logs}
              onChange={(e) => {
                setLogs(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder={`Paste your log entries here...\nSupports JSONL, Plain Text, and Apache/Nginx formats.`}
              spellCheck={false}
              autoComplete="off"
            />
            <div className="log-textarea-meta">
              <span>{lineCount.toLocaleString()} line{lineCount !== 1 ? 's' : ''}</span>
              <span>{charCount.toLocaleString()} character{charCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Config Panel */}
          <div className="log-config-panel">
            <div className="log-config-header" onClick={() => setConfigOpen(prev => !prev)}>
              <h3>
                <Settings size={18} />
                Configuration
              </h3>
              <ChevronDown size={20} className={`log-config-toggle ${configOpen ? 'open' : ''}`} />
            </div>
            <div className={`log-config-body ${configOpen ? 'open' : ''}`}>
              <div className="log-config-fields">
                <div>
                  <label className="label">Log Format</label>
                  <select
                    className="select"
                    value={config.format}
                    onChange={(e) => setConfig(prev => ({ ...prev, format: e.target.value }))}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="json">JSON / JSONL</option>
                    <option value="apache">Apache / Nginx</option>
                    <option value="plain">Plain Text</option>
                  </select>
                </div>
                <div>
                  <label className="label">Time Range</label>
                  <input
                    className="input"
                    type="text"
                    value={config.timeRange}
                    onChange={(e) => setConfig(prev => ({ ...prev, timeRange: e.target.value }))}
                    placeholder="e.g., Last 24 hours"
                  />
                </div>
                <div>
                  <label className="label">Service Name</label>
                  <input
                    className="input"
                    type="text"
                    value={config.serviceName}
                    onChange={(e) => setConfig(prev => ({ ...prev, serviceName: e.target.value }))}
                    placeholder="e.g., payment-api"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="log-validation-error">
              <AlertTriangle size={18} />
              <span>{validationError}</span>
            </div>
          )}

          {/* Submit */}
          <div className="log-submit-section">
            <button className="btn btn-primary btn-lg" onClick={handleSubmit}>
              Analyze Logs
              <Rocket size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
