// Derivative review artifacts must not disclose the sampled member's name.
// Preserve the exact frozen body after the greeting, not a newly selected/rendered
// inventory. Only the approved Friday template contains a personalized greeting.
export function neutralFriendDiscoveryReview<T extends {subject:string;text:string;html:string}>(email:T):T {
 if(email.subject!=='What’s happening near you this weekend?')return {...email};
 const text=/^Hey [^\r\n]*,\n/;
 const html=/^(<div\b[^>]*>)<p>Hey [^<]*,<\/p>/;
 if(!text.test(email.text)||!html.test(email.html))throw Error('Unrecognized Friday greeting; review export blocked');
 return {...email,text:email.text.replace(text,'Hey there,\n'),html:email.html.replace(html,'$1<p>Hey there,</p>')};
}
