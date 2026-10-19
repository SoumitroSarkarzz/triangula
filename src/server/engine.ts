import {randomUUID} from 'node:crypto';
import type {Game,Point,Edge} from '../shared/types.js';
import {illegal,canonical,captures,hasLegalMove,hullArea2} from '../shared/geometry.js';
export function newGame(points:Point[],starter:number):Game{return {id:randomUUID(),points:structuredClone(points),edges:[],triangles:[],scores:[0,0],turn:starter,starter,hullArea2:hullArea2(points),history:[],winner:null,reason:null};}
export function finish(game:Game,reason:Game['reason'],winner?:number){game.reason=reason;game.winner=winner??(game.scores[0]===game.scores[1]?null:game.scores[0]>game.scores[1]?0:1);}
export function play(game:Game,player:number,edge:Edge){
 if(game.reason)return 'This match has finished.';
 if(player!==game.turn)return 'It is your opponent’s turn.';
 const error=illegal(game.points,game.edges,...edge);if(error)return error;
 const e=canonical(...edge);game.edges.push(e);const gained=captures(game.points,game.edges,game.triangles,e,player);game.triangles.push(...gained);
 const score=gained.reduce((s,t)=>s+t.area2,0);game.scores[player]+=score;game.history.push({player,edge:e,area2:score,at:Date.now()});
 if(!score)game.turn=1-player;
 if(!hasLegalMove(game.points,game.edges))finish(game,'complete');
 return null;
}
