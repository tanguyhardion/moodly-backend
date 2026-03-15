import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";

/**
 * GET  /api/metric-config  - Retrieve the user's metric configuration
 * POST /api/metric-config  - Save/update the user's metric configuration
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (!validateMasterPassword(req)) {
    res.status(401).json(createErrorResponse("Invalid or missing master password"));
    return;
  }

  const supabase = getSupabaseClient();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("metric_config")
        .select("*")
        .eq("id", 1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const config = data
        ? { metrics: data.metrics ?? [], updatedAt: data.updated_at }
        : { metrics: [], updatedAt: null };

      res.status(200).json(createSuccessResponse(config));
    } catch (error) {
      console.error("Error fetching metric config:", error);
      res.status(500).json(createErrorResponse("Failed to fetch metric configuration"));
    }
  } else if (req.method === "POST") {
    try {
      const { metrics } = req.body;

      if (!Array.isArray(metrics)) {
        res.status(400).json(createErrorResponse("metrics must be an array"));
        return;
      }

      const row = {
        id: 1,
        metrics,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("metric_config").upsert(row);

      if (error) {
        throw error;
      }

      res.status(200).json(createSuccessResponse({ success: true }));
    } catch (error) {
      console.error("Error saving metric config:", error);
      res.status(500).json(createErrorResponse("Failed to save metric configuration"));
    }
  } else {
    res.status(405).json(createErrorResponse("Method not allowed"));
  }
}
