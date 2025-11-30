import { VercelRequest, VercelResponse } from '@vercel/node';
import { validateMasterPassword, setCorsHeaders, handleOptionsRequest, createErrorResponse, createSuccessResponse } from '../utils/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  setCorsHeaders(res);
  
  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json(createErrorResponse('Method not allowed'));
    return;
  }

  try {
    // Validate master password
    if (!validateMasterPassword(req)) {
      res.status(401).json(createErrorResponse('Invalid master password'));
      return;
    }

    // Password is valid
    res.status(200).json(createSuccessResponse({ authenticated: true }));
  } catch (error) {
    console.error('Error verifying password:', error);
    res.status(500).json(createErrorResponse('Internal server error'));
  }
}
