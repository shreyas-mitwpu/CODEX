import React from 'react';

export default function POModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
        <div className="bg-slate-100 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><span>📦</span> Generate Purchase Order</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-red-500 text-xl font-bold">×</button>
        </div>
        
        <div className="p-5">
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold text-slate-800">Quick Steel Co</div>
                <div className="text-xs text-green-600 font-semibold mt-1">✓ Verified Supplier</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-800">Total: ₹67,500</div>
                <div className="text-xs text-slate-500 mt-1">Payment: 30 days</div>
              </div>
            </div>
            <div className="text-sm text-slate-600">Material: Steel Rod (500 kg @ ₹135/kg)</div>
            <div className="text-sm text-slate-600">Delivery Time: Same Day</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-4 font-mono text-xs text-slate-700 whitespace-pre-wrap">
{`─────────────────────────────────────────────
PURCHASE ORDER #PO-2025-0001
─────────────────────────────────────────────
PO Date: 14 July 2025
Supplier: Quick Steel Co
Factory: Raju Auto Parts, Pune

Items:
Steel Rod - 500 kg @ ₹135/kg = ₹67,500
Delivery: Same Day by 6 PM
Payment: 30 Days from PO Date

─────────────────────────────────────────────
Authorized by: [Digital Signature]
─────────────────────────────────────────────`}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded shadow-sm text-sm">
              ✅ PREVIEW ORDER
            </button>
            <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 rounded shadow-sm text-sm">
              📧 Email Supplier
            </button>
            <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 rounded shadow-sm text-sm">
              💬 WhatsApp Supplier
            </button>
            <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 rounded shadow-sm text-sm">
              🖨️ Print PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
