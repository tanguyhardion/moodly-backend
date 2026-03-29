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

  if (!validateMasterPassword(req)) {
    return res.status(401).json(createErrorResponse('Invalid or missing master password'));
  }

  try {
    const supabase = getSupabaseClient();

    // GET - Fetch entries
    if (req.method === 'GET') {
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
    }

    // POST - Save entry
    if (req.method === 'POST') {
      const { id, date, data } = req.body;

      if (!date) {
        return res.status(400).json(createErrorResponse('Date is required'));
      }

      if (!data || typeof data !== 'object') {
        return res.status(400).json(createErrorResponse('Data object is required'));
      }

      const now = new Date().toISOString();

      const row: Record<string, unknown> = {
        date,
        data,
        updated_at: now,
      };

      if (id) {
        row.id = id;
      }

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
    }

    // DELETE - Delete entry
    if (req.method === 'DELETE') {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json(createErrorResponse('Entry ID is required'));
      }

      const { error } = await supabase.from('daily_entry').delete().eq('id', id);

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json(createErrorResponse('Failed to delete entry from database'));
      }

      return res.status(200).json(createSuccessResponse({ id }));
    }

    return res.status(405).json(createErrorResponse('Method not allowed'));
  } catch (error) {
    console.error('Error handling entries request:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
}
