(function(){"use strict";const N=window.NationalTools,E=window.GardenFrostCover;
const form=document.getElementById("loc"),controls=document.getElementById("controls"),output=document.getElementById("output"),status=document.getElementById("status");
let loc=null,feed=null,requestId=0;
function render(){if(!loc)return;
const input={crop:document.getElementById("crop").value,stage:document.getElementById("stage").value,setting:document.getElementById("setting").value,protection:document.getElementById("protection").value};
const r=E.decide(input,feed,new Date());output.hidden=false;output.replaceChildren();
const pill=document.createElement("span");pill.className="badge";pill.textContent=r.code.replaceAll("_"," ");
const h=document.createElement("h2");h.textContent=r.headline;output.append(pill,h);
const summary=document.createElement("p");summary.className="muted";summary.textContent=r.window+" · NWS forecast low: "+(r.lowest===null?"unavailable":Math.round(r.lowest)+"°F")+" · "+r.count+" hourly forecasts · "+r.confidence;output.appendChild(summary);
const ul=document.createElement("ul");r.details.forEach(s=>{const li=document.createElement("li");li.textContent=s;ul.appendChild(li)});output.appendChild(ul);
const note=document.createElement("p");note.className="muted";note.textContent="Not a frost sensor: NWS grid temperatures represent broader air conditions. Your garden's microclimate, cloud cover and wind can alter leaf temperatures.";output.appendChild(note);
if(window.gtag)gtag("event","garden_frost_decision",{decision:r.code,crop:input.crop});
}
async function onLoc(place){loc=place;feed=null;const n=++requestId;controls.hidden=false;status.textContent="Checking overnight forecast for "+N.label(place)+"…";output.hidden=true;
try{const q=new URLSearchParams({lat:String(place.latitude),lon:String(place.longitude)});
const response=await fetch("/api/national-frost?"+q.toString(),{signal:AbortSignal.timeout(17000)});
if(!response.ok)throw Error("Official forecast unavailable");const data=await response.json();if(n!==requestId)return;feed=data;
status.textContent=N.label(place)+" · "+(data.current_forecast?"NWS hourly forecast retrieved":"NWS hourly forecast unavailable");
}catch(_){if(n!==requestId)return;status.textContent=N.label(place)+" · Forecast unavailable. No safe-weather claim can be made."; }render();}
controls.addEventListener("input",render);N.bind(form,onLoc);
const q=new URLSearchParams(location.search).get("q");if(q){form.querySelector("input").value=q;form.requestSubmit();}
})();