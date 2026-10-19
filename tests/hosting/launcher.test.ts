import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {io} from 'socket.io-client';
import {createServer} from 'node:net';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as {port:number}).port;await new Promise<void>(r=>s.close(()=>r()));return p;}
for(const failure of [false,true])test(`launcher ${failure?'handles tunnel failure and cleans up':'handles spaces, public origin, health and Control+C cleanup'}`,async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'triangula hosting spaces ')),bin=path.join(dir,'tools');await mkdir(bin);await mkdir(path.join(dir,'node_modules'));
 const root=process.cwd(),lock=await readFile(path.join(root,'package-lock.json'));
 await writeFile(path.join(dir,'package-lock.json'),lock);await writeFile(path.join(dir,'node_modules/.triangula-lock'),createHash('sha256').update(lock).digest('hex')+'\n');
 await writeFile(path.join(dir,'Start-Online.command'),await readFile(path.join(root,'Start-Online.command')));await symlink(path.join(root,'dist'),path.join(dir,'dist'));
 await writeFile(path.join(bin,'npm'),'#!/bin/sh\necho "test harness: build already verified"\n',{mode:0o755});
 await writeFile(path.join(bin,'open'),'#!/bin/sh\necho "$1" > "$MOCK_DIR/opened"\n',{mode:0o755});
 await writeFile(path.join(bin,'cloudflared'),`#!/bin/sh\necho $$ > "$MOCK_DIR/tunnel-pid"\nif [ "$MOCK_FAIL" = "yes" ]; then echo 'controlled tunnel failure' >&2; exit 1; fi\necho 'https://controlled-test.trycloudflare.com' >&2\nexec node -e 'setInterval(()=>{},1000)'\n`,{mode:0o755});
 const port=await freePort(),child=spawn('bash',['Start-Online.command'],{cwd:dir,env:{...process.env,PATH:`${bin}:${process.env.PATH}`,PORT:String(port),MOCK_DIR:dir,MOCK_FAIL:failure?'yes':'no'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);const ended=new Promise<number|null>(r=>child.on('exit',r));
 try{
  if(failure){const result=await Promise.race([ended,delay(15000).then(()=>{throw Error('Launcher did not exit');})]);assert.equal(result,1);assert.match(output,/Cloudflare Tunnel exited/);}
  else{
   for(let i=0;i<150&&!output.includes('PLAY ONLINE:');i++){if(child.exitCode!==null)throw Error(output);await delay(100);}assert.match(output,/PLAY ONLINE: https:\/\/controlled-test.trycloudflare.com/);
   const health=await fetch(`http://127.0.0.1:${port}/health`);assert.deepEqual(await health.json(),{ok:true,service:'triangula'});
   const remote=io(`http://127.0.0.1:${port}`,{transports:['websocket'],extraHeaders:{Origin:'https://controlled-test.trycloudflare.com'},reconnection:false});
   try{await new Promise<void>((resolve,reject)=>{remote.once('connect',()=>resolve());remote.once('connect_error',reject);});}finally{remote.disconnect();}
   assert.equal((await readFile(path.join(dir,'opened'),'utf8')).trim(),'https://controlled-test.trycloudflare.com');
   child.kill('SIGINT');assert.equal(await Promise.race([ended,delay(5000).then(()=>{throw Error('Control+C cleanup timed out');})]),130);
  }
  await assert.rejects(fetch(`http://127.0.0.1:${port}/health`));const pid=Number(await readFile(path.join(dir,'tunnel-pid'),'utf8'));assert.throws(()=>process.kill(pid,0));assert.match(output,/Triangula stopped/);
 }finally{if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([ended,delay(5000)]);}await rm(dir,{recursive:true,force:true});}
});
