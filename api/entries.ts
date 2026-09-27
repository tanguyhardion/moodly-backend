import { withApi, createErrorResponse, createSuccessResponse } from '../utils/api';
import { getEntries, getEntryByDate, getSupabaseClient } from '../utils/database';
import { mapDatabaseEntryToDailyEntry } from '../utils/helpers';

export default withApi({ methods: ['GET', 'POST', 'DELETE'] }, async (req, res) => {
  const supabase = getSupabaseClient();

  // GET - Fetch entries
  if (req.method === 'GET') {
    const { from, to, date } = req.query;

    if (typeof date === 'string' && date) {
      const entry = await getEntryByDate(date);
      return res.status(200).json(createSuccessResponse(entry ? [entry] : []));
    }

    const entries = await getEntries({
      from: typeof from === 'string' && from ? from : undefined,
      to: typeof to === 'string' && to ? to : undefined,
    });
    return res.status(200).json(createSuccessResponse(entries));
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

    const row: Record<string, unknown> = {
      date,
      data,
      updated_at: new Date().toISOString(),
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

    return res.status(200).json(createSuccessResponse(mapDatabaseEntryToDailyEntry(savedEntry)));
  }

  // DELETE - Delete entry
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
});
