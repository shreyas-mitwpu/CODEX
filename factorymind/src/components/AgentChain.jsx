import React, { useEffect, useRef } from 'react';
import { FALLBACK_AGENTS } from '../data/demoData';

export default function AgentChain({ isRunning, logs, currentAgent, evalComplete }) {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-[40%] min-w-[400px] bg-[#0F172A] border-r border-slate-700 flex flex-col h-full overflow-hidden">
      
      {/* Title Bar */}
      <div className="px-6 py-4 border-b border-slate-800 bg-[#0B1120]">
        <h2 className="text-[12px] font-mono text-slate-400">
          🤖 Codex Agent Orchestrator — Live Reasoning
        </h2>
      </div>

      {/* Log Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 font-mono text-[13px] leading-relaxed pb-20"
      >
        {!isRunning && logs.length === 0 && (
          <div className="text-slate-500 italic">Waiting for input...</div>
        )}
        
        {logs.map((log, i) => (
          <div key={i} className="mb-6 whitespace-pre-wrap">
            <span style={{ color: FALLBACK_AGENTS.find(a => a.id === log.agentId)?.color || '#fff' }}>
              {log.text}
            </span>
          </div>
        ))}
        
        {/* Blinking Cursor */}
        {isRunning && !evalComplete && (
          <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1 align-middle"></span>
        )}

        {/* Evals Section */}
        {evalComplete && (
          <div className="mt-8 border border-slate-700 rounded p-4 bg-[#1E293B]/50 text-slate-300">
            <div className="border-b border-slate-700 pb-2 mb-3 font-bold">
              CODEX AGENT EVALUATION REPORT
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Inventory Agent</span>
                <span className="flex items-center gap-2">
                  <span className="tracking-widest text-[#10B981]">████████████</span> 94%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Production Agent</span>
                <span className="flex items-center gap-2">
                  <span className="tracking-widest text-[#10B981]">██████████<span className="text-slate-600">░░</span></span> 89%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Maintenance Agent</span>
                <span className="flex items-center gap-2">
                  <span className="tracking-widest text-[#10B981]">████████<span className="text-slate-600">░░░░</span></span> 78%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Forecast Agent</span>
                <span className="flex items-center gap-2">
                  <span className="tracking-widest text-[#10B981]">███████████<span className="text-slate-600">░</span></span> 91%
                </span>
              </div>
            </div>
            <div className="border-t border-slate-700 pt-3 space-y-1 text-[12px]">
              <div className="flex justify-between"><span>Average Confidence:</span><span className="font-bold">88%</span></div>
              <div className="flex justify-between"><span>Agents completed:</span><span className="font-bold">4/4</span></div>
              <div className="flex justify-between"><span>Critical alerts found:</span><span className="font-bold text-red-400">2</span></div>
              <div className="flex justify-between"><span>Est. money saved:</span><span className="font-bold text-green-400">₹57,000</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status */}
      {evalComplete && (
        <div className="bg-[#0B1120] border-t border-slate-800 p-4">
          <div className="flex items-center gap-2 text-[#10B981] font-mono text-[13px] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            ● FactoryMind ready — Dashboard updated
          </div>
        </div>
      )}
    </div>
  );
}
