// Explicit opt-in runner: use an existing synthetic is_test account, never a
// real/admin session. Run only a localhost app; no emails/messages are sent.
import {createClient} from '@supabase/supabase-js';
import {createHmac,createHash,randomBytes} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import https from 'node:https';

if(process.env.E2E_ALLOW_TEST_REALM!=='1')throw Error('Set E2E_ALLOW_TEST_REALM=1 to authorize the isolated test-account session.');
const base='https://127.0.0.1:3117';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw Error('Test runner only allows a local app.');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:users,error}=await db.from('users').select('id,email,is_test')
 .eq('is_test',true).is('deleted_at',null).eq('pool_active',true).neq('is_blocked',true).order('id').limit(10);
if(error)throw Error('Could not resolve test account');
const admins=new Set((process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()));
const user=users?.find(u=>u.is_test===true&&!admins.has(u.email?.toLowerCase()));
if(!user)throw Error('No eligible synthetic test account is available.');
const exp=Date.now()+5*60*1000;
// Ephemeral local signer: never change or depend on the production login key.
const secret=randomBytes(32).toString('hex');
const sig=createHmac('sha256',secret).update(`${user.id}.${exp}`).digest('base64url');
const tlsDir=mkdtempSync(join(tmpdir(),'notcupid-qa-tls-'));
const keyPath=join(tlsDir,'key.pem'),certPath=join(tlsDir,'cert.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=127.0.0.1'],{stdio:'ignore'});
const server=spawn(process.execPath,['scripts/test-https-server.mjs'],{
 stdio:'ignore',env:{...process.env,MATCH_LINK_SECRET:secret,E2E_LOCAL_HTTPS:'1',E2E_TLS_KEY:keyPath,E2E_TLS_CERT:certPath},
});
function localGet(path){return new Promise((resolve,reject)=>{
 // Trust only this ephemeral localhost test certificate, never remote traffic.
 const request=https.get(base+path,{rejectUnauthorized:false,timeout:1500},response=>{
  response.resume();resolve({status:response.statusCode,headers:response.headers});
 });request.on('error',reject);request.on('timeout',()=>request.destroy(new Error('Local test timeout')));
});}
let token;
try{
 let ready=false;
 for(let attempt=0;attempt<30;attempt++){
  if(server.exitCode!==null)throw Error('Local test server failed to start.');
  try{ready=(await localGet('/login')).status===200;}catch{}
  if(ready)break;await new Promise(r=>setTimeout(r,500));
 }
 if(!ready)throw Error('Local test server was not ready.');
 const login=await localGet(`/api/dev-login?u=${user.id}&exp=${exp}&sig=${sig}`);
 token=login.headers['set-cookie']?.join(';')?.match(/nc_session=([^;]+)/)?.[1];
 if(!token||login.status!==307)throw Error('Test-only login failed');
 console.log('Running authenticated mobile checks with an isolated is_test account. No credentials are logged.');
 const code=await new Promise((resolve,reject)=>{
  const child=spawn('npm',['run','test:e2e:release','--','e2e/public-mobile.spec.ts'],{stdio:'inherit',env:{...process.env,E2E_BASE_URL:base,E2E_TEST_SESSION:token,E2E_LOCAL_HTTPS:'1'}});
  child.on('error',reject);child.on('exit',resolve);
 });
 process.exitCode=code === 0 ? 0 : 1;
}finally{
 server.kill('SIGTERM');
 unlinkSync(keyPath);unlinkSync(certPath);rmdirSync(tlsDir);
 if(token){
 const tokenHash=createHash('sha256').update(token).digest('hex');
 const{error:cleanupError}=await db.from('sessions').delete().eq('token',tokenHash).eq('user_id',user.id);
 if(cleanupError){console.error('Temporary test session cleanup failed.');process.exitCode=1;}
 else console.log('Temporary test session removed.');
 }
}
