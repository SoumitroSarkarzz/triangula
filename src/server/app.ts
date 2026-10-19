import express from 'express';
import {createServer} from 'node:http';
import {Server,Socket} from 'socket.io';
import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import path from 'node:path';
import type {Room,Action,Reply,Settings} from '../shared/types.js';
import {generate} from './board.js';
import {newGame,play,finish} from './engine.js';
type Session={token:string; room:string; playerId:string; socketId:string|null; seen:Map<string,Reply>};
export function createApp(options:{graceMs?:number;ttlMs?:number;origins?:string[]}={}){
 const app=express(), http=createServer(app),rooms=new Map<string,Room>(),sessions=new Map<string,Session>();
 const graceMs=options.graceMs??120000,ttlMs=options.ttlMs??14400000,lastActive=new Map<string,number>();
 const localOrigins=['http://localhost:3000','http://127.0.0.1:3000','http://localhost:5173','http://127.0.0.1:5173'];
 const allowed=new Set([...localOrigins,...(options.origins??[])]);
 const io=new Server(http,{maxHttpBufferSize:8192,allowRequest(req,cb){const origin=req.headers.origin;cb(null,!origin||allowed.has(origin));}});
 app.disable('x-powered-by');app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'");next();});
 app.get('/health',(_req,res)=>res.json({ok:true,service:'triangula'}));
 app.use(express.static(path.resolve('dist/public')));
 app.get('/',(_req,res)=>res.sendFile(path.resolve('dist/public/index.html')));
 function broadcast(room:Room){room.revision++;lastActive.set(room.code,Date.now());io.to(room.code).emit('state',structuredClone(room));}
 function auth(socket:Socket){const s=sessions.get(socket.data.token);if(!s||s.socketId!==socket.id)throw Error('Your seat is not authenticated. Rejoin the room.');const room=rooms.get(s.room);if(!room)throw Error('This room expired or the server restarted. Create a new room.');return {s,room,player:room.players.find(p=>p.id===s.playerId)!};}
 function nameOf(v:unknown){if(typeof v!=='string'||!v.trim()||v.trim().length>20||/[\u0000-\u001f\u007f]/.test(v))throw Error('Enter a name of 1–20 characters.');return v.trim();}
 function codeOf(v:unknown){if(typeof v!=='string'||! /^[A-HJ-NP-Z2-9]{8}$/.test(v))throw Error('Room codes contain eight letters or numbers.');return v;}
 function settingsOf(v:unknown):Settings{const s=v as Settings;if(!s||![12,20,30].includes(s.size)||!['jitter','scatter'].includes(s.layout))throw Error('Choose a supported board size and layout.');return {size:s.size,layout:s.layout};}
 const buckets=new Map<string,{count:number;until:number}>();
 function rate(key:string,max:number,window=10000){let b=buckets.get(key);if(!b||Date.now()>b.until){b={count:0,until:Date.now()+window};buckets.set(key,b);}if(++b.count>max)throw Error('Too many requests. Wait a moment and try again.');}
 function wrap(socket:Socket,event:string,fn:(data:any)=>Reply){socket.on(event,(data,ack)=>{if(typeof ack!=='function')return;try{rate(`socket:${socket.id}`,80);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid request.');ack(fn(data));}catch(e){ack({ok:false,error:e instanceof Error?e.message:'Request failed.'});}});}
 function bind(socket:Socket,room:Room,playerId:string,token?:string){
  if(socket.data.token)throw Error('Leave your current room first.');
  const t=token??randomBytes(32).toString('hex');const s:Session={token:t,room:room.code,playerId,socketId:socket.id,seen:new Map()};sessions.set(t,s);socket.data.token=t;socket.join(room.code);return s;
 }
 io.on('connection',socket=>{
  wrap(socket,'create',data=>{rate(`create:${socket.handshake.address}`,8,60000);const name=nameOf(data.name);if(socket.data.token)throw Error('Leave your current room first.');if(rooms.size>=1000)throw Error('Server is busy. Try again later.');let code='';do{code=Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');}while(rooms.has(code));
   const id=randomUUID(),settings:Settings={size:20,layout:'jitter'},seed=randomInt(0x7fffffff);const room:Room={code,revision:0,hostId:id,players:[{id,name,ready:true,connected:true,disconnectedAt:null}],settings,seed,preview:generate(seed,settings),phase:'lobby',game:null,rematch:[],graceMs};rooms.set(code,room);const s=bind(socket,room,id);broadcast(room);return {ok:true,room,token:s.token,playerId:id};});
  wrap(socket,'join',data=>{rate(`join:${socket.handshake.address}`,30,60000);const code=codeOf(data.code),name=nameOf(data.name),room=rooms.get(code);if(!room)throw Error('Room not found. It may have expired or the server restarted. Ask for a new invite.');if(room.players.length>=2||room.phase!=='lobby')throw Error('This room is full or already playing.');if(socket.data.token)throw Error('Leave your current room first.');const id=randomUUID();room.players.push({id,name,ready:false,connected:true,disconnectedAt:null});const s=bind(socket,room,id);broadcast(room);return {ok:true,room,token:s.token,playerId:id};});
  wrap(socket,'resume',data=>{if(typeof data.token!=='string'||! /^[a-f0-9]{64}$/.test(data.token))throw Error('Invalid reconnect token.');const s=sessions.get(data.token),room=s&&rooms.get(s.room);if(!s||!room)throw Error('Your saved room expired or the server restarted. Create or join a new room.');if(socket.data.token&&socket.data.token!==s.token)throw Error('Already connected to another room.');const player=room.players.find(p=>p.id===s.playerId);if(!player)throw Error('Your seat has expired. Join again.');if(s.socketId&&s.socketId!==socket.id){const old=io.sockets.sockets.get(s.socketId);if(old){old.data.token=null;old.emit('replaced');old.disconnect(true);}}
   s.socketId=socket.id;socket.data.token=s.token;socket.join(room.code);player.connected=true;player.disconnectedAt=null;broadcast(room);return {ok:true,room,playerId:player.id};});
  wrap(socket,'action',(data:Action)=>{
   const {s,room,player}=auth(socket);if(typeof data.actionId!=='string'||! /^[a-zA-Z0-9-]{8,80}$/.test(data.actionId))throw Error('Invalid action ID.');
   const previous=s.seen.get(data.actionId);if(previous)return {...previous,room};
   if(data.revision!==room.revision)throw Error('The board changed. Your view has been refreshed; try again.');
   if(data.matchId!==(room.game?.id??null))throw Error('That action belongs to an earlier match.');
   const index=room.players.indexOf(player),host=room.hostId===player.id;
   const requireLobby=()=>{if(room.phase!=='lobby')throw Error('This action is only available in the lobby.');};
   const requireBoth=()=>{if(room.players.length!==2||room.players.some(p=>!p.connected))throw Error('Play is paused while a player reconnects.');};
   switch(data.type){
    case 'ready':requireLobby();player.ready=!player.ready;break;
    case 'settings':case 'regenerate':requireLobby();if(!host)throw Error('Only the host can change the board.');if(data.type==='settings')room.settings=settingsOf(data.settings);room.seed=randomInt(0x7fffffff);room.preview=generate(room.seed,room.settings);room.players.forEach(p=>p.ready=p.id===room.hostId);break;
    case 'start':requireLobby();requireBoth();if(!host||room.players.some(p=>!p.ready))throw Error('Both players must be ready; only the host can start.');room.game=newGame(room.preview,randomInt(2));room.phase='match';break;
    case 'move':{rate(`move:${s.token}`,30);if(room.phase!=='match')throw Error('No match is in progress.');requireBoth();if(!Array.isArray(data.edge)||data.edge.length!==2)throw Error('Choose two dots.');const error=play(room.game!,index,data.edge);if(error)throw Error(error);if(room.game!.reason)room.phase='results';break;}
    case 'resign':if(room.phase!=='match')throw Error('No active match.');finish(room.game!,'resignation',1-index);room.phase='results';break;
    case 'claim':{if(room.phase!=='match')throw Error('No active match.');const other=room.players[1-index];if(!other||other.connected||other.disconnectedAt===null||Date.now()-other.disconnectedAt<graceMs)throw Error('The reconnect grace period has not ended.');finish(room.game!,'disconnect',index);room.phase='results';break;}
    case 'rematch':if(room.phase!=='results')throw Error('Finish this match first.');requireBoth();if(!room.rematch.includes(player.id))room.rematch.push(player.id);if(room.rematch.length===2){room.seed=randomInt(0x7fffffff);room.preview=generate(room.seed,room.settings);room.game=newGame(room.preview,1-room.game!.starter);room.rematch=[];room.phase='match';}break;
    case 'lobby':if(room.phase!=='results')throw Error('Finish this match first.');room.phase='lobby';room.game=null;room.rematch=[];room.players=room.players.filter(p=>p.connected);if(!room.players.some(p=>p.id===room.hostId))room.hostId=player.id;room.players.forEach(p=>p.ready=p.id===room.hostId);break;
    case 'leave':if(room.phase==='match'){finish(room.game!,'resignation',1-index);room.phase='results';}socket.leave(room.code);socket.data.token=null;sessions.delete(s.token);if(room.phase==='lobby'){room.players=room.players.filter(p=>p.id!==player.id);if(host&&room.players.length)room.hostId=room.players[0].id;room.players.forEach(p=>p.ready=p.id===room.hostId);}else{player.connected=false;player.disconnectedAt=Date.now();}break;
    default:throw Error('Unknown action.');
   }
   broadcast(room);const reply={ok:true,room};s.seen.set(data.actionId,reply);if(s.seen.size>256)s.seen.delete(s.seen.keys().next().value!);return reply;
  });
  socket.on('disconnect',()=>{const s=sessions.get(socket.data.token);if(!s||s.socketId!==socket.id)return;s.socketId=null;const room=rooms.get(s.room),p=room?.players.find(p=>p.id===s.playerId);if(room&&p){p.connected=false;p.disconnectedAt=Date.now();broadcast(room);}});
 });
 const timer=setInterval(()=>{const now=Date.now();for(const [code,room]of rooms){if(room.phase==='lobby'){const gone=room.players.filter(p=>!p.connected&&p.disconnectedAt!==null&&now-p.disconnectedAt>graceMs);if(gone.length){room.players=room.players.filter(p=>!gone.includes(p));for(const [t,s]of sessions)if(s.room===code&&gone.some(p=>p.id===s.playerId))sessions.delete(t);if(room.players.length&&!room.players.some(p=>p.id===room.hostId)){room.hostId=room.players[0].id;room.players[0].ready=true;}broadcast(room);}}
  if(!room.players.some(p=>p.connected)&&now-(lastActive.get(code)??0)>ttlMs){rooms.delete(code);lastActive.delete(code);for(const [t,s]of sessions)if(s.room===code)sessions.delete(t);}}
  for(const [k,b]of buckets)if(now>b.until)buckets.delete(k);
 },1000);timer.unref();
 return {app,http,io,rooms,allowOrigin:(origin:string)=>allowed.add(origin),close:async()=>{clearInterval(timer);await new Promise<void>(resolve=>io.close(()=>resolve()));}};
}
