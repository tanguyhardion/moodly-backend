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
    const { id, date, data } = req.body;

    if (!date) {
      return res.status(400).json(createErrorResponse('Date is required'));
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json(createErrorResponse('Data object is required'));
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const row: Record<string, unknown> = {
      date,
      data,
      updated_at: now,
    };

    if (id) {
      row.id = id;
    }

    // Upsert on date (unique constraint)
    const { data: savedEntry, error } = await supabase
      .from('daily_entry')
      .upsert(row, { onConflict: 'date' })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json(createErrorResponse('Failed to save entry'));
    }

    return res.status(200).json(createSuccessResponse({
      id: savedEntry.id,
      date: savedEntry.date,
      data: savedEntry.data,
      createdAt: savedEntry.created_at,
      updatedAt: savedEntry.updated_at,
    }));
  } catch (error) {
    console.error('Error saving entry:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}
