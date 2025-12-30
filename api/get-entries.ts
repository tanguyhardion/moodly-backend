import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";
import { mapDatabaseEntryToDailyEntry } from "../utils/helpers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json(createErrorResponse("Method not allowed"));
    return;
  }

  try {
    // Validate master password from query parameter
    if (!validateMasterPassword(req)) {
      res
        .status(401)
        .json(createErrorResponse("Invalid or missing master password"));
      return;
    }

    const supabase = getSupabaseClient();

    // Fetch all entries ordered by date descending
    const { data, error } = await supabase
      .from("entry")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to fetch entries from database"));
      return;
    }

    // Transform database format to app format
    const entries = data.map(mapDatabaseEntryToDailyEntry);

    res.status(200).json(createSuccessResponse(entries));
  } catch (error) {
    console.error("Error fetching entries:", error);
    res
      .status(500)
      .json(
        createErrorResponse("Internal server error while fetching entries"),
      );
  }
}
