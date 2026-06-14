import assert from "node:assert/strict";
import { runFullDemoSync } from "../public/demo-core.mjs";

const runs = 20;
const failures = [];

for (let index = 1; index <= runs; index += 1) {
  try {
    const state = runFullDemoSync();
    assert.equal(state.completed, true, "demo did not complete");
    assert.equal(
      state.agentOutputs.filter((output) => output.agentId.startsWith("agent-")).length,
      4,
      "expected four completed agents"
    );
    assert.equal(state.handoffs.length, 4, "expected four visible agent handoffs");
    assert.ok(
      state.agentOutputs
        .filter((output) => output.agentId.startsWith("agent-"))
        .every(
          (output) =>
            output.inputReceived &&
            output.analysisPerformed &&
            output.decisionMade &&
            output.outputPassedForward
        ),
      "expected every agent to expose reasoning fields"
    );
    assert.ok(state.riskAssessment?.riskFindings?.length > 0, "expected risk findings from Agent 2");
    assert.ok(state.procurementPlan?.reorderCards?.length > 0, "expected procurement plan from Agent 3");
    assert.equal(state.metrics.red, 3, "expected three RED materials");
    assert.equal(state.alerts.length, 3, "expected three alerts");
    assert.equal(state.reorderCards.length, 3, "expected three reorder cards");
    assert.equal(state.schedules.length, 3, "expected three schedules");
    assert.ok(state.metrics.savings > 0, "savings counter did not calculate");
    assert.ok(state.evaluationReport?.score >= 90, "evaluation score is too low");
  } catch (error) {
    failures.push({ run: index, error: error instanceof Error ? error.message : String(error) });
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ runs, failures }, null, 2));
  process.exit(1);
}

console.log(`FactoryMind QA stress passed: ${runs}/${runs} demo runs completed.`);
