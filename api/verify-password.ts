import { withApi, createErrorResponse, createSuccessResponse } from "../utils/api";
import { checkMasterPassword, createSessionToken } from "../utils/auth";

/**
 * POST /api/verify-password  { password }
 * Exchanges the master password for a signed session token. All other endpoints
 * expect that token as `Authorization: Bearer <token>`.
 */
export default withApi({ methods: ["POST"], auth: "none" }, (req, res) => {
  if (!checkMasterPassword(req.body?.password)) {
    return res.status(401).json(createErrorResponse("Invalid master password"));
  }

  return res.status(200).json(createSuccessResponse(createSessionToken()));
});
