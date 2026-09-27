import { withApi, createErrorResponse, createSuccessResponse } from "../utils/api";
import { fetchJson } from "../utils/http";

export default withApi({ methods: ["GET"] }, async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== "string") {
    return res.status(400).json(createErrorResponse("Query parameter 'q' is required"));
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return res.status(500).json(createErrorResponse("Geoapify API key not configured"));
  }

  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&apiKey=${apiKey}`;

  try {
    return res.status(200).json(createSuccessResponse(await fetchJson(url)));
  } catch (error) {
    console.error("Error fetching location:", error);
    return res.status(500).json(createErrorResponse("Failed to fetch location data"));
  }
});
