import { VercelRequest, VercelResponse } from '@vercel/node';
import { validateMasterPassword, setCorsHeaders, handleOptionsRequest, createErrorResponse, createSuccessResponse } from '../utils/auth';
import { getSupabaseClient } from '../utils/database';

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
      res.status(401).json(createErrorResponse('Invalid or missing master password'));
      return;
    }

    const { id } = req.body;

    if (!id) {
      res.status(400).json(createErrorResponse('Entry ID is required'));
      return;
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('entry')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json(createErrorResponse('Failed to delete entry from database'));
      return;
    }

    res.status(200).json(createSuccessResponse({ id }));
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json(createErrorResponse('Internal server error while deleting entry'));
  }
}
