// Shared email-typo correction. Used on login + quiz signup, plus the admin
// cleanup tool that fixes already-saved bad addresses in the DB.

export const EMAIL_TYPOS: Record<string, string> = {
  // gmail
  'gmail.om': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.ocm': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmailcom': 'gmail.com',
  'gmaul.com': 'gmail.com',

  // outlook
  'outlook.om': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlook.fom': 'outlook.com',
  'outlook.cm': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outloo.cm': 'outlook.com',
  'outlokk.com': 'outlook.com',

  // yahoo
  'yahoo.om': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.cm': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',

  // hotmail
  'hotmail.om': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.cm': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',

  // icloud / me
  'iclud.com': 'icloud.com',
  'icloud.om': 'icloud.com',
  'icloud.cm': 'icloud.com',
  'icoud.com': 'icloud.com',
  'icould.com': 'icloud.com',
  'me.cm': 'me.com',
  'me.om': 'me.com',

  // schools
  'northeastern.com': 'northeastern.edu',
  'harvard.com': 'harvard.edu',
  'bu.com': 'bu.edu',
  'mit.com': 'mit.edu',
}

/**
 * Returns the corrected email if the address's domain matches a known typo,
 * otherwise null.
 *
 * Case-insensitive on the domain. Preserves the local-part exactly.
 */
export function suggestEmailCorrection(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  const domain = email.slice(at + 1).toLowerCase().trim()
  const correction = EMAIL_TYPOS[domain]
  if (correction && correction !== domain) {
    return email.slice(0, at + 1) + correction
  }
  return null
}
