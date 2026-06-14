export const STOCK_INPUT = `Steel Rod: 155 kg
Rubber Sheet: 65 kg  
Paint: 2 cans
Bolts: 500 pieces
Iron Scrap: 45 kg`;

export const DEFAULT_ORDERS = [
  { id: '001', product: 'Brake Pads', qty: 100, deadline: 'Friday', priority: 'Low', customer: 'Tata Motors', status: 'On Track', color: 'green' },
  { id: '002', product: 'Clutch Plates', qty: 50, deadline: 'Thursday', priority: 'Medium', customer: 'Mahindra', status: 'At Risk', color: 'orange' },
  { id: '003', product: 'Gaskets', qty: 200, deadline: 'Wednesday', priority: 'CRITICAL', customer: 'Bajaj Motors', status: 'CRITICAL', color: 'red' },
];

export const FACTORIES = [
  { 
    id: "rajuauto", 
    name: "Raju Auto Parts", 
    location: "Pimpri-Chinchwad, Pune", 
    owner: "Raju Sharma", 
    phones: "+91-9876543211", 
    machineCount: 3, 
    employeeCount: 12, 
    monthlyOrders: 45, 
    status: "Active" 
  },
  { 
    id: "sundar", 
    name: "Sundar Engineering", 
    location: "Aurangabad", 
    owner: "Sundar Patel", 
    phones: "+91-9876543222", 
    machineCount: 5, 
    employeeCount: 20, 
    monthlyOrders: 78, 
    status: "Active" 
  }
];

export const WORKER_SHIFTS = [
  { day: 'Wednesday', worker: 'Ramesh', shift: 'Morning', status: 'Active' },
  { day: 'Wednesday', worker: 'Suresh', shift: 'Evening', status: 'Active' },
  { day: 'Wednesday', worker: 'Ajay', shift: 'Night', status: 'On Leave' },
  { day: 'Thursday', worker: 'Ramesh', shift: 'Evening', status: 'Pending' }
];

export const SUPPLIERS = [
  { name: 'Quick Steel Co', rating: '★★★★★', delivery: 'Same day', price: '₹135/kg', status: 'Active' },
  { name: 'Ram Steel Works', rating: '★★★☆☆', delivery: '2 days', price: '₹120/kg', status: 'Active' },
  { name: 'Rubber King', rating: '★★★★☆', delivery: '1 day', price: '₹80/kg', status: 'Active' },
  { name: 'Paint Pro India', rating: '★★★★☆', delivery: '3 days', price: '₹450/can', status: 'Active' }
];

export const FALLBACK_AGENTS = [
  {
    id: 1,
    name: 'Inventory Agent',
    color: '#10B981', // green
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CODEX] Inventory Agent v1.0 — INITIALIZING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Reading stock data from Ramesh (7:15 AM)...
→ Parsing 5 materials from plain English input...
→ Cross-referencing with historical usage rates...

ANALYSIS COMPLETE:
✓ Steel Rod: 155kg | Usage: 45kg/day
  ⚠ CRITICAL — 3.4 days remaining
  → Flagging for immediate reorder
  
✓ Rubber Sheet: 65kg | Usage: 10kg/day  
  ✓ OK — 6.5 days remaining
  
✓ Paint: 2 cans | Usage: 0.5/day
  ⚠ LOW — 4 days remaining
  
✓ Bolts: 500pc | Usage: 20/day
  ✓ OK — 25 days remaining

✓ Iron Scrap: 45kg | Usage: 5kg/day
  ✓ OK — 9 days remaining

PASSING CONSTRAINTS TO: Production Agent
Confidence Score: 94%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  },
  {
    id: 2,
    name: 'Production Agent',
    color: '#3B82F6', // blue
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CODEX] Production Agent v1.0 — INITIALIZING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Receiving constraints from Inventory Agent...
→ Loading 3 pending orders...
→ Checking machine availability...

ORDER PRIORITY ANALYSIS:
✓ Order #003 (Gaskets) → ELEVATED to #1 priority
  Reason: Due Wednesday, most critical deadline
  
✓ Order #002 (Clutch Plates) → Priority #2
  Warning: At risk of 1-day delay
  Action: Shift Machine 2 to night shift Wed

✓ Order #001 (Brake Pads) → Priority #3
  Status: On track, no changes needed

SCHEDULE GENERATED:
Machine 1: Gaskets (Wed 9AM → Thu 2PM)
Machine 2: Brake Pads (Wed 9AM → Wed 5PM)
           Clutch Plates (Wed 6PM → Thu 12PM)
Machine 3: BLOCKED — waiting for steel rods

PASSING TO: Maintenance Agent
Confidence Score: 89%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  },
  {
    id: 3,
    name: 'Maintenance Agent',
    color: '#F59E0B', // amber
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CODEX] Maintenance Agent v1.0 — INITIALIZING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Analyzing factory floor photo (7:20 AM)...
→ Running visual inspection via Claude Vision...
→ Checking maintenance logs...

VISUAL ANALYSIS:
✓ Machine 1 (Cutting): Normal wear detected
  Last service: 23 days ago ✓ OK
  
⚠ Machine 2 (Assembly): ATTENTION REQUIRED
  Visual: Conveyor belt showing stress marks
  Last service: 67 days ago ← OVERDUE
  Risk: Breakdown probability 34% this week
  Recommendation: Service before Thursday

✓ Machine 3 (Painting): Currently idle
  Last service: 12 days ago ✓ OK

ACTION REQUIRED:
→ Schedule Machine 2 service: Wednesday 12PM-2PM
→ Alert: Do NOT run night shift until serviced
→ Estimated downtime if ignored: 4-6 hours

PASSING TO: Forecast Agent  
Confidence Score: 78%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  },
  {
    id: 4,
    name: 'Forecast Agent',
    color: '#8B5CF6', // purple
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CODEX] Forecast Agent v1.0 — INITIALIZING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Analyzing order history: last 90 days...
→ Detecting seasonal patterns...
→ Cross-referencing with Pune auto sector data...

DEMAND FORECAST — NEXT 14 DAYS:
↑ Orders expected to increase 38%
  Reason: Q2 end + festival season approaching

STOCK RECOMMENDATION:
→ Steel Rod: Order 500kg minimum (not 300kg)
   Reason: Demand spike will double consumption
   
→ Rubber Sheet: Order 50kg buffer
   Reason: New order likely from Bajaj Motors
   
→ Paint: Order 5 cans
   Reason: Increased production volume

REVENUE PROJECTION:
This week (current plan):  ₹2,40,000
Next week (with forecast):  ₹3,35,000
Increase: +₹95,000 (39.5% growth)

QUALITY ANALYSIS:
PRODUCTION QUALITY (This Week):
├ Overall Quality Rate: 98.5% ✓
├ Defect Rate: 1.5% (Below 2% target)
├ Rework Required: 3 units (Brake Pads)
└ Customer Complaints: 0

QUALITY TRENDS (30 days):
↑ Defects: 2.1% → 1.5% (Improvement)
○ Average: 1.4% → 1.6% → 1.5% → 1.5%

ALL AGENTS COMPLETE ✓
Generating dashboard output...
Confidence Score: 91%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CODEX ORCHESTRATOR] All 4 agents completed.
Total reasoning time: 28.3 seconds
Average confidence: 88%
Output sent to dashboard ✓`
  }
];
