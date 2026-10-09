(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.GardenFrostCover=api;})(typeof window!=="undefined"?window:null,function(){
"use strict";
const categories={tomato:"tender",pepper:"tender",basil:"tender",cucumber:"tender",beans:"tender",zinnia:"tender",dahlia:"tender",lettuce:"cool",broccoli:"cool",kale:"hardy",spinach:"hardy"};
function parts(value,tz){
 const d=new Date(value);if(Number.isNaN(d.getTime()))return null;
 const fmt=new Intl.DateTimeFormat("en-US",{timeZone:tz||"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"});
 const z=Object.fromEntries(fmt.formatToParts(d).map(x=>[x.type,Number(x.value)]));
 const day=Math.floor(Date.UTC(z.year,z.month-1,z.day)/86400000);
 return {day,hour:z.hour,clock:day*24+z.hour};
}
function overnight(periods,now,tz){
 const here=parts(now,tz);if(!here)return {hours:[],label:"Time unavailable"};
 const early=here.hour<10;
 const startDay=early?here.day-1:here.day;
 const start=startDay*24+16,end=(startDay+1)*24+10;
 const hours=(Array.isArray(periods)?periods:[]).filter(p=>{
  const ptime=parts(p.time,tz);return ptime&&ptime.clock>=Math.max(here.clock,start)&&ptime.clock<end&&Number.isFinite(Number(p.temp_f));
 }).map(p=>({time:p.time,temp_f:p.unit==="C"?Number(p.temp_f)*9/5+32:Number(p.temp_f),forecast:p.forecast||""}));
 return {hours,label:early?"Through this morning":"Tonight through tomorrow morning",start,end};
}
function decide(input,feed,now=new Date()){
 const tz=feed?.location?.timeZone||feed?.current_forecast?.timeZone||"America/New_York";
 const forecast=feed?.current_forecast,periods=forecast?.periods;
 const night=overnight(periods,now,tz);
 const kind=categories[input.crop]||"tender";
 const sample=night.hours;let code="UNKNOWN",headline="Overnight guidance unavailable",details=[];
 const min=sample.length?Math.min(...sample.map(x=>x.temp_f)):null;
 let stale=false;
 if(forecast?.updated_at){const ms=new Date(now)-new Date(forecast.updated_at);stale=Number.isFinite(ms)&&ms>12*60*60*1000;}
 if(!sample.length)details.push("No usable hourly temperatures for the upcoming overnight window. No crop-safe prediction is possible.");
 else if(stale)details.push("The NWS forecast timestamp is older than 12 hours. Refresh before relying on this garden decision.");
 else if(kind==="tender"){
  if(min<=28){code="HARVEST_MOVE";headline="Harvest or move tender plants before this freeze";details.push("A basic frost sheet may not prevent damage near or below 28°F, especially over several hours.");}
  else if(min<=36){code="COVER";headline="Protect frost-tender plants during the overnight window";details.push("Radiational frost can form on plants when the standard air forecast remains several degrees above 32°F.");}
  else {code="NO_COVER";headline="No routine cover indicated by this forecast";details.push("The point forecast shows no near-freezing hour overnight. Low spots and exposed leaves can be colder than the reported air temperature.");}
 }else if(kind==="cool"){
  const threshold=input.stage==="seedling"?32:27;
  if(min<=threshold){code="COVER";headline="Protect this cool-season crop tonight";details.push("Young transplants can be more vulnerable. Mature cool-season plants tolerate some frost, not unlimited freezing.");}
  else {code="NO_COVER";headline="No additional cover indicated for this cool-season crop";details.push("Plant hardiness depends on cultivar, moisture, maturity and the duration of freezing.");}
 }else {
  const threshold=input.stage==="seedling"?30:23;
  if(min<=threshold){code="COVER";headline="Consider insulation for cold-hardy plants";details.push("Hardy plants tolerate frost but sustained severe cold can still harm new growth and exposed roots.");}
  else {code="NO_COVER";headline="This hardy crop generally needs no cover at forecast temperatures";details.push("Acclimation, variety, soil moisture and local cold-air pockets still matter.");}
 }
 if(input.setting==="container"&&code==="COVER"){code="MOVE";headline="Move container plants to a protected location if possible";details.push("Containers expose roots to cold from multiple sides; moving them is usually more reliable than a loose sheet.");}
 if(input.setting==="container"&&code==="HARVEST_MOVE")details.push("Bring portable containers inside; harvest tender outdoor fruit before the freeze.");
 if(input.protection==="none"&&code==="COVER")details.push("No cover available: move containers if possible or harvest vulnerable produce.");
 if(input.protection==="sheet"&&["COVER","MOVE"].includes(code))details.push("Drape breathable fabric to the ground on supports, secure edges and uncover in the morning when temperatures rise. Keep plastic off leaves.");
 if(input.protection==="tunnel"&&["COVER","MOVE"].includes(code))details.push("Use properly ventilated row covers or a cold frame; monitor overheating after sunrise.");
 if(stale)code="STALE";
 return {code,headline,details,lowest:min,window:night.label,count:sample.length,stale,tz,confidence:sample.length&&!stale?"Forecast-based, local microclimate unknown":"Insufficient current evidence"};
}
return {decide,overnight,parts};
});