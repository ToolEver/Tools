/* ToolKit Hub: browser engine. Renders the form for generic tools and runs the custom
   image and PDF tools. Loaded on every tool page. */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const statHTML = (l, v) => `<div class="stat"><span>${esc(v)}</span>${esc(l)}</div>`;

function fmtBytes(b) {
  return b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB";
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = URL.createObjectURL(file);
  });
}
const canvasBlob = (canvas, type, q) => new Promise(r => canvas.toBlob(r, type, q));

/* ---------- Generic form tools ---------- */
function fieldHTML(f) {
  const id = "f-" + f.id;
  let control;
  if (f.type === "textarea") {
    control = `<textarea id="${id}" name="${f.id}" rows="${f.rows || 5}">${esc(f.def)}</textarea>`;
  } else if (f.type === "select") {
    const opts = f.opts.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}"${String(v) === String(f.def) ? " selected" : ""}>${esc(l)}</option>`;
    }).join("");
    control = `<select id="${id}" name="${f.id}">${opts}</select>`;
  } else {
    control = `<input id="${id}" name="${f.id}" type="${f.type}" value="${esc(f.def)}"${f.type === "number" ? ` step="${f.step || "any"}"` : ""}>`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}</label>${control}</div>`;
}

function showResult(out, r) {
  let html = "";
  if (r.stats) html += `<div class="stats">${r.stats.map(([l, v]) => statHTML(l, v)).join("")}</div>`;
  if (r.text !== undefined) {
    const rows = Math.min(14, Math.max(3, String(r.text).split("\n").length));
    html += `<div class="field"><label>Result</label><textarea rows="${rows}" readonly>${esc(r.text)}</textarea></div>
             <button class="btn btn-secondary copy-btn" type="button">Copy result</button>`;
  }
  out.innerHTML = html;
  const copy = out.querySelector(".copy-btn");
  if (copy) copy.addEventListener("click", () => {
    navigator.clipboard.writeText(r.text);
    copy.textContent = "Copied";
  });
}

function renderGeneric(root, tool) {
  root.innerHTML = `<form class="tool-form" novalidate>${tool.fields.map(fieldHTML).join("")}
    <button class="btn btn-primary" type="submit">Calculate</button></form>
    <div class="tool-output" aria-live="polite"></div>`;
  const form = root.querySelector("form"), out = root.querySelector(".tool-output");
  const values = () => {
    const v = {};
    tool.fields.forEach(f => {
      const el = form.querySelector(`[name="${f.id}"]`);
      v[f.id] = f.type === "number" ? (parseFloat(el.value) || 0) : el.value;
    });
    return v;
  };
  const run = (quiet) => Promise.resolve()
    .then(() => tool.run(values()))
    .then(r => showResult(out, r))
    .catch(e => { if (!quiet) out.innerHTML = `<p class="error">${esc(e.message || "Please check your input.")}</p>`; else out.innerHTML = ""; });
  form.addEventListener("submit", e => { e.preventDefault(); run(false); });
  form.addEventListener("input", () => run(false));
  run(true);
}

/* ---------- Custom tools ---------- */
const CUSTOM = {};

CUSTOM["merge-pdf"] = root => {
  root.innerHTML = `<div class="tool-form">
    <div class="field"><label for="pdfs">Choose PDF files (select several; they merge in the order chosen)</label>
    <input id="pdfs" type="file" accept="application/pdf" multiple></div>
    <button class="btn btn-primary" id="go" type="button">Merge and download</button>
    <p class="status" id="st"></p></div>`;
  const st = root.querySelector("#st");
  const show = (msg, err) => { st.className = err ? "status error" : "status"; st.textContent = msg; };
  root.querySelector("#go").addEventListener("click", async () => {
    const files = root.querySelector("#pdfs").files;
    if (!window.PDFLib) return show("The PDF library did not load. Check your connection and refresh.", true);
    if (!files.length) return show("Choose at least one PDF.", true);
    show("Merging...");
    try {
      const { PDFDocument } = PDFLib;
      const out = await PDFDocument.create();
      for (const f of files) {
        const src = await PDFDocument.load(await f.arrayBuffer());
        (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
      }
      download(new Blob([await out.save()], { type: "application/pdf" }), "merged.pdf");
      show("Done. Your merged PDF is downloading.");
    } catch (e) {
      show("Could not merge. One file may be encrypted or damaged.", true);
    }
  });
};

CUSTOM["image-compressor"] = root => {
  root.innerHTML = `<div class="tool-form">
    <div class="field"><label for="u">Choose an image (JPG, PNG or WebP)</label><input id="u" type="file" accept="image/*"></div>
    <div class="field"><label for="q">Quality: <b id="qv">80</b>%</label><input id="q" type="range" min="10" max="100" value="80"></div>
    <div class="stats" id="stats"></div>
    <img id="pv" class="preview hidden" alt="Compressed preview">
    <a id="dl" class="btn btn-primary hidden" download="compressed.jpg" href="#">Download compressed image</a>
    <p class="status" id="st">Transparent PNG backgrounds become white in the JPG output.</p></div>`;
  const $ = s => root.querySelector(s);
  let img = null, original = 0;
  async function process() {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
    const blob = await canvasBlob(c, "image/jpeg", $("#q").value / 100);
    const url = URL.createObjectURL(blob);
    $("#pv").src = url; $("#pv").classList.remove("hidden");
    $("#dl").href = url; $("#dl").classList.remove("hidden");
    $("#stats").innerHTML = statHTML("Original", fmtBytes(original)) + statHTML("Compressed", fmtBytes(blob.size))
      + statHTML("Saved", Math.max(0, Math.round((1 - blob.size / original) * 100)) + "%");
  }
  $("#u").addEventListener("change", async () => {
    const f = $("#u").files[0];
    if (!f) return;
    original = f.size;
    try { img = await loadImage(f); process(); }
    catch (e) { $("#st").className = "status error"; $("#st").textContent = e.message; }
  });
  $("#q").addEventListener("input", () => { $("#qv").textContent = $("#q").value; process(); });
};

CUSTOM["image-converter"] = root => {
  root.innerHTML = `<div class="tool-form">
    <div class="field"><label for="u">Choose an image</label><input id="u" type="file" accept="image/*"></div>
    <div class="field"><label for="fmt">Convert to</label><select id="fmt">
      <option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></div>
    <button class="btn btn-primary" id="go" type="button">Convert and download</button>
    <p class="status" id="st"></p></div>`;
  const st = root.querySelector("#st");
  root.querySelector("#go").addEventListener("click", async () => {
    const f = root.querySelector("#u").files[0];
    if (!f) { st.className = "status error"; st.textContent = "Choose an image first."; return; }
    try {
      const img = await loadImage(f);
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const type = root.querySelector("#fmt").value, x = c.getContext("2d");
      if (type === "image/jpeg") { x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(img, 0, 0);
      const ext = type.split("/")[1].replace("jpeg", "jpg");
      const blob = await canvasBlob(c, type, 0.92);
      download(blob, "converted." + ext);
      st.className = "status"; st.textContent = `Converted to ${ext.toUpperCase()} (${fmtBytes(blob.size)}).`;
    } catch (e) { st.className = "status error"; st.textContent = e.message; }
  });
};

CUSTOM["image-resizer"] = root => {
  root.innerHTML = `<div class="tool-form">
    <div class="field"><label for="u">Choose an image</label><input id="u" type="file" accept="image/*"></div>
    <div class="field"><label for="w">New width (px, height scales automatically)</label><input id="w" type="number" value="800" min="1"></div>
    <div class="field"><label for="fmt">Output format</label><select id="fmt">
      <option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></div>
    <button class="btn btn-primary" id="go" type="button">Resize and download</button>
    <p class="status" id="st"></p></div>`;
  const st = root.querySelector("#st");
  root.querySelector("#go").addEventListener("click", async () => {
    const f = root.querySelector("#u").files[0];
    const w = Math.round(parseFloat(root.querySelector("#w").value));
    if (!f) { st.className = "status error"; st.textContent = "Choose an image first."; return; }
    if (!w || w < 1) { st.className = "status error"; st.textContent = "Enter a width above zero."; return; }
    try {
      const img = await loadImage(f);
      const c = document.createElement("canvas");
      c.width = w; c.height = Math.round(img.naturalHeight * w / img.naturalWidth);
      const type = root.querySelector("#fmt").value, x = c.getContext("2d");
      if (type === "image/jpeg") { x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(img, 0, 0, c.width, c.height);
      const blob = await canvasBlob(c, type, 0.92);
      download(blob, `resized-${c.width}x${c.height}.${type.split("/")[1].replace("jpeg", "jpg")}`);
      st.className = "status"; st.textContent = `Resized to ${c.width} x ${c.height} px.`;
    } catch (e) { st.className = "status error"; st.textContent = e.message; }
  });
};

/* ---------- Boot ---------- */
(function boot() {
  const root = document.getElementById("tool-root");
  if (root) {
    const slug = root.dataset.slug;
    if (CUSTOM[slug]) CUSTOM[slug](root);
    else {
      const tool = TOOLS.find(t => t.slug === slug);
      if (tool) renderGeneric(root, tool);
    }
  }
  const search = document.getElementById("tool-search");
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      document.querySelectorAll(".tool-card").forEach(card => {
        card.hidden = !!q && !card.dataset.text.includes(q);
      });
      const shown = [...document.querySelectorAll(".tool-card")].filter(c => !c.hidden).length;
      document.getElementById("result-count").textContent = `${shown} tools found`;
    });
  }
})();
