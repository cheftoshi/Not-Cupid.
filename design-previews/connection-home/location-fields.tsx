'use client';
import {useId} from 'react';
import type {Invitation, LocationDraft} from './model';
import {locationFor, neighborhoods} from './model';
import s from './home.module.css';

export function LocationFields({value,onChange,kind}:{value:LocationDraft;onChange:(value:LocationDraft)=>void;kind:'friends'|'date'}) {
  const id=useId();
  return <fieldset className={s.locationFields}>
    <legend>Where’s it happening?</legend>
    <label>Neighborhood · required<select required value={value.neighborhood} onChange={e=>onChange({...value,neighborhood:e.target.value})}><option value="">Choose a neighborhood</option>{neighborhoods.map(n=><option key={n}>{n}</option>)}</select></label>
    <p className={s.caption}>Boston, MA · Your neighborhood is visible on the invitation. This is a selected area, not your live location.</p>
    <div className={s.choiceRow}><label><input type="radio" name={id+'-place'} checked={value.choice==='together'} onChange={()=>onChange({...value,choice:'together'})}/>Decide together</label><label><input type="radio" name={id+'-place'} checked={value.choice==='venue'} onChange={()=>onChange({...value,choice:'venue'})}/>Add a public place</label></div>
    {value.choice==='venue'&&<>
      <label>Public meeting place<input value={value.venue} onChange={e=>onChange({...value,venue:e.target.value})} maxLength={120} required placeholder="A café name, park entrance, or public venue"/></label>
      <label className={s.confirmPlace}><input type="checkbox" checked={value.publicPlace} onChange={e=>onChange({...value,publicPlace:e.target.checked})} required/>This is a public meeting place, not a home address.</label>
      {kind==='friends'?<fieldset><legend>Who can see the exact place?</legend><div className={s.choiceRow}><label><input type="radio" name={id+'-visibility'} checked={value.visibility==='participants'} onChange={()=>onChange({...value,visibility:'participants'})}/>Joined participants only</label><label><input type="radio" name={id+'-visibility'} checked={value.visibility==='public'} onChange={()=>onChange({...value,visibility:'public'})}/>Everyone viewing the invitation</label></div></fieldset>:<p className={s.privacyNote}>Only you can see the exact place until you accept a date request. Then it is shared with that one person. Pending requests see the neighborhood only.</p>}
    </>}
    {value.choice==='together'&&<p className={s.privacyNote}>No exact place will be published. Agree in chat; the host can set the meeting place there later.</p>}
    <p className={s.caption}>Keep private addresses out of the title and description too. Public-place confirmation is your choice, not venue verification.</p>
  </fieldset>;
}

export function LocationDetails({plan,viewer}:{plan:Invitation;viewer:string}) {
  const view=locationFor(plan,viewer);
  return <div className={s.locationDetails} aria-label="Meeting location"><strong>↗ {view.neighborhood} · Boston</strong><span>{view.status==='decide'?'Decide together · no venue set':view.status==='hidden'?(plan.kind==='date'?'Exact place shared after acceptance':'Exact place shared with joined participants'):view.venue}</span>{view.status==='visible'&&<small>{plan.kind==='date'?'Private date location':plan.location.visibility==='public'?'Public meeting place':'Participants-only location'}</small>}</div>;
}
