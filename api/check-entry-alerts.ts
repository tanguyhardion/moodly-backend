import { withApi, createErrorResponse, createSuccessResponse } from "../utils/api";
import { runAlertsForDate } from "../utils/alertEvaluator";

export default withApi({ methods: ["POST"] }, async (req, res) => {
  const { date } = req.body;

  if (!date) {
    return res.status(400).json(createErrorResponse("Date is required"));
  }

  const results = await runAlertsForDate(date);
  return res.status(200).json(createSuccessResponse({ results }));
});
