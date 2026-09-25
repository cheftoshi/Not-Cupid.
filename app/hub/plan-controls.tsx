'use client';
import { useRef, useState } from 'react';
import { ConnectionPlan, DateProfile, planEndpoint, planHasEnded } from '@/lib/connection-plans';
import { fetchJsonWithTimeout } from '@/lib/fetch-helpers';
import s from './plans-home.module.css';

type Place = { area:string; location:string; visibility:'public'|'participants'; public_place:boolean };
const genders = [['m','Men'],['f','Women'],['nb','Nonbinary people']];
const message = (error:unknown)=>error instanceof Error?error.message:'Could not save. Please retry.';

function LocationFields({value,onChange,areas,date=false}:{value:Place;onChange:(p:Place)=>void;areas:string[];date?:boolean}) {
  const [venue,setVenue]=useState(!!value.location);
  return <fieldset className={s.locationFields}><legend>Where’s it happening?</legend>
    <label>Neighborhood · required<select required value={value.area} onChange={e=>onChange({...value,area:e.target.value})}><option value="">Choose a neighborhood</option>{areas.map(a=><option key={a}>{a}</option>)}</select></label>
    <p className={s.muted}>Your meeting area is visible, not your live location.</p>
    <div className={s.actions}><button type="button" aria-pressed={!venue} onClick={()=>{setVenue(false);onChange({...value,location:'',public_place:false});}}>Decide together</button><button type="button" aria-pressed={venue} onClick={()=>setVenue(true)}>Add a public place</button></div>
    {venue&&<><label>Public meeting place<input required maxLength={120} value={value.location} onChange={e=>onChange({...value,location:e.target.value})} placeholder="A café, park entrance, or public venue"/></label>
      <label className={s.check}><input type="checkbox" required checked={value.public_place} onChange={e=>onChange({...value,public_place:e.target.checked})}/>This is a public place, not a home address.</label>
      {!date&&<label>Who can see the exact place?<select value={value.visibility} onChange={e=>onChange({...value,visibility:e.target.value as Place['visibility']})}><option value="participants">Joined participants only</option><option value="public">Everyone viewing the invitation</option></select></label>}</>}
    <small>{date?'The exact venue is shared only with your accepted date.':'You can set the meeting place from the conversation later.'} Keep private addresses out of your title and description.</small>
  </fieldset>;
}
export function MeetingPlace({plan}:{plan:ConnectionPlan}) {return <div className={s.place}><strong>{plan.area||'Local area'}{plan.distanceMiles!=null?' · '+(plan.distanceMiles<1?'Less than 1':'About '+plan.distanceMiles)+' mi away':''}</strong><span>{plan.location||(plan.locationHidden?(plan.connectionKind==='date'?'Exact place shared after acceptance':'Exact place shared with participants'):'Decide together · no venue set')}</span>{plan.location&&<small>{plan.locationVisibility==='participants'?'Participants-only meeting place':'Public meeting place'}</small>}</div>;}
export function Profile({person}:{person:DateProfile}) {return <div className={s.profile}>{person.photo&&<img src={person.photo} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<strong>{person.name}{person.age?', '+person.age:''}</strong><small>{genders.find(([id])=>id===person.gender)?.[1]}</small><p>{person.bio}</p><small>{person.interests.join(' · ')}</small></div>;}

export function CreateInvitation({areas,origin,onCreated,onClose}:{areas:string[];origin:string;onCreated:(id:string,date:boolean)=>void;onClose:()=>void}) {
  const [title,setTitle]=useState(''),[body,setBody]=useState(''),[when,setWhen]=useState(''),[capacity,setCapacity]=useState('4'),[intent,setIntent]=useState('friends'),[mode,setMode]=useState('profile'),[seeks,setSeeks]=useState<string[]>([]),[place,setPlace]=useState<Place>({area:areas.includes(origin)?origin:'',location:'',visibility:'participants',public_place:false}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef(false),retry=useRef<{payload:string;id:string}|null>(null),date=intent==='date';
  async function submit(e:React.FormEvent){e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{const at=when?new Date(when):null;if(at&&(!Number.isFinite(at.getTime())||at.getTime()<=Date.now()))throw Error('Choose a future time or leave it flexible.');
      const payload={kind:'event',title,body,category:'hang',happens_at:at?.toISOString()||null,capacity:date?2:Number(capacity),...place,location_version:1,...(date?{date_mode:mode,genders:seeks}:{})};
      const signature=JSON.stringify(payload);if(retry.current?.payload!==signature)retry.current={payload:signature,id:crypto.randomUUID()};
      const {response,data}=await fetchJsonWithTimeout(date?'/api/date-plans':'/api/friend/activities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,client_id: retry.current.id})});
      if(!response.ok||!data?.id)throw Error(data?.error||'Publication not confirmed. Retry this same form.');onCreated(data.id,date);
    }catch(e){setError(message(e));}finally{pending.current=false;setBusy(false);}
  }
  return <form className={s.form} onSubmit={submit} aria-label="Create an invitation"><div className={s.sectionHead}><div><span className={s.eyebrow}>Start something</span><h2>What would you like to do?</h2></div><button type="button" disabled={busy} onClick={onClose}>Close</button></div>
    <label>Your invitation<input autoFocus required maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} placeholder="A walk around the Common after work?"/></label>
    <label>What kind of connection?<select value={intent} onChange={e=>setIntent(e.target.value)}><option value="friends">Friendship</option><option value="date">A date for two · free</option></select></label>
    {date?<div className={s.dateSetup}><p>Two people. You choose one guest. Requests and acceptance are free and do not use Love Line picks.</p><label>Date style<select value={mode} onChange={e=>setMode(e.target.value)}><option value="profile">Profile first</option><option value="blind">Blind date</option></select></label><fieldset><legend>Who would you like to meet?</legend>{genders.map(([id,label])=><label className={s.check} key={id}><input type="checkbox" checked={seeks.includes(id)} onChange={e=>setSeeks(prev=>e.target.checked?[...prev,id]:prev.filter(x=>x!==id))}/>{label}</label>)}</fieldset><small>Age and gender stay visible. {mode==='blind'?'Names, photos, and bios reveal after acceptance. Avoid identifying details in your invitation.':'People can review your basic profile before requesting.'} Both people must be 18+.</small></div>:<label>People, including you<select value={capacity} onChange={e=>setCapacity(e.target.value)}><option value="2">2 · one-on-one</option><option value="4">4 · small group</option><option value="6">6 · small group</option><option value="10">10 · group</option></select></label>}
    <LocationFields value={place} onChange={setPlace} areas={areas} date={date}/>
    <details><summary>Optional details · when, a little more</summary><div className={s.formDetails}><label>When · optional<input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)}/></label><label>A little more · optional<textarea maxLength={1000} value={body} onChange={e=>setBody(e.target.value)}/></label></div></details>
    {error&&<p className={s.error} role="alert">{error}</p>}<button className={s.primary} disabled={busy||!title.trim()||!place.area||(date&&!seeks.length)}>{busy?'Publishing…':'Create invitation'}</button>
  </form>;
}

export function DateInvitation({plan,onChange,onOpen}:{plan:ConnectionPlan;onChange:()=>Promise<void>;onOpen:(p:ConnectionPlan)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[profile,setProfile]=useState(false),[confirmCancel,setConfirmCancel]=useState(false);const pending=useRef(false);
  const ended=planHasEnded(plan)||plan.state==='cancelled';
  function report(request?:string){if(window.confirm('Report and block this person? Your conversations with them will no longer be available.'))void act('report',request);}
  async function act(action:string,request?:string){if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{const {response,data}=await fetchJsonWithTimeout(planEndpoint(plan),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,request_id:request})});if(!response.ok||!data?.ok)throw Error(data?.error||'Response not confirmed.');await onChange();if(action==='accept')onOpen({...plan,canChat:true,myResponse:'yes'});}
    catch(e){setError(message(e));}finally{pending.current=false;setBusy(false);setConfirmCancel(false);}
  }
  return <article className={s.card} aria-label={plan.title}><div className={s.cardStrip}><span>{plan.dateMode==='blind'?'Blind date':'Profile first'}</span><span>2 people · free</span></div>
    <div className={s.host}>{plan.authorPhoto&&<img src={plan.authorPhoto} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<div><strong>{plan.isMine?'Your invitation':plan.authorName}</strong><small>{plan.authorProfile?.age} · {genders.find(([id])=>id===plan.authorProfile?.gender)?.[1]} · interested in {plan.audienceGender?.map(g=>genders.find(([id])=>id===g)?.[1].toLowerCase()).join(', ')}</small></div></div>
    <h2>{plan.title}</h2>{plan.body&&<p>{plan.body}</p>}<small>{plan.happens_at?new Date(plan.happens_at).toLocaleString():'Find a time together'}</small><MeetingPlace plan={plan}/>
    <p className={s.muted}>{plan.state==='cancelled'?'Date cancelled':plan.canChat?'Date confirmed · just the two of you':ended?'Closed to new requests':'Host chooses one guest'}</p>
    {plan.authorProfile&&plan.dateMode!=='blind'&&!plan.isMine&&<><button onClick={()=>setProfile(!profile)} aria-expanded={profile}>View profile</button>{profile&&<Profile person={plan.authorProfile}/>}</>}
    {plan.dateMode==='blind'&&!plan.canChat&&<p className={s.muted}>Profiles reveal after acceptance. Interests: {plan.authorProfile?.interests.join(' · ')||'Get to know each other in chat'}.</p>}
    <div className={s.actions}>{plan.canChat&&<button className={s.primary} onClick={()=>onOpen(plan)}>Open conversation ↗</button>}
      {!plan.isMine&&!plan.canChat&&!ended&&(plan.myResponse==='pending'?<button disabled={busy} onClick={()=>void act('withdraw')}>Withdraw request</button>:plan.myResponse==='passed'||plan.myResponse==='withdrawn'?<span>This request is closed.</span>:<button className={s.primary} disabled={busy||!plan.eligible} onClick={()=>void act('request')}>I’m interested →</button>)}
      {(plan.isMine||plan.canChat)&&plan.state!=='cancelled'&&<button disabled={busy} onClick={()=>setConfirmCancel(!confirmCancel)}>Cancel date</button>}
      {(!plan.isMine||plan.canChat)&&<button disabled={busy} onClick={()=>report()}>Report & block</button>}
    </div>{confirmCancel&&<div role="alert"><p>Cancel this invitation? Please tell your date in chat first.</p><button disabled={busy} onClick={()=>void act('cancel')}>Yes, cancel</button><button onClick={()=>setConfirmCancel(false)}>Keep it</button></div>}
    {!plan.eligible&&!plan.isMine&&!plan.canChat&&!ended&&<small>This invitation has age or gender requirements.</small>}
    {plan.isMine&&plan.requests?.length?<section className={s.requests}><h3>Interested in your date</h3>{plan.requests.map(r=><div key={r.id} className={s.request}><Profile person={r.profile}/><div className={s.actions}><button className={s.primary} disabled={busy||ended} onClick={()=>void act('accept',r.id)}>Accept request</button><button disabled={busy||ended} onClick={()=>void act('pass',r.id)}>Pass</button><button disabled={busy} onClick={()=>report(r.id)}>Report & block</button></div></div>)}</section>:null}
    {error&&<p role="alert" className={s.error}>{error}</p>}
  </article>;
}

export function LocationEditor({plan,areas,onSaved,onClose}:{plan:ConnectionPlan;areas:string[];onSaved:()=>Promise<void>;onClose:()=>void}){
  const [place,setPlace]=useState<Place>({area:plan.area||'',location:plan.location||'',visibility:plan.locationVisibility||'participants',public_place:false}),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
  async function save(e:React.FormEvent){e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);try{const {response,data}=await fetchJsonWithTimeout(planEndpoint(plan),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(place)});if(!response.ok||!data?.ok)throw Error(data?.error||'Update not confirmed.');await onSaved();onClose();}catch(e){setError(message(e));}finally{pending.current=false;setBusy(false);}}
  return <form className={s.form} onSubmit={save} aria-label="Update meeting place"><LocationFields value={place} onChange={setPlace} areas={plan.locationAreas||areas} date={plan.connectionKind==='date'}/>{error&&<p role="alert">{error}</p>}<div className={s.actions}><button className={s.primary} disabled={busy}>Save meeting place</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button></div></form>;
}
