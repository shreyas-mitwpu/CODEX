import React, { useState } from 'react';
import { exportToExcel, exportGanttCSV } from '../utils/exportExcel';

export default function ExportManager() {
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = (type) => {
    setIsOpen(false);
    if (type === 'excel') {
      exportToExcel([{ Metric: "Savings", Value: 57000 }], "Full_Dashboard_Report");
    } else if (type === 'csv') {
      exportGanttCSV();
    } else if (type === 'txt') {
      const element = document.createElement("a");
      const file = new Blob(["Agent logs exported..."], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = "agent_logs.txt";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-1.5 px-3 rounded flex items-center gap-1"
      >
        <span>📥</span> Export Report
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded shadow-lg z-50">
          <ul className="text-xs text-slate-700 py-1">
            <li className="px-4 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => handleExport('excel')}>Full Dashboard (Excel)</li>
            <li className="px-4 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => handleExport('csv')}>Production Schedule (CSV)</li>
            <li className="px-4 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => handleExport('excel')}>Stock Inventory (XLSX)</li>
            <li className="px-4 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => handleExport('txt')}>Orders Summary (PDF fallback)</li>
            <li className="px-4 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => handleExport('txt')}>Agent Logs (TXT)</li>
            <li className="px-4 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => handleExport('excel')}>Cost Analysis (XLSX)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
