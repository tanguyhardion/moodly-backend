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

  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed'));
  }

  if (!validateMasterPassword(req)) {
    return res.status(401).json(createErrorResponse('Invalid or missing master password'));
  }

  try {
    const supabase = getSupabaseClient();

    // Optional query params for filtering
    const { from, to, date } = req.query;

    let query = supabase
      .from('daily_entry')
      .select('*')
      .order('date', { ascending: false });

    if (date && typeof date === 'string') {
      query = query.eq('date', date);
    } else {
      if (from && typeof from === 'string') {
        query = query.gte('date', from);
      }
      if (to && typeof to === 'string') {
        query = query.lte('date', to);
      }
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json(createErrorResponse('Failed to fetch entries'));
    }

    const mapped = (entries ?? []).map((e: Record<string, unknown>) => ({
      id: e.id,
      date: e.date,
      data: e.data,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));

    return res.status(200).json(createSuccessResponse(mapped));
  } catch (error) {
    console.error('Error fetching entries:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}
