import {createApp} from './app.js';
const port=Number(process.env.PORT??3000),host=process.env.HOST??'127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer from 1 to 65535.');
const positive=(name:string,fallback:number)=>{const n=Number(process.env[name]??fallback);if(!Number.isFinite(n)||n<=0)throw Error(`${name} must be positive.`);return n;};
const {http,close}=createApp({graceMs:positive('DISCONNECT_GRACE_MS',120000),ttlMs:positive('ROOM_TTL_MS',14400000),origins:[`http://localhost:${port}`,`http://127.0.0.1:${port}`,...(process.env.ALLOWED_ORIGINS??'').split(',').filter(Boolean)]});
http.on('error',(e:NodeJS.ErrnoException)=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is busy. Choose another PORT.`:`Server failed: ${e.message}`);process.exit(1);});
http.listen(port,host,()=>console.log(`TRIANGULA listening on http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void close().then(()=>process.exit(0));setTimeout(()=>process.exit(1),5000).unref();});
