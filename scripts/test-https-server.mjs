// Local QA only. Production keeps Vercel TLS and the normal security headers.
import https from 'node:https';
import {readFileSync} from 'node:fs';
import next from 'next';
if(process.env.E2E_LOCAL_HTTPS!=='1')throw Error('Local QA server only');
const app=next({dev:false,hostname:'127.0.0.1',port:3117});
await app.prepare();
https.createServer({key:readFileSync(process.env.E2E_TLS_KEY),cert:readFileSync(process.env.E2E_TLS_CERT)},app.getRequestHandler()).listen(3117,'127.0.0.1');
