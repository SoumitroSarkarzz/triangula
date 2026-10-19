import type {Point,Edge,Triangle} from './types.js';
export const orient=(a:Point,b:Point,c:Point)=> (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export const area2=(a:Point,b:Point,c:Point)=>Math.abs(orient(a,b,c));
export const edgeKey=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
export const canonical=(a:number,b:number):Edge=>a<b?[a,b]:[b,a];
export function onSegment(a:Point,b:Point,c:Point){return orient(a,b,c)===0 && c.x>=Math.min(a.x,b.x)&&c.x<=Math.max(a.x,b.x)&&c.y>=Math.min(a.y,b.y)&&c.y<=Math.max(a.y,b.y);}
export function intersects(a:Point,b:Point,c:Point,d:Point){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);return (o1*o2<0&&o3*o4<0)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);}
export function illegal(points:Point[],edges:Edge[],a:number,b:number):string|null{
 if(!Number.isInteger(a)||!Number.isInteger(b)||!points[a]||!points[b])return 'Choose two existing dots.';
 if(a===b)return 'Choose two different dots.';
 if(edges.some(([c,d])=>edgeKey(a,b)===edgeKey(c,d)))return 'That edge has already been drawn.';
 const A=points[a], B=points[b];
 if(points.some((p,i)=>i!==a&&i!==b&&onSegment(A,B,p)))return 'A line cannot pass through another dot.';
 for(const [c,d] of edges){
  const shared=[a,b].filter(i=>i===c||i===d);
  if(shared.length){const s=shared[0], other1=s===a?b:a,other2=s===c?d:c;if(onSegment(points[s],points[other1],points[other2])||onSegment(points[s],points[other2],points[other1]))return 'Collinear edges cannot overlap.';continue;}
  if(intersects(A,B,points[c],points[d]))return 'Lines cannot cross or touch another line.';
 }
 return null;
}
export function inside(p:Point,a:Point,b:Point,c:Point){const v=[orient(a,b,p),orient(b,c,p),orient(c,a,p)];return v.every(n=>n>0)||v.every(n=>n<0);}
export function captures(points:Point[],edges:Edge[],claimed:Triangle[],edge:Edge,owner:number):Triangle[]{
 const [a,b]=edge, keys=new Set(edges.map(([c,d])=>edgeKey(c,d))), old=new Set(claimed.map(t=>[...t.vertices].sort((x,y)=>x-y).join(':'))), out:Triangle[]=[];
 for(let c=0;c<points.length;c++){
  if(c===a||c===b||!keys.has(edgeKey(a,c))||!keys.has(edgeKey(b,c)))continue;
  const vertices=[a,b,c] as [number,number,number], A=points[a],B=points[b],C=points[c],area=area2(A,B,C);
  if(!area||old.has([...vertices].sort((x,y)=>x-y).join(':')))continue;
  if(points.some((p,i)=>!vertices.includes(i)&&(inside(p,A,B,C)||onSegment(A,B,p)||onSegment(B,C,p)||onSegment(C,A,p))))continue;
  // With a valid planar edge set, any subdivision has an interior/boundary vertex.
  out.push({vertices,owner,area2:area});
 }
 return out;
}
export function hull(points:Point[]):Point[]{
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);if(sorted.length<3)return sorted;
 const half=(ps:Point[])=>{const h:Point[]=[];for(const p of ps){while(h.length>1&&orient(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}return h;};
 const lo=half(sorted),hi=half([...sorted].reverse());return [...lo.slice(0,-1),...hi.slice(0,-1)];
}
export function hullArea2(points:Point[]){const h=hull(points);return Math.abs(h.reduce((s,p,i)=>s+p.x*h[(i+1)%h.length].y-p.y*h[(i+1)%h.length].x,0));}
export function hasLegalMove(points:Point[],edges:Edge[]){for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++)if(!illegal(points,edges,a,b))return true;return false;}
