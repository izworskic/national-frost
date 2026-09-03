const test=require("node:test");
const assert=require("node:assert/strict");
const frost=require("../api/national-frost.js")._test;

test("NCEI search station buckets become clean explicit station IDs",()=>{
  const ids=frost.parseSearchStationIds({
    stations:{buckets:[
      {key:"USC00204967",docCount:1},
      {key:"USW00014828",docCount:1},
      {key:"USC00204967.csv",docCount:1},
      {key:"bad id!",docCount:1},
    ]}
  });
  assert.deepEqual(ids,["USC00204967","USW00014828"]);
});

test("West Branch sample normals expose median last and first freeze plus growing season",()=>{
  const row={
    "ANN-TMIN-PRBFST-T32FP20":"   09/20",
    "STATION":"USC00204967",
    "ANN-TMIN-PRBFST-T32FP10":"   09/15",
    "ANN-TMIN-PRBGSL-T32FP50":"   129.0",
    "LONGITUDE":" -84.0233",
    "ANN-TMIN-PRBLST-T32FP20":"   05/31",
    "ANN-TMIN-PRBLST-T32FP10":"   06/05",
    "LATITUDE":" 44.4200",
    "ANN-TMIN-PRBLST-T32FP50":"   05/21",
    "NAME":"LUPTON 1S, MI US",
    "ANN-TMIN-PRBFST-T32FP50":"   09/29"
  };
  const s=frost.station(row,44.276408,-84.238613);
  assert.equal(s.id,"USC00204967");
  assert.equal(s.dates.spring_50.mmdd,"05-21");
  assert.equal(s.dates.fall_50.mmdd,"09-29");
  assert.equal(s.dates.spring_10.mmdd,"06-05");
  assert.equal(s.growing_season_days_50,129);
  assert.ok(s.distance_miles<15);
  assert.equal(s.confidence,"high");
});

test("USDA ZIP table class normalizes to zone without becoming a frost date",()=>{
  const z=frost.normalizeZone({
    ZIP_CODE:"48661",
    ZONE_CODE:2286,
    MAJORITY:9,
    Class:"5a (-20 to -15 °F/-28.9 to -26.1 °C)",
    Class_Code:9
  },"48661","search location");
  assert.equal(z.zone,"5a");
  assert.equal(z.zip,"48661");
  assert.equal(z.min_extreme_f,-20);
  assert.equal(z.max_extreme_f,-15);
  assert.equal(z.basis,"ZIP-area majority zone");
});

test("ZIP normalization accepts five digit and ZIP+4 but rejects non-ZIP text",()=>{
  assert.equal(frost.normalizeZip("48661"),"48661");
  assert.equal(frost.normalizeZip("48661-1234"),"48661");
  assert.equal(frost.normalizeZip("West Branch, MI 48661"),"48661");
  assert.equal(frost.normalizeZip("West Branch, MI"),null);
});

test("NCEI coordinates are rounded before search requests",()=>{
  assert.equal(frost.roundCoord(44.626408000000005),44.626408);
  assert.equal(frost.normalizeDate("   05/21").mmdd,"05-21");
});
