import { signFriendEventToken } from './friend-event-campaign';
import type { FrozenFriendDelivery } from './friend-event-sender';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderFriendEventMessage(input: {userId:string;deliveryId:string;channel:'email'|'push';email?:string;expires:number},key?:string):FrozenFriendDelivery {
 const token=signFriendEventToken({purpose:'attribution',userId:input.userId,deliveryId:input.deliveryId,channel:input.channel,expires:input.expires},key);
 const url=`https://notcupid.com/go/friend-events?token=${token}`;
 const base={userId:input.userId,deliveryId:input.deliveryId,channel:input.channel};
 if(input.channel==='push') return {...base,push:{title:'Find your weekend plans',body:'Explore Boston events in Friend and find people to go with.',url,tag:`friend-events-${input.deliveryId}`}};
 if(!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Valid reviewed recipient required');
 const unsubscribe=signFriendEventToken({purpose:'unsubscribe',userId:input.userId,channel:'email',expires:input.expires+400*86400000},key);
 const unsubscribeUrl=`https://notcupid.com/api/friend-events/unsubscribe?token=${unsubscribe}`;
 const body='Looking for something to do around Boston? Explore local events in Friend, pick something you like, and find people to go with. Browse the full list or post a plan of your own. Joining a NotCupid plan does not include tickets or admission.';
 return {...base,email:{to:input.email,from:'NotCupid <match@notcupid.com>',replyTo:'match@notcupid.com',subject:'Find your weekend plans on NotCupid',
 text:`${body}\n\nFind plans: ${url}\n\nYou chose Friend event emails. Stop these emails: ${unsubscribeUrl}\nNotCupid by Lemon Labs, 109 California Ave, Quincy, MA 02169.`,
 html:`<p>${escape(body)}</p><p><a href="${escape(url)}">Find plans</a></p><p>You chose Friend event emails. <a href="${escape(unsubscribeUrl)}">Unsubscribe from Friend event emails</a>.</p><p>NotCupid by Lemon Labs, 109 California Ave, Quincy, MA 02169.</p>`,unsubscribeUrl}};
}
