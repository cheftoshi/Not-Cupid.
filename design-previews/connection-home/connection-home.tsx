'use client';
import { useEffect, useRef, useState } from 'react';
import { acceptDate, canChat, dateEligible, newLocationDraft, people, saveLocation, seedInvitations, visibleTo } from './model';
import type { Gender, Invitation } from './model';
import {LocationDetails, LocationFields} from './location-fields';
import s from './home.module.css';

type Message = { person: string; body: string };
const genders: Gender[] = ['Woman','Man','Nonbinary'];
const genderLabel: Record<Gender,string> = {Woman:'Women',Man:'Men',Nonbinary:'Nonbinary people'};
function Avatar({id,blind=false}:{id:string;blind?:boolean}) { const p=people[id]; return <span className={s.avatar} style={{background:blind?'#ece6dd':p.color}} aria-hidden="true">{blind?'?':p.name.slice(0,1)}</span>; }

export default function ConnectionHome({phone=false}:{phone?:boolean}) {
  const [plans,setPlans]=useState(seedInvitations);
  const [viewer,setViewer]=useState('jamie');
  const [filter,setFilter]=useState('discover');
  const [roomId,setRoomId]=useState<string|null>('lunch');
  const [sheet,setSheet]=useState(false);
  const [narrow,setNarrow]=useState(false);
  const [messages,setMessages]=useState<Record<string,Message[]>>({lunch:[{person:'taylor',body:'Found a lovely spot in the South End. Does 12:30 work for everyone?'},{person:'alex',body:'Works for me. Looking forward to it!'}]});
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [creating,setCreating]=useState(false);
  const [title,setTitle]=useState(''); const [body,setBody]=useState('');
  const [kind,setKind]=useState<'friends'|'date'>('friends');
  const [mode,setMode]=useState<'profile'|'blind'>('profile');
  const [seeks,setSeeks]=useState<Gender[]>(['Man']);
  const [capacity,setCapacity]=useState(4);
  const [location,setLocation]=useState(newLocationDraft);
  const [locationError,setLocationError]=useState('');
  const [editingPlace,setEditingPlace]=useState(false);
  const [roomLocation,setRoomLocation]=useState(newLocationDraft);
  const [roomLocationError,setRoomLocationError]=useState('');
  const [time,setTime]=useState('');
  const [notice,setNotice]=useState(''); const [profile,setProfile]=useState<string|null>(null);
  const [passed,setPassed]=useState<string[]>([]);
  const aside=useRef<HTMLElement>(null);
  const returnFocus=useRef<HTMLElement|null>(null);
  const mobile=phone||narrow;
  const me=people[viewer];
  const room=plans.find(p=>p.id===roomId && canChat(p,viewer));
  const joined=plans.filter(p=>canChat(p,viewer));
  const requests=plans.filter(p=>p.owner===viewer&&!p.confirmed).reduce((n,p)=>n+p.requests.filter(r=>r.status==='pending').length,0);
  const upcoming=joined.find(p=>p.kind==='date')||joined[0];
  const shown=plans.filter(p=>visibleTo(p,viewer) && (filter==='yours'?(p.owner===viewer||p.members.includes(viewer)||p.requests.some(r=>r.user===viewer&&r.status==='pending')):!passed.includes(p.id)&&(filter==='discover'||(filter==='friends'?p.kind==='friends':p.kind==='date'))));
  useEffect(()=>{const mq=window.matchMedia('(max-width: 850px)'); const update=()=>setNarrow(mq.matches);update();mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update);},[]);
  useEffect(()=>{
    if(!mobile||!sheet)return;
    const before=document.activeElement as HTMLElement|null; const panel=aside.current;
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')setSheet(false);if(e.key==='Tab'&&panel){const nodes=Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]'));if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    document.addEventListener('keydown',handler);
    return()=>{document.removeEventListener('keydown',handler);(returnFocus.current||before)?.focus();};
  },[mobile,sheet]);
  function openRoom(id:string){returnFocus.current=document.activeElement as HTMLElement;setRoomId(id);setSheet(true);setEditingPlace(false);setRoomLocationError('');}
  function switchViewer(id:string){setViewer(id);setRoomId(null);setEditingPlace(false);setRoomLocationError('');setSheet(false);setProfile(null);setFilter('discover');setPassed([]);setCreating(false);setSeeks(people[id].seeks);setNotice('Preview perspective changed. These are fictional sample members.');}
  function update(plan:Invitation){setPlans(prev=>prev.map(p=>p.id===plan.id?plan:p));}
  function respond(plan:Invitation){
    if(plan.kind==='date'){
      if(!dateEligible(plan,me)||plan.confirmed)return;
      if(plan.requests.some(r=>r.user===viewer&&r.status==='pending')){update({...plan,requests:plan.requests.filter(r=>r.user!==viewer)});setNotice('Your request was withdrawn.');return;}
      update({...plan,requests:[...plan.requests.filter(r=>r.user!==viewer),{user:viewer,status:'pending'}]});
      setNotice('Request sent in the demo. Switch the preview perspective to the host to review and accept it. Chat stays closed until acceptance.');
    }else if(plan.members.includes(viewer))openRoom(plan.id);
    else if(plan.members.length<plan.capacity){update({...plan,members:[...plan.members,viewer]});openRoom(plan.id);setNotice('You joined this sample plan. Your conversation is ready.');}
  }
  function accept(plan:Invitation,guest:string){const next=acceptDate(plan,viewer,guest);if(next===plan)return;update(next);setProfile(null);setNotice('Accepted. This is now a private date for two, removed from everyone else’s discovery feed.');openRoom(plan.id);}
  function create(e:React.FormEvent){
    e.preventDefault();if(!title.trim()||(kind==='date'&&!seeks.length))return;setLocationError('');
    try {
      const savedLocation=saveLocation(location,kind);
      const plan:Invitation={id:crypto.randomUUID(),owner:viewer,title:title.trim(),body:body.trim(),location:savedLocation,time:time.trim()||'Find a time together',kind,category:kind==='date'?(mode==='blind'?'BLIND DATE':'DATE FOR TWO'):'YOUR INVITATION',capacity:kind==='date'?2:capacity,members:[viewer],mode:kind==='date'?mode:undefined,seeks:kind==='date'?seeks:undefined,requests:[]};
      setPlans(prev=>[plan,...prev]);setCreating(false);setTitle('');setBody('');setLocation(newLocationDraft(location.neighborhood));setTime('');setFilter('yours');setNotice('Invitation created in this tab only. '+(kind==='date'?'Interested members must request; you choose one person.':'People can join and talk in the plan room.'));
    }catch(e){setLocationError(e instanceof Error?e.message:'Check the meeting location.');}
  }
  function editMeetingPlace(){if(!room||room.owner!==viewer)return;setRoomLocation({neighborhood:room.location.neighborhood,choice:room.location.venue?'venue':'together',venue:room.location.venue||'',visibility:room.location.visibility,publicPlace:false});setRoomLocationError('');setEditingPlace(true);}
  function saveMeetingPlace(e:React.FormEvent){e.preventDefault();if(!room||room.owner!==viewer)return;try{update({...room,location:saveLocation(roomLocation,room.kind)});setEditingPlace(false);setNotice('Meeting location updated in the demo. Eligible participants can see it in this conversation. No notification was sent.');}catch(e){setRoomLocationError(e instanceof Error?e.message:'Check the meeting location.');}}
  function send(e:React.FormEvent){e.preventDefault();if(!room)return;const key=viewer+':'+room.id;const text=(drafts[key]||'').trim();if(!text)return;setMessages(prev=>({...prev,[room.id]:[...(prev[room.id]||[]),{person:viewer,body:text}]}));setDrafts(prev=>({...prev,[key]:''}));}

  return <div className={`${s.app} ${mobile?s.mobile:''}`}>
    <div className={s.demoTools}><span>Try both sides of a date</span><label>Preview as<select value={viewer} onChange={e=>switchViewer(e.target.value)}><option value="jamie">Jamie · guest</option><option value="noah">Noah · host</option><option value="taylor">Taylor · other member</option></select></label></div>
    <nav className={s.nav} aria-label="Home navigation"><a className={s.brand} href="#home">Not<span>Cupid</span><i>connections, in real life</i></a><div className={s.navItems}><button className={s.current} onClick={()=>setFilter('discover')}>Home</button><button onClick={()=>setFilter('dates')}>Love</button><button onClick={()=>setFilter('friends')}>Friends</button><button onClick={()=>{returnFocus.current=document.activeElement as HTMLElement;setSheet(true);if(!roomId&&joined[0])setRoomId(joined[0].id);}}>Messages <span>{joined.length}</span></button></div><Avatar id={viewer}/></nav>
    <main id="home" className={s.main}>
      <header className={s.welcome}><div><span className={s.eyebrow}>YOUR HOME · BOSTON, MA</span><h1>Good to see you, {me.name}.</h1><p>A familiar face. A new connection. Something to look forward to.</p></div><button className={s.primary} onClick={()=>setCreating(v=>!v)}>＋ Invite someone</button></header>
      <div className={s.highlights}>
        <button className={s.nextCard} onClick={()=>upcoming?openRoom(upcoming.id):setCreating(true)}><span className={s.eyebrow}>COMING UP</span><strong>{upcoming?.title||'Leave a little room for good company.'}</strong><span>{upcoming?`${upcoming.time} · ${upcoming.members.length} people`:'Your next get-together starts with an invitation.'}</span><b>{upcoming?'Continue the conversation ↗':'Invite someone ↗'}</b></button>
        <button className={s.checkIn} onClick={()=>{setFilter('yours');setNotice(requests?'Your incoming requests are shown below.':'Your invitations and joined plans are shown below.');}}><span className={s.eyebrow}>YOUR CONNECTIONS</span><strong>{requests?`${requests} ${requests===1?'person is':'people are'} interested`:`${joined.length} ${joined.length===1?'conversation':'conversations'} to come back to`}</strong><span>{requests?'You decide who joins your date.':'Pick up where you left off.'}</span><b>{requests?'Review your requests ↗':'See your circle ↗'}</b></button>
      </div>
      {notice&&<div className={s.notice} role="status"><span>{notice}</span><button aria-label="Dismiss notice" onClick={()=>setNotice('')}>×</button></div>}
      {creating&&<form className={s.create} onSubmit={create} aria-label="Create an invitation"><div className={s.sectionHead}><div><span className={s.eyebrow}>START SOMETHING</span><h2>What would you like to do?</h2></div><button type="button" onClick={()=>setCreating(false)}>Close</button></div>
        <label>Your invitation<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} maxLength={140} placeholder="A walk around the Common after work?" required/></label>
        <fieldset><legend>What kind of connection?</legend><div className={s.choiceRow}><label><input type="radio" name="kind" checked={kind==='friends'} onChange={()=>setKind('friends')}/> Friendship</label><label><input type="radio" name="kind" checked={kind==='date'} onChange={()=>setKind('date')}/> A date for two</label></div></fieldset>
        {kind==='date'?<div className={s.dateSetup}><p><strong>Just you + one person.</strong> You review requests and accept one. Then your invitation becomes a private date.</p><fieldset><legend>How do you want to meet?</legend><div className={s.modeGrid}><label><input type="radio" name="mode" checked={mode==='profile'} onChange={()=>setMode('profile')}/><strong>Profile first</strong><span>See each other’s profile before choosing.</span></label><label><input type="radio" name="mode" checked={mode==='blind'} onChange={()=>setMode('blind')}/><strong>Blind date</strong><span>Names and profile details stay hidden until acceptance.</span></label></div></fieldset><fieldset><legend>Who would you like to date?</legend><div className={s.choiceRow}>{genders.map(g=><label key={g}><input type="checkbox" checked={seeks.includes(g)} onChange={()=>setSeeks(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}/>{genderLabel[g]}</label>)}</div></fieldset><p className={s.caption}>Your sample profile: {me.gender}, {me.age}. Both people’s dating preferences must align. Blind mode still shows age, gender, and interests; it is not guaranteed anonymity.</p></div>:<label>People, including you<select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}><option value={2}>2 · one-on-one</option><option value={4}>4 · small group</option><option value={6}>6 · small group</option></select></label>}
        <LocationFields value={location} onChange={setLocation} kind={kind}/>
        {locationError&&<p role="alert">{locationError}</p>}
        <details><summary>Optional details · when, a little more</summary><div className={s.formDetails}><label>When<input value={time} onChange={e=>setTime(e.target.value)} placeholder="Sunday around noon, or keep it flexible" maxLength={100}/></label><label>A little more<textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={1000}/></label></div></details><div className={s.sectionHead}><small>Sample invitation only. Meet in public.</small><button className={s.primary} disabled={!title.trim()||!location.neighborhood||(kind==='date'&&!seeks.length)}>Create invitation</button></div>
      </form>}
      <div className={s.columns}><section aria-label="Discover invitations" className={s.feed}><div className={s.sectionHead}><div><span className={s.eyebrow}>A LITTLE CLOSER TO YOUR PEOPLE</span><h2>Around you</h2></div><span className={s.local}>Boston ↗</span></div><nav className={s.filters} aria-label="Discover filters">{[['discover','Discover'],['friends','Friends'],['dates','Dates'],['yours','Your invitations']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key);setProfile(null);}}>{label}{key==='yours'&&requests>0?` · ${requests}`:''}</button>)}</nav>
      <div className={s.cards}>{shown.map(plan=>{
        const owner=people[plan.owner],mine=plan.owner===viewer,dating=plan.kind==='date',blind=dating&&plan.mode==='blind'&&!plan.confirmed;
        const pending=plan.requests.some(r=>r.user===viewer&&r.status==='pending');
        const full=plan.members.length>=plan.capacity;
        const personVisible=!blind||mine;
        return <article key={plan.id} className={`${s.card} ${dating?s.dateCard:''}`} aria-label={plan.title}>
          <div className={`${s.cardStrip} ${dating?s.rose:s.sage}`}><span>{plan.category}</span><span>{dating?(plan.confirmed?'PRIVATE · 2 PEOPLE':plan.mode==='blind'?'BLIND DATE':'PROFILE FIRST'):'FRIENDSHIP'}</span></div>
          <div className={s.cardBody}><div className={s.host}><Avatar id={owner.id} blind={blind&&!mine}/><div><strong>{mine?'Your invitation':personVisible?owner.name:'A little mystery'}</strong><span>{dating?`${owner.gender}, ${owner.age} · interested in ${plan.seeks?.map(g=>genderLabel[g].toLowerCase()).join(', ')}`:'Someone nearby, up for good company'}</span></div></div>
            <h3>{plan.title}</h3><p>{plan.body}</p><div className={s.planMeta}><span>◷ {plan.time}</span></div><LocationDetails plan={plan} viewer={viewer}/>
            <div className={s.capacity}><span>{dating?(plan.confirmed?'Just the two of you · confirmed':pending?'Your request is with the host':'2 people only · host chooses'):`${plan.members.length} joining · ${Math.max(0,plan.capacity-plan.members.length)} ${plan.capacity-plan.members.length===1?'spot':'spots'} open`}</span>{dating&&blind&&<span>Profiles hidden</span>}</div>
            {dating&&!mine&&!plan.confirmed&&<>{blind?<p className={s.caption}>Shared interests: {owner.interests.filter(i=>me.interests.includes(i)).join(', ')||'Get to know each other after acceptance'}. Profile reveals only after you request and the host accepts.</p>:<button className={s.textButton} onClick={()=>setProfile(profile===plan.id?null:plan.id)}>{profile===plan.id?'Hide profile':'View profile →'}</button>}{profile===plan.id&&!blind&&<div className={s.profile}><strong>{owner.name}, {owner.age}</strong><p>{owner.bio}</p><span>{owner.interests.join(' · ')}</span></div>}</>}
            {dating&&mine&&!plan.confirmed&&<div className={s.requests}><h4>Interested in your date</h4>{!plan.requests.some(r=>r.status==='pending')?<p className={s.caption}>No requests yet. You’ll choose who to accept here.</p>:plan.requests.filter(r=>r.status==='pending').map(r=><div className={s.request} key={r.user}><div className={s.host}><Avatar id={r.user} blind={blind}/><div><strong>{blind?'Interested guest':people[r.user].name}</strong><span>{people[r.user].gender}, {people[r.user].age}</span></div></div>{blind?<p className={s.caption}>Shared interests: {people[r.user].interests.filter(i=>owner.interests.includes(i)).join(', ')||'Explore together'} · Profile hidden until you accept.</p>:<><button className={s.textButton} onClick={()=>setProfile(profile===plan.id+':'+r.user?null:plan.id+':'+r.user)}>Review profile →</button>{profile===plan.id+':'+r.user&&<div className={s.profile}><p>{people[r.user].bio}</p><span>{people[r.user].interests.join(' · ')}</span></div>}</>}<div className={s.actions}><button className={s.primary} onClick={()=>accept(plan,r.user)}>Accept request</button><button onClick={()=>{update({...plan,requests:plan.requests.map(item=>item.user===r.user?{...item,status:'passed'}:item)});setNotice('Request declined in the demo. No chat was opened.');}}>Pass</button></div></div>)}</div>}
            <div className={s.actions}>{canChat(plan,viewer)?<button className={s.primary} onClick={()=>openRoom(plan.id)}>{dating?'Open private date chat ↗':'Open conversation ↗'}</button>:!mine&&<button className={s.primary} disabled={dating?!!plan.confirmed||!dateEligible(plan,me):full} onClick={()=>respond(plan)}>{dating?(pending?'Withdraw request':dateEligible(plan,me)?'I’m interested →':'Preferences don’t align'):full?'This table is full':'Join this plan →'}</button>}{!mine&&!canChat(plan,viewer)&&!pending&&<button className={s.quiet} onClick={()=>setPassed(prev=>[...prev,plan.id])}>Not now</button>}{!dating&&plan.members.includes(viewer)&&!mine&&<button className={s.quiet} onClick={()=>{update({...plan,members:plan.members.filter(id=>id!==viewer)});if(roomId===plan.id){setRoomId(null);setSheet(false);}setNotice('You left this sample plan. Your spot is available again.');}}>Leave plan</button>}</div>
          </div></article>;
      })}</div>
      {!shown.length&&<div className={s.empty}><h3>A little quiet here.</h3><p>Start something you’d genuinely like to do, or try another view.</p><button onClick={()=>setCreating(true)}>Invite someone</button></div>}
      {passed.length>0&&<button className={s.restore} onClick={()=>setPassed([])}>Show {passed.length} hidden invitation{passed.length===1?'':'s'} again</button>}
      </section>
      {mobile&&sheet&&<div className={s.backdrop} onClick={()=>setSheet(false)}/>}
      <aside ref={aside} className={`${s.sidebar} ${sheet?s.sheetOpen:''}`} role={mobile&&sheet?'dialog':undefined} aria-modal={mobile&&sheet?true:undefined} aria-label="Your conversations">
        <div className={s.roomHeading}><div><span className={s.eyebrow}>KEEP THE CONNECTION GOING</span><h2>Your conversations</h2></div><button aria-label="Close conversations" className={s.closeChat} onClick={()=>{setSheet(false);if(!mobile)setRoomId(null);}}>×</button></div>
        <div className={s.roomList}>{joined.map(p=><button key={p.id} aria-pressed={room?.id===p.id} onClick={()=>{setRoomId(p.id);setEditingPlace(false);setRoomLocationError('');}}><span>{p.kind==='date'?'♡':'↗'}</span><span><strong>{p.title}</strong><small>{p.kind==='date'?'Private date · just two':`${p.members.length} people · plan chat`}</small></span></button>)}</div>
        {room?<><div className={s.roomTitle}><h3>{room.title}</h3><p>{room.kind==='date'?'Only you and '+people[room.owner===viewer?room.confirmed!:room.owner].name:'With '+room.members.filter(id=>id!==viewer).map(id=>people[id].name).join(', ')}</p>{room.kind==='date'&&<div className={s.reveal}><Avatar id={room.owner===viewer?room.confirmed!:room.owner}/><span><strong>{people[room.owner===viewer?room.confirmed!:room.owner].name}, {people[room.owner===viewer?room.confirmed!:room.owner].age}</strong><small>{room.mode==='blind'?'You both chose this. Profiles are now revealed.':'Your private date is confirmed.'}</small></span></div>}{room.kind==='date'&&<><button className={s.textButton} onClick={()=>setProfile(profile==='room:'+room.id?null:'room:'+room.id)}>View their profile →</button>{profile==='room:'+room.id&&<div className={s.profile}><p>{people[room.owner===viewer?room.confirmed!:room.owner].bio}</p><span>{people[room.owner===viewer?room.confirmed!:room.owner].interests.join(' · ')}</span></div>}</>}<LocationDetails plan={room} viewer={viewer}/>{room.owner===viewer&&!editingPlace&&<button className={s.textButton} onClick={editMeetingPlace}>{room.location.venue?'Edit meeting place':'Set meeting place'}</button>}</div>{editingPlace&&room.owner===viewer&&<form className={`${s.create} ${s.roomLocationForm}`} onSubmit={saveMeetingPlace} aria-label="Update meeting place"><LocationFields value={roomLocation} onChange={setRoomLocation} kind={room.kind}/>{roomLocationError&&<p role="alert">{roomLocationError}</p>}<div className={s.actions}><button className={s.primary}>Save meeting place</button><button type="button" onClick={()=>setEditingPlace(false)}>Cancel</button></div></form>}<div className={s.messages} aria-label="Conversation messages" aria-live="polite">{(messages[room.id]||[]).map((m,i)=><div key={i} className={`${s.message} ${m.person===viewer?s.mine:''}`}><small>{m.person===viewer?'You':people[m.person].name}</small><p>{m.body}</p></div>)}{!(messages[room.id]||[]).length&&<p className={s.chatEmpty}>A new connection starts here.<br/>Say hello and agree on the details.</p>}</div><form className={s.messageForm} onSubmit={send}><label className={s.srOnly} htmlFor="plan-message">Message this plan</label><textarea id="plan-message" placeholder="Say something…" rows={2} maxLength={1000} value={drafts[viewer+':'+room.id]||''} onChange={e=>setDrafts(prev=>({...prev,[viewer+':'+room.id]:e.target.value}))}/><button className={s.primary} disabled={!(drafts[viewer+':'+room.id]||'').trim()}>Send</button></form><p className={s.sandboxNote}>Sample chat. Nothing is sent to real people.</p></>:<div className={s.chatEmpty}><span className={s.chatIcon}>↗</span><h3>Good conversations live here.</h3><p>Join a friendship plan, or accept a date request. Your chat will open in this panel.</p></div>}
      </aside></div>
      <footer className={s.footer}>NotCupid · A little less scrolling. A little more connection.<span>Need a hand? AI coaching stays optional.</span></footer>
    </main>
    {mobile&&!sheet&&<button className={s.mobileChat} onClick={()=>{returnFocus.current=document.activeElement as HTMLElement;setSheet(true);}}>Messages · {joined.length}</button>}
  </div>;
}
