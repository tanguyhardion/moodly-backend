import { withApi, createSuccessResponse } from "../../utils/api";
import { runAlertsForDate } from "../../utils/alertEvaluator";

export default withApi({ methods: ["GET"], auth: "session-or-cron" }, async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const results = await runAlertsForDate(today);
  return res.status(200).json(createSuccessResponse({ results }));
});
