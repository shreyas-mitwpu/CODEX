import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      (email === 'admin@factorymind.com' && password === 'admin') ||
      (email === 'rajoo@rajuauto.com' && password === 'rajoo')
    ) {
      onLogin();
    } else {
      setError('Invalid credentials. Use admin@factorymind.com / admin');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F172A] z-[200] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded bg-blue-600 flex items-center justify-center text-white text-2xl shadow-md">
            🏭
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">FactoryMind Login</h2>
        <p className="text-center text-sm text-slate-500 mb-6">Please sign in to access your factory dashboard</p>
        
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4 font-semibold text-center">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="admin@factorymind.com"
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700">Password</label>
              <a href="#" className="text-[10px] text-blue-600 font-semibold hover:underline">Forgot Password?</a>
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-colors flex justify-center items-center gap-2 mt-2">
            <span>🔑</span> Login to FactoryMind
          </button>
        </form>
        
        <div className="mt-6 border-t border-slate-200 pt-4 text-center">
          <p className="text-xs text-slate-500 font-mono">Demo: admin@factorymind.com / admin</p>
        </div>
      </div>
    </div>
  );
}
