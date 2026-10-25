import type {Catalog,Flavor,Ingredient,Prediction,Recipe,Target} from './types';
import {clamp,midpoint,predict,hopIbu} from './calculations';import {consensus,flavorPredict} from './flavor';
export interface Candidate {recipe:Recipe;prediction:Prediction;flavor:Flavor;score:number;explanations:string[];tradeoffs:string[]}
const out=(v:number,r:[number,number])=>v<r[0]?r[0]-v:v>r[1]?v-r[1]:0;
export function objective(t:Target,r:Recipe,p:Prediction,f:Flavor,c:Catalog):number{
 const entries=Object.entries(t.flavors);let flavor=entries.reduce((s,[a,v])=>s+((f.scores[a]??0)-v)**2,0)/(entries.length||1);
 flavor+=t.must.reduce((s,a)=>s+Math.max(0,1-(f.scores[a]??0))**2*8,0)+t.avoid.reduce((s,a)=>s+Math.max(0,(f.scores[a]??0)-.3)**2*10,0);
 let numbers=((p.abv-t.abv)/.5)**2+((p.ibu-t.ibu)/10)**2+((p.srm-t.srm)/3)**2;
 if(t.og)numbers+=(out(p.og,t.og)/.005)**2;if(t.fg)numbers+=(out(p.fg,t.fg)/.003)**2;
 const style=c.styles.find(s=>s.id===t.styleId);const stylePenalty=style?(['og','fg','abv','ibu','srm'] as const).reduce((s,k)=>s+(out(p[k],style[k])/(k==='og'?.005:k==='fg'?.003:k==='ibu'?10:k==='srm'?3:.5))**2,0):0;
 return t.weights.flavor*flavor+t.weights.numbers*numbers+t.weights.style*stylePenalty;
}
export function solve(t:Target,c:Catalog,iterations=70,userWeight=1):Candidate[]{
 if(t.batchL<=t.equipment.lossL||t.batchL<=0||t.abv<=0||t.abv>18||t.efficiency<=0||t.efficiency>100)throw new Error('Use a positive batch, valid efficiency, ABV 0–18%, and transfer loss below batch volume.');
 const allowed=(i:Ingredient)=>!t.exclude.includes(i.id)&&(!t.onHand.length||t.onHand.includes(i.id));
 const descriptors=new Map<string,typeof c.descriptors>();for(const d of c.descriptors){const rows=descriptors.get(d.ingredientId)??[];rows.push(d);descriptors.set(d.ingredientId,rows)}
 const rank=(i:Ingredient)=>{const ds=consensus(descriptors.get(i.id)??[],i.kind==='hop'?{use:'dry hop'}:i.kind==='malt'?{percent:5}:{tempC:20},userWeight);return ds.reduce((s,d)=>s+(t.flavors[d.descriptor]??0)*d.intensity+(t.must.includes(d.descriptor)?10:0)-(t.avoid.includes(d.descriptor)?40:0),0)};
 const bases=c.malts.filter(m=>allowed(m)&&m.type==='base'&&m.maxPercent>=70&&m.ppg>20&&!/hull/i.test(m.name)).sort((a,b)=>rank(b)-rank(a)).slice(0,6);
 const specialties=c.malts.filter(m=>allowed(m)&&m.type!=='base'&&m.ppg>15&&m.maxPercent>0&&!/hull|lactose|smok|acid|sour/i.test(m.name)).sort((a,b)=>{const colorTarget=Math.max(2,t.srm*3);return rank(b)-rank(a)+Math.abs(a.lovibond-colorTarget)*.03-Math.abs(b.lovibond-colorTarget)*.03}).slice(0,8);
 const hops=c.hops.filter(allowed).sort((a,b)=>rank(b)-rank(a)).slice(0,8);
 const family=/lager|pils|bock|helles|dunkel|schwarz|oktober/i.test(t.styleId)?'lager':'ale';
 const yeasts=c.yeasts.filter(y=>allowed(y)&&(t.yeastForm==='any'||y.form===t.yeastForm)&&(t.budget!=='economy'||y.form==='dry')&&['ale','lager','wheat','belgian','kveik'].includes(y.type.toLowerCase())&&(y.alcoholTolerance===null||y.alcoholTolerance>=t.abv)).sort((a,b)=>rank(b)-rank(a)+(a.type===family?-5:0)-(b.type===family?-5:0)).slice(0,6);
 if(!bases.length||!yeasts.length||(t.ibu>0&&!hops.length))throw new Error('No feasible ingredient set. Include a base malt, compatible brewing yeast and hops in the on-hand list, or relax exclusions/form/budget.');
 let seed=3761;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const results:Candidate[]=[];
 for(let start=0;start<18;start++){
  const base=bases[start%bases.length],special=specialties.length?specialties[start%specialties.length]:undefined,hop=hops[start%Math.max(1,hops.length)],hop2=hops[(start+2)%Math.max(1,hops.length)]??hop,y=yeasts[Math.floor(start/3)%yeasts.length];
  const fraction=special?Math.max(1-base.maxPercent/100,Math.min(.05,special.maxPercent/100)):0;
  let r:Recipe={id:`candidate-${start}`,name:`${hop?.name??'Malt'} ${c.styles.find(s=>s.id===t.styleId)?.name??'House Ale'}`,styleId:t.styleId,batchL:t.batchL,efficiency:t.efficiency,mashC:(t.flavors.body??0)>3?69:65,mashMinutes:60,fermentC:midpoint(y.tempC),boilMinutes:t.equipment.boilMinutes,boilOffLPerHour:t.equipment.boilOffLPerHour,lossL:t.equipment.lossL,whirlpoolFactor:.15,carbonation:2.4,pitchMultiplier:1,yeastId:y.id,grains:[{ingredientId:base.id,kg:4*(t.batchL/20)*(1-fraction)},...(special?[{ingredientId:special.id,kg:4*(t.batchL/20)*fraction}]:[])],hops:hop?[{ingredientId:hop.id,use:'boil',minutes:Math.min(60,t.equipment.boilMinutes),grams:20*t.batchL/20},{ingredientId:hop.id,use:'whirlpool',minutes:20,grams:30*t.batchL/20},{ingredientId:hop2.id,use:'dry hop',minutes:4320,grams:50*t.batchL/20}]:[]};
  const ids=new Set([...r.grains.map(g=>g.ingredientId),...r.hops.map(h=>h.ingredientId),r.yeastId]);const small={...c,malts:c.malts.filter(m=>ids.has(m.id)),hops:c.hops.filter(h=>ids.has(h.id)),yeasts:[y],descriptors:c.descriptors.filter(d=>ids.has(d.ingredientId))};
  const normalize=(a:Recipe)=>{
   for(let k=0;k<3;k++){const p=predict(a,small);const factor=clamp(t.abv/(p.abv||.1),.3,3);a.grains=a.grains.map(g=>({...g,kg:g.kg*factor}))}
   if(a.hops.length){a.hops[0].grams=0;const p=predict(a,small);const bg=(p.og+p.preBoilGravity)/2;const per=hopIbu({...a.hops[0],grams:1},midpoint(hop.alpha),bg,a.batchL,a.whirlpoolFactor);a.hops[0].grams=clamp(per?(t.ibu-p.ibu)/per:0,0,t.batchL*10);
    if(t.budget==='economy'){const total=a.hops.reduce((s,h)=>s+h.grams,0);if(total>a.batchL*4)a.hops=a.hops.map(h=>({...h,grams:h.grams*a.batchL*4/total}))}
   }
   return a;
  };
  const evaluate=(a:Recipe)=>{const p=predict(a,small);const f=flavorPredict(a,small,p,userWeight);return {recipe:a,prediction:p,flavor:f,score:objective(t,a,p,f,small)}};
  r=normalize(r);let best=evaluate(r);
  for(let iter=0;iter<iterations;iter++){
   let a=structuredClone(best.recipe);const decay=1-iter/iterations;const move=iter%5;
   if(move===0&&a.grains.length>1){const total=a.grains.reduce((s,g)=>s+g.kg,0);const pct=clamp(a.grains[1].kg/total+(rand()-.5)*.12*decay,Math.max(0,1-base.maxPercent/100),Math.min(.3,special!.maxPercent/100));a.grains[1].kg=total*pct;a.grains[0].kg=total*(1-pct)}
   else if(move===1){a.mashC=clamp(a.mashC+(rand()-.5)*5*decay,63,70)}
   else if(move===2){a.fermentC=clamp(a.fermentC+(rand()-.5)*4*decay,y.tempC[0],y.tempC[1])}
   else if(a.hops.length){const j=move===3?1:2;a.hops[j].grams=clamp(a.hops[j].grams+(rand()-.5)*a.batchL*3*decay,0,a.batchL*8);if(move===3)a.hops[1].use=iter%2===0?'whirlpool':'boil';if(a.hops[1].use==='boil')a.hops[1].minutes=Math.min(10,a.boilMinutes)}
   a=normalize(a);const candidate=evaluate(a);if(candidate.score<best.score)best=candidate;
  }
  const b=best,tradeoffs:string[]=[];const total=b.recipe.grains.reduce((s,g)=>s+g.kg,0);
  if(b.recipe.grains.some(g=>g.kg/total*100>(c.malts.find(m=>m.id===g.ingredientId)!.maxPercent+.01)))continue;
  for(const [key,tolerance] of [['abv',.25],['ibu',3],['srm',1.5]] as const)if(Math.abs(b.prediction[key]-t[key])>tolerance)tradeoffs.push(`${key.toUpperCase()} target ${t[key]}; candidate ${b.prediction[key].toFixed(2)}. Targets compete; adjust weights or ingredients.`);
  if(t.og&&out(b.prediction.og,t.og))tradeoffs.push('OG is outside the requested range.');if(t.fg&&out(b.prediction.fg,t.fg))tradeoffs.push('FG is outside the requested range.');
  for(const term of t.must)if((b.flavor.scores[term]??0)<1)tradeoffs.push(`Must include “${term}” is unmet (score ${(b.flavor.scores[term]??0).toFixed(1)}).`);
  for(const term of t.avoid)if((b.flavor.scores[term]??0)>.3)tradeoffs.push(`Avoid “${term}” conflicts with this recipe (score ${b.flavor.scores[term].toFixed(1)}).`);
  const sty=c.styles.find(s=>s.id===t.styleId);if(sty)for(const k of ['og','fg','abv','ibu','srm'] as const)if(out(b.prediction[k],sty[k]))tradeoffs.push(`${k.toUpperCase()} falls outside ${sty.name}'s reference range.`);
  if(t.abv<=4.5&&(t.flavors.body??0)>=3)tradeoffs.push(`Low ABV and full body compete; mash at ${b.recipe.mashC.toFixed(1)}°C helps the body proxy. More body may still be unattainable.`);
  if(t.budget==='economy')tradeoffs.push('Economy proxy: dry yeast and ≤4 g/L total hops. No live ingredient prices are available.');
  const explanations=b.recipe.grains.map(g=>{const m=c.malts.find(m=>m.id===g.ingredientId)!;return `${(g.kg/total*100).toFixed(1)}% ${m.name}: ${m.type==='base'?'fermentable backbone':m.type+' character and color'}.`});
  for(const id of new Set(b.recipe.hops.map(h=>h.ingredientId))){const ds=consensus(descriptors.get(id)??[],{use:'dry hop'}).sort((a,b)=>(t.flavors[b.descriptor]??0)-(t.flavors[a.descriptor]??0)).slice(0,3);explanations.push(`${c.hops.find(h=>h.id===id)!.name}: ${ds.map(d=>d.descriptor).join(', ')||'kettle bitterness'}; ${b.recipe.hops.filter(h=>h.ingredientId===id&&h.grams>.1).map(h=>h.use).join(' + ')}.`)}
  explanations.push(`${y.lab} ${y.name} at ${b.recipe.fermentC.toFixed(1)}°C: chosen for attenuation, temperature range and descriptor fit.`);
  results.push({...b,explanations,tradeoffs});
 }
 return results.sort((a,b)=>a.score-b.score).slice(0,3);
}
