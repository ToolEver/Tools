/* ToolKit Hub: tool catalog.
   Every tool runs in the visitor's browser. A run() function receives the form values
   and returns { stats: [[label, value], ...], text: "..." } (either or both).
   Add a new tool by calling add({...}). Keep slugs lowercase with hyphens. */

const CATS = {
  text:    { name: "Text Tools", blurb: "Count, clean, format and transform text." },
  finance: { name: "Finance Calculators", blurb: "EMI, GST, SIP, interest, tax and business maths." },
  health:  { name: "Health & Fitness", blurb: "BMI, calories, heart rate and pregnancy due dates." },
  date:    { name: "Date & Time", blurb: "Age, date differences, working days and timestamps." },
  dev:     { name: "Developer Tools", blurb: "Format, encode, generate and test for developers." },
  convert: { name: "Unit & Data Converters", blurb: "Length, weight, temperature, data, numbers and more." },
  misc:    { name: "Everyday Tools", blurb: "Random pickers, grades, attendance and bill splitting." },
  image:   { name: "Image Tools", blurb: "Compress, convert and resize photos in your browser." },
  pdf:     { name: "PDF Tools", blurb: "Merge PDF files in your browser." }
};

const F = {
  n: (id, label, def = 0, step = "any") => ({ id, label, type: "number", def, step }),
  x: (id, label, def = "") => ({ id, label, type: "text", def }),
  t: (id, label, def = "", rows = 6) => ({ id, label, type: "textarea", def, rows }),
  d: (id, label, def = "") => ({ id, label, type: "date", def }),
  s: (id, label, opts, def) => ({ id, label, type: "select", opts, def })
};

const TOOLS = [];
function add(tool) { TOOLS.push(tool); }

/* ---------- Shared helpers ---------- */
function rs(n, d = 0) {
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function num(n, d = 2) {
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });
}
function pd(s) {
  if (!s) throw new Error("Please pick a date.");
  return new Date(s + "T00:00:00");
}
function need(v, msg = "Please enter a valid value.") {
  if (v === undefined || v === null || Number.isNaN(v)) throw new Error(msg);
}
function toRoman(n) {
  const m = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let s = "";
  for (const [v, r] of m) while (n >= v) { s += r; n -= v; }
  return s;
}
function fromRoman(str) {
  const val = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const s = str.toUpperCase().trim();
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const c = val[s[i]];
    if (!c) throw new Error("Invalid Roman numeral.");
    const next = val[s[i + 1]] || 0;
    total += c < next ? -c : c;
  }
  if (toRoman(total) !== s) throw new Error("Invalid Roman numeral.");
  return total;
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}
function slabTax(t) {
  const br = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
  let tax = 0, prev = 0;
  for (const [lim, r] of br) { if (t > prev) tax += (Math.min(t, lim) - prev) * r; prev = lim; }
  return tax;
}
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function twoDigits(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""); }
function threeDigits(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? ONES[h] + " hundred" + (r ? " " : "") : "") + (r ? twoDigits(r) : "");
}
function indianWords(n) {
  if (n === 0) return "zero";
  const parts = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push(indianWords(cr) + " crore");
  if (lk) parts.push(twoDigits(lk) + " lakh");
  if (th) parts.push(twoDigits(th) + " thousand");
  if (n) parts.push(threeDigits(n));
  return parts.join(" ");
}
const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

/* Generic unit converter: U maps unit -> factor to the base unit. */
function addConverter(slug, name, desc, U, def) {
  add({
    slug, name, cat: "convert", desc,
    fields: [F.n("value", "Value", 1), F.s("unit", "From unit", Object.keys(U).map(k => [k, k]), def)],
    run: v => {
      need(v.value);
      const base = v.value * U[v.unit];
      return { stats: Object.keys(U).map(k => [k, num(base / U[k], 6)]) };
    }
  });
}

/* ================= TEXT TOOLS (22) ================= */
add({ slug: "word-counter", name: "Word Counter", cat: "text", desc: "Count words, characters, sentences, paragraphs and reading time.",
  fields: [F.t("text", "Your text")],
  run: v => {
    const x = v.text.trim(), w = x ? x.split(/\s+/).length : 0;
    return { stats: [["Words", w], ["Characters", v.text.length], ["Without spaces", v.text.replace(/\s/g, "").length],
      ["Sentences", (x.match(/[.!?]+(\s|$)/g) || []).length], ["Paragraphs", x ? x.split(/\n\s*\n/).length : 0],
      ["Reading time", w ? Math.max(1, Math.round(w / 200)) + " min" : "0 min"]] };
  } });

add({ slug: "character-counter", name: "Character Counter", cat: "text", desc: "Count characters with spaces, without spaces, lines and UTF-8 bytes.",
  fields: [F.t("text", "Your text")],
  run: v => ({ stats: [["Characters", v.text.length], ["Without spaces", v.text.replace(/\s/g, "").length],
    ["UTF-8 bytes", new TextEncoder().encode(v.text).length], ["Lines", v.text ? v.text.split("\n").length : 0]] }) });

add({ slug: "case-converter", name: "Case Converter", cat: "text", desc: "Convert text to UPPER, lower, Title, Sentence or aLtErNaTiNg case.",
  fields: [F.t("text", "Your text", "", 5),
    F.s("mode", "Convert to", [["upper", "UPPER CASE"], ["lower", "lower case"], ["title", "Title Case"], ["sentence", "Sentence case"], ["alt", "aLtErNaTiNg"]], "title")],
  run: v => {
    const t = v.text, m = v.mode;
    const out = m === "upper" ? t.toUpperCase() : m === "lower" ? t.toLowerCase()
      : m === "title" ? t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      : m === "sentence" ? t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase())
      : [...t].map((c, i) => (i % 2 ? c.toLowerCase() : c.toUpperCase())).join("");
    return { text: out };
  } });

const wordsOf = t => (t.toLowerCase().match(/[a-z0-9]+/g) || []);
add({ slug: "camel-case-converter", name: "Camel Case Converter", cat: "text", desc: "Turn any phrase into camelCase for code variables.",
  fields: [F.t("text", "Your phrase", "", 3)],
  run: v => ({ text: wordsOf(v.text).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join("") }) });
add({ slug: "snake-case-converter", name: "Snake Case Converter", cat: "text", desc: "Turn any phrase into snake_case for code or database names.",
  fields: [F.t("text", "Your phrase", "", 3)],
  run: v => ({ text: wordsOf(v.text).join("_") }) });
add({ slug: "kebab-case-converter", name: "Kebab Case Converter", cat: "text", desc: "Turn any phrase into kebab-case for URLs and CSS classes.",
  fields: [F.t("text", "Your phrase", "", 3)],
  run: v => ({ text: wordsOf(v.text).join("-") }) });

add({ slug: "remove-duplicate-lines", name: "Remove Duplicate Lines", cat: "text", desc: "Delete repeated lines and keep the first occurrence of each.",
  fields: [F.t("text", "Your lines")],
  run: v => {
    const seen = new Set(), out = [];
    const lines = v.text.split("\n");
    lines.forEach(l => { if (!seen.has(l)) { seen.add(l); out.push(l); } });
    return { stats: [["Lines removed", lines.length - out.length]], text: out.join("\n") };
  } });

add({ slug: "sort-lines", name: "Sort Lines", cat: "text", desc: "Sort lines alphabetically or numerically, ascending or descending.",
  fields: [F.t("text", "Your lines"), F.s("order", "Order", [["asc", "A to Z"], ["desc", "Z to A"], ["num", "Numeric (smallest first)"]], "asc")],
  run: v => {
    const sorted = [...v.text.split("\n")].sort((a, b) => v.order === "num" ? (parseFloat(a) || 0) - (parseFloat(b) || 0)
      : v.order === "desc" ? b.localeCompare(a) : a.localeCompare(b));
    return { text: sorted.join("\n") };
  } });

add({ slug: "reverse-text", name: "Reverse Text", cat: "text", desc: "Reverse the characters or the word order of any text.",
  fields: [F.t("text", "Your text", "", 4), F.s("mode", "Reverse", [["chars", "Characters"], ["words", "Word order"]], "chars")],
  run: v => ({ text: v.mode === "words" ? v.text.split(/\s+/).reverse().join(" ") : [...v.text].reverse().join("") }) });

add({ slug: "remove-extra-spaces", name: "Remove Extra Spaces", cat: "text", desc: "Clean up double spaces, tabs and extra blank lines.",
  fields: [F.t("text", "Your text")],
  run: v => ({ text: v.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() }) });

add({ slug: "slug-generator", name: "URL Slug Generator", cat: "text", desc: "Create a clean, SEO-friendly URL slug from a title.",
  fields: [F.x("text", "Title", "How to Write SEO Friendly Titles!")],
  run: v => ({ text: v.text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }) });

add({ slug: "lorem-ipsum-generator", name: "Lorem Ipsum Generator", cat: "text", desc: "Generate placeholder paragraphs for mockups and layouts.",
  fields: [F.n("count", "Number of paragraphs", 3, 1)],
  run: v => ({ text: Array.from({ length: Math.min(50, Math.max(1, Math.round(v.count))) }, () => LOREM).join("\n\n") }) });

add({ slug: "line-counter", name: "Line Counter", cat: "text", desc: "Count total, empty and non-empty lines in a block of text.",
  fields: [F.t("text", "Your text")],
  run: v => { const l = v.text ? v.text.split("\n") : [];
    return { stats: [["Lines", l.length], ["Non-empty lines", l.filter(x => x.trim()).length], ["Empty lines", l.filter(x => !x.trim()).length]] }; } });

add({ slug: "find-and-replace", name: "Find and Replace", cat: "text", desc: "Replace every match of a word or phrase and count the changes.",
  fields: [F.t("text", "Your text"), F.x("find", "Find"), F.x("replace", "Replace with"),
    F.s("cs", "Case sensitive", [["no", "No"], ["yes", "Yes"]], "no")],
  run: v => {
    if (!v.find) return { text: v.text };
    const esc = v.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(esc, v.cs === "yes" ? "g" : "gi");
    return { stats: [["Replacements", (v.text.match(re) || []).length]], text: v.text.replace(re, v.replace) };
  } });

add({ slug: "email-extractor", name: "Email Extractor", cat: "text", desc: "Pull all unique email addresses out of any text.",
  fields: [F.t("text", "Paste text containing emails")],
  run: v => { const m = [...new Set(v.text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])];
    return { stats: [["Unique emails", m.length]], text: m.join("\n") }; } });

add({ slug: "url-extractor", name: "URL Extractor", cat: "text", desc: "Find every http and https link in a block of text.",
  fields: [F.t("text", "Paste text containing links")],
  run: v => { const m = [...new Set(v.text.match(/https?:\/\/[^\s<>"']+/g) || [])];
    return { stats: [["Unique links", m.length]], text: m.join("\n") }; } });

add({ slug: "keyword-density", name: "Keyword Density Checker", cat: "text", desc: "See the top 10 most used words and their percentage in your content.",
  fields: [F.t("text", "Paste your article or page text")],
  run: v => {
    const words = v.text.toLowerCase().match(/[a-z']+/g) || [];
    if (!words.length) return { text: "Paste some text to see keyword density." };
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { stats: top.map(([w, c]) => [w, (c / words.length * 100).toFixed(1) + "%"]) };
  } });

add({ slug: "acronym-generator", name: "Acronym Generator", cat: "text", desc: "Build an acronym from a phrase, skipping small words like 'and' and 'of'.",
  fields: [F.x("text", "Phrase", "Search Engine Optimization")],
  run: v => { const skip = ["and", "of", "the", "for", "in", "a", "an", "to", "with", "on"];
    return { text: (v.text.match(/[A-Za-z]+/g) || []).filter(w => !skip.includes(w.toLowerCase())).map(w => w[0].toUpperCase()).join("") }; } });

add({ slug: "initials-generator", name: "Initials Generator", cat: "text", desc: "Turn a full name into initials, such as J. R. R. Tolkien.",
  fields: [F.x("text", "Full name", "Priya Kumari Sharma")],
  run: v => ({ text: (v.text.match(/[A-Za-z]+/g) || []).map(w => w[0].toUpperCase() + ".").join(" ") }) });

add({ slug: "remove-html-tags", name: "Remove HTML Tags", cat: "text", desc: "Strip HTML tags and leave only the plain text.",
  fields: [F.t("text", "Paste HTML")],
  run: v => ({ text: v.text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() }) });

add({ slug: "tweet-counter", name: "Tweet Character Counter", cat: "text", desc: "Check if your post fits the 280 character limit.",
  fields: [F.t("text", "Your post", "", 4)],
  run: v => { const n = [...v.text].length;
    return { stats: [["Characters", n], ["Remaining", 280 - n], ["Status", n <= 280 ? "Fits" : "Too long"]] }; } });

add({ slug: "meta-description-checker", name: "Meta Description Length Checker", cat: "text", desc: "Check whether your SEO meta description is within 120 to 160 characters.",
  fields: [F.t("text", "Meta description", "", 3)],
  run: v => { const n = v.text.length;
    return { stats: [["Length", n], ["Recommended", "120 to 160"], ["Status", n === 0 ? "Missing" : n < 120 ? "Too short" : n <= 160 ? "Good" : "Too long"]] }; } });

/* ================= FINANCE (19) ================= */
add({ slug: "emi-calculator", name: "EMI Calculator", cat: "finance", desc: "Find your monthly loan EMI, total interest and total payment.",
  fields: [F.n("amount", "Loan amount (₹)", 500000), F.n("rate", "Annual interest rate (%)", 9, 0.01), F.n("years", "Tenure (years)", 5)],
  run: v => { need(v.amount); const P = v.amount, n = v.years * 12, r = v.rate / 1200;
    const emi = r ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n;
    const total = emi * n;
    return { stats: [["Monthly EMI", rs(emi)], ["Total interest", rs(total - P)], ["Total payment", rs(total)]] }; } });

add({ slug: "gst-calculator", name: "GST Calculator", cat: "finance", desc: "Add or remove GST at 5%, 12%, 18% or 28%.",
  fields: [F.n("amount", "Amount (₹)", 1000), F.s("rate", "GST rate", [["5", "5%"], ["12", "12%"], ["18", "18%"], ["28", "28%"]], "18"),
    F.s("mode", "Mode", [["add", "Add GST to amount"], ["remove", "Remove GST from amount"]], "add")],
  run: v => { let base, gst; const r = +v.rate;
    if (v.mode === "add") { base = v.amount; gst = base * r / 100; }
    else { base = v.amount * 100 / (100 + r); gst = v.amount - base; }
    return { stats: [["Before tax", rs(base, 2)], ["GST (" + r + "%)", rs(gst, 2)], ["Total", rs(base + gst, 2)]] }; } });

add({ slug: "sip-calculator", name: "SIP Calculator", cat: "finance", desc: "Estimate the value of monthly mutual fund investments (SIP).",
  fields: [F.n("monthly", "Monthly investment (₹)", 5000), F.n("rate", "Expected annual return (%)", 12, 0.01), F.n("years", "Years", 10)],
  run: v => { const i = v.rate / 1200, n = v.years * 12, P = v.monthly;
    const fv = i ? P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : P * n, inv = P * n;
    return { stats: [["Invested", rs(inv)], ["Estimated gains", rs(fv - inv)], ["Maturity value", rs(fv)]] }; } });

add({ slug: "lumpsum-calculator", name: "Lumpsum Calculator", cat: "finance", desc: "Project the growth of a one-time investment at a fixed return.",
  fields: [F.n("amount", "Investment (₹)", 100000), F.n("rate", "Expected annual return (%)", 12, 0.01), F.n("years", "Years", 5)],
  run: v => { const fv = v.amount * Math.pow(1 + v.rate / 100, v.years);
    return { stats: [["Invested", rs(v.amount)], ["Gains", rs(fv - v.amount)], ["Maturity value", rs(fv)]] }; } });

add({ slug: "fd-calculator", name: "Fixed Deposit Calculator", cat: "finance", desc: "Calculate fixed deposit maturity with quarterly, monthly or yearly compounding.",
  fields: [F.n("principal", "Deposit amount (₹)", 100000), F.n("rate", "Interest rate (% per year)", 7, 0.01), F.n("years", "Tenure (years)", 3),
    F.s("freq", "Compounding", [["1", "Yearly"], ["4", "Quarterly"], ["12", "Monthly"]], "4")],
  run: v => { const m = +v.freq, A = v.principal * Math.pow(1 + v.rate / 100 / m, m * v.years);
    return { stats: [["Principal", rs(v.principal)], ["Interest earned", rs(A - v.principal)], ["Maturity amount", rs(A)]] }; } });

add({ slug: "rd-calculator", name: "Recurring Deposit Calculator", cat: "finance", desc: "Estimate maturity value of a monthly recurring deposit.",
  fields: [F.n("monthly", "Monthly deposit (₹)", 2000), F.n("rate", "Interest rate (% per year)", 6.5, 0.01), F.n("months", "Tenure (months)", 36, 1)],
  run: v => { const i = v.rate / 1200, n = v.months, P = v.monthly;
    const M = i ? P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : P * n, inv = P * n;
    return { stats: [["Total deposited", rs(inv)], ["Interest earned", rs(M - inv)], ["Maturity amount", rs(M)]] }; } });

add({ slug: "simple-interest-calculator", name: "Simple Interest Calculator", cat: "finance", desc: "Calculate simple interest and total amount on a principal.",
  fields: [F.n("principal", "Principal (₹)", 50000), F.n("rate", "Rate (% per year)", 8, 0.01), F.n("years", "Time (years)", 2)],
  run: v => { const si = v.principal * v.rate * v.years / 100;
    return { stats: [["Simple interest", rs(si, 2)], ["Total amount", rs(v.principal + si, 2)]] }; } });

add({ slug: "compound-interest-calculator", name: "Compound Interest Calculator", cat: "finance", desc: "See how your savings grow with compound interest at any frequency.",
  fields: [F.n("principal", "Principal (₹)", 100000), F.n("rate", "Rate (% per year)", 10, 0.01), F.n("years", "Time (years)", 5),
    F.s("freq", "Compounded", [["1", "Yearly"], ["2", "Half-yearly"], ["4", "Quarterly"], ["12", "Monthly"]], "1")],
  run: v => { const m = +v.freq, A = v.principal * Math.pow(1 + v.rate / 100 / m, m * v.years);
    return { stats: [["Interest earned", rs(A - v.principal, 2)], ["Final amount", rs(A, 2)]] }; } });

add({ slug: "ppf-calculator", name: "PPF Calculator", cat: "finance", desc: "Estimate Public Provident Fund maturity from yearly deposits.",
  fields: [F.n("yearly", "Yearly deposit (₹, max 1,50,000)", 150000), F.n("rate", "Interest rate (% per year)", 7.1, 0.01), F.n("years", "Years", 15)],
  run: v => { const i = v.rate / 100, n = v.years, P = Math.min(v.yearly, 150000);
    const M = i ? P * (Math.pow(1 + i, n) - 1) / i : P * n, inv = P * n;
    return { stats: [["Invested", rs(inv)], ["Interest", rs(M - inv)], ["Maturity value", rs(M)]] }; } });

add({ slug: "cagr-calculator", name: "CAGR Calculator", cat: "finance", desc: "Compute compound annual growth rate between a start and end value.",
  fields: [F.n("begin", "Starting value", 10000), F.n("end", "Ending value", 25000), F.n("years", "Number of years", 5)],
  run: v => { if (v.begin <= 0 || v.years <= 0) throw new Error("Start value and years must be above zero.");
    return { stats: [["CAGR", ((Math.pow(v.end / v.begin, 1 / v.years) - 1) * 100).toFixed(2) + "% per year"]] }; } });

add({ slug: "roi-calculator", name: "ROI Calculator", cat: "finance", desc: "Calculate return on investment as a percentage.",
  fields: [F.n("cost", "Amount invested (₹)", 50000), F.n("returns", "Final value (₹)", 65000)],
  run: v => { if (!v.cost) throw new Error("Investment must be above zero.");
    const gain = v.returns - v.cost;
    return { stats: [["Gain or loss", rs(gain)], ["ROI", (gain / v.cost * 100).toFixed(2) + "%"]] }; } });

add({ slug: "profit-margin-calculator", name: "Profit Margin Calculator", cat: "finance", desc: "Work out gross profit, profit margin and markup from revenue and cost.",
  fields: [F.n("revenue", "Revenue or selling price (₹)", 1200), F.n("cost", "Cost (₹)", 800)],
  run: v => { if (!v.revenue) throw new Error("Revenue must be above zero.");
    const p = v.revenue - v.cost;
    return { stats: [["Profit", rs(p, 2)], ["Profit margin", (p / v.revenue * 100).toFixed(2) + "%"], ["Markup", v.cost ? (p / v.cost * 100).toFixed(2) + "%" : "-"]] }; } });

add({ slug: "discount-calculator", name: "Discount Calculator", cat: "finance", desc: "Find the final price and savings after a percentage discount.",
  fields: [F.n("price", "Original price (₹)", 2500), F.n("discount", "Discount (%)", 20, 0.01)],
  run: v => { const saved = v.price * v.discount / 100;
    return { stats: [["You save", rs(saved, 2)], ["Final price", rs(v.price - saved, 2)]] }; } });

add({ slug: "percentage-calculator", name: "Percentage Calculator", cat: "finance", desc: "Find what percent of a number another number is, or what X% of Y equals.",
  fields: [F.n("x", "Percentage (%)", 15), F.n("y", "Of this number", 2000)],
  run: v => ({ stats: [[v.x + "% of " + num(v.y, 4), num(v.x / 100 * v.y, 4)]] }) });

add({ slug: "percentage-change-calculator", name: "Percentage Change Calculator", cat: "finance", desc: "Measure the increase or decrease between an old and new value.",
  fields: [F.n("oldValue", "Old value", 200), F.n("newValue", "New value", 250)],
  run: v => { if (!v.oldValue) throw new Error("Old value cannot be zero.");
    const c = (v.newValue - v.oldValue) / v.oldValue * 100;
    return { stats: [["Change", (c >= 0 ? "+" : "") + c.toFixed(2) + "%"], ["Difference", num(v.newValue - v.oldValue, 4)]] }; } });

add({ slug: "break-even-calculator", name: "Break-Even Calculator", cat: "finance", desc: "Find how many units you must sell to cover your fixed costs.",
  fields: [F.n("fixed", "Fixed costs per month (₹)", 50000), F.n("price", "Selling price per unit (₹)", 500), F.n("variable", "Variable cost per unit (₹)", 300)],
  run: v => { if (v.price <= v.variable) throw new Error("Selling price must be higher than variable cost per unit.");
    const units = Math.ceil(v.fixed / (v.price - v.variable));
    return { stats: [["Units to break even", num(units, 0)], ["Revenue at break-even", rs(units * v.price)]] }; } });

add({ slug: "income-tax-estimator", name: "Income Tax Estimator (New Regime)", cat: "finance", desc: "Rough estimate of salaried income tax under the new regime for FY 2025-26.",
  fields: [F.n("income", "Annual gross salary (₹)", 1000000)],
  run: v => { const taxable = Math.max(0, v.income - 75000);
    let tax = taxable <= 1200000 ? 0 : slabTax(taxable);
    const cess = tax * 0.04;
    return { stats: [["Taxable income", rs(taxable)], ["Income tax", rs(tax)], ["Cess (4%)", rs(cess)], ["Total tax (estimate)", rs(tax + cess)]],
      text: "Simplified estimate: applies the ₹75,000 standard deduction, the 87A rebate for taxable income up to ₹12 lakh, and 4% health and education cess. Marginal relief, surcharge and other deductions are not included. Confirm with a tax professional." }; } });

add({ slug: "inflation-calculator", name: "Inflation Calculator", cat: "finance", desc: "See how much a price today will cost in the future at a given inflation rate.",
  fields: [F.n("amount", "Amount today (₹)", 100000), F.n("inflation", "Average annual inflation (%)", 6, 0.01), F.n("years", "Years from now", 10)],
  run: v => { const future = v.amount * Math.pow(1 + v.inflation / 100, v.years);
    return { stats: [["Future cost of the same goods", rs(future)], ["Increase", rs(future - v.amount)]] }; } });

add({ slug: "depreciation-calculator", name: "Depreciation Calculator", cat: "finance", desc: "Calculate straight-line depreciation for an asset over its useful life.",
  fields: [F.n("cost", "Asset cost (₹)", 100000), F.n("salvage", "Salvage value (₹)", 10000), F.n("life", "Useful life (years)", 5)],
  run: v => { if (!v.life) throw new Error("Useful life must be above zero.");
    const annual = (v.cost - v.salvage) / v.life;
    return { stats: [["Yearly depreciation", rs(annual, 2)], ["Monthly depreciation", rs(annual / 12, 2)], ["Value after life", rs(v.salvage)]] }; } });

/* ================= HEALTH (8) ================= */
add({ slug: "bmi-calculator", name: "BMI Calculator", cat: "health", desc: "Check your body mass index and weight category.",
  fields: [F.n("height", "Height (cm)", 170), F.n("weight", "Weight (kg)", 70)],
  run: v => { if (!v.height) throw new Error("Enter your height."); const h = v.height / 100, bmi = v.weight / (h * h);
    const cat = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
    return { stats: [["BMI", bmi.toFixed(1)], ["Category", cat]], text: "BMI is a general guide. It does not measure muscle mass or body fat directly." }; } });

const SEX = [["male", "Male"], ["female", "Female"]];
const bmrOf = v => 10 * v.weight + 6.25 * v.height - 5 * v.age + (v.sex === "male" ? 5 : -161);
add({ slug: "bmr-calculator", name: "BMR Calculator", cat: "health", desc: "Estimate your basal metabolic rate, the calories your body burns at rest.",
  fields: [F.s("sex", "Sex", SEX, "male"), F.n("age", "Age (years)", 30, 1), F.n("height", "Height (cm)", 170), F.n("weight", "Weight (kg)", 70)],
  run: v => ({ stats: [["BMR", Math.round(bmrOf(v)) + " kcal/day"]], text: "Uses the Mifflin-St Jeor equation." }) });

add({ slug: "calorie-calculator", name: "Daily Calorie Calculator", cat: "health", desc: "Estimate daily calorie needs for maintenance, weight loss or weight gain.",
  fields: [F.s("sex", "Sex", SEX, "male"), F.n("age", "Age (years)", 30, 1), F.n("height", "Height (cm)", 170), F.n("weight", "Weight (kg)", 70),
    F.s("activity", "Activity level", [["1.2", "Sedentary (little or no exercise)"], ["1.375", "Light (1-3 days a week)"], ["1.55", "Moderate (3-5 days a week)"], ["1.725", "Very active (6-7 days a week)"], ["1.9", "Athlete (hard daily training)"]], "1.55")],
  run: v => { const m = bmrOf(v) * +v.activity;
    return { stats: [["Maintenance", Math.round(m) + " kcal"], ["Lose 0.5 kg a week", Math.round(m - 500) + " kcal"], ["Gain 0.5 kg a week", Math.round(m + 500) + " kcal"]],
      text: "Estimates only. Adjust based on how your weight changes over 2 to 3 weeks." }; } });

add({ slug: "ideal-weight-calculator", name: "Ideal Weight Calculator", cat: "health", desc: "Estimate ideal body weight from height using the Devine formula.",
  fields: [F.s("sex", "Sex", SEX, "male"), F.n("height", "Height (cm)", 170)],
  run: v => { const inches = v.height / 2.54;
    const ideal = (v.sex === "male" ? 50 : 45.5) + 2.3 * (inches - 60);
    return { stats: [["Ideal weight", ideal.toFixed(1) + " kg"]], text: "Based on the Devine formula. Use it as a reference, not a target." }; } });

add({ slug: "water-intake-calculator", name: "Water Intake Calculator", cat: "health", desc: "Estimate your daily water needs based on weight and exercise.",
  fields: [F.n("weight", "Weight (kg)", 70), F.n("exercise", "Exercise minutes per day", 30)],
  run: v => { const ml = v.weight * 35 + v.exercise / 30 * 500;
    return { stats: [["Daily water", (ml / 1000).toFixed(2) + " litres"], ["Glasses (250 ml)", Math.round(ml / 250)]] }; } });

add({ slug: "pregnancy-due-date-calculator", name: "Pregnancy Due Date Calculator", cat: "health", desc: "Estimate your due date from the first day of your last period.",
  fields: [F.d("lmp", "First day of last period")],
  run: v => { const lmp = pd(v.lmp), due = new Date(lmp); due.setDate(due.getDate() + 280);
    const fmt = d => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    return { stats: [["Estimated due date", fmt(due)]], text: "This is an estimate. Confirm with your doctor or midwife." }; } });

add({ slug: "heart-rate-zone-calculator", name: "Heart Rate Zone Calculator", cat: "health", desc: "Find your target heart rate zones for training.",
  fields: [F.n("age", "Age (years)", 30, 1)],
  run: v => { const max = 220 - v.age, r = p => Math.round(max * p);
    return { stats: [["Max heart rate", max + " bpm"], ["Warm-up (50-60%)", r(.5) + " to " + r(.6)], ["Fat burn (60-70%)", r(.6) + " to " + r(.7)],
      ["Cardio (70-85%)", r(.7) + " to " + r(.85)], ["Peak (85-100%)", r(.85) + " to " + max]], text: "Uses the 220 minus age estimate." }; } });

add({ slug: "waist-hip-ratio-calculator", name: "Waist to Hip Ratio Calculator", cat: "health", desc: "Calculate waist-to-hip ratio and assess health risk.",
  fields: [F.s("sex", "Sex", SEX, "male"), F.n("waist", "Waist (cm)", 85), F.n("hip", "Hip (cm)", 100)],
  run: v => { if (!v.hip) throw new Error("Enter hip measurement.");
    const ratio = v.waist / v.hip, limit = v.sex === "male" ? 0.9 : 0.85;
    return { stats: [["Waist to hip ratio", ratio.toFixed(2)], ["Risk", ratio > limit ? "Higher" : "Lower"]], text: "Higher risk is above 0.90 for men and 0.85 for women." }; } });

/* ================= DATE & TIME (9) ================= */
add({ slug: "age-calculator", name: "Age Calculator", cat: "date", desc: "Calculate exact age in years, months and days from a date of birth.",
  fields: [F.d("dob", "Date of birth")],
  run: v => { const d = pd(v.dob), t = new Date();
    let y = t.getFullYear() - d.getFullYear(), m = t.getMonth() - d.getMonth(), dd = t.getDate() - d.getDate();
    if (dd < 0) { m--; dd += new Date(t.getFullYear(), t.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    return { stats: [["Years", y], ["Months", m], ["Days", dd], ["Total days", Math.floor((t - d) / 864e5).toLocaleString("en-IN")]] }; } });

add({ slug: "date-difference-calculator", name: "Date Difference Calculator", cat: "date", desc: "Count the days, weeks and months between two dates.",
  fields: [F.d("start", "Start date"), F.d("end", "End date")],
  run: v => { const days = Math.round((pd(v.end) - pd(v.start)) / 864e5);
    return { stats: [["Days", days], ["Weeks", num(days / 7, 1)], ["Approx months", num(days / 30.44, 1)]] }; } });

add({ slug: "add-days-to-date", name: "Add Days to Date", cat: "date", desc: "Find the date that is a given number of days before or after another date.",
  fields: [F.d("start", "Start date"), F.n("days", "Days to add (negative to subtract)", 90, 1)],
  run: v => { const d = pd(v.start); d.setDate(d.getDate() + Math.round(v.days));
    return { stats: [["Result", d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })]] }; } });

add({ slug: "days-until-calculator", name: "Days Until Calculator", cat: "date", desc: "Count down the days until an event, or since it happened.",
  fields: [F.d("target", "Event date")],
  run: v => { const t = pd(v.target), now = new Date(); now.setHours(0, 0, 0, 0);
    const diff = Math.round((t - now) / 864e5);
    return { stats: [[diff >= 0 ? "Days until" : "Days since", Math.abs(diff)]] }; } });

add({ slug: "weekday-finder", name: "Day of the Week Finder", cat: "date", desc: "Find which day of the week any date falls on.",
  fields: [F.d("date", "Date")],
  run: v => ({ stats: [["Day", pd(v.date).toLocaleDateString("en-IN", { weekday: "long" })]] }) });

add({ slug: "working-days-calculator", name: "Working Days Calculator", cat: "date", desc: "Count Monday to Friday working days between two dates, excluding weekends.",
  fields: [F.d("start", "Start date"), F.d("end", "End date")],
  run: v => { const s = pd(v.start), e = pd(v.end); let c = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w !== 0 && w !== 6) c++; }
    return { stats: [["Working days", c]], text: "Public holidays are not excluded." }; } });

add({ slug: "unix-timestamp-converter", name: "Unix Timestamp Converter", cat: "date", desc: "Convert a Unix timestamp to a readable date in IST and UTC.",
  fields: [F.n("ts", "Unix timestamp (seconds)", 1790000000, 1)],
  run: v => { const d = new Date(v.ts * 1000);
    if (isNaN(d)) throw new Error("Invalid timestamp.");
    return { stats: [["IST", d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })], ["UTC", d.toISOString().replace("T", " ").slice(0, 19)]] }; } });

add({ slug: "week-number-calculator", name: "Week Number Calculator", cat: "date", desc: "Find the ISO week number of any date.",
  fields: [F.d("date", "Date")],
  run: v => ({ stats: [["ISO week", isoWeek(pd(v.date))]] }) });

add({ slug: "leap-year-checker", name: "Leap Year Checker", cat: "date", desc: "Check whether a year is a leap year.",
  fields: [F.n("year", "Year", 2028, 1)],
  run: v => { const y = Math.round(v.year), leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return { stats: [["Year", y], ["Leap year", leap ? "Yes" : "No"]] }; } });

/* ================= DEVELOPER (20) ================= */
add({ slug: "json-formatter", name: "JSON Formatter", cat: "dev", desc: "Validate and pretty-print JSON with clean indentation.",
  fields: [F.t("text", "Paste JSON", '{"name":"ToolKit","tools":108}', 10)],
  run: v => ({ text: JSON.stringify(JSON.parse(v.text), null, 2) }) });

add({ slug: "json-validator", name: "JSON Validator", cat: "dev", desc: "Check whether your JSON is valid and see the exact error if it is not.",
  fields: [F.t("text", "Paste JSON", "", 8)],
  run: v => { JSON.parse(v.text); return { stats: [["Status", "Valid JSON"]] }; } });

add({ slug: "base64-encoder", name: "Base64 Encoder", cat: "dev", desc: "Encode text into Base64, with full support for Unicode and Hindi text.",
  fields: [F.t("text", "Text to encode", "", 5)],
  run: v => { let bin = ""; new TextEncoder().encode(v.text).forEach(b => { bin += String.fromCharCode(b); }); return { text: btoa(bin) }; } });

add({ slug: "base64-decoder", name: "Base64 Decoder", cat: "dev", desc: "Decode a Base64 string back into readable text.",
  fields: [F.t("text", "Base64 to decode", "", 5)],
  run: v => { const bin = atob(v.text.trim()); return { text: new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))) }; } });

add({ slug: "url-encoder", name: "URL Encoder", cat: "dev", desc: "Encode text so it can be safely used in a URL or query string.",
  fields: [F.t("text", "Text to encode", "", 4)],
  run: v => ({ text: encodeURIComponent(v.text) }) });

add({ slug: "url-decoder", name: "URL Decoder", cat: "dev", desc: "Decode percent-encoded URLs and query strings.",
  fields: [F.t("text", "Encoded text", "", 4)],
  run: v => ({ text: decodeURIComponent(v.text) }) });

add({ slug: "html-escape", name: "HTML Escape", cat: "dev", desc: "Convert special characters like < > & and quotes into safe HTML entities.",
  fields: [F.t("text", "Your code or text", "", 5)],
  run: v => ({ text: v.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;") }) });

add({ slug: "html-unescape", name: "HTML Unescape", cat: "dev", desc: "Turn HTML entities such as &amp; back into normal characters.",
  fields: [F.t("text", "Escaped HTML", "", 5)],
  run: v => { const d = document.createElement("textarea"); d.innerHTML = v.text; return { text: d.value }; } });

add({ slug: "password-generator", name: "Password Generator", cat: "dev", desc: "Generate strong random passwords. Nothing is stored or sent anywhere.",
  fields: [F.n("length", "Length", 16, 1), F.s("symbols", "Include symbols", [["yes", "Yes"], ["no", "No"]], "yes")],
  run: v => { let pool = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    if (v.symbols === "yes") pool += "!@#$%^&*()-_=+[]{};:,.?";
    const len = Math.min(128, Math.max(8, Math.round(v.length))), bytes = new Uint32Array(len);
    crypto.getRandomValues(bytes);
    return { text: Array.from(bytes, b => pool[b % pool.length]).join("") }; } });

add({ slug: "pin-generator", name: "PIN Generator", cat: "dev", desc: "Generate a random numeric PIN of any length.",
  fields: [F.n("digits", "Number of digits", 6, 1)],
  run: v => { const n = Math.min(20, Math.max(4, Math.round(v.digits))), a = new Uint32Array(n);
    crypto.getRandomValues(a); return { text: Array.from(a, x => x % 10).join("") }; } });

add({ slug: "uuid-generator", name: "UUID Generator", cat: "dev", desc: "Generate random version 4 UUIDs for databases and APIs.",
  fields: [F.n("count", "How many", 5, 1)],
  run: v => ({ text: Array.from({ length: Math.min(100, Math.max(1, Math.round(v.count))) }, () => crypto.randomUUID()).join("\n") }) });

add({ slug: "sha256-generator", name: "SHA-256 Hash Generator", cat: "dev", desc: "Create a SHA-256 hash of any text, computed in your browser.",
  fields: [F.t("text", "Text to hash", "", 4)],
  run: async v => { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.text));
    return { text: Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("") }; } });

add({ slug: "regex-tester", name: "Regex Tester", cat: "dev", desc: "Test a regular expression against text and list every match.",
  fields: [F.x("pattern", "Pattern (without slashes)", "\\d{4}-\\d{2}-\\d{2}"), F.x("flags", "Flags", "g"), F.t("text", "Test text", "Dates: 2026-10-09 and 2027-01-15", 4)],
  run: v => { const flags = v.flags.includes("g") ? v.flags : v.flags + "g";
    const m = [...v.text.matchAll(new RegExp(v.pattern, flags))];
    return { stats: [["Matches", m.length]], text: m.map(x => x[0]).join("\n") }; } });

add({ slug: "css-minifier", name: "CSS Minifier", cat: "dev", desc: "Remove comments and whitespace from CSS to reduce file size.",
  fields: [F.t("text", "Your CSS", "", 8)],
  run: v => { const out = v.text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,>])\s*/g, "$1").replace(/;}/g, "}").trim();
    return { stats: [["Original bytes", v.text.length], ["Minified bytes", out.length]], text: out }; } });

add({ slug: "hex-to-rgb", name: "HEX to RGB Converter", cat: "dev", desc: "Convert a hex color code such as #2563eb into RGB values.",
  fields: [F.x("hex", "Hex color", "#2563eb")],
  run: v => { let h = v.hex.replace("#", "").trim(); if (h.length === 3) h = h.split("").map(c => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("Enter a valid hex color, such as #2563eb.");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return { stats: [["Red", r], ["Green", g], ["Blue", b]], text: `rgb(${r}, ${g}, ${b})` }; } });

add({ slug: "rgb-to-hex", name: "RGB to HEX Converter", cat: "dev", desc: "Convert red, green and blue values into a hex color code.",
  fields: [F.n("r", "Red (0-255)", 37, 1), F.n("g", "Green (0-255)", 99, 1), F.n("b", "Blue (0-255)", 235, 1)],
  run: v => { const c = x => { const n = Math.min(255, Math.max(0, Math.round(x))); return n.toString(16).padStart(2, "0"); };
    return { text: "#" + (c(v.r) + c(v.g) + c(v.b)).toUpperCase() }; } });

const HTTP = { 200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found", 304: "Not Modified",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 408: "Request Timeout",
  409: "Conflict", 422: "Unprocessable Entity", 429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway",
  503: "Service Unavailable", 504: "Gateway Timeout" };
add({ slug: "http-status-lookup", name: "HTTP Status Code Lookup", cat: "dev", desc: "Look up the meaning of common HTTP status codes like 404 or 503.",
  fields: [F.n("code", "Status code", 404, 1)],
  run: v => { const c = Math.round(v.code), name = HTTP[c];
    const cls = c >= 500 ? "Server error" : c >= 400 ? "Client error" : c >= 300 ? "Redirection" : c >= 200 ? "Success" : "Information";
    return { stats: [["Code", c], ["Meaning", name || "Not in this list"], ["Class", cls]] }; } });

add({ slug: "chmod-calculator", name: "Linux chmod Calculator", cat: "dev", desc: "Convert octal file permissions like 755 into rwx symbols and back.",
  fields: [F.x("mode", "Octal permissions (e.g. 755)", "755")],
  run: v => { if (!/^[0-7]{3}$/.test(v.mode)) throw new Error("Enter three octal digits, such as 644 or 755.");
    const map = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    const sym = [...v.mode].map(d => map[+d]).join("");
    return { stats: [["Symbolic", sym]], text: `chmod ${v.mode} file` }; } });

add({ slug: "subnet-calculator", name: "Subnet Calculator", cat: "dev", desc: "Find the network, broadcast, host range and usable hosts for an IPv4 CIDR.",
  fields: [F.x("cidr", "IPv4 address with prefix", "192.168.1.10/24")],
  run: v => { const [ip, cidr] = v.cidr.split("/"), bits = parseInt(cidr, 10), p = (ip || "").split(".").map(Number);
    if (p.length !== 4 || p.some(x => isNaN(x) || x < 0 || x > 255) || !(bits >= 0 && bits <= 32))
      throw new Error("Use the format 192.168.1.10/24.");
    const int = ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
    const mask = bits ? (0xFFFFFFFF << (32 - bits)) >>> 0 : 0;
    const net = (int & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
    const toIp = x => [x >>> 24, (x >>> 16) & 255, (x >>> 8) & 255, x & 255].join(".");
    const hosts = bits === 32 ? 1 : bits === 31 ? 2 : Math.pow(2, 32 - bits) - 2;
    return { stats: [["Network", toIp(net)], ["Broadcast", toIp(bc)], ["First host", bits >= 31 ? "-" : toIp(net + 1)],
      ["Last host", bits >= 31 ? "-" : toIp(bc - 1)], ["Usable hosts", num(hosts, 0)], ["Subnet mask", toIp(mask)]] }; } });

add({ slug: "random-string-generator", name: "Random String Generator", cat: "dev", desc: "Generate random strings of letters, numbers or both for tokens and test data.",
  fields: [F.n("length", "Length", 20, 1), F.s("set", "Characters", [["alnum", "Letters and numbers"], ["alpha", "Letters only"], ["num", "Numbers only"]], "alnum")],
  run: v => { const pools = { alnum: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", num: "0123456789" };
    const pool = pools[v.set], len = Math.min(256, Math.max(1, Math.round(v.length))), a = new Uint32Array(len);
    crypto.getRandomValues(a); return { text: Array.from(a, x => pool[x % pool.length]).join("") }; } });

/* ================= CONVERTERS (15) ================= */
addConverter("length-converter", "Length Converter", "Convert between metres, feet, inches, miles and more.",
  { m: 1, cm: 0.01, mm: 0.001, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 }, "m");
addConverter("weight-converter", "Weight Converter", "Convert between kilograms, grams, pounds, ounces and tonnes.",
  { kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.0283495231, tonne: 1000, stone: 6.35029318 }, "kg");
addConverter("area-converter", "Area Converter", "Convert square metres, acres, hectares, square feet and more.",
  { m2: 1, km2: 1e6, cm2: 0.0001, ft2: 0.09290304, sq_yd: 0.83612736, acre: 4046.8564224, hectare: 10000 }, "m2");
addConverter("volume-converter", "Volume Converter", "Convert litres, millilitres, gallons, cups and tablespoons.",
  { l: 1, ml: 0.001, m3: 1000, gal_us: 3.785411784, cup: 0.236588, fl_oz: 0.0295735, tbsp: 0.0147868, tsp: 0.00492892 }, "l");
addConverter("speed-converter", "Speed Converter", "Convert km/h, mph, metres per second and knots.",
  { "m/s": 1, "km/h": 0.277778, mph: 0.44704, knot: 0.514444 }, "km/h");
addConverter("data-storage-converter", "Data Storage Converter", "Convert bytes, KB, MB, GB and TB (binary, 1 KB = 1024 bytes).",
  { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 }, "MB");
addConverter("time-unit-converter", "Time Unit Converter", "Convert seconds, minutes, hours, days, weeks and years.",
  { sec: 1, min: 60, hour: 3600, day: 86400, week: 604800, year: 31557600 }, "hour");

add({ slug: "temperature-converter", name: "Temperature Converter", cat: "convert", desc: "Convert between Celsius, Fahrenheit and Kelvin.",
  fields: [F.n("value", "Temperature", 100), F.s("unit", "From", [["c", "Celsius"], ["f", "Fahrenheit"], ["k", "Kelvin"]], "c")],
  run: v => { const c = v.unit === "c" ? v.value : v.unit === "f" ? (v.value - 32) * 5 / 9 : v.value - 273.15;
    return { stats: [["Celsius", num(c)], ["Fahrenheit", num(c * 9 / 5 + 32)], ["Kelvin", num(c + 273.15)]] }; } });

add({ slug: "fuel-economy-converter", name: "Fuel Economy Converter", cat: "convert", desc: "Convert km per litre to litres per 100 km and miles per gallon.",
  fields: [F.n("kmpl", "Fuel economy (km per litre)", 15)],
  run: v => { if (!v.kmpl) throw new Error("Enter a value above zero.");
    return { stats: [["Litres per 100 km", num(100 / v.kmpl)], ["Miles per gallon (US)", num(v.kmpl * 2.352145)]] }; } });

add({ slug: "number-base-converter", name: "Number Base Converter", cat: "convert", desc: "Convert numbers between decimal, binary, hexadecimal and octal.",
  fields: [F.x("value", "Number", "255"), F.s("base", "Number system", [["10", "Decimal"], ["2", "Binary"], ["16", "Hexadecimal"], ["8", "Octal"]], "10")],
  run: v => { const n = parseInt(v.value.trim(), +v.base); if (isNaN(n)) throw new Error("This is not a valid number in that system.");
    return { stats: [["Decimal", n.toString(10)], ["Binary", n.toString(2)], ["Hexadecimal", n.toString(16).toUpperCase()], ["Octal", n.toString(8)]] }; } });

add({ slug: "roman-to-number", name: "Roman Numeral to Number", cat: "convert", desc: "Convert Roman numerals such as XIV or MMXXVI into normal numbers.",
  fields: [F.x("roman", "Roman numeral", "MMXXVI")],
  run: v => ({ text: String(fromRoman(v.roman)) }) });

add({ slug: "number-to-roman", name: "Number to Roman Numeral", cat: "convert", desc: "Convert numbers from 1 to 3999 into Roman numerals.",
  fields: [F.n("num", "Number (1 to 3999)", 2026, 1)],
  run: v => { const n = Math.round(v.num); if (n < 1 || n > 3999) throw new Error("Enter a number from 1 to 3999.");
    return { text: toRoman(n) }; } });

add({ slug: "number-to-words-indian", name: "Number to Words (Indian System)", cat: "convert", desc: "Write numbers in words using lakh and crore, such as 12,34,567 in words.",
  fields: [F.n("num", "Number", 1234567, 1)],
  run: v => { const n = Math.floor(Math.abs(v.num));
    if (n > 9.99e15) throw new Error("Number is too large.");
    return { text: (v.num < 0 ? "minus " : "") + indianWords(n) }; } });

add({ slug: "text-to-binary", name: "Text to Binary", cat: "convert", desc: "Convert any text into binary code, one byte per group.",
  fields: [F.t("text", "Your text", "", 4)],
  run: v => ({ text: [...new TextEncoder().encode(v.text)].map(b => b.toString(2).padStart(8, "0")).join(" ") }) });

add({ slug: "binary-to-text", name: "Binary to Text", cat: "convert", desc: "Decode binary code groups back into readable text.",
  fields: [F.t("text", "Binary (8 bits per group)", "01001000 01101001", 4)],
  run: v => { const bytes = v.text.trim().split(/\s+/).map(b => parseInt(b, 2));
    if (bytes.some(b => isNaN(b) || b < 0 || b > 255)) throw new Error("Use groups of 0 and 1, such as 01001000.");
    return { text: new TextDecoder().decode(Uint8Array.from(bytes)) }; } });

/* ================= EVERYDAY (11) ================= */
add({ slug: "random-number-generator", name: "Random Number Generator", cat: "misc", desc: "Pick random whole numbers within any range.",
  fields: [F.n("min", "Minimum", 1, 1), F.n("max", "Maximum", 100, 1), F.n("count", "How many", 1, 1)],
  run: v => { let lo = Math.round(v.min), hi = Math.round(v.max); if (lo > hi) [lo, hi] = [hi, lo];
    const n = Math.min(100, Math.max(1, Math.round(v.count)));
    const nums = Array.from({ length: n }, () => Math.floor(Math.random() * (hi - lo + 1)) + lo);
    return { stats: [["Result", nums.join(", ")]], text: nums.join("\n") }; } });

add({ slug: "coin-flip", name: "Coin Flip", cat: "misc", desc: "Flip a virtual coin once or many times and count heads and tails.",
  fields: [F.n("flips", "Number of flips", 1, 1)],
  run: v => { const n = Math.min(10000, Math.max(1, Math.round(v.flips))); let h = 0;
    for (let i = 0; i < n; i++) if (Math.random() < 0.5) h++;
    return { stats: [["Heads", h], ["Tails", n - h]] }; } });

add({ slug: "dice-roller", name: "Dice Roller", cat: "misc", desc: "Roll any number of dice with any number of sides.",
  fields: [F.n("dice", "Number of dice", 2, 1), F.n("sides", "Sides per die", 6, 1)],
  run: v => { const d = Math.min(100, Math.max(1, Math.round(v.dice))), s = Math.min(1000, Math.max(2, Math.round(v.sides)));
    const rolls = Array.from({ length: d }, () => Math.floor(Math.random() * s) + 1);
    return { stats: [["Total", rolls.reduce((a, b) => a + b, 0)]], text: rolls.join(", ") }; } });

add({ slug: "random-picker", name: "Random Name Picker", cat: "misc", desc: "Pick a random winner from a list of names, one per line.",
  fields: [F.t("text", "Names, one per line", "Aarav\nDiya\nRohan\nAnanya", 6)],
  run: v => { const list = v.text.split("\n").map(s => s.trim()).filter(Boolean);
    if (!list.length) throw new Error("Add at least one name.");
    return { stats: [["Winner", list[Math.floor(Math.random() * list.length)]], ["Entries", list.length]] }; } });

add({ slug: "marks-percentage-calculator", name: "Marks to Percentage Calculator", cat: "misc", desc: "Convert marks obtained out of total marks into a percentage.",
  fields: [F.n("obtained", "Marks obtained", 450), F.n("total", "Total marks", 600)],
  run: v => { if (!v.total) throw new Error("Total marks must be above zero.");
    return { stats: [["Percentage", (v.obtained / v.total * 100).toFixed(2) + "%"]] }; } });

add({ slug: "cgpa-to-percentage-calculator", name: "CGPA to Percentage Calculator", cat: "misc", desc: "Convert a 10-point CGPA into a percentage using the common 9.5 factor.",
  fields: [F.n("cgpa", "CGPA (out of 10)", 8.2, 0.01)],
  run: v => ({ stats: [["Percentage", (v.cgpa * 9.5).toFixed(2) + "%"]], text: "Uses the common factor of 9.5. Your university may use a different formula." }) });

add({ slug: "percentage-to-cgpa-calculator", name: "Percentage to CGPA Calculator", cat: "misc", desc: "Convert a percentage into a 10-point CGPA using the common 9.5 factor.",
  fields: [F.n("percent", "Percentage", 78, 0.01)],
  run: v => ({ stats: [["CGPA (out of 10)", (v.percent / 9.5).toFixed(2)]], text: "Uses the common factor of 9.5. Your university may use a different formula." }) });

add({ slug: "attendance-calculator", name: "Attendance Calculator", cat: "misc", desc: "Check your attendance percentage and how many classes you can miss or must attend.",
  fields: [F.n("attended", "Classes attended", 40, 1), F.n("total", "Total classes held", 50, 1), F.n("target", "Required attendance (%)", 75, 1)],
  run: v => { if (!v.total) throw new Error("Total classes must be above zero.");
    const pct = v.attended / v.total * 100, t = v.target / 100;
    if (pct >= v.target) {
      const canMiss = Math.floor(v.attended / t - v.total);
      return { stats: [["Current attendance", pct.toFixed(1) + "%"], ["Can still miss", canMiss + " classes"]] };
    }
    const need = Math.ceil((t * v.total - v.attended) / (1 - t));
    return { stats: [["Current attendance", pct.toFixed(1) + "%"], ["Must attend next", need + " classes"]] };
  } });

add({ slug: "tip-calculator", name: "Tip Calculator", cat: "misc", desc: "Calculate the tip and total bill, and split it between people.",
  fields: [F.n("bill", "Bill amount (₹)", 1500), F.n("tip", "Tip (%)", 10, 0.1), F.n("people", "Number of people", 2, 1)],
  run: v => { const p = Math.max(1, Math.round(v.people)), tip = v.bill * v.tip / 100, total = v.bill + tip;
    return { stats: [["Tip", rs(tip, 2)], ["Total", rs(total, 2)], ["Per person", rs(total / p, 2)]] }; } });

add({ slug: "split-bill-calculator", name: "Split Bill Calculator", cat: "misc", desc: "Split a bill with tax between friends or roommates.",
  fields: [F.n("bill", "Bill before tax (₹)", 3000), F.n("tax", "Tax (%)", 18, 0.1), F.n("people", "Number of people", 4, 1)],
  run: v => { const p = Math.max(1, Math.round(v.people)), total = v.bill * (1 + v.tax / 100);
    return { stats: [["Total with tax", rs(total, 2)], ["Each person pays", rs(total / p, 2)]] }; } });

add({ slug: "weighted-average-calculator", name: "Weighted Average Calculator", cat: "misc", desc: "Calculate a weighted average of scores, such as grades weighted by credits.",
  fields: [F.t("text", "One line per item: score,weight", "85,4\n72,3\n90,2", 6)],
  run: v => { let sum = 0, w = 0, n = 0;
    v.text.split("\n").forEach(line => { const [s, wt] = line.split(",").map(x => parseFloat(x));
      if (!isNaN(s) && !isNaN(wt)) { sum += s * wt; w += wt; n++; } });
    if (!w) throw new Error("Use one line per item, such as 85,4.");
    return { stats: [["Weighted average", num(sum / w, 2)], ["Items", n], ["Total weight", w]] }; } });

/* ================= IMAGE & PDF (browser-based, custom UI) ================= */
add({ slug: "image-compressor", name: "Image Compressor", cat: "image", custom: true, desc: "Reduce JPG or PNG file size with a quality slider, right in your browser." });
add({ slug: "image-converter", name: "Image Converter", cat: "image", custom: true, desc: "Convert images between PNG, JPG and WebP." });
add({ slug: "image-resizer", name: "Image Resizer", cat: "image", custom: true, desc: "Resize a photo to a new width and keep its proportions." });
add({ slug: "merge-pdf", name: "Merge PDF", cat: "pdf", custom: true, desc: "Combine several PDF files into one document, in the order you choose." });

if (typeof module !== "undefined") module.exports = { TOOLS, CATS };
