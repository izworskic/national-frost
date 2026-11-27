const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("public/national-tools/frost/index.html","utf8");
const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes("async function run(loc)"));
function fixture(){
 const nodes=new Map(),handlers={},geoHandlers={};
 let run,fetchImpl;
 const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:"",className:""});return nodes.get(id);};
 const input={value:"48706"};
 const form={querySelector:s=>s==="input"?input:{addEventListener:(name,fn)=>geoHandlers[name]=fn},addEventListener:(name,fn)=>handlers[name]=fn};
 const document={getElementById:id=>id==="loc"?form:get(id),addEventListener:(name,fn)=>fn()};
 const N={label:l=>l.displayName,bind:(f,fn)=>run=fn,readJsonResponse:async r=>{if(!r.ok)throw Error("unavailable");return r.json();}};
 vm.runInNewContext(source,{document,window:{NationalTools:N},location:{search:""},URLSearchParams,Date,encodeURIComponent,fetch:(...args)=>fetchImpl(...args)});
 return {get,input,handlers,geoHandlers,run,setFetch:fn=>fetchImpl=fn};
}
const location=(zip,state)=>({latitude:43,longitude:-83,postcode:zip,stateCode:state,displayName:zip+" "+state});
const packet=zone=>({ok:true,json:async()=>({freeze_verdict:{label:"Freeze risk"},hardiness_zone:{zone,zip:"48706"},interpretation:{hardiness:"reference"},climate_normals:null,current_forecast:null})});
test("successful result is hidden during invalid lookup, then new successful result is shown",async()=>{
 const f=fixture();f.setFetch(async()=>packet("6a"));await f.run(location("48706","MI"));assert.equal(f.get("result").hidden,false);assert.equal(f.get("mi").hidden,false);
 f.input.value="99999";f.handlers.submit();assert.equal(f.get("result").hidden,true);assert.equal(f.get("mi").hidden,true);
 f.input.value="96813";f.setFetch(async()=>packet("12b"));await f.run(location("96813","HI"));assert.equal(f.get("result").hidden,false);assert.equal(f.get("mi").hidden,true);assert.match(f.get("answer").textContent,/96813 HI/);
});
test("failed decision API and superseded response cannot restore old advice",async()=>{
 const f=fixture();f.setFetch(async()=>packet("6a"));await f.run(location("48706","MI"));
 f.setFetch(async()=>({ok:false}));await assert.rejects(f.run(location("96813","HI")));assert.equal(f.get("result").hidden,true);
 let resolve;f.setFetch(()=>new Promise(r=>resolve=r));const pending=f.run(location("48706","MI"));f.handlers.submit();resolve(packet("6a"));await pending;assert.equal(f.get("result").hidden,true);
 f.geoHandlers.click();assert.equal(f.get("result").hidden,true);
});