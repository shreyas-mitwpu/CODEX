import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AGENTS,
  calculateSavings,
  createInitialState,
  getAgentDelay,
  runAgentStep,
  runFullDemoSync,
  startRun
} from "../../public/demo-core.mjs";

describe("FactoryMind agent demo requirements", () => {
  it("renders the required three-panel shell in HTML", () => {
    const html = readFileSync("public/index.html", "utf8");
    expect(html).toContain('data-testid="input-panel"');
    expect(html).toContain('data-testid="agent-chain-panel"');
    expect(html).toContain('data-testid="dashboard-panel"');
    expect(html).toContain("Run FactoryMind Agents");
    expect(html).toContain("Evaluation Report");
    expect(html).toContain("Reorder Cards");
    expect(html).toContain("Procurement Schedule");
    expect(html).toContain("Agent Handoff Timeline");
    expect(html).toContain("Business Impact");
    expect(html).toContain("Judge Demo Outcome");
    expect(html).toContain("Run Judge Demo Mode");
    expect(html).toContain("Before vs After");
    expect(html).toContain("CEO Summary");
    expect(html).toContain("Why AI?");
    expect(html).toContain("Confidence & Trust");
    expect(html).toContain("Winning Criteria Audit");
  });

  it("ships the finals judge mode and confidence trust layer", () => {
    const app = readFileSync("public/app.js", "utf8");
    expect(app).toContain("const JUDGE_DEMO_TARGET_MS = 34000");
    expect(app).toContain("Inventory Agent");
    expect(app).toContain("Stock Analyst");
    expect(app).toContain("Procurement Planner");
    expect(app).toContain("Executive Evaluator");
    expect(app).toContain("runJudgeDemoMode");
  });

  it("executes all four agents and reaches completion", () => {
    const state = runFullDemoSync();
    expect(state.completed).toBe(true);
    expect(state.running).toBe(false);
    expect(state.progressPercent).toBe(100);
    expect(state.agentOutputs.filter((output) => output.agentId.startsWith("agent-"))).toHaveLength(4);
    expect(state.handoffs).toHaveLength(4);
    expect(state.evaluationReport).not.toBeNull();
  });

  it("passes structured outputs through every downstream agent handoff", () => {
    const state = runFullDemoSync();
    const intake = state.agentOutputs.find((output) => output.agentId === "agent-1");
    const stock = state.agentOutputs.find((output) => output.agentId === "agent-2");
    const procurement = state.agentOutputs.find((output) => output.agentId === "agent-3");
    const evaluator = state.agentOutputs.find((output) => output.agentId === "agent-4");

    expect(intake.payload.stockEntries).toHaveLength(5);
    expect(stock.payload.riskAssessment.riskFindings.map((risk) => risk.materialName)).toContain(
      "Steel Rod 12mm"
    );
    expect(procurement.payload.procurementPlan.reorderCards).toHaveLength(
      stock.payload.riskAssessment.riskFindings.length
    );
    expect(evaluator.payload.consumedRiskCount).toBe(stock.payload.riskAssessment.riskFindings.length);
    expect(evaluator.payload.consumedProcurementDecisionCount).toBe(
      procurement.payload.procurementPlan.reorderCards.length
    );
  });

  it("renders visible reasoning and handoff messages for judges", () => {
    const state = runFullDemoSync();
    const agentOutputs = state.agentOutputs.filter((output) => output.agentId.startsWith("agent-"));

    for (const output of agentOutputs) {
      expect(output.inputReceived).not.toEqual("");
      expect(output.analysisPerformed).not.toEqual("");
      expect(output.decisionMade).not.toEqual("");
      expect(output.outputPassedForward).not.toEqual("");
      expect(output.handoffMessage).toContain("COMPLETE");
    }

    expect(state.handoffs[0].message).toContain("passing structured inventory data to Agent 2");
    expect(state.handoffs[1].message).toContain("passing risk assessment to Agent 3");
    expect(state.handoffs[2].message).toContain("passing procurement decisions to Agent 4");
    expect(state.handoffs[3].message).toContain("executive evaluation delivered to dashboard");
  });

  it("updates the dashboard progressively through the agent chain", () => {
    let state = startRun(createInitialState(), {}, {});
    state = runAgentStep(state, 0);
    expect(state.parsed.stockEntries.length).toBeGreaterThan(0);
    expect(state.metrics.red).toBe(0);

    state = runAgentStep(state, 1);
    expect(state.metrics.red).toBe(3);
    expect(state.materials.find((material) => material.id === "cement").status).toBe("RED");

    state = runAgentStep(state, 2);
    expect(state.alerts).toHaveLength(3);
    expect(state.reorderCards).toHaveLength(3);
    expect(state.schedules).toHaveLength(3);
    expect(state.procurementPlan.totalEstimatedPo).toBeGreaterThan(0);

    state = runAgentStep(state, 3);
    expect(state.metrics.savings).toBeGreaterThan(0);
    expect(state.evaluationReport.lines.join(" ")).toContain("Savings estimated");
  });

  it("handles missing API key, failed AI request, and streaming interruption with fallback output", () => {
    const state = runFullDemoSync({
      resilience: {
        missingApiKey: true,
        failedAiRequest: true,
        streamingInterrupted: true
      }
    });
    const intake = state.agentOutputs.find((output) => output.agentId === "agent-1");
    expect(intake.notes.join(" ")).toContain("No OpenAI API key");
    expect(intake.notes.join(" ")).toContain("OpenAI request failed");
    expect(intake.notes.join(" ")).toContain("Streaming interruption");
    expect(state.completed).toBe(true);
  });

  it("handles empty data without crashing and renders a safe report", () => {
    const state = runFullDemoSync({ resilience: { emptyData: true } });
    expect(state.completed).toBe(true);
    expect(state.alerts).toHaveLength(0);
    expect(state.reorderCards).toHaveLength(0);
    expect(state.evaluationReport.lines.join(" ")).toContain("0 procurement actions");
    expect(state.metrics.savings).toBe(0);
  });

  it("includes executive-quality evaluation metrics", () => {
    const state = runFullDemoSync();
    const report = state.evaluationReport.lines.join(" ");
    expect(report).toContain("risks detected");
    expect(report).toContain("procurement actions generated");
    expect(report).toContain("Savings estimated");
    expect(report).toContain("Average agent confidence");
    expect(report).toContain("Agent performance");
  });

  it("respects slow-network timing simulation", () => {
    const normal = AGENTS.map((agent) => getAgentDelay(agent, { slowNetwork: false }));
    const slow = AGENTS.map((agent) => getAgentDelay(agent, { slowNetwork: true }));
    expect(slow).toEqual(normal.map((duration) => duration * 2));
  });

  it("calculates savings from alerts, reorder cards, and reporting automation", () => {
    const state = runFullDemoSync();
    const savings = calculateSavings(state);
    expect(savings.avoidedStockout).toBe(126000);
    expect(savings.reducedManualReporting).toBe(65000);
    expect(savings.total).toBe(state.metrics.savings);
  });
});
