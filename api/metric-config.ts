import { withApi, createErrorResponse, createSuccessResponse } from "../utils/api";
import { getMetricConfigRow, getSupabaseClient } from "../utils/database";

/**
 * GET  /api/metric-config  - Retrieve the user's metric configuration
 * POST /api/metric-config  - Save/update the user's metric configuration
 */
export default withApi({ methods: ["GET", "POST"] }, async (req, res) => {
  if (req.method === "GET") {
    try {
      return res.status(200).json(createSuccessResponse(await getMetricConfigRow()));
    } catch (error) {
      console.error("Error fetching metric config:", error);
      return res.status(500).json(createErrorResponse("Failed to fetch metric configuration"));
    }
  }

  const { metrics } = req.body;

  if (!Array.isArray(metrics)) {
    return res.status(400).json(createErrorResponse("metrics must be an array"));
  }

  const { error } = await getSupabaseClient().from("metric_config").upsert({
    id: 1,
    metrics,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error saving metric config:", error);
    return res.status(500).json(createErrorResponse("Failed to save metric configuration"));
  }

  return res.status(200).json(createSuccessResponse({ success: true }));
});
