import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

export default function FailureTimeline({ rawTimeline }) {
  // Parse the timeline string containing the JSON block
  const events = useMemo(() => {
    if (!rawTimeline) return [];
    if (typeof rawTimeline !== 'string') return Array.isArray(rawTimeline) ? rawTimeline : [];
    
    // Attempt to extract JSON block from markdown string
    const match = rawTimeline.match(/```json\s*([\s\S]*?)\s*```/);
    try {
      if (match) {
        return JSON.parse(match[1]);
      } else {
        // Fallback: try parsing the whole string if it's just JSON
        return JSON.parse(rawTimeline);
      }
    } catch (e) {
      console.error('Failed to parse timeline JSON', e);
      return [];
    }
  }, [rawTimeline]);

  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-400">No structured timeline data available.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8 py-6 w-full font-sans">
      {/* Glowing Left Rail */}
      <div className="absolute left-[15px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-cyan-500 via-indigo-500 to-rose-500 rounded-full opacity-40"></div>
      
      <div className="flex flex-col gap-5">
        {events.map((ev, i) => (
          <TimelineEvent key={i} event={ev} />
        ))}
      </div>
    </div>
  );
}

function TimelineEvent({ event }) {
  // Start expanded if it's a failure to draw immediate attention
  const [expanded, setExpanded] = useState(event.status?.toLowerCase() === 'failure');

  // Status styling configuration
  const statusConfig = {
    success: {
      color: 'text-cyan-400',
      border: 'border-cyan-500/30',
      bg: 'bg-cyan-500/10',
      glow: 'hover:shadow-[0_4px_20px_rgba(6,182,212,0.1)]',
      icon: <CheckCircle2 size={16} className="text-cyan-400" />,
      dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
    },
    warning: {
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      glow: 'hover:shadow-[0_4px_20px_rgba(245,158,11,0.1)]',
      icon: <AlertTriangle size={16} className="text-amber-400" />,
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
    },
    failure: {
      color: 'text-rose-400',
      border: 'border-rose-500/40',
      bg: 'bg-rose-500/10',
      glow: 'shadow-[0_4px_20px_rgba(244,63,94,0.15)]',
      icon: <XCircle size={16} className="text-rose-400" />,
      dot: 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,1)]',
      pulse: true
    }
  };

  const st = statusConfig[event.status?.toLowerCase()] || statusConfig.success;

  return (
    <div className="relative group z-10">
      {/* Node Marker */}
      <div className="absolute -left-10 top-4 flex items-center justify-center">
        <div className={`w-3 h-3 rounded-full border-2 border-[#111827] ${st.dot}`}>
          {st.pulse && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping"></span>
          )}
        </div>
      </div>

      {/* Content Card */}
      <motion.div 
        layout
        whileHover={{ y: -2 }}
        className={`rounded-xl border border-white/5 bg-[#1f2937]/40 backdrop-blur-md overflow-hidden transition-all duration-300 ${st.glow} hover:border-white/10`}
      >
        {/* Card Header (Clickable) */}
        <div 
          onClick={() => setExpanded(!expanded)}
          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors select-none gap-4"
        >
          {/* Left: Time and Title */}
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">{st.icon}</div>
            <div className="flex flex-col">
              <span className="font-mono text-xs text-gray-400 flex items-center gap-1.5 mb-1">
                <Clock size={12} />
                {event.timeRange || 'Unknown Time'}
              </span>
              <span className="font-medium text-gray-200 text-sm leading-snug pr-4">
                {event.description}
              </span>
            </div>
          </div>

          {/* Right: Badges & Toggle */}
          <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
            <div className="flex gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-md bg-gray-800/80 text-gray-300 border border-gray-700/50">
                Req: {event.requests ?? 0}
              </span>
              {event.errors > 0 && (
                <span className={`px-2.5 py-1 rounded-md border ${st.border} ${st.bg} ${st.color}`}>
                  Err: {event.errors}
                </span>
              )}
            </div>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-gray-500 hover:text-gray-300 ml-1"
            >
              <ChevronDown size={18} />
            </motion.div>
          </div>
        </div>

        {/* Expandable Logs / Insights */}
        <AnimatePresence>
          {expanded && event.logs && event.logs.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="border-t border-white/5 bg-black/20"
            >
              <ul className="p-4 space-y-2.5 text-sm text-gray-400">
                {event.logs.map((log, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-cyan-500 mt-1 flex-shrink-0 opacity-70">▸</span>
                    <span className="leading-relaxed">{log}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
