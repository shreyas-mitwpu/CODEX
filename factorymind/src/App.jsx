import { useState, useRef } from 'react';
import InputPanel from './components/InputPanel';
import AgentChain from './components/AgentChain';
import Dashboard from './components/Dashboard';
import Panel4 from './components/Panel4';
import ExportManager from './components/ExportManager';
import Login from './components/Login';
import { runAgent } from './utils/openaiClient';
import { loadFromLocalStorage, saveToLocalStorage } from './utils/localStorageManager';
import { DEFAULT_ORDERS, FACTORIES } from './data/demoData';

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState(0); 
  const [logs, setLogs] = useState([]);
  const [evalComplete, setEvalComplete] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // V2 Global State
  const [activeFactoryId, setActiveFactoryId] = useState(FACTORIES[0].id);
  const [orders, setOrders] = useState(() => loadFromLocalStorage('orders', DEFAULT_ORDERS));
  const [activePanel4Tab, setActivePanel4Tab] = useState(null); // 'calendar', 'metrics', 'shifts', etc.

  const activeFactory = FACTORIES.find(f => f.id === activeFactoryId) || FACTORIES[0];

  // Sync orders to local storage
  const handleSetOrders = (newOrders) => {
    setOrders(newOrders);
    saveToLocalStorage('orders', newOrders);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const addLog = (agentId, chunk) => {
    setLogs(prev => {
      const newLogs = [...prev];
      const lastIndex = newLogs.length - 1;
      
      if (lastIndex >= 0 && newLogs[lastIndex].agentId === agentId) {
        // Proper immutable update
        newLogs[lastIndex] = {
          ...newLogs[lastIndex],
          text: newLogs[lastIndex].text + chunk
        };
      } else {
        // Create new log entry
        newLogs.push({ agentId, text: chunk });
      }
      return newLogs;
    });
  };

  const handleRun = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setStep(0);
    setLogs([]);
    setEvalComplete(false);

    // T=0s
    setLogs([{ agentId: 0, text: 'Initializing Codex...\n' }]);

    // T=0.5s: Start Agent 1
    await sleep(500);
    // Agent 1 needs to finish around T=8s (7.5s duration)
    await runAgent(1, null, (chunk) => addLog(1, chunk), 7500);
    setStep(1); // triggers UI
    addLog(0, '\nPASSING CONSTRAINTS TO: Production Agent\n\n');

    // T=9.5s: Start Agent 2 (1.5s after Agent 1 finished)
    await sleep(1500);
    // Agent 2 needs to finish around T=17s (7.5s duration)
    await runAgent(2, null, (chunk) => addLog(2, chunk), 7500);
    setStep(2);
    addLog(0, '\nPASSING TO: Maintenance Agent\n\n');

    // T=18.5s: Start Agent 3 (1.5s after Agent 2 finished)
    await sleep(1500);
    // Agent 3 needs to finish around T=25s (6.5s duration)
    await runAgent(3, null, (chunk) => addLog(3, chunk), 6500);
    setStep(3);
    addLog(0, '\nPASSING TO: Forecast Agent\n\n');

    // T=26.5s: Start Agent 4 (1.5s after Agent 3 finished)
    await sleep(1500);
    // Agent 4 needs to finish around T=33s (6.5s duration)
    await runAgent(4, null, (chunk) => addLog(4, chunk), 6500);
    setStep(4);
    
    // Complete sequence
    setIsRunning(false);
    setEvalComplete(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className={`h-screen w-full flex flex-col font-sans overflow-hidden ${isDarkMode ? 'bg-slate-900 filter invert hue-rotate-180' : 'bg-[#F1F5F9]'}`}>
      
      {/* Header Bar */}
      <header className="h-[60px] md:h-[64px] bg-[#0F172A] border-b border-slate-800 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shadow-md text-lg">
            🏭
          </div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-white font-bold text-[18px] tracking-tight">FactoryMind</h1>
            <select 
              className="bg-transparent text-slate-400 text-[13px] font-medium outline-none cursor-pointer hover:text-white"
              value={activeFactoryId}
              onChange={(e) => setActiveFactoryId(e.target.value)}
            >
              {FACTORIES.map(f => (
                <option key={f.id} value={f.id} className="text-black">{f.name}, {f.location.split(',')[1]}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4 relative">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="text-slate-400 hover:text-white text-lg transition-colors"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? '🌞' : '🌙'}
          </button>
          
          <div 
            className="text-slate-400 cursor-pointer hover:text-white relative text-lg"
            onClick={() => document.getElementById('notif-drop').classList.toggle('hidden')}
          >
            🔔
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded-full">3</span>
          </div>
          
          {/* Notification Dropdown */}
          <div id="notif-drop" className="hidden absolute top-8 right-16 w-72 bg-white border border-slate-200 shadow-xl rounded-lg z-50 overflow-hidden">
            <div className="bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2 border-b border-slate-200">
              Notifications
            </div>
            <div className="max-h-64 overflow-y-auto">
              <div className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-xs mt-0.5">●</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">CRITICAL: Steel Rod Stock Low</div>
                    <div className="text-[10px] text-slate-500 mt-1">3.4 days remaining</div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
                <div className="flex items-start gap-2">
                  <span className="text-orange-500 text-xs mt-0.5">●</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">WARNING: Machine 2 Needs Service</div>
                    <div className="text-[10px] text-slate-500 mt-1">67 days overdue</div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 hover:bg-slate-50">
                <div className="flex items-start gap-2">
                  <span className="text-green-500 text-xs mt-0.5">✓</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Order #003 Completed</div>
                    <div className="text-[10px] text-slate-500 mt-1">Gaskets shipped to customer</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-[#1E293B] border border-slate-700 px-3 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            <span className="text-green-400 text-[11px] font-bold tracking-widest uppercase">Live</span>
          </div>
        </div>
      </header>

      {/* Main 3-Panel Layout */}
      <main className={`flex-1 flex flex-col md:flex-row overflow-hidden transition-all duration-300 ${activePanel4Tab ? 'md:max-h-[50vh]' : ''}`}>
        {/* Panel 1: Input */}
        <div className="md:w-[25%] w-full h-[50vh] md:h-auto overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-white z-20">
          <InputPanel onRun={handleRun} isRunning={isRunning} orders={orders} setOrders={handleSetOrders} />
        </div>
        
        {/* Panel 2: Agent Chain */}
        <div className="md:w-[40%] w-full h-[50vh] md:h-auto overflow-hidden shrink-0 z-10">
          <AgentChain isRunning={isRunning} logs={logs} evalComplete={evalComplete} />
        </div>
        
        {/* Panel 3: Dashboard */}
        <div className="md:w-[35%] w-full h-full overflow-hidden shrink-0 bg-white">
          <Dashboard step={step} ExportComponent={ExportManager} />
        </div>
      </main>

      {/* Enterprise Feature Toggle Bar */}
      <div className="h-10 bg-slate-200 border-y border-slate-300 flex items-center px-4 gap-2 overflow-x-auto shrink-0 text-xs font-semibold text-slate-600">
        <button onClick={() => setActivePanel4Tab(activePanel4Tab === 'calendar' ? null : 'calendar')} className={`px-3 py-1 rounded ${activePanel4Tab === 'calendar' ? 'bg-white shadow' : 'hover:bg-slate-300'}`}>📅 Maintenance Calendar</button>
        <button onClick={() => setActivePanel4Tab(activePanel4Tab === 'metrics' ? null : 'metrics')} className={`px-3 py-1 rounded ${activePanel4Tab === 'metrics' ? 'bg-white shadow' : 'hover:bg-slate-300'}`}>📊 Real-time Metrics</button>
        <button onClick={() => setActivePanel4Tab(activePanel4Tab === 'shifts' ? null : 'shifts')} className={`px-3 py-1 rounded ${activePanel4Tab === 'shifts' ? 'bg-white shadow' : 'hover:bg-slate-300'}`}>👥 Worker Shifts</button>
        <button onClick={() => setActivePanel4Tab(activePanel4Tab === 'documents' ? null : 'documents')} className={`px-3 py-1 rounded ${activePanel4Tab === 'documents' ? 'bg-white shadow' : 'hover:bg-slate-300'}`}>📄 Documents</button>
        <button onClick={() => setActivePanel4Tab(activePanel4Tab === 'suppliers' ? null : 'suppliers')} className={`px-3 py-1 rounded ${activePanel4Tab === 'suppliers' ? 'bg-white shadow' : 'hover:bg-slate-300'}`}>📢 Suppliers</button>
        <button onClick={() => setActivePanel4Tab(activePanel4Tab === 'parsers' ? null : 'parsers')} className={`px-3 py-1 rounded ${activePanel4Tab === 'parsers' ? 'bg-white shadow text-blue-700' : 'hover:bg-slate-300 text-blue-600'}`}>🧠 Smart Parsers (MVP)</button>
      </div>

      {/* Panel 4: Slide-up content */}
      {activePanel4Tab && (
        <div className="flex-1 bg-white overflow-hidden border-t border-slate-300 transition-all duration-300">
          <Panel4 activeTab={activePanel4Tab} />
        </div>
      )}

    </div>
  );
}
