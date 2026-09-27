import { withApi, createErrorResponse, createSuccessResponse } from '../utils/api';
import { getSupabaseClient } from '../utils/database';
import type { ScheduledLetter } from '../types';

export default withApi({ methods: ['POST'] }, async (req, res) => {
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

  const { data: savedLetter, error } = await getSupabaseClient()
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

  const letter: ScheduledLetter = {
    id: savedLetter.id,
    message: savedLetter.message,
    sendDate: savedLetter.send_date,
    createdAt: savedLetter.created_at,
  };
  return res.status(200).json(createSuccessResponse(letter));
});
