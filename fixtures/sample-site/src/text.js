// Small text helpers used by the sample company profile page.

// "Rumah Tinggal Klaten!" -> "rumah-tinggal-klaten"
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 1500000 -> "Rp 1.500.000"
function formatRupiah(amount) {
  const n = Math.round(Number(amount));
  return "Rp " + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

module.exports = { slugify, formatRupiah };
