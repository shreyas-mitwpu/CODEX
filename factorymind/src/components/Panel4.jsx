import React, { useState } from 'react';
import { WORKER_SHIFTS, SUPPLIERS } from '../data/demoData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { format, addDays } from 'date-fns';
import SmartParsersTab from './SmartParsersTab';

export default function Panel4({ activeTab }) {
  if (activeTab === 'calendar') return <CalendarView />;
  if (activeTab === 'metrics') return <MetricsView />;
  if (activeTab === 'shifts') return <ShiftsView />;
  if (activeTab === 'documents') return <DocumentsView />;
  if (activeTab === 'suppliers') return <SuppliersView />;
  if (activeTab === 'parsers') return <SmartParsersTab />;
  return null;
}

function CalendarView() {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">📅 Maintenance Calendar - July 2025</h2>
      <div className="grid grid-cols-7 gap-2 text-center text-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="font-bold py-2 bg-slate-100">{d}</div>)}
        
        {Array.from({length: 31}).map((_, i) => {
          const day = i + 1;
          let event = null;
          let isToday = day === 14;
          
          if (day === 3) event = { text: "Machine 1 Service", color: "bg-blue-100 text-blue-800" };
          if (day === 10) event = { text: "Machine 2 Service", color: "bg-orange-100 text-orange-800 border border-orange-400" };
          if (day === 17) event = { text: "Machine 3 Service", color: "bg-blue-100 text-blue-800" };
          
          return (
            <div key={day} className={`h-24 border ${isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-200'} p-1 text-left relative`}>
              <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{day}</span>
              {event && <div className={`mt-1 p-1 text-[10px] leading-tight rounded ${event.color}`}>{event.text}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricsView() {
  const lineData = [
    { day: 'Mon', stock: 200 },
    { day: 'Tue', stock: 180 },
    { day: 'Wed', stock: 155 }, // Today
    { day: 'Thu', stock: 400 }, // Projected Reorder
    { day: 'Fri', stock: 350 },
  ];
  
  const COLORS = ['#10B981', '#F59E0B', '#EF4444'];
  const pieData = [
    { name: 'On Track', value: 33 },
    { name: 'At Risk', value: 33 },
    { name: 'Critical', value: 33 },
  ];

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50">
      <div className="grid grid-cols-3 gap-6 h-[250px]">
        {/* Line Chart */}
        <div className="bg-white p-4 rounded shadow-sm border border-slate-200">
          <h3 className="text-xs font-bold text-slate-500 mb-2">Inventory Level Over Time (Steel Rod)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="day" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="stock" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Pie Chart */}
        <div className="bg-white p-4 rounded shadow-sm border border-slate-200">
          <h3 className="text-xs font-bold text-slate-500 mb-2">Order Priority Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Cost vs Revenue */}
        <div className="bg-white p-4 rounded shadow-sm border border-slate-200 flex flex-col justify-center">
          <h3 className="text-xs font-bold text-slate-500 mb-4">Cost vs Revenue</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="font-semibold">Revenue</span><span className="text-green-600">₹1,12,500</span></div>
              <div className="w-full bg-slate-100 h-2 rounded"><div className="bg-green-500 h-2 rounded" style={{width: '80%'}}></div></div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="font-semibold">Cost</span><span className="text-red-500">₹74,250</span></div>
              <div className="w-full bg-slate-100 h-2 rounded"><div className="bg-red-500 h-2 rounded" style={{width: '50%'}}></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftsView() {
  return (
    <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">👥 Worker Shift Management</h2>
        <button className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold">➕ Add Worker</button>
      </div>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {WORKER_SHIFTS.map((w, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{w.day}</td>
                <td className="px-4 py-3">{w.worker}</td>
                <td className="px-4 py-3">{w.shift}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${w.status === 'Active' ? 'bg-green-100 text-green-700' : w.status === 'On Leave' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {w.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-slate-400 hover:text-blue-500">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocumentsView() {
  return (
    <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto">
      <h2 className="text-lg font-bold mb-4">📄 Documents & Files</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
          <div className="text-2xl mb-2">☝</div>
          <p className="font-semibold text-slate-700">Click to upload new document</p>
          <p className="text-xs text-slate-500 mt-1">Support: PDF, JPEG, PNG, CSV, XLSX (max 10MB)</p>
        </div>
        
        {/* NEW FEATURE: CLOUD SYNC STATUS */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm flex flex-col justify-center">
          <h3 className="font-bold text-sm text-slate-800 mb-2 flex items-center gap-1"><span>🔄</span> Cloud Sync Status</h3>
          <div className="text-xs space-y-1.5 text-slate-600 mb-3">
            <div className="flex justify-between"><span>Last Sync:</span> <span className="font-semibold">2 mins ago</span></div>
            <div className="flex justify-between"><span>Status:</span> <span className="text-green-600 font-bold">✓ In Sync</span></div>
            <div className="flex justify-between"><span>Next Sync:</span> <span>28 mins</span></div>
          </div>
          <div className="text-[10px] space-y-1 mb-3 text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
            <div>├ Google Drive: <span className="text-green-600">✓ Enabled</span></div>
            <div>├ Dropbox: ✗ Disabled</div>
            <div>└ OneDrive: ✗ Disabled</div>
          </div>
          <button className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-1.5 rounded transition-colors">
            ⚡ Manual Sync
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {['Invoice - Raju Auto #123.pdf', 'Machine Photo - Machine 3.jpg', 'Quality Log - July.csv', 'Supplier Agreement - Quick Steel.pdf', 'Monthly Report - June 2025.pdf'].map((doc, i) => (
          <div key={i} className="border border-slate-200 p-3 rounded flex items-center gap-3 hover:shadow-sm">
            <span className="text-slate-400 text-xl">📄</span>
            <span className="text-sm font-medium text-slate-700 truncate">{doc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuppliersView() {
  return (
    <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">📢 Supplier Directory</h2>
        <button className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold">➕ Add Supplier</button>
      </div>
      <div className="grid gap-3">
        {SUPPLIERS.map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 p-4 rounded-lg flex justify-between items-center shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800">{s.name}</h3>
              <div className="text-yellow-400 text-sm mt-1">{s.rating}</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-semibold text-slate-700">{s.price}</div>
              <div className="text-xs text-slate-500 mt-1">Delivery: {s.delivery}</div>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase">{s.status}</span>
              <button className="text-slate-400 hover:text-slate-600 px-2">✏️</button>
              <button className="text-red-300 hover:text-red-500 px-2">❌</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
