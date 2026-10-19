import {test} from 'node:test';
import assert from 'node:assert/strict';
import {illegal,area2,captures,hasLegalMove,hullArea2,orient} from '../src/shared/geometry.js';
import {generate,fallbackBoard} from '../src/server/board.js';
import {newGame,play,finish} from '../src/server/engine.js';
import type {Point,Edge} from '../src/shared/types.js';
const square:Point[]=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
test('crossing edges and interior touching are rejected; endpoints may be shared',()=>{
 assert.match(illegal(square,[[0,2]],1,3)!,/cross/);assert.equal(illegal(square,[[0,1]],1,2),null);
 const p=[...square,{x:5,y:5}];assert.match(illegal(p,[[0,2]],1,4)!,/touch/);
});
test('canonical duplicate and reversed edges',()=>{assert.match(illegal(square,[[0,1]],0,1)!,/already/);assert.match(illegal(square,[[0,1]],1,0)!,/already/);});
test('third dots, overlaps, invalid endpoints and identical endpoints',()=>{const p=[{x:0,y:0},{x:5,y:0},{x:10,y:0},{x:0,y:10}];assert.match(illegal(p,[],0,2)!,/another dot/);assert.ok(illegal(p,[[0,2]],0,1));assert.ok(illegal(p,[],0,0));assert.ok(illegal(p,[],0,99));assert.ok(illegal(p,[],.2,1));});
test('exact area and hull denominator',()=>{assert.equal(area2(...square.slice(0,3) as [Point,Point,Point]),100);assert.equal(hullArea2(square),200);assert.equal(area2({x:0,y:0},{x:1,y:0},{x:0,y:1}),1);});
test('empty face capture; enclosing and degenerate triangles excluded',()=>{
 const edges:Edge[]=[[0,1],[1,2],[0,2]];assert.equal(captures(square,edges,[],[0,2],0).length,1);
 assert.equal(captures([...square,{x:8,y:3}],edges,[],[0,2],0).length,0);
 assert.equal(captures([{x:0,y:0},{x:5,y:0},{x:10,y:0}],edges,[],[0,2],0).length,0);
 assert.equal(captures([{x:0,y:0},{x:10,y:0},{x:0,y:10},{x:5,y:0}],edges,[],[0,2],0).length,0);
});
test('double capture, no double score, and game-over detection',()=>{
 const edges:Edge[]=[[0,1],[1,2],[2,3],[0,3],[0,2]];const ts=captures(square,edges,[],[0,2],0);assert.equal(ts.length,2);assert.equal(ts.reduce((s,t)=>s+t.area2,0),200);assert.equal(captures(square,edges,ts,[0,2],1).length,0);assert.equal(hasLegalMove(square,edges),false);assert.equal(hasLegalMove(square,[]),true);
});
test('alternating turns, invalid moves preserve complete state, capturing retains turn',()=>{
 const g=newGame(square,0);assert.equal(play(g,0,[0,1]),null);assert.equal(g.turn,1);const before=structuredClone(g);assert.ok(play(g,0,[0,2]));assert.deepEqual(g,before);assert.ok(play(g,1,[1,0]));assert.deepEqual(g,before);
 assert.equal(play(g,1,[1,2]),null);assert.equal(play(g,0,[0,2]),null);assert.equal(g.turn,0);assert.equal(g.scores[0],100);
});
test('exact ties, normal finish, resignation and reset/starting alternation',()=>{
 const g=newGame(square,0);play(g,0,[0,1]);play(g,1,[1,2]);play(g,0,[0,2]);play(g,0,[2,3]);play(g,1,[0,3]);assert.equal(g.reason,'complete');assert.equal(g.winner,null);assert.deepEqual(g.scores,[100,100]);
 const next=newGame(square,1-g.starter);assert.equal(next.starter,1);assert.deepEqual(next.scores,[0,0]);assert.equal(next.edges.length,0);assert.notEqual(next.id,g.id);finish(next,'resignation',0);assert.equal(next.winner,0);assert.equal(next.reason,'resignation');
});
test('seeded generation: sizes, layouts, boundaries, separation, no collinearity',()=>{
 for(const size of [12,20,30] as const)for(const layout of ['jitter','scatter'] as const)for(let seed=0;seed<60;seed++){
  const p=generate(seed,{size,layout});assert.deepEqual(p,generate(seed,{size,layout}));assert.equal(p.length,size);assert.ok(hullArea2(p)>150000);
  for(let a=0;a<p.length;a++){assert.ok(p[a].x>=40&&p[a].x<=760&&p[a].y>=40&&p[a].y<=760);for(let b=a+1;b<p.length;b++){assert.ok(Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y)>=70);for(let c=b+1;c<p.length;c++)assert.notEqual(orient(p[a],p[b],p[c]),0);}}
 }
});

test('fallback layouts preserve spacing, hull and non-collinear triples',()=>{for(const n of [12,20,30]){const p=fallbackBoard(n);assert.equal(p.length,n);assert.ok(hullArea2(p)>150000);for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){assert.ok(Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y)>=75);for(let c=b+1;c<n;c++)assert.notEqual(orient(p[a],p[b],p[c]),0);}}});
