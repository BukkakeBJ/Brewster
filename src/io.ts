import {XMLParser,XMLBuilder,XMLValidator} from 'fast-xml-parser';
import type {Catalog,Recipe} from './engine/types';
import {recipeSchema} from './validation';
export function exportBeerXML(r:Recipe,c:Catalog){
 const y=c.yeasts.find(y=>y.id===r.yeastId)!;
 const data={RECIPES:{RECIPE:{NAME:r.name,VERSION:1,TYPE:'All Grain',BREWER:'Brew Designer',BATCH_SIZE:r.batchL,BOIL_SIZE:r.batchL+r.boilOffLPerHour*r.boilMinutes/60,BOIL_TIME:r.boilMinutes,EFFICIENCY:r.efficiency,PRIMARY_TEMP:r.fermentC,CARBONATION:r.carbonation,BD_STYLE_ID:r.styleId,BD_LOSS_L:r.lossL,BD_WHIRLPOOL_FACTOR:r.whirlpoolFactor,BD_PITCH_MULTIPLIER:r.pitchMultiplier,FERMENTABLES:{FERMENTABLE:r.grains.map(g=>{const m=c.malts.find(m=>m.id===g.ingredientId)!;return {NAME:m.name,VERSION:1,TYPE:m.type==='sugar'?'Sugar':m.type==='extract'?'Extract':'Grain',AMOUNT:g.kg,YIELD:m.extractPercent,COLOR:m.lovibond,BD_ID:m.id}})},HOPS:{HOP:r.hops.map(h=>({NAME:c.hops.find(x=>x.id===h.ingredientId)!.name,VERSION:1,ALPHA:h.alpha??c.hops.find(x=>x.id===h.ingredientId)!.alpha[0],AMOUNT:h.grams/1000,USE:h.use==='dry hop'?'Dry Hop':h.use==='whirlpool'?'Aroma':'Boil',TIME:h.minutes,FORM:'Pellet',BD_ID:h.ingredientId}))},YEASTS:{YEAST:{NAME:y.name,VERSION:1,TYPE:y.type==='lager'?'Lager':'Ale',FORM:y.form==='dry'?'Dry':'Liquid',AMOUNT:.011,ATTENUATION:(y.attenuation[0]+y.attenuation[1])/2,LABORATORY:y.lab,PRODUCT_ID:y.code,BD_ID:y.id}},MASH:{NAME:'Single infusion',VERSION:1,GRAIN_TEMP:20,MASH_STEPS:{MASH_STEP:{NAME:'Saccharification',VERSION:1,TYPE:'Infusion',STEP_TEMP:r.mashC,STEP_TIME:r.mashMinutes}}}}}};
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLBuilder({format:true}).build(data);
}
export function importRecipe(text:string,c:Catalog,defaults:Recipe):Recipe{
 if(text.trimStart().startsWith('{')){const r=recipeSchema.parse(JSON.parse(text));assertKnown(r,c);return {...r,id:crypto.randomUUID()}}
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('DTD and entity declarations are not supported.');
 if(XMLValidator.validate(text)!==true)throw new Error('Invalid XML.');
 const parsed=new XMLParser({ignoreAttributes:true}).parse(text);let x=parsed.RECIPES?.RECIPE??parsed.RECIPE;if(Array.isArray(x))throw new Error('Import one recipe at a time.');if(!x)throw new Error('No BeerXML recipe found.');
 const arr=(a:unknown)=>a==null?[]:Array.isArray(a)?a:[a];
 const resolveId=(a:any,list:{id:string;name:string}[])=>{const match=list.find(i=>i.id===a.BD_ID)||list.find(i=>i.name.toLowerCase()===String(a.NAME).toLowerCase());if(!match)throw new Error(`Unknown ingredient: ${a.NAME}. Add it to the catalog before importing.`);return match.id};
 const ys=arr(x.YEASTS?.YEAST);if(ys.length!==1)throw new Error('Exactly one known yeast is required.');
 const steps=arr(x.MASH?.MASH_STEPS?.MASH_STEP);if(steps.length>1)throw new Error('Multi-step mashes are not supported; import a single-infusion recipe.');
 const batch=Number(x.BATCH_SIZE),boil=Number(x.BOIL_TIME??60);
 const r=recipeSchema.parse({...defaults,id:crypto.randomUUID(),name:x.NAME,styleId:x.BD_STYLE_ID??'',batchL:batch,efficiency:Number(x.EFFICIENCY??72),boilMinutes:boil,boilOffLPerHour:boil>0?Math.max(0,Number(x.BOIL_SIZE??batch)-batch)*60/boil:0,lossL:Number(x.BD_LOSS_L??0),whirlpoolFactor:Number(x.BD_WHIRLPOOL_FACTOR??.15),pitchMultiplier:Number(x.BD_PITCH_MULTIPLIER??1),mashC:Number(steps[0]?.STEP_TEMP??65),mashMinutes:Number(steps[0]?.STEP_TIME??60),fermentC:Number(x.PRIMARY_TEMP??19),carbonation:Number(x.CARBONATION??2.4),yeastId:resolveId(ys[0],c.yeasts),grains:arr(x.FERMENTABLES?.FERMENTABLE).map((a:any)=>({ingredientId:resolveId(a,c.malts),kg:Number(a.AMOUNT)})),hops:arr(x.HOPS?.HOP).map((a:any)=>{const use=String(a.USE).toLowerCase();if(!['boil','aroma','whirlpool','dry hop'].includes(use))throw new Error(`Unsupported hop use: ${a.USE}`);return {ingredientId:resolveId(a,c.hops),grams:Number(a.AMOUNT)*1000,alpha:Number(a.ALPHA),use:use==='dry hop'?'dry hop':use==='boil'?'boil':'whirlpool',minutes:Number(a.TIME)}})});
 return r;
}
function assertKnown(r:Recipe,c:Catalog){for(const g of r.grains)if(!c.malts.some(m=>m.id===g.ingredientId))throw new Error('Unknown grain');for(const h of r.hops)if(!c.hops.some(m=>m.id===h.ingredientId))throw new Error('Unknown hop');if(!c.yeasts.some(y=>y.id===r.yeastId))throw new Error('Unknown yeast')}
export function download(name:string,content:string,type='application/json'){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
