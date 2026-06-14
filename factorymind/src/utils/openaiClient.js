import { FALLBACK_AGENTS } from '../data/demoData';
import { streamText } from './streamText';
import { parseAgentText } from './textParsers';

/**
 * Build a dynamic inventory agent output string from parsed stock data.
 */
function buildInventoryAgentText(parsedInventory) {
  const rows = parsedInventory.rows || [];
  if (rows.length === 0) {
    return FALLBACK_AGENTS.find(a => a.id === 1)?.text || 'No stock data.';
  }

  let output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CODEX] Inventory Agent v1.0 — INITIALIZING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Reading stock data from Ramesh (7:15 AM)...
→ Parsing ${rows.length} materials from plain English input...
→ Cross-referencing with historical usage rates...

ANALYSIS COMPLETE:\n`;

  rows.forEach(row => {
    const qtyStr = row.quantity != null ? row.quantity : '?';
    const statusIcon = row.status === 'Critical' ? '⚠ CRITICAL' :
                       row.status === 'Low' ? '⚠ LOW' : '✓ OK';
    output += `✓ ${row.item}: ${qtyStr}
  ${statusIcon}
  ${row.note ? `→ ${row.note}` : ''}\n\n`;
  });

  const summary = parsedInventory.summary || {};
  const criticalCount = summary['Critical'] || 0;
  const lowCount = summary['Low'] || 0;

  output += `PASSING CONSTRAINTS TO: Production Agent
Confidence Score: ${criticalCount > 0 ? '94' : lowCount > 0 ? '89' : '97'}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return output;
}

/**
 * Handles agent execution. Uses dynamic stock data for Agent 1,
 * otherwise falls back to hardcoded demo data with streaming animation.
 */
export const runAgent = async (agentId, inputData, onChunk, durationMs = 7000) => {
  // For Agent 1 (Inventory), generate dynamic text from stock data
  if (agentId === 1 && inputData?.stockText) {
    const parsed = parseAgentText('inventory', inputData.stockText);
    const dynamicText = buildInventoryAgentText(parsed);
    await streamText(dynamicText, onChunk, durationMs);
    return { text: dynamicText, parsed };
  }

  // Agents 2-4: use fallback demo data
  const agent = FALLBACK_AGENTS.find(a => a.id === agentId);
  const fallbackText = agent ? agent.text : 'Agent error...';
  await streamText(fallbackText, onChunk, durationMs);
  return { text: fallbackText };
};
