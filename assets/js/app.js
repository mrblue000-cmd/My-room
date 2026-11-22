/* =========================================================
   맛과 길 — app
   data/site.json, data/posts.json 만 고치면 사이트가 바뀝니다.
   ========================================================= */

const state = {
  category: "전체",
  region: "전체",
  tag: null,
  q: "",
  tagExpanded: false,
};

let site = null;
let posts = [];
let map = null;
let markerById = new Map();
let mapBound = false;
let lastRegion = "전체";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- helpers ---------- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const dateLong = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
};
const dateShort = (iso) => iso.replaceAll("-", ".");

const catClass = (cat) => (cat === "여행" ? "travel" : "food");

const ratingText = (r) => (typeof r === "number" ? r.toFixed(1) : null);

function matches(post) {
  if (state.category !== "전체" && post.category !== state.category) return false;
  if (state.region !== "전체" && post.region !== state.region) return false;
  if (state.tag && !(post.tags || []).includes(state.tag)) return false;
  const q = state.q.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    post.title, post.oneline, post.area, post.region, post.category,
    (post.tags || []).join(" "), post.place?.name, post.place?.address,
    (post.body || []).join(" "),
  ].join(" ").toLowerCase();
  return hay.includes(q);
}

function filteredPosts() {
  return posts
    .filter(matches)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const byId = (id) => posts.find((p) => p.id === id);

/* ---------- rendering ---------- */

function renderSite() {
  $$("[data-site-title]").forEach((el) => (el.textContent = site.title));
  $$("[data-site-tagline]").forEach((el) => (el.textContent = site.tagline));
  document.title = `${site.title} · ${site.tagline}`;
}

function renderHero() {
  const latest = posts.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!latest) return;
  const section = $("#featured");
  $("#hero-img").src = latest.cover;
  $("#hero-img").alt = latest.coverAlt || latest.title;
  const badge = latest.category === "여행" ? "badge--travel" : "badge--food";
  $("#hero-meta").innerHTML = `
    <span class="badge ${badge}">${esc(latest.category)}</span>
    <span>${esc(latest.region)} · ${esc(latest.area)}</span>
    <span class="dot">·</span>
    <span>${dateLong(latest.date)}</span>
    ${ratingText(latest.rating) ? `<span class="dot">·</span><span class="rating"><span class="star">★</span>${ratingText(latest.rating)}</span>` : ""}
  `;
  $("#hero-title").innerHTML = `<a href="#magazine" data-open="${esc(latest.id)}">${esc(latest.title)}</a>`;
  $("#hero-oneline").textContent = latest.oneline || "";
  $("#hero-open").onclick = () => openPost(latest.id);
  $("#hero-title a").onclick = (e) => { e.preventDefault(); openPost(latest.id); };
  section.hidden = false;
}

function chip(label, { active, count, onClick, extraClass = "" }) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `chip ${extraClass} ${active ? "is-active" : ""}`.trim();
  b.setAttribute("aria-pressed", active ? "true" : "false");
  b.innerHTML = `${esc(label)}${count != null ? `<span class="count">${count}</span>` : ""}`;
  b.addEventListener("click", onClick);
  return b;
}

function renderFilters() {
  // categories
  const catBox = $("#category-chips");
  catBox.innerHTML = "";
  (site.categories || []).forEach((c) => {
    const count = c.id === "전체" ? posts.length : posts.filter((p) => p.category === c.id).length;
    catBox.appendChild(chip(c.label, {
      active: state.category === c.id,
      count,
      onClick: () => { state.category = c.id; update(); },
    }));
  });

  // regions
  const regionBox = $("#region-chips");
  regionBox.innerHTML = "";
  const regionAll = chip("전체", {
    active: state.region === "전체",
    count: posts.length,
    onClick: () => { state.region = "전체"; update(); },
  });
  regionBox.appendChild(regionAll);
  (site.regions || []).forEach((r) => {
    const count = posts.filter((p) => p.region === r.id).length;
    if (!count) return;
    regionBox.appendChild(chip(r.label, {
      active: state.region === r.id,
      count,
      onClick: () => { state.region = state.region === r.id ? "전체" : r.id; update(); },
    }));
  });

  // tags
  const tagCounts = new Map();
  posts.forEach((p) => (p.tags || []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  const limit = 8;
  const shown = state.tagExpanded || tags.length <= limit ? tags : tags.slice(0, limit);

  const tagBox = $("#tag-chips");
  tagBox.innerHTML = "";
  tagBox.appendChild(chip("전체", {
    active: !state.tag,
    onClick: () => { state.tag = null; update(); },
  }));
  shown.forEach(([t, n]) => {
    tagBox.appendChild(chip(`#${t}`, {
      active: state.tag === t,
      count: n > 1 ? n : null,
      extraClass: "chip--tag",
      onClick: () => { state.tag = state.tag === t ? null : t; update(); },
    }));
  });

  const toggle = $("#tag-toggle");
  if (tags.length > limit) {
    toggle.hidden = false;
    toggle.textContent = state.tagExpanded ? "접기" : `더 보기 (${tags.length - limit})`;
    toggle.setAttribute("aria-expanded", String(state.tagExpanded));
    toggle.onclick = () => { state.tagExpanded = !state.tagExpanded; renderFilters(); };
  } else {
    toggle.hidden = true;
  }
}

function cardEl(post, index) {
  const el = document.createElement("article");
  el.className = "card";
  el.style.animationDelay = `${Math.min(index * 40, 240)}ms`;
  el.innerHTML = `
    <div class="card-media" role="button" tabindex="0" aria-label="${esc(post.title)} 크게 보기">
      <img src="${esc(post.cover)}" alt="${esc(post.coverAlt || post.title)}" loading="lazy" width="1600" height="1000" />
      <span class="card-cat card-cat--${catClass(post.category)}">${esc(post.category)}</span>
    </div>
    <div class="card-body">
      <div class="card-kicker">
        <span>${esc(post.region)} · ${esc(post.area)}</span>
        <span class="dot">·</span>
        <span>${dateShort(post.date)}</span>
        ${ratingText(post.rating) ? `<span class="dot">·</span><span class="rating"><span class="star">★</span>${ratingText(post.rating)}</span>` : ""}
      </div>
      <h3 class="card-title"><button type="button">${esc(post.title)}</button></h3>
      <p class="card-oneline">${esc(post.oneline || "")}</p>
      <div class="card-foot">
        <div class="card-tags">${(post.tags || []).slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div>
        <span class="badge badge--sample">예시</span>
      </div>
    </div>`;
  const media = $(".card-media", el);
  const titleBtn = $(".card-title button", el);
  media.addEventListener("click", () => openPost(post.id));
  media.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPost(post.id); }
  });
  titleBtn.addEventListener("click", () => openPost(post.id));
  return el;
}

function renderGrid() {
  const list = filteredPosts();
  const grid = $("#grid");
  grid.innerHTML = "";
  list.forEach((p, i) => grid.appendChild(cardEl(p, i)));
  $("#empty").hidden = list.length > 0;
  $("#result-count").textContent = `${list.length}개의 기록`;
  $("#magazine").hidden = false;
}

function renderRegionCards() {
  const box = $("#region-list");
  box.innerHTML = "";
  const all = document.createElement("button");
  all.type = "button";
  all.className = `region-card ${state.region === "전체" ? "is-active" : ""}`;
  all.innerHTML = `<span class="r-name">모든 지역</span><span class="r-count">${posts.length}편</span>`;
  all.onclick = () => { state.region = "전체"; update(); };
  box.appendChild(all);

  (site.regions || []).forEach((r) => {
    const n = posts.filter((p) => p.region === r.id).length;
    if (!n) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = `region-card ${state.region === r.id ? "is-active" : ""}`;
    b.innerHTML = `<span class="r-name">${esc(r.label)}</span><span class="r-count">${n}편</span>`;
    b.onclick = () => {
      state.region = state.region === r.id ? "전체" : r.id;
      update();
      document.getElementById("magazine").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    box.appendChild(b);
  });
}

/* ---------- map ---------- */

function popupHtml(post) {
  return `
    <div class="popup-card">
      <img src="${esc(post.cover)}" alt="" loading="lazy" />
      <div class="popup-body">
        <span class="popup-cat">${esc(post.category)} · ${esc(post.area)}</span>
        <h3>${esc(post.title)}</h3>
        <button type="button" data-post="${esc(post.id)}">기록 읽기 →</button>
      </div>
    </div>`;
}

function initMap() {
  const host = $("#leaflet-map");
  if (typeof L === "undefined") {
    host.innerHTML = '<p style="padding:24px;font-size:13px;color:#6b6459">지도를 불러오지 못했습니다. 아래 지역 목록을 이용해 주세요.</p>';
    return;
  }
  map = L.map(host, {
    scrollWheelZoom: false,
    zoomControl: true,
    attributionControl: true,
  }).setView(site.mapCenter || [37.4, 127.6], site.mapZoom || 7);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);

  const bounds = [];
  posts.forEach((post, i) => {
    if (!post.place || typeof post.place.lat !== "number") return;
    const icon = L.divIcon({
      className: "map-pin-wrap",
      html: `<div class="map-pin map-pin--${catClass(post.category)}"><span>${i + 1}</span></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
    });
    const marker = L.marker([post.place.lat, post.place.lng], {
      icon,
      title: post.title,
      alt: `${post.title} 위치`,
    }).addTo(map);
    marker.bindPopup(popupHtml(post), { minWidth: 216, closeButton: true, autoPanPadding: [24, 24] });
    marker.on("popupopen", (e) => {
      const btn = e.popup.getElement()?.querySelector("[data-post]");
      if (btn) btn.addEventListener("click", () => openPost(btn.dataset.post));
    });
    markerById.set(post.id, marker);
    bounds.push([post.place.lat, post.place.lng]);
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [46, 46], maxZoom: 12 });
}

function syncMap() {
  if (!map) return;
  const visible = [];
  posts.forEach((post) => {
    const m = markerById.get(post.id);
    if (!m) return;
    const ok = matches(post);
    if (ok) visible.push(m.getLatLng());
    const el = m.getElement()?.querySelector(".map-pin");
    if (el) el.classList.toggle("is-dim", !ok);
  });

  // 지역 필터를 고르면 그 지역 핀으로 지도를 옮깁니다.
  if (state.region !== lastRegion) {
    lastRegion = state.region;
    if (state.region !== "전체" && visible.length) {
      map.flyToBounds(visible, { padding: [60, 60], maxZoom: 11, duration: 0.7 });
    }
  }
}

/* ---------- modal ---------- */

const dialog = $("#post-modal");

function openPost(id) {
  const post = byId(id);
  if (!post) return;

  $("#modal-img").src = post.cover;
  $("#modal-img").alt = post.coverAlt || post.title;
  $("#modal-badge").textContent = "예시 기록 · 실제 방문기가 아닙니다";
  $("#modal-title").textContent = post.title;
  $("#modal-oneline").textContent = post.oneline || "";

  const rows = [
    ["방문일", dateLong(post.date)],
    ["지역", `${post.region} · ${post.area}`],
    ["분류", post.category],
    ["평점", ratingText(post.rating) ? `★ ${ratingText(post.rating)} / 5` : "—"],
  ];
  $("#modal-meta").innerHTML = rows
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("");

  $("#modal-body").innerHTML = (post.body || []).map((p) => `<p>${esc(p)}</p>`).join("");

  $("#modal-gallery").innerHTML = (post.gallery || [])
    .map((g) => `<img src="${esc(g.src)}" alt="${esc(g.alt || "")}" loading="lazy" />`)
    .join("");

  $("#modal-tags").innerHTML = (post.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("");

  const p = post.place;
  const gmap = p && typeof p.lat === "number"
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
    : null;
  const naver = p
    ? `https://map.naver.com/p/search/${encodeURIComponent(p.name + " " + (p.address || ""))}`
    : null;

  $("#modal-actions").innerHTML = `
    ${gmap ? `<a class="btn btn-primary" href="${gmap}" target="_blank" rel="noopener">Google 지도에서 보기</a>` : ""}
    ${naver ? `<a class="btn btn-ghost" href="${naver}" target="_blank" rel="noopener">네이버 지도에서 찾기</a>` : ""}
    <button class="btn btn-ghost" type="button" id="modal-close-2">닫기</button>
  `;
  $("#modal-close-2").onclick = () => dialog.close();

  if (!dialog.open) dialog.showModal();
  $("#modal-scroll").scrollTop = 0;
}

$("#modal-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
// backdrop click on the dialog's padding area
dialog.addEventListener("mousedown", (e) => {
  if (e.target === dialog) dialog.close();
});

/* ---------- filters wiring ---------- */

$("#search").addEventListener("input", (e) => {
  state.q = e.target.value;
  $("#search-clear").hidden = !state.q;
  update();
});
$("#search-clear").addEventListener("click", () => {
  state.q = "";
  $("#search").value = "";
  $("#search-clear").hidden = true;
  $("#search").focus();
  update();
});
$("#reset-filters").addEventListener("click", () => {
  state.category = "전체";
  state.region = "전체";
  state.tag = null;
  state.q = "";
  $('#search').value = "";
  $("#search-clear").hidden = true;
  update();
});

/* ---------- update ---------- */

function update() {
  renderFilters();
  renderGrid();
  renderRegionCards();
  syncMap();
}

/* ---------- boot ---------- */

async function boot() {
  try {
    const [siteRes, postsRes] = await Promise.all([
      fetch("data/site.json", { cache: "no-cache" }),
      fetch("data/posts.json", { cache: "no-cache" }),
    ]);
    if (!siteRes.ok || !postsRes.ok) throw new Error("데이터를 불러오지 못했습니다.");
    site = await siteRes.json();
    const data = await postsRes.json();
    posts = (data.posts || []).slice();
  } catch (err) {
    $("#grid").innerHTML = `<p style="color:#8a8275">글 목록을 불러오지 못했습니다. (${esc(err.message)})</p>`;
    $("#magazine").hidden = false;
    return;
  }

  renderSite();
  renderHero();
  $("#toolbar").hidden = false;
  $("#map").hidden = false;
  update();
  initMap();

  // keep map crisp when the section appears / viewport changes
  const ro = new ResizeObserver(() => { if (map) map.invalidateSize(); });
  ro.observe($("#leaflet-map"));
  window.addEventListener("load", () => { if (map) map.invalidateSize(); });
}

boot();
