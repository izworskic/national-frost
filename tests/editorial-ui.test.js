const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public/national-tools/frost/index.html"), "utf8");

test("uses the editorial national-tool shell without changing the tool contract", () => {
  assert.match(html, /data-editorial-tool-ui="2026-09"/);
  assert.match(html, /id="editorial-tool-ui"/);
  assert.match(html, /class="breadcrumb"/);
  assert.match(html, /<a href="\/">Home<\/a>/);
  assert.match(html, /<a href="\/tools\/">Michigan Tools<\/a>/);
  assert.match(html, /<a href="\/national-tools\/" aria-current="page">U\.S\. Outdoor Tools<\/a>/);
  assert.match(html, /<form id="loc"/);
  assert.match(html, /id="result"/);
  assert.match(html, /national-tools\.js/);
  assert.ok(html.includes('<link rel="canonical" href="https://chrisizworski.com/national-tools/frost/">'));
});

test("editorial override keeps the quiet Michigan-style visual language", () => {
  const start = html.indexOf('<style id="editorial-tool-ui">');
  const end = html.indexOf("</style>", start);
  assert.ok(start >= 0 && end > start);
  const css = html.slice(start, end);
  assert.match(css, /--editorial-paper:#f8f6f1/);
  assert.match(css, /--editorial-green:#2c5f2d/);
  assert.match(css, /font-family:Georgia/);
  assert.match(css, /box-shadow:none/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});

test("emitted page links its author and publisher to the canonical Person", () => {
  const jsonLd = [...html.matchAll(/<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, source]) => JSON.parse(source));
  const graph = jsonLd.flatMap((document) => document["@graph"] || [document]);
  const personId = "https://chrisizworski.com/#person";
  const person = graph.find((node) => node["@type"] === "Person" && node["@id"] === personId);
  const website = graph.find((node) => node["@type"] === "WebSite" && node["@id"] === "https://chrisizworski.com/#website");
  const app = graph.find((node) => node["@type"] === "SoftwareApplication" && node.url === "https://chrisizworski.com/national-tools/frost/");
  assert.deepEqual({ name: person?.name, url: person?.url }, { name: "Chris Izworski", url: "https://chrisizworski.com/" });
  assert.equal(website?.author?.["@id"], personId);
  assert.equal(website?.publisher?.["@id"], personId);
  assert.equal(app?.author?.["@id"], personId);
  assert.equal(app?.publisher?.["@id"], personId);
  assert.ok(html.includes('<link rel="canonical" href="https://chrisizworski.com/national-tools/frost/">'));
});
