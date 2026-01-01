import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from "../utils/auth";
import https from "https";

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

  // Validate master password
  if (!validateMasterPassword(req)) {
    res
      .status(401)
      .json(createErrorResponse("Invalid or missing master password"));
    return;
  }

  const { q } = req.query;

  if (!q || typeof q !== "string") {
    res
      .status(400)
      .json(createErrorResponse("Query parameter 'q' is required"));
    return;
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    res
      .status(500)
      .json(createErrorResponse("Geoapify API key not configured"));
    return;
  }

  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
    q,
  )}&apiKey=${apiKey}`;

  try {
    const data = await new Promise((resolve, reject) => {
      https
        .get(url, (apiRes) => {
          let body = "";
          apiRes.on("data", (chunk) => (body += chunk));
          apiRes.on("end", () => {
            if (
              apiRes.statusCode &&
              apiRes.statusCode >= 200 &&
              apiRes.statusCode < 300
            ) {
              resolve(JSON.parse(body));
            } else {
              reject(
                new Error(`Geoapify API error: ${apiRes.statusCode} ${body}`),
              );
            }
          });
        })
        .on("error", (err) => reject(err));
    });

    res.status(200).json(createSuccessResponse(data));
  } catch (error: any) {
    console.error("Error fetching location:", error);
    res.status(500).json(createErrorResponse("Failed to fetch location data"));
  }
}
