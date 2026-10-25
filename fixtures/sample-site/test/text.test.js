const test = require("node:test");
const assert = require("node:assert/strict");
const { slugify, formatRupiah } = require("../src/text");

test("slugify makes URL-safe slugs", () => {
  assert.equal(slugify("Rumah Tinggal Klaten!"), "rumah-tinggal-klaten");
  assert.equal(slugify("  Café  &  Gudang  "), "cafe-gudang");
});

test("formatRupiah adds thousand separators", () => {
  assert.equal(formatRupiah(1500000), "Rp 1.500.000");
  assert.equal(formatRupiah(999), "Rp 999");
});
