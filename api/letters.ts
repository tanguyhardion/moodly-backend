import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  validateMasterPassword,
  setCorsHeaders,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
} from '../utils/auth';
import { getSupabaseClient } from '../utils/database';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (handleOptionsRequest(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed'));
  }

  if (!validateMasterPassword(req)) {
    return res.status(401).json(createErrorResponse('Invalid or missing master password'));
  }

  try {
    const { message, sendDate } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json(createErrorResponse('Message is required'));
    }

    if (!sendDate) {
      return res.status(400).json(createErrorResponse('Send date is required'));
    }

    // Validate that sendDate is in the future
    const today = new Date().toISOString().split('T')[0];
    if (sendDate <= today) {
      return res.status(400).json(createErrorResponse('Send date must be in the future'));
    }

    const supabase = getSupabaseClient();

    const { data: savedLetter, error } = await supabase
      .from('scheduled_letter')
      .insert({
        message: message.trim(),
        send_date: sendDate,
        sent: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json(createErrorResponse('Failed to save letter'));
    }

    return res.status(200).json(createSuccessResponse({
      id: savedLetter.id,
      message: savedLetter.message,
      sendDate: savedLetter.send_date,
      createdAt: savedLetter.created_at,
    }));
  } catch (error) {
    console.error('Error saving letter:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}
