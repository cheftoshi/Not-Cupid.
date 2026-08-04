import { createHmac } from 'crypto';

export function hashOtp(email: string, code: string): string {
  const secret = process.env.MATCH_LINK_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('MATCH_LINK_SECRET is not set or too short');
  }
  return createHmac('sha256', secret)
    .update(`otp.${email}.${code}`)
    .digest('hex');
}
