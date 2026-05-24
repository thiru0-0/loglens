import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ClipboardList, AlertCircle, Target, Lightbulb, Wrench, Clock, BarChart2, HeartPulse } from 'lucide-react';
import ReportSection from '../components/ReportSection';
import AnomalyTable from '../components/AnomalyTable';
import DownloadButton from '../components/DownloadButton';
import Button from '../components/Button';
import FollowUpChat from './FollowUpChat';
import FailureTimeline from '../components/FailureTimeline';
import '../styles/results.css';

/**
 * Helper to format bold, italic, and code inline.
 */
const formatInline = (line) => {
  if (typeof line !== 'string') return line;
  const parts = [];
  const regex = /\*\*(.*?)\*\*|\*(.*?)\*|`(.*?)`/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
    if (match[1] !== undefined) parts.push(<strong key={`b${match.index}`}>{match[1]}</strong>);
    else if (match[2] !== undefined) parts.push(<em key={`i${match.index}`}>{match[2]}</em>);
    else if (match[3] !== undefined) parts.push(<code key={`c${match.index}`}>{match[3]}</code>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return parts.length > 0 ? parts : line;
};

/**
 * Simple markdown-ish renderer for the AI analysis text.
 * Handles bold, code, lists, and paragraphs.
 */
function MarkdownContent({ text }) {
  if (!text) return <p className="text-muted">No content available.</p>;

  const lines = text.split('\n');
  const elements = [];
  let key = 0;
  let listItems = [];

  const flushList = (ordered = false) => {
    if (listItems.length > 0) {
      if (ordered) {
        elements.push(<ol key={key++}>{listItems}</ol>);
      } else {
        elements.push(<ul key={key++}>{listItems}</ul>);
      }
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(<h4 key={key++}>{formatInline(trimmed.slice(5))}</h4>);
    } else if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={key++}>{formatInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      listItems.push(<li key={key++}>{formatInline(trimmed.slice(2))}</li>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s*/, '');
      listItems.push(<li key={key++}>{formatInline(content)}</li>);
    } else if (trimmed === '') {
      flushList();
    } else {
      flushList();
      elements.push(<p key={key++}>{formatInline(trimmed)}</p>);
    }
  }
  flushList();

  return <div className="markdown-content">{elements}</div>;
}

export default function Results() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);

  useEffect(() => {
    const data = sessionStorage.getItem('loglens_result');
    if (!data) {
      navigate('/analyze', { replace: true });
      return;
    }
    try {
      setReport(JSON.parse(data));
    } catch {
      navigate('/analyze', { replace: true });
    }
  }, [navigate]);

  // Derive display data from the report (handles various API response shapes)
  const {
    summary,
    anomalies,
    rootCause,
    recommendations,
    recommendationsList,
    timeline,
    timelineEvents,
    stats,
    reportId,
  } = useMemo(() => {
    if (!report) return {};

    const r = report.report || report;

    // Summary
    const summary = r.summary || r.executiveSummary || r.executive_summary || '';

    // Anomalies
    const anomalies =
      r.anomalies ||
      (report.aggregatedStats && report.aggregatedStats.anomalies) ||
      (r.aggregatedStats && r.aggregatedStats.anomalies) ||
      (r.aggregated_stats && r.aggregated_stats.anomalies) ||
      [];

    // Root cause
    const rootCause =
      r.rootCause || r.root_cause || r.rootCauseAnalysis || r.root_cause_analysis || '';

    // Recommendations
    const rawRecs =
      r.recommendations || r.debugging_recommendations || r.debuggingRecommendations || '';

    // Timeline
    const rawTimeline = r.timeline || r.failure_timeline || r.failureTimeline || [];
    let timelineEvents = [];
    if (Array.isArray(rawTimeline)) {
      timelineEvents = rawTimeline.map(ev =>
        typeof ev === 'string' ? { event: ev } : ev
      );
    } else if (typeof rawTimeline === 'string' && rawTimeline) {
      timelineEvents = rawTimeline
        .split('\n')
        .filter(l => l.trim())
        .map(l => ({ event: l.replace(/^[-•]\s*/, '').trim() }));
    }

    // Stats
    const rawStats = r.stats || r.logSummary || r.log_summary || r.rawLogSummary || report.aggregatedStats || {};
    const stats = {
      totalLines: rawStats.totalLines || rawStats.totalEntries || rawStats.totalRequests || '—',
      errorCount: rawStats.errorCount || rawStats.error_count || rawStats.errors || rawStats.totalErrors || '—',
      errorRate: rawStats.errorRate || rawStats.error_rate || '—',
      timeRange: (rawStats.timeRange && rawStats.timeRange.durationMinutes) ? `${rawStats.timeRange.durationMinutes}m` : (rawStats.timeRange || rawStats.time_range || '—'),
      worstEndpoint: rawStats.worstEndpoint || rawStats.worst_endpoint || '—',
      bestEndpoint: rawStats.bestEndpoint || rawStats.best_endpoint || '—',
      servicesAffected: (rawStats.endpointBreakdown) 
        ? Array.from(new Set(Object.values(rawStats.endpointBreakdown).flatMap(ep => ep.services || []))).length 
        : '—',
      detectedFormat: rawStats.detectedFormat || '—',
      recoveryStatus: rawStats.recoveryStatus || '—'
    };

    const reportId = r.reportId || r.report_id || r.id || 'report-' + Date.now();

    return {
      summary,
      anomalies,
      rootCause,
      recommendations: rawRecs,
      timeline: rawTimeline,
      timelineEvents,
      stats,
      reportId,
    };
  }, [report]);

  // Generate downloadable markdown
  const markdownReport = useMemo(() => {
    if (!report) return '';
    return [
      '# LogLens Incident Report',
      '',
      '## Executive Summary',
      summary || 'No summary available.',
      '',
      '## Root Cause Analysis',
      typeof rootCause === 'string' ? rootCause : JSON.stringify(rootCause, null, 2),
      '',
      '## Recommendations',
      typeof recommendations === 'string' ? recommendations : JSON.stringify(recommendations, null, 2),
      '',
      '## Stats',
      `- Total Requests: ${stats?.totalLines}`,
      `- Error Count: ${stats?.errorCount}`,
      `- Error Rate: ${stats?.errorRate}`,
      `- Services Affected: ${stats?.servicesAffected}`,
      '',
      '---',
      `Generated by LogLens on ${new Date().toISOString()}`,
    ].join('\n');
  }, [report, summary, rootCause, recommendations, stats]);

  const jsonReport = useMemo(() => {
    if (!report) return '';
    return JSON.stringify(report, null, 2);
  }, [report]);

  if (!report) {
    return (
      <div className="container page">
        <div className="processing">
          <div className="processing-card">
            <div className="processing-header">
              <h2>Loading report...</h2>
            </div>
            <div className="processing-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="results">
        {/* Header */}
        <div className="results-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>📊 Incident Report</h1>
              <p>AI-generated analysis of your log data</p>
            </div>
            {stats.detectedFormat !== '—' && (
              <span className="badge badge-medium" style={{ fontSize: '12px' }}>
                Format: {stats.detectedFormat}
              </span>
            )}
          </div>
        </div>

        {/* 1. Stats Bar */}
        {stats.totalLines !== '—' && (
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-value">{stats.totalLines}</div>
              <div className="stat-label">Total Requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.errorCount}</div>
              <div className="stat-label">Failed Requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.errorRate}</div>
              <div className="stat-label">Error Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.servicesAffected}</div>
              <div className="stat-label">Services Affected</div>
            </div>
          </div>
        )}

        {/* Report Sections */}
        <div className="report-sections">
          {/* 2. Executive Summary */}
          <ReportSection 
            title="Executive Summary" 
            icon={<AlertCircle size={20} />} 
            defaultOpen={true}
            extraHeader={
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`badge ${
                  stats.recoveryStatus.startsWith('Recovered') ? 'badge-low' : 'badge-high'
                }`}>{stats.recoveryStatus}</span>
                <button 
                  className="clipboard-btn" 
                  onClick={() => navigator.clipboard.writeText(summary)}
                  title="Copy to clipboard"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cyan-light)' }}
                >
                  <ClipboardList size={16} />
                </button>
              </div>
            }
          >
            <div className="executive-summary">{summary || 'No summary available.'}</div>
          </ReportSection>

          {/* 3. Anomaly Table */}
          <ReportSection title="Detected Anomalies" icon={<AlertCircle size={20} />} defaultOpen={true}>
            <AnomalyTable anomalies={anomalies} />
          </ReportSection>

          {/* 4. Failure Timeline */}
          <ReportSection title="Failure Timeline" icon={<Clock size={20} />} defaultOpen={true}>
            {timelineEvents.length > 0 ? (
              <FailureTimeline rawTimeline={report.failureTimeline} />
            ) : typeof timeline === 'string' && timeline ? (
              <MarkdownContent text={timeline} />
            ) : (
              <p className="text-muted">No timeline data available.</p>
            )}
          </ReportSection>

          {/* 5. Root Cause Analysis / Latency Health Check */}
          <ReportSection 
            title={stats.errorCount === 0 || stats.errorCount === '0' ? "Latency Health Check" : "Root Cause Analysis"} 
            icon={stats.errorCount === 0 || stats.errorCount === '0' ? <HeartPulse size={20} /> : <Target size={20} />} 
            defaultOpen={true}
          >
            {typeof rootCause === 'string' ? (
              <MarkdownContent text={rootCause.replace(/(HIGH CONFIDENCE|MEDIUM CONFIDENCE|LOW CONFIDENCE):?/gi, (match) => `**[${match.replace(':', '')}]**`)} />
            ) : (
              <pre>{JSON.stringify(rootCause, null, 2)}</pre>
            )}
          </ReportSection>

          {/* 6. Debugging Recommendations / Suggestion */}
          <ReportSection 
            title={stats.errorCount === 0 || stats.errorCount === '0' ? "Suggestion" : "Debugging Recommendations"} 
            icon={stats.errorCount === 0 || stats.errorCount === '0' ? <Lightbulb size={20} /> : <Wrench size={20} />} 
            defaultOpen={true}
          >
            {typeof recommendations === 'string' ? (
              <MarkdownContent text={recommendations} />
            ) : (
              <p className="text-muted">No recommendations available.</p>
            )}
          </ReportSection>
        </div>

        {/* Action Buttons */}
        <div className="results-actions">
          <DownloadButton
            content={markdownReport}
            filename="loglens-report.md"
            label="Download Report (.md)"
          />
          <DownloadButton
            content={jsonReport}
            filename="loglens-report.json"
            label="Download JSON"
          />
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              sessionStorage.removeItem('loglens_result');
              navigate('/analyze');
            }}
          >
            🔄 Analyze New Logs
          </Button>
        </div>

        {/* Follow-Up Chat */}
        <FollowUpChat reportId={reportId} reportContext={report} />
      </div>
    </div>
  );
}
