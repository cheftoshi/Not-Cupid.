import { createHash } from 'node:crypto';

// One owner-authorized mailbox, not a general admin inclusion switch. Keep the
// address in server configuration, never in public bundles or member analytics.
const approvedAddressHash = 'd03b62f6b93f0c023e60ad5011301187be0f946a2fa666d18cfd6da311bbcd45';
export function ownerReviewEmail(value = process.env.CAMPAIGN_OWNER_REVIEW_EMAIL): string | null {
  const email = value?.trim().toLowerCase();
  return email && createHash('sha256').update(email).digest('hex') === approvedAddressHash ? email : null;
}
export type OwnerReviewManifest = {
  purpose: 'owner_campaign_review'; sourceCampaign: string; sourceHash: string;
  userId: string; expires: number;
  email: { to: string; from: string; replyTo: string; subject: string; html: string; text: string; unsubscribeUrl: string; unsubscribePostUrl: string };
};
export function ownerReviewHash(manifest: OwnerReviewManifest): string {
  // Explicit stable field order; the entire exact copy and recipient are bound.
  const m=manifest,e=m.email;
  return createHash('sha256').update(JSON.stringify([m.purpose,m.sourceCampaign,m.sourceHash,m.userId,m.expires,e.to,e.from,e.replyTo,e.subject,e.html,e.text,e.unsubscribeUrl,e.unsubscribePostUrl])).digest('hex');
}
export function validOwnerReview(m: OwnerReviewManifest, now=Date.now()): boolean {
  if (!m || m.purpose!=='owner_campaign_review' || !/^friend_events_announcement_[a-z0-9_]{1,60}$/.test(m.sourceCampaign) || !/^[a-f0-9]{64}$/.test(m.sourceHash) || !/^[a-f0-9-]{36}$/.test(m.userId) || !Number.isSafeInteger(m.expires) || m.expires<=now) return false;
  const e=m.email;
  if(!e || e.to!==ownerReviewEmail() || e.from!=='NotCupid <match@notcupid.com>' || e.replyTo!=='match@notcupid.com' || !e.subject || !e.html || !e.text || /go\/friend-events|friend_event_delivery_id/.test(e.html+e.text))return false;
  try {for(const [value,path] of [[e.unsubscribeUrl,'/unsubscribe'],[e.unsubscribePostUrl,'/api/unsubscribe']]) {const u=new URL(value);if(u.origin!=='https://notcupid.com'||u.username||u.password||u.pathname!==path||u.searchParams.get('u')!==m.userId||!u.searchParams.get('t'))return false;}} catch{return false;}
  return true;
}
export type OwnerReviewApproval = {manifestHash:string;contentApprovedAt:number;sendApprovedAt:number;expires:number;enabled:boolean};
export type OwnerReviewDependencies = {
  approval():Promise<OwnerReviewApproval|null>;
  eligible():Promise<boolean>;
  suppression():Promise<'clear'|'blocked'|'unknown'>;
  claim():Promise<boolean>;
  submit():Promise<string>;
  receipt(providerId:string):Promise<void>;
};
export async function executeOwnerReview(input:OwnerReviewManifest,deps:OwnerReviewDependencies) {
  const m=structuredClone(input),hash=ownerReviewHash(m);let attempted=0;
  const approved=async()=>{const a=await deps.approval();return !!a?.enabled&&a.manifestHash===hash&&Number.isFinite(a.contentApprovedAt)&&a.contentApprovedAt>0&&Number.isFinite(a.sendApprovedAt)&&a.sendApprovedAt>a.contentApprovedAt&&a.sendApprovedAt<=Date.now()&&a.expires>Date.now()&&m.expires>Date.now();};
  try {
    if(!validOwnerReview(m))return {attempted,accepted:0,stopped:'invalid_or_expired_review'};
    if(!await approved())return {attempted,accepted:0,stopped:'exact_approval_required'};
    if(!await deps.eligible()||await deps.suppression()!=='clear')return {attempted,accepted:0,stopped:'ineligible_or_suppressed'};
    if(!await deps.claim())return {attempted,accepted:0,stopped:'already_claimed_or_unapproved'};
    if(!await approved()||!await deps.eligible()||await deps.suppression()!=='clear'||!await approved())return {attempted,accepted:0,stopped:'changed_after_claim_no_retry'};
    attempted=1;const providerId=await deps.submit();if(!providerId)throw Error('Missing provider receipt');
    await deps.receipt(providerId);return {attempted,accepted:1,stopped:'accepted'};
  } catch {return {attempted,accepted:null,stopped:'uncertain_reconcile_no_retry'};}
}
