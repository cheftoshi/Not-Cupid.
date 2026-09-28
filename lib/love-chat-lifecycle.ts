/** Archiving is an inbox filter, never an end, pass, or loss of consent. */
export const CHAT_ARCHIVE_DAYS = 10;
export function isArchivedChat(match: any, now = Date.now()): boolean {
  if (match.ended_at || !match.user_1_accepted || !match.user_2_accepted) return false;
  const activity = Date.parse(match.chat_last_activity_at || match.created_at);
  return Number.isFinite(activity) && activity <= now - CHAT_ARCHIVE_DAYS * 86400000;
}

/** The database repeats this check under locks, plus reports, realm and caps. */
export function canRestoreChat(match: any): boolean {
  return !!match.ended_at && match.ended_reason === 'expired'
    && ['ended', 'expired'].includes(match.status)
    && match.user_1_accepted === true && match.user_2_accepted === true
    && !match.chat_restored_at;
}
