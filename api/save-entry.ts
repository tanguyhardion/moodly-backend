import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import { getSupabaseClient } from "../utils/database";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json(createErrorResponse("Method not allowed"));
    return;
  }

  try {
    // Validate master password
    if (!validateMasterPassword(req)) {
      res
        .status(401)
        .json(createErrorResponse("Invalid or missing master password"));
      return;
    }

    const { entry } = req.body;

    if (!entry) {
      res.status(400).json(createErrorResponse("Entry data is required"));
      return;
    }

    const supabase = getSupabaseClient();

    // Transform app format to database format
    const dbEntry = {
      id: entry.id,
      date: entry.date,
      mood: entry.metrics.mood,
      energy: entry.metrics.energy,
      sleep: entry.metrics.sleep,
      focus: entry.metrics.focus,
      healthy_food: entry.checkboxes?.healthyFood ?? false,
      caffeine: entry.checkboxes?.caffeine ?? false,
      gym: entry.checkboxes?.gym ?? false,
      hard_work: entry.checkboxes?.hardWork ?? false,
      misc: entry.checkboxes?.misc ?? false,
      note: entry.note || null,
      created_at: entry.createdAt,
    };

    // Use upsert to insert or update
    const { data, error } = await supabase
      .from("entry")
      .upsert(dbEntry, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to save entry to database"));
      return;
    }

    // Transform back to app format
    const savedEntry = {
      id: data.id,
      date: data.date,
      metrics: {
        mood: data.mood,
        energy: data.energy,
        sleep: data.sleep,
        focus: data.focus,
      },
      checkboxes: {
        healthyFood: data.healthy_food,
        caffeine: data.caffeine,
        gym: data.gym,
        hardWork: data.hard_work,
        misc: data.misc,
      },
      note: data.note,
      createdAt: data.created_at,
    };

    res.status(200).json(createSuccessResponse(savedEntry));
  } catch (error) {
    console.error("Error saving entry:", error);
    res
      .status(500)
      .json(createErrorResponse("Internal server error while saving entry"));
  }
}
