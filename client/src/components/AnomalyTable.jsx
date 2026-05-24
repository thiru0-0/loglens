export default function AnomalyTable({ anomalies = [] }) {
  if (!anomalies.length) {
    return (
      <div className="chat-empty">
        <p className="text-muted">No anomalies detected.</p>
      </div>
    );
  }

  const severityClass = (severity) => {
    const s = (severity || '').toLowerCase();
    if (s === 'high' || s === 'critical') return 'badge-high';
    if (s === 'medium' || s === 'moderate') return 'badge-medium';
    return 'badge-low';
  };

  return (
    <div className="anomaly-table-wrapper">
      <table className="anomaly-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Error Type</th>
            <th>Failures</th>
            <th>Total Requests</th>
            <th>Error Rate</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>
          {anomalies.map((row, i) => (
            <tr key={i}>
              <td>
                <span className="badge" style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-secondary)' }}>
                  {row.method || '—'}
                </span>
              </td>
              <td>{row.path || row.endpoint || '—'}</td>
              <td>{row.errorType || row.error_type || '—'}</td>
              <td className="count-cell">{row.count ?? '—'}</td>
              <td className="count-cell">{row.total ?? '—'}</td>
              <td className="rate-cell">
                {row.errorRate != null
                  ? typeof row.errorRate === 'number'
                    ? `${(row.errorRate * 100).toFixed(1)}%`
                    : row.errorRate
                  : row.error_rate != null
                    ? typeof row.error_rate === 'number'
                      ? `${(row.error_rate * 100).toFixed(1)}%`
                      : row.error_rate
                    : '—'}
              </td>
              <td>
                <span className={`badge ${severityClass(row.severity)}`}>
                  {row.severity || 'unknown'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
