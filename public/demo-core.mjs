export const AGENTS = [
  {
    id: "agent-1",
    name: "Agent 1",
    title: "Intake Parser",
    durationMs: 450,
    confidence: 0.92
  },
  {
    id: "agent-2",
    name: "Agent 2",
    title: "Stock Analyst",
    durationMs: 550,
    confidence: 0.9
  },
  {
    id: "agent-3",
    name: "Agent 3",
    title: "Procurement Planner",
    durationMs: 600,
    confidence: 0.88
  },
  {
    id: "agent-4",
    name: "Agent 4",
    title: "Executive Evaluator",
    durationMs: 500,
    confidence: 0.94
  }
];

export const DEFAULT_INPUTS = {
  stock:
    "Morning stock: Cement 120 bags, Steel Rod 12mm 950 kg, Packaging Film 42 rolls, Industrial Oil 160 l, Paint Primer 75 boxes",
  usage: "Evening usage: cement 100 bags, steel rod 850 kg, oil 150 l"
};

export const MATERIALS = [
  {
    id: "cement",
    name: "Cement",
    aliases: ["cem", "cement bag", "cement bags"],
    unit: "bags",
    supplier: "Rapid Industrial Supply",
    supplierPhone: "+91 96666 66666",
    leadTimeDays: 2,
    reorderQuantity: 160,
    unitCost: 410
  },
  {
    id: "steel-rod-12mm",
    name: "Steel Rod 12mm",
    aliases: ["steel", "rod", "saria", "saria 12mm", "12mm rod"],
    unit: "kg",
    supplier: "Metro Metals",
    supplierPhone: "+91 95555 55555",
    leadTimeDays: 3,
    reorderQuantity: 1400,
    unitCost: 68
  },
  {
    id: "packaging-film",
    name: "Packaging Film",
    aliases: ["packing film", "film", "film roll"],
    unit: "rolls",
    supplier: "PackFast Traders",
    supplierPhone: "+91 94444 44444",
    leadTimeDays: 1,
    reorderQuantity: 70,
    unitCost: 1200
  },
  {
    id: "industrial-oil",
    name: "Industrial Oil",
    aliases: ["oil", "machine oil", "lubricant"],
    unit: "l",
    supplier: "Rapid Industrial Supply",
    supplierPhone: "+91 96666 66666",
    leadTimeDays: 2,
    reorderQuantity: 220,
    unitCost: 220
  },
  {
    id: "paint-primer",
    name: "Paint Primer",
    aliases: ["paint", "primer"],
    unit: "boxes",
    supplier: "ColorChem Depot",
    supplierPhone: "+91 93333 33333",
    leadTimeDays: 4,
    reorderQuantity: 110,
    unitCost: 900
  }
];

export function createInitialState(overrides = {}) {
  return {
    version: 4,
    runId: 0,
    running: false,
    completed: false,
    currentAgentIndex: -1,
    progressPercent: 0,
    inputs: structuredClone(DEFAULT_INPUTS),
    resilience: {
      missingApiKey: true,
      failedAiRequest: false,
      emptyData: false,
      slowNetwork: false,
      streamingInterrupted: false
    },
    materials: MATERIALS.map((material) => ({
      ...structuredClone(material),
      stock: 0,
      usage: 0,
      averageDailyUsage: 0,
      daysRemaining: null,
      status: "GREEN"
    })),
    agentOutputs: [],
    handoffs: [],
    alerts: [],
    reorderCards: [],
    schedules: [],
    evaluationReport: null,
    savings: {
      total: 0,
      avoidedStockout: 0,
      reducedRushOrders: 0,
      reducedManualReporting: 0
    },
    metrics: {
      green: 5,
      yellow: 0,
      red: 0,
      black: 0,
      confidence: 0,
      savings: 0
    },
    timings: [],
    lastRunAt: null,
    completedAt: null,
    hasInventoryData: false,
    ...structuredClone(overrides)
  };
}

export function sanitizeState(value) {
  const fallback = createInitialState();
  if (!value || typeof value !== "object" || value.version !== 4) return fallback;
  return {
    ...fallback,
    ...value,
    inputs: { ...fallback.inputs, ...(value.inputs ?? {}) },
    resilience: { ...fallback.resilience, ...(value.resilience ?? {}) },
    materials: Array.isArray(value.materials) ? value.materials : fallback.materials,
    agentOutputs: Array.isArray(value.agentOutputs) ? value.agentOutputs : [],
    handoffs: Array.isArray(value.handoffs) ? value.handoffs : [],
    alerts: Array.isArray(value.alerts) ? value.alerts : [],
    reorderCards: Array.isArray(value.reorderCards) ? value.reorderCards : [],
    schedules: Array.isArray(value.schedules) ? value.schedules : [],
    timings: Array.isArray(value.timings) ? value.timings : []
  };
}

export function getAgentDelay(agent, resilience) {
  return resilience.slowNetwork ? agent.durationMs * 2 : agent.durationMs;
}

export function startRun(state, inputs, resilience) {
  const next = createInitialState({
    runId: state.runId + 1,
    running: true,
    inputs: { ...state.inputs, ...inputs },
    resilience: { ...state.resilience, ...resilience },
    lastRunAt: new Date().toISOString()
  });
  next.agentOutputs.push({
    agentId: "system",
    title: "Run started",
    status: "completed",
    confidence: 1,
    message: "FactoryMind agent chain started from a clean state.",
    inputReceived: "Raw morning stock and evening consumption text from the input panel.",
    analysisPerformed: "Prepared a four-agent execution plan.",
    decisionMade: "Run each agent sequentially and require every downstream agent to consume the previous output.",
    outputPassedForward: "Inputs queued for Agent 1."
  });
  return next;
}

export function runAgentStep(state, agentIndex) {
  const agent = AGENTS[agentIndex];
  if (!agent) return state;
  let next = structuredClone(state);
  next.currentAgentIndex = agentIndex;
  next.progressPercent = Math.round(((agentIndex + 1) / AGENTS.length) * 100);

  if (agentIndex === 0) next = executeIntakeAgent(next, agent);
  if (agentIndex === 1) next = executeStockAgent(next, agent);
  if (agentIndex === 2) next = executeProcurementAgent(next, agent);
  if (agentIndex === 3) next = executeEvaluatorAgent(next, agent);
  next = appendHandoff(next, agentIndex);

  next.timings.push({
    agentId: agent.id,
    durationMs: getAgentDelay(agent, next.resilience),
    completedAt: new Date().toISOString()
  });

  if (agentIndex === AGENTS.length - 1) {
    next.running = false;
    next.completed = true;
    next.completedAt = new Date().toISOString();
  }

  return next;
}

export function runFullDemoSync(options = {}) {
  let state = startRun(
    createInitialState(),
    options.inputs ?? DEFAULT_INPUTS,
    options.resilience ?? {}
  );
  for (let index = 0; index < AGENTS.length; index += 1) {
    state = runAgentStep(state, index);
  }
  return state;
}

function executeIntakeAgent(state, agent) {
  const output = createAgentOutput(agent);
  output.inputReceived = `Morning: "${state.inputs.stock}" | Evening: "${state.inputs.usage}"`;
  if (state.resilience.missingApiKey) {
    output.notes.push("No OpenAI API key detected. Local deterministic parser engaged.");
  }
  if (state.resilience.failedAiRequest) {
    output.notes.push("OpenAI request failed. Recovered with fallback parser.");
  }
  if (state.resilience.streamingInterrupted) {
    output.notes.push("Streaming interruption detected. Resumed from checkpoint.");
  }

  const stockEntries = state.resilience.emptyData
    ? []
    : extractInventoryEntries(state.inputs.stock, state.materials);
  const usageEntries = state.resilience.emptyData
    ? []
    : extractInventoryEntries(state.inputs.usage, state.materials);

  output.confidence =
    state.resilience.emptyData || state.resilience.failedAiRequest ? 0.78 : agent.confidence;
  output.message =
    stockEntries.length === 0 && usageEntries.length === 0
      ? "Agent 1 found no usable rows and produced a safe empty-data payload."
      : `Agent 1 normalized ${stockEntries.length} stock rows and ${usageEntries.length} usage rows.`;
  output.analysisPerformed =
    "Parsed material aliases, normalized units, separated stock snapshot rows from consumption rows.";
  output.decisionMade =
    stockEntries.length === 0 && usageEntries.length === 0
      ? "Use safe fallback mode with no false risk generation."
      : "Pass structured inventory rows to Stock Analyst.";
  output.outputPassedForward = JSON.stringify(
    {
      stockRows: stockEntries.length,
      usageRows: usageEntries.length,
      materials: stockEntries.map((entry) => entry.materialId)
    },
    null,
    0
  );
  output.payload = { stockEntries, usageEntries };
  state.agentOutputs.push(output);
  state.parsed = output.payload;
  state.metrics.confidence = output.confidence;
  return state;
}

function executeStockAgent(state, agent) {
  const output = createAgentOutput(agent);
  const materials = state.materials.map((material) => ({ ...material }));
  const stockEntries = state.parsed?.stockEntries ?? [];
  const usageEntries = state.parsed?.usageEntries ?? [];
  const hasInventoryData = stockEntries.length > 0 || usageEntries.length > 0;
  state.hasInventoryData = hasInventoryData;
  output.inputReceived = `${stockEntries.length} stock rows and ${usageEntries.length} consumption rows from Agent 1.`;
  const stockMap = new Map(stockEntries.map((entry) => [entry.materialId, entry.quantity]));
  const usageMap = new Map(usageEntries.map((entry) => [entry.materialId, entry.quantity]));

  for (const material of materials) {
    if (!hasInventoryData) {
      material.stock = 0;
      material.usage = 0;
      material.averageDailyUsage = 0;
      material.daysRemaining = null;
      material.status = "GREEN";
      continue;
    }
    const stock = Number(stockMap.get(material.id) ?? 0);
    const usage = Math.min(Number(usageMap.get(material.id) ?? 0), stock);
    material.stock = round(Math.max(0, stock - usage));
    material.usage = usage;
    material.averageDailyUsage = usage;
    const status = calculateStatus(material.stock, material.averageDailyUsage);
    material.daysRemaining = status.daysRemaining;
    material.status = status.status;
  }

  state.materials = materials;
  const riskFindings = materials
    .filter((material) => material.status === "RED" || material.status === "BLACK")
    .map((material) => ({
      materialId: material.id,
      materialName: material.name,
      status: material.status,
      stock: material.stock,
      unit: material.unit,
      averageDailyUsage: material.averageDailyUsage,
      daysRemaining: material.daysRemaining,
      supplier: material.supplier,
      leadTimeDays: material.leadTimeDays
    }));
  state.riskAssessment = {
    hasInventoryData,
    riskFindings,
    safeMaterials: materials
      .filter((material) => material.status === "GREEN" || material.status === "YELLOW")
      .map((material) => material.name)
  };
  state.metrics = {
    ...calculateMetricCounts(materials),
    confidence: averageConfidence([...state.agentOutputs, output]),
    savings: state.metrics.savings
  };
  output.message = hasInventoryData
    ? `Agent 2 calculated stock health: ${state.metrics.red} RED, ${state.metrics.black} BLACK, ${state.metrics.green} GREEN.`
    : "Agent 2 received an empty inventory payload and rendered a safe no-data dashboard.";
  output.analysisPerformed = hasInventoryData
    ? "Computed current stock, average usage, days remaining, and status for every material."
    : "Confirmed no inventory rows were present and suppressed false depletion alerts.";
  output.decisionMade =
    riskFindings.length > 0
      ? `Escalate ${riskFindings.length} critical stock risks to Procurement Planner.`
      : "No procurement action required.";
  output.outputPassedForward = JSON.stringify(
    {
      risks: riskFindings.map((risk) => `${risk.materialName}:${risk.status}`),
      dashboardMetrics: state.metrics
    },
    null,
    0
  );
  output.payload = { materials, riskAssessment: state.riskAssessment };
  state.agentOutputs.push(output);
  return state;
}

function executeProcurementAgent(state, agent) {
  const output = createAgentOutput(agent);
  const riskFindings = state.riskAssessment?.riskFindings ?? [];
  output.inputReceived =
    riskFindings.length > 0
      ? `${riskFindings.length} risk findings from Agent 2: ${riskFindings.map((risk) => risk.materialName).join(", ")}.`
      : "No critical risks from Agent 2.";
  const critical = state.materials.filter((material) =>
    riskFindings.some((risk) => risk.materialId === material.id)
  );
  state.alerts = critical.map((material) => ({
    id: `${material.id}-${material.status}`,
    status: material.status,
    materialName: material.name,
    message: `${material.status} alert: ${material.name} has ${material.stock} ${material.unit} remaining.`
  }));
  state.reorderCards = critical.map((material) => ({
    id: `reorder-${material.id}`,
    materialName: material.name,
    supplier: material.supplier,
    supplierPhone: material.supplierPhone,
    leadTimeDays: material.leadTimeDays,
    quantity: material.reorderQuantity,
    unit: material.unit,
    estimatedCost: material.reorderQuantity * material.unitCost,
    urgency: material.status === "BLACK" ? "Immediate" : "Today"
  }));
  state.schedules = state.reorderCards.map((card, index) => ({
    id: `schedule-${card.id}`,
    title: `${card.materialName} purchase order`,
    dueInHours: 2 + index * 2,
    owner: index % 2 === 0 ? "Factory Owner" : "Shift Manager",
    supplier: card.supplier
  }));
  state.procurementPlan = {
    alerts: state.alerts,
    reorderCards: state.reorderCards,
    schedules: state.schedules,
    totalEstimatedPo: state.reorderCards.reduce((sum, card) => sum + card.estimatedCost, 0)
  };
  output.message = `Agent 3 generated ${state.alerts.length} alerts, ${state.reorderCards.length} reorder cards, and ${state.schedules.length} schedules.`;
  output.analysisPerformed =
    "Matched each risk to fastest supplier, lead time, reorder quantity, purchase cost, owner, and due window.";
  output.decisionMade =
    state.reorderCards.length > 0
      ? "Recommend same-day purchase orders for all critical materials."
      : "No procurement schedule required.";
  output.outputPassedForward = JSON.stringify(
    {
      reorderCards: state.reorderCards.length,
      schedules: state.schedules.length,
      estimatedPo: state.procurementPlan.totalEstimatedPo
    },
    null,
    0
  );
  output.payload = {
    alerts: state.alerts,
    reorderCards: state.reorderCards,
    schedules: state.schedules,
    procurementPlan: state.procurementPlan
  };
  state.agentOutputs.push(output);
  state.metrics.confidence = averageConfidence(state.agentOutputs);
  return state;
}

function executeEvaluatorAgent(state, agent) {
  const output = createAgentOutput(agent);
  output.inputReceived = `${state.riskAssessment?.riskFindings?.length ?? 0} risks and ${state.procurementPlan?.reorderCards?.length ?? 0} procurement decisions from Agents 2 and 3.`;
  state.savings = calculateSavings(state);
  state.metrics.savings = state.savings.total;
  state.metrics.confidence = averageConfidence([...state.agentOutputs, output]);
  state.evaluationReport = {
    title: "FactoryMind Evaluation Report",
    verdict: state.alerts.length > 0 ? "High-impact intervention found" : "Stable inventory state",
    lines: [
      "Raw inventory data was converted into structured material rows.",
      `${state.alerts.length} risks detected: ${state.alerts.map((alert) => alert.materialName).join(", ") || "none"}.`,
      `${state.reorderCards.length} procurement actions generated with ${state.schedules.length} scheduled owner follow-ups.`,
      `Savings estimated: ${formatCurrency(state.savings.total)} (${formatCurrency(state.savings.avoidedStockout)} avoided stockout, ${formatCurrency(state.savings.reducedRushOrders)} rush-order reduction, ${formatCurrency(state.savings.reducedManualReporting)} reporting automation).`,
      `Average agent confidence: ${Math.round(state.metrics.confidence * 100)}%.`,
      `Agent performance: ${state.timings.length + 1}/4 steps completed before final evaluation.`
    ],
    score: Math.min(100, 86 + state.reorderCards.length * 3)
  };
  output.message = `Agent 4 completed evaluation with score ${state.evaluationReport.score}/100 and projected savings ${formatCurrency(state.savings.total)}.`;
  output.analysisPerformed =
    "Combined risk findings, procurement plan, cost avoidance, confidence, and timing metrics.";
  output.decisionMade =
    state.alerts.length > 0
      ? "Recommend executive approval for immediate procurement."
      : "Recommend monitoring only.";
  output.outputPassedForward = "Executive report rendered on dashboard with quantified business impact.";
  output.payload = {
    evaluationReport: state.evaluationReport,
    savings: state.savings,
    consumedRiskCount: state.riskAssessment?.riskFindings?.length ?? 0,
    consumedProcurementDecisionCount: state.procurementPlan?.reorderCards?.length ?? 0
  };
  state.agentOutputs.push(output);
  return state;
}

function createAgentOutput(agent) {
  return {
    agentId: agent.id,
    title: `${agent.name}: ${agent.title}`,
    status: "completed",
    confidence: agent.confidence,
    message: "",
    inputReceived: "",
    analysisPerformed: "",
    decisionMade: "",
    outputPassedForward: "",
    notes: [],
    payload: {}
  };
}

function appendHandoff(state, agentIndex) {
  const output = state.agentOutputs.find((item) => item.agentId === AGENTS[agentIndex].id);
  if (!output) return state;
  const nextAgent = AGENTS[agentIndex + 1];
  const message = nextAgent
    ? `${AGENTS[agentIndex].name} COMPLETE - passing ${handoffLabel(agentIndex)} to ${nextAgent.name}.`
    : `${AGENTS[agentIndex].name} COMPLETE - executive evaluation delivered to dashboard.`;
  state.handoffs.push({
    fromAgentId: AGENTS[agentIndex].id,
    toAgentId: nextAgent?.id ?? "dashboard",
    message,
    payloadSummary: output.outputPassedForward
  });
  output.handoffMessage = message;
  return state;
}

function handoffLabel(agentIndex) {
  if (agentIndex === 0) return "structured inventory data";
  if (agentIndex === 1) return "risk assessment";
  if (agentIndex === 2) return "procurement decisions";
  return "executive decision support";
}

export function extractInventoryEntries(text, materials = MATERIALS) {
  const normalizedText = normalize(text);
  const entries = [];
  for (const material of materials) {
    const names = [material.name, ...(material.aliases ?? [])].map(normalize);
    if (!names.some((name) => normalizedText.includes(name))) continue;
    const quantity = findQuantity(text, material);
    if (quantity !== null) entries.push({ materialId: material.id, quantity });
  }
  return entries;
}

function findQuantity(text, material) {
  const names = [material.name, ...(material.aliases ?? [])].map(escapeRegExp).join("|");
  const unit = unitPattern(material.unit);
  const after = text.match(new RegExp(`(?:${names})\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:${unit})?`, "i"));
  const before = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${unit})?\\s*(?:${names})`, "i"));
  const value = after?.[1] ?? before?.[1] ?? null;
  return value === null ? null : Number(value);
}

function unitPattern(unit) {
  const aliases = {
    bags: "bags?|bag",
    kg: "kg|kgs|kilograms?|kilo",
    rolls: "rolls?|roll",
    l: "l|ltr|ltrs|liters?|litres?",
    boxes: "boxes|box"
  };
  return aliases[unit] ?? escapeRegExp(unit);
}

export function calculateStatus(stock, averageDailyUsage) {
  if (stock <= 0) return { status: "BLACK", daysRemaining: 0 };
  if (averageDailyUsage <= 0) return { status: "GREEN", daysRemaining: null };
  const daysRemaining = stock / averageDailyUsage;
  if (daysRemaining > 7) return { status: "GREEN", daysRemaining };
  if (daysRemaining > 3) return { status: "YELLOW", daysRemaining };
  return { status: "RED", daysRemaining };
}

export function calculateMetricCounts(materials) {
  return materials.reduce(
    (totals, material) => {
      totals[material.status.toLowerCase()] += 1;
      return totals;
    },
    { green: 0, yellow: 0, red: 0, black: 0 }
  );
}

export function calculateSavings(state) {
  if (!state.hasInventoryData) {
    return {
      avoidedStockout: 0,
      reducedRushOrders: 0,
      reducedManualReporting: 0,
      total: 0
    };
  }
  const avoidedStockout = state.alerts.length * 42000;
  const reducedRushOrders = state.reorderCards.reduce(
    (sum, card) => sum + Math.round(card.estimatedCost * 0.08),
    0
  );
  const reducedManualReporting = state.completed || state.currentAgentIndex >= 3 ? 65000 : 0;
  return {
    avoidedStockout,
    reducedRushOrders,
    reducedManualReporting,
    total: avoidedStockout + reducedRushOrders + reducedManualReporting
  };
}

export function averageConfidence(outputs) {
  const agentOutputs = outputs.filter((output) => output.agentId?.startsWith("agent-"));
  if (agentOutputs.length === 0) return 0;
  return round(agentOutputs.reduce((sum, output) => sum + output.confidence, 0) / agentOutputs.length);
}

export function formatCurrency(value) {
  return `INR ${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatDays(days) {
  if (days === null) return "No usage";
  if (days === 0) return "Depleted";
  return `${round(days)} days`;
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9.+]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
