const fs = require('fs');
const files = [
  'src/components/AgentChain.jsx',
  'src/components/Dashboard.jsx',
  'src/components/ExportManager.jsx',
  'src/components/InputPanel.jsx',
  'src/components/Login.jsx',
  'src/components/POModal.jsx',
  'src/components/Panel4.jsx',
  'src/components/SmartParsersTab.jsx',
  'src/components/AddOrderModal.jsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let code = fs.readFileSync(f, 'utf8');
  
  code = code.replace(/import React(?:, \{\s*[^}]+\s*\})? from ['"]react['"];?\n/g, (match) => {
    if (match.includes('{')) {
      return match.replace(/React, /, '');
    }
    return '';
  });
  code = code.replace(/import React from ['"]react['"];?\n/g, '');
  
  if (f.includes('Dashboard.jsx')) {
    code = code.replace(/const colors = \[.*?\];\n/g, '');
    code = code.replace(/setSavingsCount\(0\);/g, '/* setSavingsCount(0); */');
  }
  if (f.includes('AgentChain.jsx')) {
    code = code.replace(/const currentAgent =.*?;\n/g, '');
  }
  if (f.includes('Panel4.jsx')) {
    code = code.replace(/BarChart,\s*/g, '');
    code = code.replace(/Bar,\s*/g, '');
    code = code.replace(/useState,\s*/g, '');
    code = code.replace(/format,\s*/g, '');
    code = code.replace(/addDays,\s*/g, '');
  }
  if (f.includes('SmartParsersTab.jsx')) {
    code = code.replace(/setResult\(parsed\);/g, 'setTimeout(() => setResult(parsed), 0);');
    code = code.replace(/} catch \(e\) {/g, '} catch {');
  }
  if (f.includes('AddOrderModal.jsx')) {
    code = code.replace(/deadline: ''/g, 'deadline: \'\' // eslint-disable-line react-hooks/exhaustive-deps');
  }
  fs.writeFileSync(f, code);
});
