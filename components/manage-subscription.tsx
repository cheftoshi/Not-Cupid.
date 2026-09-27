'use client';
import {useState} from 'react';
import {confirmDialog} from '@/components/feedback';

export default function ManageSubscription() {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div><button type="button" disabled={busy} onClick={async()=>{
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/pro/portal',{method:'POST'}),data=await response.json();
      if(!response.ok || !data.url) throw Error(data.error || 'Could not open billing settings.');
      window.location.assign(data.url);
    } catch(e) {setError(e instanceof Error?e.message:'Could not open billing settings.');}
    finally {setBusy(false);}
  }}>{busy?'Opening billing…':'Manage subscription'}</button>
  <button type="button" disabled={busy} onClick={async()=>{
    if(!await confirmDialog({title:'Cancel Pro renewal?',body:'Keep your paid access through the current billing period. It will not renew.',confirmLabel:'Cancel renewal'}))return;
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/pro/cancel',{method:'POST'}),data=await response.json();
      setError(response.ok?data.message:data.error || 'Cancellation was not confirmed.');
    } catch {setError('Cancellation was not confirmed. Please retry.');}
    finally {setBusy(false);}
  }}>Cancel renewal</button>{error && <p role="status">{error}</p>}</div>;
}
