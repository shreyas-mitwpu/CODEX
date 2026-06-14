import React, { useState } from 'react';
import { STOCK_INPUT } from '../data/demoData';
import AddOrderModal from './AddOrderModal';

export default function InputPanel({ onRun, isRunning, orders = [], setOrders }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const handleDelete = (id) => {
    setOrders(orders.filter(o => o.id !== id));
  };

  const handleSaveOrder = (orderData) => {
    let color = 'green';
    if (orderData.status === 'At Risk') color = 'orange';
    if (orderData.status === 'CRITICAL') color = 'red';
    
    if (editingOrder) {
      setOrders(orders.map(o => o.id === orderData.id ? {...orderData, color} : o));
    } else {
      setOrders([...orders, {...orderData, color}]);
    }
    setModalOpen(false);
  };

  const openAdd = () => {
    setEditingOrder(null);
    setModalOpen(true);
  };

  const openEdit = (order) => {
    setEditingOrder(order);
    setModalOpen(true);
  };

  return (
    <div className="w-[25%] min-w-[300px] bg-white border-r border-slate-200 p-6 flex flex-col h-full overflow-y-auto">
      <h2 className="text-[14px] font-semibold text-slate-500 mb-6 uppercase tracking-wider shrink-0">
        Factory Inputs
      </h2>

      {/* SECTION A — STOCK DATA */}
      <div className="mb-6 shrink-0">
        <label className="block text-sm font-bold text-slate-800 mb-2">
          Morning Stock Update
        </label>
        <textarea
          className="w-full h-[120px] text-[12px] bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-slate-700 resize-none outline-none focus:border-green-500"
          readOnly
          defaultValue={STOCK_INPUT}
        ></textarea>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-green-500 text-[10px]">●</span>
          <span className="text-[11px] text-slate-500 font-medium">
            Received from Ramesh, 7:15 AM
          </span>
        </div>
      </div>

      {/* SECTION B — FACTORY PHOTO */}
      <div className="mb-6 shrink-0">
        <label className="block text-sm font-bold text-slate-800 mb-2">
          Factory Floor Photo
        </label>
        <div className="relative rounded-lg overflow-hidden border border-slate-200 h-[200px]">
          <img 
            src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400" 
            alt="Factory Floor" 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 flex items-center gap-2">
            <span className="text-white text-xs">📷</span>
            <span className="text-white text-xs font-semibold">Machine 2 — Assembly Line</span>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-500 font-medium">
          Photo received 7:20 AM
        </div>
      </div>

      {/* Section C: Pending Orders */}
      <div className="flex-1 overflow-y-auto mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Pending Orders ({orders.length})
          </h3>
          <button onClick={openAdd} className="text-xs text-blue-600 font-bold hover:underline">
            + Add Order
          </button>
        </div>
        
        <div className="space-y-2">
          {orders.map((order) => {
            const badgeColors = {
              green: 'bg-green-100 text-green-700 border-green-200',
              orange: 'bg-amber-100 text-amber-700 border-amber-200',
              red: 'bg-red-100 text-red-700 border-red-200',
            };
            
            return (
              <div 
                key={order.id} 
                className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm group hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px] font-mono">#{order.id}</span>
                    <span className="text-slate-800 text-[13px] font-bold">{order.product}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(order)} className="text-slate-400 hover:text-blue-500 text-xs">✏️</button>
                    <button onClick={() => handleDelete(order.id)} className="text-red-300 hover:text-red-500 text-xs">❌</button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-2">
                  <div className="text-slate-500 text-[11px]">
                    {order.qty} units • Due {order.deadline}
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeColors[order.color] || badgeColors.green}`}>
                    {order.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION D — GENERATE BUTTON */}
      <div className="mt-auto shrink-0 pt-4">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-semibold text-[14px] py-[14px] rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
        >
          <span>⚡</span>
          {isRunning ? 'Agents Running...' : 'Run FactoryMind Agents'}
        </button>
      </div>

      <AddOrderModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSave={handleSaveOrder} 
        initialData={editingOrder} 
      />
    </div>
  );
}
