import { createHash } from 'node:crypto';

export type FrozenFriendDelivery = {
  deliveryId: string; userId: string; channel: 'email' | 'push';
  email?: { to: string; from: string; replyTo: string; subject: string; html: string; text: string; unsubscribeUrl: string; unsubscribePostUrl?: string };
  push?: { title: string; body: string; url: string; tag: string };
};
export type FrozenFriendCampaign = { purpose?: 'weekly_discovery' | 'friend_line_announcement'; campaign: string; version: string; expires: number; entries: FrozenFriendDelivery[] };
export type FriendCampaignApproval = { audiencePolicy?: 'weekly_discovery' | 'friend_line_announcement'; manifestHash: string; recipientCount: number; contentApprovedAt: number; sendApprovedAt: number; expires: number; enabled: boolean };
export type FriendSenderDependencies = {
  approval(campaign: string): Promise<FriendCampaignApproval | null>;
  eligible(entry: FrozenFriendDelivery): Promise<boolean>;
  suppression(entry: FrozenFriendDelivery): Promise<'clear' | 'blocked' | 'unknown'>;
  claim(entry: FrozenFriendDelivery, campaign: string, hash: string): Promise<boolean>;
  submit(entry: FrozenFriendDelivery, campaign: string): Promise<{ accepted: boolean; providerId?: string }>;
  recordAccepted(entry: FrozenFriendDelivery, providerId?: string): Promise<void>;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k)+':'+canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function friendCampaignHash(manifest: FrozenFriendCampaign): string {
  return createHash('sha256').update(canonical(manifest)).digest('hex');
}
export function reviewFrozenFriendCampaign(manifest: FrozenFriendCampaign) {
  return { manifestHash: friendCampaignHash(manifest), deliveryCount: manifest.entries.length,
    uniquePeople: new Set(manifest.entries.map(entry => entry.userId)).size,
    emailCount: manifest.entries.filter(entry => entry.channel === 'email').length,
    pushCount: manifest.entries.filter(entry => entry.channel === 'push').length,
    renderedMessages: structuredClone(manifest.entries) };
}
function validGlobalUnsubscribe(value: string | undefined,userId:string,path:string):boolean {
 try {const u=new URL(value||'');return u.origin==='https://notcupid.com'&&!u.username&&!u.password&&u.pathname===path&&u.searchParams.get('u')===userId&&!!u.searchParams.get('t');}catch{return false;}
}
function validManifest(m: FrozenFriendCampaign): boolean {
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const deliveries=new Set<string>(), recipients=new Set<string>();
  const announcement=m.purpose==='friend_line_announcement';
  if(m.purpose && !['weekly_discovery','friend_line_announcement'].includes(m.purpose)) return false;
  if(announcement && !m.campaign.startsWith('friend_events_announcement_')) return false;
  return /^friend_events_[a-z0-9_]{1,80}$/.test(m.campaign) && !!m.version && Number.isSafeInteger(m.expires) && m.entries.length>0 && m.entries.every(e=>{
    const recipient=`${e.userId}:${e.channel}`;
    if (!uuid.test(e.userId) || !uuid.test(e.deliveryId) || deliveries.has(e.deliveryId) || recipients.has(recipient)) return false;
    deliveries.add(e.deliveryId);recipients.add(recipient);
    if(e.channel==='email') return !!e.email && !e.push && e.email.from==='NotCupid <match@notcupid.com>' && e.email.replyTo==='match@notcupid.com' && !!e.email.subject && !!e.email.html && !!e.email.text && (announcement ? validGlobalUnsubscribe(e.email.unsubscribeUrl,e.userId,'/unsubscribe') && validGlobalUnsubscribe(e.email.unsubscribePostUrl,e.userId,'/api/unsubscribe') : e.email.unsubscribeUrl.startsWith('https://notcupid.com/api/friend-events/unsubscribe?token='));
    return !announcement && e.channel==='push' && !!e.push && !e.email && !!e.push.title && !!e.push.body && e.push.url.startsWith('https://notcupid.com/go/friend-events?token=');
  });
}
// Only explicitly guarded operator execution may call this worker; never cron. Every exact rendered
// message, signed link, address, channel and count is frozen in the approved hash.
// Unknown outcomes remain claimed and halt the batch. Never blindly retry.
export async function executeFrozenFriendCampaign(input: FrozenFriendCampaign, deps: FriendSenderDependencies, now=Date.now()) {
  const manifest=structuredClone(input); // caller cannot change material after approval
  const result={attempted:0,accepted:0,stopped:''};
  if(!validManifest(manifest) || manifest.expires<=now) return {...result,stopped:'invalid_or_expired_manifest'};
  const hash=friendCampaignHash(manifest);
  const approval=await deps.approval(manifest.campaign);
  if(!approval?.enabled || (approval.audiencePolicy||'weekly_discovery')!==(manifest.purpose||'weekly_discovery') || approval.manifestHash!==hash || approval.recipientCount!==manifest.entries.length || !Number.isFinite(approval.contentApprovedAt) || !Number.isFinite(approval.sendApprovedAt) || approval.contentApprovedAt<=0 || approval.sendApprovedAt<=approval.contentApprovedAt || approval.sendApprovedAt>now || !Number.isFinite(approval.expires) || approval.expires<=now) return {...result,stopped:'exact_approval_required'};
  // A changed audience means a new count/content review, not silent substitution.
  for(const entry of manifest.entries) {
    if(!await deps.eligible(entry) || await deps.suppression(entry)!=='clear') return {...result,stopped:'audience_changed_or_suppressed'};
  }
  for(const entry of manifest.entries) {
    try {
      // Recheck after preflight, before each actual submission.
      const current=await deps.approval(manifest.campaign);
      if(!current?.enabled || (current.audiencePolicy||'weekly_discovery')!==(manifest.purpose||'weekly_discovery') || current.manifestHash!==hash || current.recipientCount!==manifest.entries.length || !Number.isFinite(current.contentApprovedAt) || !Number.isFinite(current.sendApprovedAt) || current.contentApprovedAt<=0 || current.sendApprovedAt<=current.contentApprovedAt || current.sendApprovedAt>Date.now() || !Number.isFinite(current.expires) || current.expires<=Date.now() || manifest.expires<=Date.now()) return {...result,stopped:'approval_changed_or_expired'};
      if(!await deps.eligible(entry) || await deps.suppression(entry)!=='clear') return {...result,stopped:'eligibility_changed'};
      if(!await deps.claim(entry,manifest.campaign,hash)) return {...result,stopped:'claim_unavailable'};
      result.attempted++;
      const submitted=await deps.submit(entry,manifest.campaign);
      if(!submitted.accepted) return {...result,stopped:'provider_not_accepted_no_retry'};
      result.accepted++;
      await deps.recordAccepted(entry,submitted.providerId);
    } catch {return {...result,stopped:'uncertain_outcome_reconcile_before_retry'};}
  }
  return {...result,stopped:'complete'};
}
