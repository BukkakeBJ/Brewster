import type {BrewLog,Catalog} from './types';import {clamp,grainPoints,lToGal,midpoint} from './calculations';
export interface Calibration {efficiency:number|null;efficiencySamples:number;yeasts:Record<string,{attenuation:number;samples:number}>}
export function calibrate(logs:BrewLog[],c:Catalog):Calibration{
 const efficiencies:number[]=[],yeasts:Record<string,number[]>={};
 for(const l of logs){const r=l.recipe;const mashed=r.grains.filter(g=>c.malts.find(m=>m.id===g.ingredientId)?.requiresMash);const fixed=r.grains.filter(g=>!c.malts.find(m=>m.id===g.ingredientId)?.requiresMash);const mashPotential=grainPoints(mashed,c.malts,100);const fixedPoints=grainPoints(fixed,c.malts,100);
  if(mashPotential>0){const efficiency=((l.actualOg-1)*1000*lToGal(l.actualVolumeL)-fixedPoints)/mashPotential*100;if(efficiency>=20&&efficiency<=100)efficiencies.push(efficiency)}
  if(l.actualOg>1.005&&l.actualFg>=1&&l.actualFg<=l.actualOg){const observed=(l.actualOg-l.actualFg)/(l.actualOg-1);const total=grainPoints(r.grains,c.malts,r.efficiency);let factor=0,sugar=0;
   for(const g of r.grains){const m=c.malts.find(m=>m.id===g.ingredientId)!;const share=total?grainPoints([g],c.malts,r.efficiency)/total:0;if(/lactose/i.test(m.name))continue;if(m.type==='sugar')sugar+=share;else factor+=share*(m.type==='crystal-caramel'?.65:1)}
   if(factor){const base=((observed-sugar)/factor)*100-(65-r.mashC)*.75;if(base>=40&&base<=95)(yeasts[r.yeastId]??=[]).push(base)}
  }
 }
 const mean=(a:number[])=>a.reduce((s,n)=>s+n,0)/a.length;
 return {efficiency:efficiencies.length?mean(efficiencies):null,efficiencySamples:efficiencies.length,yeasts:Object.fromEntries(Object.entries(yeasts).map(([id,a])=>[id,{attenuation:clamp(mean(a),40,95),samples:a.length}]))};
}
export function tastingErrors(log:BrewLog){return Object.entries(log.tasting).map(([axis,actual])=>({axis,actual,predicted:log.predictedFlavor[axis]??0,delta:actual-(log.predictedFlavor[axis]??0)})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))}
