import React, { useState, useEffect } from 'react';
import { parseAgentText } from '../utils/textParsers';
import { buildAndDownloadWorkbook } from '../utils/richExportExcel';

const AGENTS = [
  { id: 'inventory', label: '📦 Inventory', title: 'Inventory Agent Parser', subtitle: 'Parses quantities and thresholds.' },
  { id: 'production', label: '⚙️ Production', title: 'Production Agent Parser', subtitle: 'Parses line statuses and capacity.' },
  { id: 'maintenance', label: '🔧 Maintenance', title: 'Maintenance Agent Parser', subtitle: 'Parses service dates and urgency.' }
];

export default function SmartParsersTab() {
  const [activeAgent, setActiveAgent] = useState('inventory');
  const [text, setText] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [result, setResult] = useState({ rows: [], summary: {} });

  useEffect(() => {
    try {
      const parsed = parseAgentText(activeAgent, text, { photoName });
      setResult(parsed);
    } catch (e) {
      setResult({ rows: [], summary: {} });
    }
  }, [text, activeAgent, photoName]);

  const handleDownload = () => {
    buildAndDownloadWorkbook(activeAgent, text, { photoName });
  };

  const currentAgentObj = AGENTS.find(a => a.id === activeAgent);

  return (
    <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto flex flex-col md:flex-row gap-6">
      
      {/* Left side: Input Area */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <div className="bg-slate-100 p-1 rounded-lg flex text-sm font-semibold">
          {AGENTS.map(agent => (
            <button 
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={`flex-1 py-2 text-center rounded-md transition-colors ${activeAgent === agent.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {agent.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex-1 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-1">{currentAgentObj.title}</h3>
          <p className="text-xs text-slate-500 mb-4">{currentAgentObj.subtitle}</p>
          
          <textarea
            className="w-full flex-1 border border-slate-300 rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[200px]"
            placeholder="Paste raw unstructured text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          
          {activeAgent === 'production' && (
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Optional Photo Attachment</label>
              <input 
                type="file" 
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                onChange={(e) => setPhotoName(e.target.files[0]?.name || '')}
              />
            </div>
          )}
          
          <button 
            disabled={!result.rows || result.rows.length === 0}
            onClick={handleDownload}
            className={`mt-4 w-full py-3 rounded-lg font-bold text-sm transition-colors ${result.rows && result.rows.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            📥 Download Styled Excel
          </button>
        </div>
      </div>

      {/* Right side: Live Preview Area */}
      <div className="w-full md:w-2/3 flex flex-col gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-lg">Live Parse Preview</h3>
            <div className="flex gap-2">
              {Object.entries(result.summary || {}).map(([key, count]) => (
                <span key={key} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700">
                  {key}: {count}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  {result.rows && result.rows.length > 0 
                    ? Object.keys(result.rows[0]).map(k => <th key={k} className="p-3 capitalize">{k}</th>)
                    : <th className="p-3">Data</th>}
                </tr>
              </thead>
              <tbody>
                {(!result.rows || result.rows.length === 0) ? (
                  <tr>
                    <td className="p-8 text-center text-slate-400 italic">No valid data parsed yet.</td>
                  </tr>
                ) : (
                  result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      {Object.values(row).map((val, j) => {
                        const strVal = String(val);
                        let colorClass = "text-slate-800";
                        if (["critical", "down"].includes(strVal.toLowerCase())) colorClass = "text-red-600 font-bold bg-red-50 px-2 py-1 rounded";
                        else if (["high", "low", "idle"].includes(strVal.toLowerCase())) colorClass = "text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded";
                        else if (["ok", "running"].includes(strVal.toLowerCase())) colorClass = "text-green-600 font-bold bg-green-50 px-2 py-1 rounded";
                        
                        return (
                          <td key={j} className="p-3">
                            <span className={colorClass}>{strVal}</span>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
        </div>
      </div>
    </div>
  );
}
