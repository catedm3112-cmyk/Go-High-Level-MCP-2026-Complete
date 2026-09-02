function isConfirmedExecutionRequest(name, args) {
  return String(name || "").startsWith("crm_prepare_") && args?.executeConfirmed === true;
}

async function executeConfirmedWorkflow(registry, prepared) {
  if (!prepared || typeof prepared !== "object" || !Array.isArray(prepared.executeToolCalls)) {
    throw new Error("The preparation tool did not return an executable confirmation queue");
  }

  const executionResults = [];
  for (const call of prepared.executeToolCalls) {
    const tool = String(call?.tool || "");
    if (!tool) throw new Error("The confirmation queue contains an invalid tool call");

    const result = await registry.callTool(tool, call.arguments || {});
    if (result === undefined) throw new Error(`Queued tool not found: ${tool}`);
    executionResults.push({ tool, result });
  }

  return {
    ...prepared,
    confirmationRequired: false,
    executed: true,
    executionResults,
    nextSteps: ["Review the execution results and verify the changes in GHL."],
  };
}

module.exports = {
  executeConfirmedWorkflow,
  isConfirmedExecutionRequest,
};
