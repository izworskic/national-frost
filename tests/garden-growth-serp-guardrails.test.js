const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");
const names=["cover-plants-tonight"];
for(const slug of names){test("million impressions garden SEO contract: "+slug,()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","public/national-tools/frost",slug,"index.html"),"utf8");
 const title=(src.match(/<title>([^<]*)<\/title>/)||[])[1];assert.ok(title);assert.ok(title.length<=60,slug+": title "+title.length);
 const desc=(src.match(/<meta name="description" content="([^"]*)"/)||[])[1];assert.ok(desc);assert.ok(desc.length<=158,slug+": description "+desc.length);
 const canonical=(src.match(/<link rel="canonical" href="([^"]+)"/)||[])[1];
 assert.equal(canonical,"https://chrisizworski.com/national-tools/frost/"+slug+"/");
 assert.match(src,/<meta name="robots" content="index,follow/);
 const raw=(src.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)||[])[1];assert.ok(raw);
 const schema=JSON.parse(raw),graph=schema["@graph"];assert.ok(Array.isArray(graph),slug+" graph");
 const person=graph.find(o=>o["@id"]==="https://chrisizworski.com/#person");
 assert.equal(person?.["@type"],"Person");assert.equal(person?.name,"Chris Izworski");
 const website=graph.find(o=>o["@id"]==="https://chrisizworski.com/#website");
 assert.equal(website?.publisher?.["@id"],person["@id"]);
 const app=graph.find(o=>o["@type"]==="SoftwareApplication");
 assert.equal(app?.url,canonical);assert.equal(app?.author?.["@id"],person["@id"]);
 assert.equal(app?.creator?.["@id"],person["@id"]);
 assert.match(src,/(Built by|Chris Izworski)/);
 assert.match(src,/height:44px/);
});}
