import React, { useState } from 'react';

export default function AddOrderModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState(
    initialData || {
      id: `00${Math.floor(Math.random() * 100) + 4}`, // fake auto-increment
      product: '',
      qty: '',
      deadline: '',
      priority: 'Medium',
      customer: '',
      status: 'On Track'
    }
  );

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-[400px] overflow-hidden">
        <div className="bg-slate-100 px-4 py-3 border-b flex justify-between items-center">
          <h2 className="font-bold text-slate-800">{initialData ? 'Edit Order' : 'Add New Order'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-red-500 text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Order ID</label>
            <input type="text" name="id" value={formData.id} readOnly className="w-full border rounded p-1.5 text-sm bg-slate-50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Product Name</label>
            <input type="text" name="product" required value={formData.product} onChange={handleChange} className="w-full border rounded p-1.5 text-sm" placeholder="e.g. Brake Pads" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
              <input type="number" name="qty" required value={formData.qty} onChange={handleChange} className="w-full border rounded p-1.5 text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Deadline</label>
              <input type="date" name="deadline" value={formData.deadline} onChange={handleChange} className="w-full border rounded p-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Customer</label>
            <input type="text" name="customer" value={formData.customer} onChange={handleChange} className="w-full border rounded p-1.5 text-sm" placeholder="e.g. Tata Motors" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className="w-full border rounded p-1.5 text-sm">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>CRITICAL</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full border rounded p-1.5 text-sm">
                <option>On Track</option>
                <option>At Risk</option>
                <option>Delayed</option>
                <option>CRITICAL</option>
                <option>Complete</option>
              </select>
            </div>
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm border rounded text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold">Save Order</button>
          </div>
        </form>
      </div>
    </div>
  );
}
