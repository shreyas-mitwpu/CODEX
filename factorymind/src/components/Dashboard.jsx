import React, { useEffect, useState, useMemo } from 'react';
import POModal from './POModal';

export default function Dashboard({ step, ExportComponent, parsedInventory }) {
  // step matches completed agents: 0=idle, 1=A1 done, 2=A2 done, 3=A3 done, 4=A4 done
  const [poModalOpen, setPoModalOpen] = useState(false);
  
  const [savingsCount, setSavingsCount] = useState(0);

  // Counter animation logic when step 4 is reached
  useEffect(() => {
    if (step >= 4) {
      let current = 0;
      const target = 57000;
      const increment = target / 20; // 20 frames for 1 second at ~50ms
      const interval = setInterval(() => {
        current += increment;
        if (current >= target) {
          setSavingsCount(target);
          clearInterval(interval);
        } else {
          setSavingsCount(Math.floor(current));
        }
      }, 50);
      return () => clearInterval(interval);
    } else {
      /* setSavingsCount(0); */
    }
  }, [step]);

  // Derive dynamic inventory metrics from parsedInventory
  const inventoryMetrics = useMemo(() => {
    if (!parsedInventory || !parsedInventory.rows || parsedInventory.rows.length === 0) {
      // Fallback to hardcoded values when no parsed data
      return {
        criticalItem: { name: 'Steel Rod', value: '155 kg', hasCritical: true },
        totalItems: 5,
        criticalCount: 1,
        lowCount: 1,
        okCount: 3,
        alerts: [
          { color: 'red', label: 'CRITICAL', title: 'Steel Rod — Reorder Needed', desc: '155kg remaining · below safe threshold' },
        ],
      };
    }

    const rows = parsedInventory.rows;
    const summary = parsedInventory.summary || {};
    const criticalRows = rows.filter(r => r.status === 'Critical');
    const lowRows = rows.filter(r => r.status === 'Low');
    const okRows = rows.filter(r => r.status === 'OK');

    const firstCritical = criticalRows[0];
    const criticalItem = firstCritical
      ? { name: firstCritical.item, value: `${firstCritical.quantity ?? '?'} units`, hasCritical: true }
      : { name: 'All Items', value: 'OK', hasCritical: false };

    // Build dynamic alerts from critical and low rows
    const alerts = [
      ...criticalRows.map(r => ({
        color: 'red',
        label: 'CRITICAL',
        title: `${r.item} — Reorder Needed`,
        desc: `${r.quantity ?? '?'} remaining${r.threshold != null ? ` · threshold: ${r.threshold}` : ''} · ${r.note || 'Below safe level'}`,
      })),
      ...lowRows.map(r => ({
        color: 'orange',
        label: 'LOW',
        title: `${r.item} — Stock Low`,
        desc: `${r.quantity ?? '?'} remaining${r.threshold != null ? ` · threshold: ${r.threshold}` : ''}`,
      })),
    ];

    return {
      criticalItem,
      totalItems: rows.length,
      criticalCount: criticalRows.length,
      lowCount: lowRows.length,
      okCount: okRows.length,
      alerts,
    };
  }, [parsedInventory]);

  if (step === 0) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center h-full">
        <div className="text-slate-400 font-medium">Waiting for agents...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 border-l border-slate-200 p-6 overflow-y-auto h-full relative">
      <POModal isOpen={poModalOpen} onClose={() => setPoModalOpen(false)} />
      <div className="max-w-2xl mx-auto space-y-8 pb-10">
        
        {/* Header Area */}
        <div className="flex justify-between items-center">
          <h2 className="text-[14px] font-semibold text-slate-500 uppercase tracking-wider">
            Output Dashboard
          </h2>
          {step >= 4 && ExportComponent && <ExportComponent />}
        </div>
        
        {/* SUBSECTION A: METRIC CARDS (Show >= 1) */}
        {step >= 1 && (
          <div className="grid grid-cols-4 gap-4 animate-slideUp">
            <MetricCard 
              label={inventoryMetrics.criticalItem.name} 
              value={inventoryMetrics.criticalItem.value} 
              badge={inventoryMetrics.criticalItem.hasCritical ? 'CRITICAL' : 'OK'} 
              badgeColor={inventoryMetrics.criticalItem.hasCritical ? 'red' : 'green'} 
            />
            <MetricCard label="Stock Items" value={String(inventoryMetrics.totalItems)} badge={`${inventoryMetrics.okCount} OK`} badgeColor="gray" />
            <MetricCard label="Low Stock" value={String(inventoryMetrics.criticalCount + inventoryMetrics.lowCount)} badge={inventoryMetrics.criticalCount > 0 ? `${inventoryMetrics.criticalCount} critical` : 'none'} badgeColor={inventoryMetrics.criticalCount > 0 ? 'orange' : 'green'} />
            <MetricCard label="Week Savings" value="₹57,000" badge="saved" badgeColor="green" />
          </div>
        )}

        {/* SUBSECTION B: URGENT ALERTS (Show >= 1) */}
        {step >= 1 && (
          <div className="animate-slideUp" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <h3 className="text-[13px] font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span className="text-red-500">⚠</span> Urgent Alerts
            </h3>
            <div className="space-y-3">
              {/* Dynamic inventory alerts */}
              {inventoryMetrics.alerts.length > 0 ? (
                inventoryMetrics.alerts.map((alert, idx) => (
                  <div key={`inv-${idx}`} className={idx > 0 ? 'animate-slideUp' : ''}>
                    <AlertItem
                      color={alert.color}
                      label={alert.label}
                      title={alert.title}
                      desc={alert.desc}
                    />
                  </div>
                ))
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm font-medium flex items-center gap-2">
                  <span>✓</span> All stock levels are within safe thresholds.
                </div>
              )}
              {/* Static order-based alert (always shown) */}
              <AlertItem 
                color="orange" label="AT RISK" title="Order #003 Gaskets — Deadline at Risk"
                desc="Due Wednesday · 20% complete · Machine 1 reassigned to fix this" 
              />
              {step >= 3 && (
                <div className="animate-slideUp">
                  <AlertItem 
                    color="orange" label="ACTION" title="Machine 2 — Schedule Service"
                    desc="67 days since service · Book Wednesday 12PM before night shift" 
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBSECTION C: GANTT CHART (Show >= 2) */}
        {step >= 2 && (
          <div className="animate-slideUp" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            <h3 className="text-[13px] font-semibold text-slate-800 mb-3">48-Hour Production Schedule</h3>
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-5 text-[10px] font-bold text-slate-500 uppercase mb-2">
                  <div>Machine</div>
                  <div>Wed AM</div>
                  <div>Wed PM</div>
                  <div>Thu AM</div>
                  <div>Thu PM</div>
                </div>
                {/* Row 1 */}
                <div className="grid grid-cols-5 gap-2 items-center mb-2">
                  <div className="text-[12px] font-semibold text-slate-700">Machine 1</div>
                  <GanttBlock color="bg-teal-600">Gaskets</GanttBlock>
                  <GanttBlock color="bg-teal-600">Gaskets</GanttBlock>
                  <GanttBlock color="bg-teal-600">cont.</GanttBlock>
                  <GanttBlock empty />
                </div>
                {/* Row 2 */}
                <div className="grid grid-cols-5 gap-2 items-center mb-2">
                  <div className="text-[12px] font-semibold text-slate-700">Machine 2</div>
                  <GanttBlock color="bg-blue-600">BrakePads</GanttBlock>
                  <GanttBlock color="bg-blue-600">cont.</GanttBlock>
                  <GanttBlock color="bg-amber-600">Clutch</GanttBlock>
                  <GanttBlock color="bg-amber-600">cont.</GanttBlock>
                </div>
                {/* Row 3 */}
                <div className="grid grid-cols-5 gap-2 items-center">
                  <div className="text-[12px] font-semibold text-slate-700">Machine 3</div>
                  <GanttBlock color="bg-red-600">BLOCKED</GanttBlock>
                  <GanttBlock color="bg-red-600">BLOCKED</GanttBlock>
                  <GanttBlock color="bg-green-600">Gaskets</GanttBlock>
                  <GanttBlock empty />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION D: REORDER CARD (Show >= 2) */}
        {step >= 2 && (
          <div className="animate-slideUp" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <h3 className="text-[13px] font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span>📦</span> Reorder Now
            </h3>
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <div className="text-[16px] font-bold text-slate-900 mb-4">Steel Rod — 500 kg</div>
              
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="font-semibold text-slate-800">Quick Steel Co</div>
                  <div className="text-[11px] text-green-600 font-medium">Same day delivery</div>
                  <div className="text-[11px] text-blue-600 cursor-pointer hover:underline">+91-98765-43211</div>
                </div>
                <div className="text-right">
                  <div className="text-[18px] font-semibold text-slate-900">₹67,500</div>
                  <div className="text-[11px] text-slate-500">best for urgency</div>
                </div>
              </div>
              
              <div className="text-center text-[10px] font-bold text-slate-400 my-3">OR</div>
              
              <div className="bg-slate-50 rounded p-3 text-[12px] text-slate-500 mb-4">
                Ram Steel Works — 2 days — ₹60,000 (cheaper but too slow)
              </div>
              
              <button onClick={() => setPoModalOpen(true)} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                <span>📞</span> Generate Purchase Order →
              </button>
            </div>
          </div>
        )}

        {/* SUBSECTION E: SAVINGS COUNTER (Show >= 4) */}
        {step >= 4 && (
          <div className="animate-slideUp space-y-6" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            {/* SUBSECTION E: SAVINGS COUNTER */}
            <div className="bg-white border border-slate-200 border-l-4 border-l-green-600 rounded-lg p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="text-6xl">💰</span>
              </div>
              <h3 className="text-[14px] font-bold text-slate-800 mb-2">💰 This Week's Impact</h3>
              <div className="text-4xl font-black text-green-600 tracking-tight">₹{savingsCount.toLocaleString()}</div>
              <div className="text-[11px] font-medium text-slate-500 mt-1 mb-4">saved this week by FactoryMind</div>
              
              <div className="space-y-1.5 text-[12px] font-medium text-slate-700 font-mono">
                <div className="flex justify-between">
                  <span>Late penalty avoided:</span>
                  <span className="text-green-600">₹45,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Overstock prevented:</span>
                  <span className="text-green-600">₹12,000</span>
                </div>
              </div>
              
              <div className="border-t border-slate-200 my-4"></div>
              
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-slate-500 font-medium">App cost this month: ₹999</span>
                <span className="text-green-600 font-black text-[13px] bg-green-50 px-2 py-1 rounded">ROI: 5,600%</span>
              </div>
            </div>

            {/* NEW FEATURE: COST CALCULATOR */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-[13px] font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span>💵</span> Production Cost Calculator
              </h3>
              <div className="space-y-2 text-xs font-mono text-slate-700">
                <div className="flex justify-between"><span>Raw Materials (Today):</span><span>₹45,250</span></div>
                <div className="flex justify-between"><span>Labor Cost:</span><span>₹18,000</span></div>
                <div className="flex justify-between"><span>Machine Maintenance:</span><span>₹2,500</span></div>
                <div className="flex justify-between"><span>Utilities (Power/Water):</span><span>₹8,500</span></div>
                <div className="border-b border-dashed border-slate-300 my-2"></div>
                <div className="flex justify-between font-bold text-slate-900 text-[13px]"><span>Total Daily Cost:</span><span>₹74,250</span></div>
                <div className="flex justify-between font-bold text-green-600 text-[13px] mt-1"><span>Revenue Expected:</span><span>₹1,12,500</span></div>
                <div className="border-b border-dashed border-slate-300 my-2"></div>
                <div className="flex justify-between font-black text-slate-900 text-[14px]"><span>Daily Profit:</span><span>₹38,250</span></div>
                <div className="flex justify-between font-bold text-slate-500 mb-4"><span>Profit Margin:</span><span>34%</span></div>
                
                <div className="mt-4">
                  <div className="text-[11px] text-slate-500 font-bold mb-2">Breakdown by Product:</div>
                  <div className="pl-2 space-y-1">
                    <div>├ Brake Pads: ₹28,500 (42%)</div>
                    <div>├ Clutch Plates: ₹45,200 (38%)</div>
                    <div>└ Gaskets: ₹38,800 (20%)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponents

function MetricCard({ label, value, badge, badgeColor }) {
  const badgeClasses = {
    red: 'bg-red-100 text-red-700',
    gray: 'bg-slate-100 text-slate-600',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-green-100 text-green-700',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm">
      <div className="text-[11px] uppercase text-slate-500 font-bold mb-1">{label}</div>
      <div className="text-[24px] font-semibold text-slate-900 mb-2 leading-none">{value}</div>
      <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full w-max ${badgeClasses[badgeColor]}`}>
        {badge}
      </div>
    </div>
  );
}

function AlertItem({ color, label, title, desc }) {
  const colors = {
    red: 'border-l-red-500 bg-red-50 text-red-700',
    orange: 'border-l-orange-500 bg-orange-50 text-orange-700',
  };
  const badgeColors = {
    red: 'bg-red-200 text-red-800',
    orange: 'bg-orange-200 text-orange-800',
  };
  return (
    <div className={`border border-slate-200 border-l-4 rounded-lg p-3 flex justify-between items-start shadow-sm bg-white`}>
      <div className="flex gap-3 items-start">
        <div className={`w-1 h-full rounded ${color === 'red' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
        <div>
          <div className="font-bold text-[13px] text-slate-900">{title}</div>
          <div className="text-[11px] text-slate-500 mt-1 leading-tight">{desc}</div>
        </div>
      </div>
      <div className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap ml-2 ${badgeColors[color]}`}>
        {label}
      </div>
    </div>
  );
}

function GanttBlock({ children, color, empty }) {
  if (empty) {
    return <div className="h-[28px] rounded-md border border-dashed border-slate-200 bg-slate-50"></div>;
  }
  return (
    <div className={`h-[28px] ${color} rounded-md text-white text-[10px] font-semibold flex items-center justify-center px-1 truncate shadow-sm`}>
      {children}
    </div>
  );
}
