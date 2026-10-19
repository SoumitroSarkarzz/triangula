import type {Point,Settings} from '../shared/types.js';
import {orient,hullArea2} from '../shared/geometry.js';
function rng(seed:number){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function generate(seed:number,settings:Settings):Point[]{
 const random=rng(seed),points:Point[]=[],n=settings.size,cols=n===12?4:n===20?5:6,rows=n/cols;
 for(let i=0;i<n;i++){
  let found=false;
  for(let attempt=0;attempt<1200;attempt++){
   const p=settings.layout==='jitter'?{x:Math.round(80+(i%cols)*640/(cols-1)+(random()-.5)*65),y:Math.round(80+Math.floor(i/cols)*640/(rows-1)+(random()-.5)*65)}:{x:Math.round(50+random()*700),y:Math.round(50+random()*700)};
   if(points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<(n===30?75:90)))continue;
   let good=true;for(let a=0;a<points.length&&good;a++)for(let b=a+1;b<points.length;b++)if(Math.abs(orient(points[a],points[b],p))<100){good=false;break;}
   if(good){points.push(p);found=true;break;}
  }
  if(!found)return fallbackBoard(n);
 }
 return hullArea2(points)>150000?points:fallbackBoard(n);
}
export function fallbackBoard(n:number):Point[]{
 // Prevalidated integer layout. Subsets span the board and preserve general position.
 const all:Point[]=[{"x":72,"y":99},{"x":240,"y":58},{"x":317,"y":63},{"x":462,"y":87},{"x":580,"y":90},{"x":708,"y":59},{"x":71,"y":263},{"x":228,"y":270},{"x":360,"y":261},{"x":448,"y":216},{"x":624,"y":232},{"x":741,"y":242},{"x":112,"y":384},{"x":233,"y":397},{"x":324,"y":390},{"x":468,"y":392},{"x":588,"y":383},{"x":694,"y":393},{"x":82,"y":545},{"x":181,"y":568},{"x":306,"y":549},{"x":432,"y":549},{"x":577,"y":548},{"x":746,"y":555},{"x":91,"y":726},{"x":218,"y":722},{"x":335,"y":703},{"x":440,"y":700},{"x":602,"y":709},{"x":705,"y":712}];
 const indices=n===12?[0,2,3,5,12,14,15,17,24,26,27,29]:n===20?[0,1,2,4,5,6,7,8,10,11,18,19,20,22,23,24,25,26,28,29]:Array.from({length:30},(_,i)=>i);
 return indices.map(i=>({...all[i]}));
}
