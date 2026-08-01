import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../../utils/auth";
import { getSupabaseClient } from "../../utils/database";
import { sendEmail } from "../../utils/email";
import { wrapInBaseTemplate } from "../../utils/email/templates/base";

const WATCH_ID = "longines-hydroconquest-l3-779-4-56-6";
const WATCH_URL = "https://www.longines.com/fr/p/watch-hydroconquest-l3-779-4-56-6";
const TARGET_LABEL = "Être averti(e)";

function normalizeLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 10)));
}

function extractAvailabilityLabel(html: string): string | null {
  const spanMatches = [
    ...html.matchAll(
      /<span\b[^>]*class=["'][^"']*\ba11y-background\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    ),
  ];

  for (const match of spanMatches) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " "));
    const normalized = text.replace(/\s+/g, " ").trim();

    if (!normalized) {
      continue;
    }

    if (normalizeLabel(normalized) === normalizeLabel(TARGET_LABEL)) {
      return normalized;
    }
  }

  return null;
}

async function fetchAvailabilityLabel(): Promise<string | null> {
  const response = await fetch(WATCH_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Longines page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return extractAvailabilityLabel(html);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json(createErrorResponse("Method not allowed"));
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    const isCronInvocation =
      authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isManualRun = validateMasterPassword(req);

    if (!isCronInvocation && !isManualRun) {
      res.status(401).json(createErrorResponse("Invalid or missing authentication"));
      return;
    }

    const supabase = getSupabaseClient();

    const { data: settingsData, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError) {
      console.error("Settings error:", settingsError);
      res.status(500).json(createErrorResponse("Failed to fetch settings"));
      return;
    }

    if (!settingsData || !settingsData.email) {
      res.status(200).json(createSuccessResponse("No email configured"));
      return;
    }

    const currentLabel = await fetchAvailabilityLabel();

    if (!currentLabel) {
      res.status(200).json(createSuccessResponse("Could not find the availability label on the Longines page"));
      return;
    }

    const normalizedCurrent = normalizeLabel(currentLabel);
    const normalizedTarget = normalizeLabel(TARGET_LABEL);
    const isStillUnavailable = normalizedCurrent === normalizedTarget;

    const { data: existingState, error: stateError } = await supabase
      .from("external_watch_notifications")
      .select("*")
      .eq("id", WATCH_ID)
      .maybeSingle();

    if (stateError) {
      console.error("Watch state error:", stateError);
      res.status(500).json(createErrorResponse("Failed to fetch watch state"));
      return;
    }

    if (isStillUnavailable) {
      const { error: updateError } = await supabase.from("external_watch_notifications").upsert({
        id: WATCH_ID,
        watch_url: WATCH_URL,
        current_label: currentLabel,
        last_notified_label: null,
        last_checked_at: new Date().toISOString(),
        last_notified_at: existingState?.last_notified_at ?? null,
      });

      if (updateError) {
        console.error("Watch state update error:", updateError);
      }

      res.status(200).json(createSuccessResponse({
        status: "still-unavailable",
        currentLabel,
      }));
      console.log(`Longines HydroConquest is still unavailable. Current label: "${currentLabel}"`);
      return;
    }

    if (existingState?.last_notified_label && normalizeLabel(existingState.last_notified_label) === normalizedCurrent) {
      const { error: updateError } = await supabase.from("external_watch_notifications").upsert({
        id: WATCH_ID,
        watch_url: WATCH_URL,
        current_label: currentLabel,
        last_notified_label: existingState.last_notified_label,
        last_checked_at: new Date().toISOString(),
        last_notified_at: existingState.last_notified_at,
      });

      if (updateError) {
        console.error("Watch state update error:", updateError);
      }

      res.status(200).json(createSuccessResponse({
        status: "already-notified",
        currentLabel,
      }));
      return;
    }

    const html = wrapInBaseTemplate(
      `
      <div class="card">
        <h2>The Longines HydroConquest is available</h2>
        <p style="margin-bottom: 16px;">The availability label on the product page changed from the waitlist state.</p>
        <p><strong>Current span value:</strong> ${currentLabel}</p>
        <p><strong>Reference URL:</strong> <a href="${WATCH_URL}">${WATCH_URL}</a></p>
      </div>
      `,
      "Longines HydroConquest Availability",
      "The Longines HydroConquest availability label changed",
      "You are receiving this because the monitored Longines product page no longer shows the waitlist label.",
    );

    await sendEmail(
      settingsData.email,
      "Longines HydroConquest is available",
      html,
    );

    const { error: saveError } = await supabase.from("external_watch_notifications").upsert({
      id: WATCH_ID,
      watch_url: WATCH_URL,
      current_label: currentLabel,
      last_notified_label: currentLabel,
      last_checked_at: new Date().toISOString(),
      last_notified_at: new Date().toISOString(),
    });

    if (saveError) {
      console.error("Watch state save error:", saveError);
      res.status(500).json(createErrorResponse("Availability email sent, but failed to save watch state"));
      return;
    }

    res.status(200).json(createSuccessResponse({
      status: "email-sent",
      currentLabel,
    }));
  } catch (error: any) {
    console.error("Error checking Longines availability:", error);
    res.status(500).json(createErrorResponse(error.message || "Internal server error while checking Longines availability"));
  }
}