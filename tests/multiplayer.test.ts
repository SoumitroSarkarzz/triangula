import {test} from 'node:test';
import assert from 'node:assert/strict';
import {io,Socket} from 'socket.io-client';
import type {AddressInfo} from 'node:net';
import {createApp} from '../src/server/app.js';
import {illegal} from '../src/shared/geometry.js';
import type {Action,Room,Reply,Edge} from '../src/shared/types.js';
const request=(s:Socket,event:string,data:unknown)=>new Promise<Reply>((resolve,reject)=>s.timeout(3000).emit(event,data,(err:Error|null,r:Reply)=>err?reject(err):resolve(r)));
const connect=(url:string)=>new Promise<Socket>((resolve,reject)=>{const s=io(url,{forceNew:true,reconnection:false,transports:['websocket']});s.once('connect',()=>resolve(s));s.once('connect_error',reject);});
const action=(r:Room,type:Action['type'],extra:Partial<Action>={}):Action=>({type,actionId:crypto.randomUUID(),revision:r.revision,matchId:r.game?.id??null,...extra});
const delay=(n=30)=>new Promise(resolve=>setTimeout(resolve,n));
test('real two-client room lifecycle, authority, retries, reconnect, rematch, complete match',async()=>{
 const server=createApp({graceMs:50});await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;const clients:Socket[]=[];
 try{
  const a=await connect(url),b=await connect(url),third=await connect(url);clients.push(a,b,third);
  assert.equal((await request(a,'create',{name:' '})).ok,false);
  const created=await request(a,'create',{name:'A <script>'});assert.ok(created.ok);let r=created.room!;const at=created.token!;
  assert.ok(/^[a-f0-9]{64}$/.test(at));assert.ok(!JSON.stringify(r).includes(at));
  assert.equal((await request(b,'join',{name:'B',code:'INVALID!'})).ok,false);
  const joined=await request(b,'join',{name:'B',code:r.code});assert.ok(joined.ok);r=joined.room!;const bt=joined.token!;
  assert.equal((await request(third,'join',{name:'C',code:r.code})).ok,false);
  assert.equal((await request(third,'action',action(r,'start'))).ok,false);
  r=(await request(a,'action',action(r,'settings',{settings:{size:12,layout:'scatter'}}))).room!;
  assert.equal((await request(a,'action',action(r,'start'))).ok,false);
  r=(await request(b,'action',action(r,'ready'))).room!;
  r=(await request(a,'action',action(r,'start'))).room!;const firstStarter=r.game!.starter,firstId=r.game!.id;
  const who=r.game!.turn===0?a:b,wrong=who===a?b:a;const before=JSON.stringify(r.game);
  assert.equal((await request(wrong,'action',action(r,'move',{edge:[0,1]}))).ok,false);assert.equal(JSON.stringify(server.rooms.get(r.code)!.game),before);
  const stale=action(r,'move',{revision:r.revision-1,edge:[0,1]});assert.equal((await request(who,'action',stale)).ok,false);
  assert.equal((await request(who,'action',action(r,'move',{matchId:'old-match',edge:[0,1]}))).ok,false);
  const move=action(r,'move',{edge:[0,1]});const accepted=await request(who,'action',move);assert.ok(accepted.ok);r=accepted.room!;
  const duplicate=await request(who,'action',move);assert.ok(duplicate.ok);assert.equal(duplicate.room!.game!.history.length,1);assert.equal(duplicate.room!.revision,r.revision);
  b.disconnect();await delay();r=server.rooms.get(r.code)!;assert.equal(r.players[1].connected,false);
  const snapshot=JSON.stringify(r.game);assert.equal((await request(a,'action',action(r,'move',{edge:[1,2]}))).ok,false);assert.equal(JSON.stringify(r.game),snapshot);
  const b2=await connect(url);clients.push(b2);assert.equal((await request(b2,'resume',{token:'a'.repeat(64)})).ok,false);const resumed=await request(b2,'resume',{token:bt});assert.ok(resumed.ok);r=resumed.room!;assert.ok(r.players.every(p=>p.connected));
  let stateA:Room|undefined,stateB:Room|undefined;a.on('state',s=>stateA=s);b2.on('state',s=>stateB=s);
  let count=0;
  while(r.phase==='match'){
   const g=r.game!;let edge:Edge|undefined;for(let i=0;i<g.points.length&&!edge;i++)for(let j=i+1;j<g.points.length;j++)if(!illegal(g.points,g.edges,i,j)){edge=[i,j];break;}
   assert.ok(edge);const result=await request(g.turn===0?a:b2,'action',action(r,'move',{edge}));assert.ok(result.ok,result.error);r=result.room!;assert.ok(++count<100);
  }
  await delay();assert.deepEqual(stateA,stateB);assert.deepEqual(stateA,r);assert.equal(r.game!.reason,'complete');assert.equal(r.game!.scores[0]+r.game!.scores[1],r.game!.hullArea2);
  assert.equal(r.game!.winner,r.game!.scores[0]===r.game!.scores[1]?null:r.game!.scores[0]>r.game!.scores[1]?0:1);
  r=(await request(a,'action',action(r,'rematch'))).room!;assert.equal(r.phase,'results');r=(await request(b2,'action',action(r,'rematch'))).room!;assert.equal(r.phase,'match');assert.notEqual(r.game!.id,firstId);assert.equal(r.game!.starter,1-firstStarter);assert.deepEqual(r.game!.scores,[0,0]);assert.equal(r.game!.edges.length,0);
  assert.equal((await request(a,'action',action(r,'move',{matchId:firstId,edge:[0,1]}))).ok,false);
  r=(await request(b2,'action',action(r,'resign'))).room!;assert.equal(r.game!.winner,0);assert.equal(r.game!.reason,'resignation');
  r=(await request(a,'action',action(r,'lobby'))).room!;assert.equal(r.phase,'lobby');assert.equal(r.game,null);
  r=(await request(a,'action',action(r,'leave'))).room!;assert.equal(r.hostId,joined.playerId);assert.equal(r.players.length,1);
  const a2=await connect(url);clients.push(a2);assert.equal((await request(a2,'resume',{token:at})).ok,false);
 }finally{clients.forEach(s=>s.disconnect());await server.close();}
});
test('disconnect grace requires explicit claim and expired server seats fail clearly',async()=>{
 const server=createApp({graceMs:40});await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;const a=await connect(url),b=await connect(url);
 try{const c=await request(a,'create',{name:'A'});let r=(await request(b,'join',{name:'B',code:c.room!.code})).room!;r=(await request(b,'action',action(r,'ready'))).room!;r=(await request(a,'action',action(r,'start'))).room!;b.disconnect();await delay(10);r=server.rooms.get(r.code)!;assert.equal((await request(a,'action',action(r,'claim'))).ok,false);await delay(60);r=server.rooms.get(r.code)!;assert.equal(r.phase,'match');const result=await request(a,'action',action(r,'claim'));assert.ok(result.ok);assert.equal(result.room!.game!.reason,'disconnect');assert.equal(result.room!.game!.winner,0);
  const code=r.code;server.rooms.delete(code);const result2=await request(a,'resume',{token:c.token});assert.equal(result2.ok,false);assert.match(result2.error!,/expired|restarted/);
 }finally{a.disconnect();b.disconnect();await server.close();}
});
test('origin enforcement rejects arbitrary browser origins',async()=>{const server=createApp({origins:['https://good.example']});await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;try{const s=io(url,{extraHeaders:{Origin:'https://evil.example'},transports:['websocket'],reconnection:false});await new Promise<void>((resolve,reject)=>{s.once('connect_error',()=>{s.disconnect();resolve();});s.once('connect',()=>{s.disconnect();reject(Error('Untrusted origin accepted'));});});}finally{await server.close();}});
