/**
 * core.js — fondasi APSIKITA: utilitas, penyimpanan lokal, klien API tahan jaringan HP
 * (timeout, retry, reqId idempoten), SWR, router SPA, dan komponen UI (toast, modal, ikon).
 */
'use strict';
const CFG = window.APP_CONFIG || {};
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function tgl(v) { if (!v) return null; const d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v); return isNaN(d) ? null : d; }
function fTgl(v) { const d = tgl(v); return d ? d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() : '-'; }
function fTglPanjang(v) { const d = tgl(v); return d ? HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() : '-'; }
function fJam(v) { const d = tgl(v); return d ? String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0') : ''; }
function fWaktu(v) { const d = tgl(v); return d ? fTgl(v) + ' ' + fJam(v) : '-'; }
function lalu(v) {
  const d = tgl(v); if (!d) return '-';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' menit yang lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; if (s < 86400 * 7) return Math.floor(s / 86400) + ' hari lalu';
  return fTgl(v);
}
function isoHari(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function inisial(n) { return String(n || '?').replace(/^((Dra?|Drs|Dr|H|Hj|Ust|Ustz|Prof|Ir)\.?\s+)+/gi, '').split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'; }
function angka(n) { return Number(n || 0).toLocaleString('id-ID'); }
function debounce(fn, ms) { let t; return function () { const a = arguments, s = this; clearTimeout(t); t = setTimeout(() => { const ev = a[0]; if (ev && ev.target && ev.target.isConnected === false) return; fn.apply(s, a); }, ms || 280); }; }   // lewati bila elemen sudah hilang (pindah halaman)
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }
function pj(s, d) { if (s && typeof s === 'object') return s; try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function rid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
function hp08(v) { let s = String(v || '').replace(/[^0-9+]/g, '').replace(/^\+/, ''); if (!s) return ''; if (s.startsWith('62')) s = '0' + s.slice(2); else if (s.startsWith('8')) s = '0' + s; return s; }

// ---------------------------------------------------------------------------- ikon (subset Lucide)
function ic(nama, kelas) {
  const b = (window.ICONS || {})[nama];
  if (!b) { if (window.ICONS) console.warn('Ikon hilang:', nama); return '<svg class="ic ' + (kelas || '') + '" viewBox="0 0 24 24"></svg>'; }
  return '<svg class="ic ' + (kelas || '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + b + '</svg>';
}
const LOGO_SVG = '<svg viewBox="0 0 64 64"><path d="M32 13l15 6v11c0 10-6.5 17.5-15 21-8.5-3.5-15-11-15-21V19z" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><path d="M25 32l5 5 9-10" fill="none" stroke="#d4a72c" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------------------------------------------------------------------------- penyimpanan lokal
const LS = 'apsk:v' + (CFG.VERSI_CACHE || '1') + ':';
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem(LS + k, s); }
    catch (e) {                                                  // kuota penuh → buang cache pengguna lain
      Object.keys(localStorage).filter((x) => x.indexOf(LS + 'u:') === 0 && x.indexOf(LS + 'u:' + (App.uid || '') + ':') !== 0).forEach((x) => localStorage.removeItem(x));
      try { localStorage.setItem(LS + k, s); } catch (e2) { /* tetap jalan tanpa cache */ }
    }
  },
  del(k) { try { localStorage.removeItem(LS + k); } catch (e) {} }
};
const Sesi = {
  get() { try { return localStorage.getItem(LS + 'token') || sessionStorage.getItem(LS + 'token') || ''; } catch (e) { return ''; } },
  set(t, ingat) { try { (ingat ? localStorage : sessionStorage).setItem(LS + 'token', t); (ingat ? sessionStorage : localStorage).removeItem(LS + 'token'); } catch (e) {} },
  ingat() { try { return !!localStorage.getItem(LS + 'token'); } catch (e) { return false; } },
  hapus() { try { localStorage.removeItem(LS + 'token'); sessionStorage.removeItem(LS + 'token'); } catch (e) {} }
};
function uKey(k) { return 'u:' + (App.uid || 'anon') + ':' + k; }

// ---------------------------------------------------------------------------- pengukur performa
/** Perf.table() = 30 panggilan terakhir (total/server/jaringan/cache), Perf.summary() = rata-rata per aksi. */
const Perf = {
  rows: [], hitung: 0,
  add(action, total, server, cached) { this.hitung++; this.rows.push({ action, total, server: server == null ? null : server, net: server != null ? total - server : null, cache: cached ? '✓' : '', at: new Date().toLocaleTimeString() }); if (this.rows.length > 300) this.rows.shift(); },
  table() { console.table(this.rows.slice(-30)); },
  summary() {
    const g = {}; this.rows.forEach((r) => { const x = (g[r.action] = g[r.action] || { n: 0, total: 0, server: 0, cache: 0 }); x.n++; x.total += r.total; x.server += r.server || 0; if (r.cache) x.cache++; });
    console.table(Object.keys(g).map((k) => ({ aksi: k, panggilan: g[k].n, rata_total_ms: Math.round(g[k].total / g[k].n), rata_server_ms: Math.round(g[k].server / g[k].n), dari_cache: g[k].cache })));
  }
};
window.Perf = Perf;

// ---------------------------------------------------------------------------- klien API
const READ_ACTIONS = /^(boot|batch|deList|deSiapkan|perangkatStatus|guruDetail|deUnduh|deMassalStatus|deMassalZip|verif|configPublik|notif\.config|notif\.queue|wa\.blastList|wa\.audience|wa\.device|crm\.list|crm\.stats|crm\.detail|crm\.export|sistem\.info|sistem\.log|migrasi\.sumber)$/;
const BATCHABLE = /^(boot|deList|deSiapkan|perangkatStatus|guruDetail|notif\.config|notif\.queue|wa\.blastList|crm\.list|crm\.stats|sistem\.info|sistem\.log)$/;
const BERAT = /^(deBuat|deSetujui|deMassalProses|deMassalZip|migrasi\.jalankan|sistem\.resetDummy|sistem\.hapusDummy|perangkatAnalisis|perangkatKirim|tlGenerate|deTemplateBawaan|dePindai|sistem\.backup)$/;
function gasUrl() { return CFG.GAS_URL || ''; }
function gasSiap() { return !!gasUrl() && !/TEMPEL_ID/.test(gasUrl()); }
async function apiOnce(action, data, timeout, reqId) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const res = await fetch(gasUrl(), { method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },                        // tanpa preflight CORS
      body: JSON.stringify({ action, token: App.token || '', reqId, data: data || {} }) });
    const text = await res.text();
    try {
      const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms, j.cached || (j.data && j.data.cached));
      if (j.v) App.serverV = j.v;
      if (j.nq > 0) scheduleDrain();                                                    // notifikasi baru → kirim beberapa detik lagi
      return j;
    } catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Pastikan GAS_URL berakhiran /exec, deployment "Anyone", dan sudah "New version".' }; }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi terputus. Periksa internet Anda.' };
  } finally { clearTimeout(timer); }
}
function waitOnline(ms) { return new Promise((r) => { if (navigator.onLine !== false) return r(); const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }
async function apiRun(action, data, opt) {
  opt = opt || {};
  if (!gasSiap()) return { success: false, message: 'GAS_URL belum diisi di js/config.js.' };
  const isRead = READ_ACTIONS.test(action);
  const reqId = isRead ? '' : (opt.reqId || rid());
  const tries = isRead ? 3 : 2;
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await new Promise((r) => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(action, data, BERAT.test(action) ? 300000 : (isRead ? (i ? 40000 : 25000) : 90000), reqId);
    if (res.success || !res.retryable) break;
  }
  if (!res.success && (res.code === 'AUTH' || (res.data && res.data.code === 'AUTH'))) App.sesiBerakhir && App.sesiBerakhir();
  return res;
}
/**
 * api(): baca identik yang sedang berjalan ditumpangi (tidak dobel); setiap TULIS menaikkan epoch
 * sehingga baca SETELAH simpan tidak menumpang baca lama (data basi).
 */
const _inflight = {}; let _writeEpoch = 0;
function api(action, data, opt) {
  if (!READ_ACTIONS.test(action)) { _writeEpoch++; return apiRun(action, data, opt); }
  const k = _writeEpoch + '|' + action + '|' + App.token + '|' + JSON.stringify(data || {});
  if (_inflight[k]) return _inflight[k];
  const p = apiRun(action, data, opt); _inflight[k] = p;
  p.then(() => delete _inflight[k], () => delete _inflight[k]);
  return p;
}
/** Penggabung otomatis: beberapa baca dalam satu tik → 1 permintaan 'batch' (1 eksekusi server). */
const Batcher = {
  q: null,
  add(action, data) { return new Promise((res) => { if (!this.q) { this.q = []; setTimeout(() => this.flush(), 0); } this.q.push({ action, data: data || {}, res }); }); },
  async flush() {
    const q = this.q; this.q = null; if (!q || !q.length) return;
    const grup = {}; q.forEach((x) => { const k = x.action + '|' + JSON.stringify(x.data); (grup[k] = grup[k] || []).push(x); });
    const unik = Object.keys(grup).map((k) => grup[k][0]), pakai = {}, sendiri = [];
    unik.forEach((x) => { if (pakai[x.action] || !BATCHABLE.test(x.action)) sendiri.push(x); else pakai[x.action] = x; });   // aksi sama + data beda → terpisah
    const bagikan = (x, r) => grup[x.action + '|' + JSON.stringify(x.data)].forEach((y) => y.res(r));
    sendiri.forEach((x) => api(x.action, x.data).then((r) => bagikan(x, r)));
    const daftar = Object.values(pakai);
    for (let i = 0; i < daftar.length; i += 10) {
      const bag = daftar.slice(i, i + 10);
      if (bag.length === 1) { api(bag[0].action, bag[0].data).then((r) => bagikan(bag[0], r)); continue; }
      api('batch', { calls: bag.map((x) => ({ action: x.action, data: x.data })) }).then((r) => {
        bag.forEach((x) => bagikan(x, r.success ? (r.data[x.action] || { success: false, message: 'Tidak ada hasil.' }) : r));
      });
    }
  }
};
function apiQ(action, data) { return Batcher.add(action, data); }
function fetchMany(calls) { return Promise.all(calls.map((c) => apiQ(c.action, c.data))); }

/** stale-while-revalidate: render dari cache seketika, segarkan di latar bila sudah basi. force → _fresh (lewati cache server). */
async function swr(key, action, payload, render, opt) {
  opt = opt || {};
  const fresh = opt.fresh == null ? 60000 : opt.fresh, c = Store.get(uKey(key), null);
  if (c) render(c.data, true);
  if (c && !opt.force && Date.now() - c.t < fresh) return { success: true, data: c.data, cached: true };
  const res = await apiQ(action, Object.assign({}, payload || {}, opt.force ? { _fresh: 1 } : {}));
  if (res.success) {
    const h = hashStr(JSON.stringify(res.data));
    Store.set(uKey(key), { t: Date.now(), h, data: res.data });
    if (!c || c.h !== h) render(res.data, false);
  } else if (!c && opt.onError) opt.onError(res);
  return res;
}
/** SWR untuk beberapa aksi baca sekaligus (1 permintaan `batch`) → data { aksi: hasil }. */
async function swrBatch(key, calls, render, opt) {
  opt = opt || {};
  const fresh = opt.fresh == null ? 30000 : opt.fresh, c = Store.get(uKey(key), null);
  if (c) render(c.data, true);
  if (c && !opt.force && Date.now() - c.t < fresh) return { success: true, cached: true };
  const hasil = await fetchMany(calls.map((x) => ({ action: x.action, data: Object.assign({}, x.data || {}, opt.force ? { _fresh: 1 } : {}) })));
  const data = {}; let gagal = null;
  calls.forEach((x, i) => { const r = hasil[i]; if (r && r.success) data[x.action] = r.data; else gagal = gagal || r; });
  if (gagal && !Object.keys(data).length) { if (!c && opt.onError) opt.onError(gagal); return gagal; }
  const h = hashStr(JSON.stringify(data));
  Store.set(uKey(key), { t: Date.now(), h, data });
  if (!c || c.h !== h) render(data, false);
  return { success: true, data };
}

/** Antrean notifikasi: respons ber-nq → POST 'drain' (debounce 400 ms, ulang maks. 3× bila masih tersisa). */
let _drainT = null, _drainN = 0;
function scheduleDrain() {
  clearTimeout(_drainT);
  _drainT = setTimeout(async () => {
    const r = await apiOnce('drain', {}, 30000, '');
    if (r.success && r.data && r.data.left > 0 && ++_drainN < 3) { setTimeout(scheduleDrain, 2000); return; }
    _drainN = 0;
  }, 400);
}

/** Pemanasan server dari browser: GET ?w=pub|admin (tanpa data), maks. 1×/4 menit per lingkup. */
function warmUpServer(scope) {
  if (!gasSiap()) return;
  scope = scope === 'admin' ? 'admin' : 'pub';
  try { const k = LS + 'warm:' + scope, t = Number(sessionStorage.getItem(k) || 0); if (Date.now() - t < 240000) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) {}
  fetch(gasUrl() + '?w=' + scope + '&t=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}
function warmUp() { warmUpServer('pub'); }

/** Aktivitas pengguna → polling adaptif: cepat saat aktif, jarang saat diam, berhenti saat tab tersembunyi. */
const Activity = {
  at: Date.now(), last: {},
  init() { ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'].forEach((ev) => addEventListener(ev, () => (this.at = Date.now()), { passive: true })); },
  idle() { return Date.now() - this.at > 120000; },
  due(key, activeMs, idleMs) {
    if (document.visibilityState !== 'visible') return false;
    if (Date.now() - (this.last[key] || 0) < (this.idle() ? idleMs : activeMs) - 500) return false;
    this.last[key] = Date.now(); return true;
  }
};
Activity.init();

/** Format kolom-baris dari server ({__pak,k,v}) ⇄ larik objek. Dipakai juga untuk menyimpan boot di perangkat (lebih hemat). */
const PAK = ['users', 'perangkat', 'observasi', 'refleksi', 'tindakLanjut', 'notif', 'sekolah'];
function bukaPak(b) {
  if (!b) return b;
  PAK.forEach((n) => { const x = b[n]; if (x && x.__pak) b[n] = x.v.map((a) => { const o = {}; x.k.forEach((k, i) => { if (a[i] !== null && a[i] !== undefined) o[k] = a[i]; }); return o; }); });
  return b;
}
function kemasPak(b) {
  const o = Object.assign({}, b);
  PAK.forEach((n) => {
    const rows = b[n]; if (!Array.isArray(rows) || rows.length < 2) return;
    const idx = {}, k = []; rows.forEach((r) => Object.keys(r).forEach((x) => { if (x.charAt(0) !== '_' || x === '_rk') { if (!(x in idx)) { idx[x] = k.length; k.push(x); } } }));
    o[n] = { __pak: 1, k, v: rows.map((r) => k.map((x) => (r[x] === undefined ? null : r[x]))) };
  });
  return o;
}

// ---------------------------------------------------------------------------- toast, modal, konfirmasi
function toast(pesan, jenis, judul) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (jenis === 'error' ? 'err' : jenis === 'warn' ? 'warn' : '');
  el.innerHTML = ic(jenis === 'error' ? 'circle-alert' : jenis === 'warn' ? 'triangle-alert' : 'circle-check') + '<div>' + (judul ? '<b>' + esc(judul) + '</b>' : '') + esc(pesan) + '</div><button class="x" aria-label="Tutup">' + ic('x') + '</button>';
  box.appendChild(el);
  const hapus = () => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); };
  el.querySelector('.x').onclick = hapus;
  setTimeout(hapus, jenis === 'error' ? 7000 : 4200);
}
function hasilToast(res, okMsg) { if (res.success) toast(res.message || okMsg || 'Berhasil.'); else toast(res.message || 'Terjadi kesalahan.', 'error'); return res.success; }

/** modal({judul, isi(html), kaki(html), ukuran, onBuka(el, tutup), tutupLuar}) → {el, tutup} */
function modal(o) {
  const root = $('#modal-root'), ov = document.createElement('div');
  ov.className = 'overlay' + (o.drawer ? ' drawer-o' : '');
  ov.innerHTML = '<div class="' + (o.drawer ? 'drawer' : 'modal ' + (o.ukuran || '')) + '" role="dialog" aria-modal="true">' +
    '<div class="modal-h"><div class="grow">' + (o.atas || '') + '<h3>' + esc(o.judul || '') + '</h3>' + (o.sub ? '<div class="muted small mt-8">' + o.sub + '</div>' : '') + '</div>' +
    (o.tanpaTutup ? '' : '<button class="btn btn-ghost btn-icon btn-sm" data-tutup aria-label="Tutup">' + ic('x') + '</button>') + '</div>' +
    '<div class="modal-b' + (o.drawer ? ' grow' : '') + '">' + (o.isi || '') + '</div>' + (o.kaki ? '<div class="modal-f">' + o.kaki + '</div>' : '') + '</div>';
  root.appendChild(ov);
  let aktif = true;
  const tutup = (v) => { if (!aktif) return; aktif = false; ov.remove(); document.removeEventListener('keydown', esc_); o.onTutup && o.onTutup(v); };
  const esc_ = (e) => { if (e.key === 'Escape' && !o.tanpaTutup) tutup(); };
  document.addEventListener('keydown', esc_);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov && !o.tanpaTutup && o.tutupLuar !== false) tutup(); });
  $$('[data-tutup]', ov).forEach((b) => (b.onclick = () => tutup()));
  const el = ov.firstChild;
  o.onBuka && o.onBuka(el, tutup);
  const f = el.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea,select');
  if (f && !o.tanpaFokus && window.innerWidth > 700) setTimeout(() => { if (aktif && !el.contains(document.activeElement)) f.focus(); }, 60);   // jangan curi fokus bila pengguna sudah mengetik
  return { el, tutup };
}
function konfirmasi(judul, pesan, opsi) {
  opsi = opsi || {};
  return new Promise((r) => {
    modal({ judul, ukuran: 'kecil', isi: '<p class="muted" style="margin:0">' + pesan + '</p>' + (opsi.ketik ? '<div class="field mt-16"><label>Ketik <b>' + esc(opsi.ketik) + '</b> untuk melanjutkan</label><input class="inp" id="k-ketik" autocomplete="off"></div>' : ''),
      kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn ' + (opsi.bahaya ? 'btn-danger' : 'btn-pri') + '" id="k-ya">' + esc(opsi.ya || 'Ya, lanjutkan') + '</button>',
      onBuka: (el, tutup) => { el.querySelector('#k-ya').onclick = () => { if (opsi.ketik && el.querySelector('#k-ketik').value.trim() !== opsi.ketik) { el.querySelector('#k-ketik').classList.add('salah'); return; } tutup(true); r(true); }; },
      onTutup: (v) => { if (!v) r(false); } });
  });
}
function tanya(judul, label, opsi) {
  opsi = opsi || {};
  return new Promise((r) => {
    modal({ judul, ukuran: 'kecil', isi: (opsi.pesan ? '<p class="muted mt-8">' + opsi.pesan + '</p>' : '') + '<div class="field"><label>' + esc(label) + '</label>' +
      (opsi.area ? '<textarea class="inp" id="t-v" rows="4" placeholder="' + esc(opsi.ph || '') + '"></textarea>' : '<input class="inp" id="t-v" type="' + (opsi.tipe || 'text') + '" placeholder="' + esc(opsi.ph || '') + '"' + (opsi.maks ? ' maxlength="' + opsi.maks + '"' : '') + ' inputmode="' + (opsi.tipe === 'password' && opsi.angka ? 'numeric' : 'text') + '">') + '</div>',
      kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn ' + (opsi.bahaya ? 'btn-danger' : 'btn-pri') + '" id="t-ok">' + esc(opsi.ya || 'Simpan') + '</button>',
      onBuka: (el, tutup) => { const i = el.querySelector('#t-v'); if (opsi.nilai) i.value = opsi.nilai; const go = () => { const v = i.value.trim(); if (opsi.wajib && !v) { i.classList.add('salah'); return; } tutup(true); r(v); }; el.querySelector('#t-ok').onclick = go; if (!opsi.area) i.onkeydown = (e) => { if (e.key === 'Enter') go(); }; },
      onTutup: (v) => { if (!v) r(null); } });
  });
}
/** Jalankan aksi async dengan tombol berstatus memuat. */
async function sibuk(btn, fn, teks) {
  if (!btn) return fn();
  if (btn.disabled) return;
  const asli = btn.innerHTML; btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>' + (teks ? ' ' + esc(teks) : '');
  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = asli; } }
}
function unduhBase64(file) {
  const bin = atob(file.base64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u8], { type: file.mime || 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = url; a.download = file.nama || 'dokumen'; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
function lihatPdf(file) {
  const bin = atob(file.base64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
  modal({ judul: file.nama || 'Pratinjau', ukuran: 'xl', isi: '<iframe src="' + url + '" style="width:100%;height:70vh;border:0;border-radius:10px;background:#f3f3f3" title="Pratinjau PDF"></iframe>',
    kaki: '<button class="btn btn-out" data-tutup>Tutup</button><button class="btn btn-pri" id="pv-dl">' + ic('download') + ' Unduh</button>',
    onBuka: (el) => { el.querySelector('#pv-dl').onclick = () => unduhBase64(file); }, onTutup: () => setTimeout(() => URL.revokeObjectURL(url), 1000) });
}
function unduhTeks(nama, isi, mime) {
  const url = URL.createObjectURL(new Blob(['﻿' + isi], { type: mime || 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nama; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
function salin(teks) { (navigator.clipboard ? navigator.clipboard.writeText(teks) : Promise.reject()).then(() => toast('Disalin ke papan klip.')).catch(() => { tanya('Salin manual', 'Teks', { nilai: teks }); }); }

// ---------------------------------------------------------------------------- CSV
function parseCsv(teks) {
  teks = String(teks || '').replace(/^﻿/, '');
  const pemisah = (teks.split('\n')[0].match(/;/g) || []).length > (teks.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], sel = '', q = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (q) { if (c === '"') { if (teks[i + 1] === '"') { sel += '"'; i++; } else q = false; } else sel += c; }
    else if (c === '"') q = true;
    else if (c === pemisah) { row.push(sel); sel = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && teks[i + 1] === '\n') i++; row.push(sel); rows.push(row); row = []; sel = ''; }
    else sel += c;
  }
  if (sel || row.length) { row.push(sel); rows.push(row); }
  const bersih = rows.filter((r) => r.some((x) => String(x).trim()));
  if (!bersih.length) return [];
  const h = bersih[0].map((x) => String(x).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return bersih.slice(1).map((r) => { const o = {}; h.forEach((k, i) => { if (k) o[k] = String(r[i] === undefined ? '' : r[i]).trim(); }); return o; });
}
function keCsv(rows, kolom) {
  const k = kolom || Object.keys(rows[0] || {});
  const q = (v) => { v = v === null || v === undefined ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [k.join(',')].concat(rows.map((r) => k.map((x) => q(r[x])).join(','))).join('\n');
}
async function bacaBerkasTabel(file) {
  if (/\.xlsx?$/i.test(file.name)) {
    await muatSkrip('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return parseCsv(window.XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));
  }
  return parseCsv(await file.text());
}
const _skrip = {};
function muatSkrip(src) {
  if (_skrip[src]) return _skrip[src];
  return (_skrip[src] = new Promise((ok, gagal) => { const s = document.createElement('script'); s.src = src; s.defer = true; s.onload = ok; s.onerror = () => { delete _skrip[src]; gagal(new Error('Gagal memuat ' + src)); }; document.head.appendChild(s); }));
}

// ---------------------------------------------------------------------------- komponen tampilan kecil
const PRED_KELAS = { 'Sangat Baik': 'pr-sb', 'Baik': 'pr-b', 'Cukup': 'pr-c', 'Kurang': 'pr-k', 'Belum Mulai': 'pr-n' };
function badgePred(p) { return '<span class="badge ' + (PRED_KELAS[p] || 'pr-n') + '">' + esc(p || '-') + '</span>'; }
function kelasBarPred(p) { return p === 'Kurang' ? 'red' : ''; }
function bar(pct, kelas) { pct = Math.max(0, Math.min(100, Number(pct) || 0)); return '<div class="bar ' + (kelas || '') + '"><i style="width:' + pct + '%"></i></div>'; }
function prog(label, pct, kelas, kanan) { return '<div class="prog"><div class="l"><span>' + esc(label) + '</span><b>' + (kanan || (Math.round(pct) + '%')) + '</b></div>' + bar(pct, kelas) + '</div>'; }
function donut(pct, ukuran, tebal, warna, label) {
  ukuran = ukuran || 150; tebal = tebal || 14; const r = (ukuran - tebal) / 2, k = 2 * Math.PI * r, isi = Math.max(0, Math.min(100, pct)) / 100 * k;
  return '<div class="donut" style="width:' + ukuran + 'px;height:' + ukuran + 'px"><svg width="' + ukuran + '" height="' + ukuran + '"><circle cx="' + ukuran / 2 + '" cy="' + ukuran / 2 + '" r="' + r + '" fill="none" stroke="#e8efeb" stroke-width="' + tebal + '"/>' +
    '<circle cx="' + ukuran / 2 + '" cy="' + ukuran / 2 + '" r="' + r + '" fill="none" stroke="' + (warna || '#11503d') + '" stroke-width="' + tebal + '" stroke-linecap="round" stroke-dasharray="' + isi + ' ' + k + '"/></svg>' +
    '<div class="txt"><b style="font-size:' + Math.round(ukuran / 4.4) + 'px">' + Math.round(pct) + '%</b>' + (label ? '<span>' + esc(label) + '</span>' : '') + '</div></div>';
}
function avatar(nama, kelas) { return '<div class="av ' + (kelas || '') + '" aria-hidden="true">' + esc(inisial(nama)) + '</div>'; }
function kosong(judul, teks, tombol, ikon) {
  return '<div class="empty"><div class="ico">' + ic(ikon || 'inbox') + '</div><h4>' + esc(judul) + '</h4><div>' + (teks || '') + '</div>' + (tombol ? '<div class="mt-16">' + tombol + '</div>' : '') + '</div>';
}
function skeleton(n, tinggi) { let s = ''; for (let i = 0; i < (n || 3); i++) s += '<div class="sk" style="height:' + (tinggi || 120) + 'px;margin-bottom:14px"></div>'; return s; }
function pager(total, hal, per, onGanti, id) {
  const n = Math.max(1, Math.ceil(total / per)); if (total <= per) return '';
  let b = '<button data-pg="' + (hal - 1) + '"' + (hal <= 1 ? ' disabled' : '') + '>Sebelumnya</button>';
  const awal = Math.max(1, Math.min(hal - 2, n - 4)), akhir = Math.min(n, awal + 4);
  for (let i = awal; i <= akhir; i++) b += '<button data-pg="' + i + '" class="' + (i === hal ? 'on' : '') + '">' + i + '</button>';
  b += '<button data-pg="' + (hal + 1) + '"' + (hal >= n ? ' disabled' : '') + '>Selanjutnya</button>';
  return '<div class="pager" id="' + (id || '') + '"><span>Menampilkan ' + ((hal - 1) * per + 1) + '–' + Math.min(total, hal * per) + ' dari ' + total + '</span><div class="pg">' + b + '</div></div>';
}
function pasangPager(root, onGanti) { $$('.pager [data-pg]', root).forEach((b) => (b.onclick = () => onGanti(Number(b.dataset.pg)))); }
function opsi(list, pilih, kosongLabel) { return (kosongLabel !== undefined ? '<option value="">' + esc(kosongLabel) + '</option>' : '') + list.map((o) => { const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o; return '<option value="' + esc(v) + '"' + (String(v) === String(pilih) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''); }
function formData(root) {
  const o = {};
  $$('[name]', root).forEach((el) => { if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else o[el.name] = el.value.trim(); });
  return o;
}

// ---------------------------------------------------------------------------- router SPA
const Pages = {};
function daftarHalaman(nama, def) { Pages[nama] = Object.assign({ akses: 'masuk' }, def); }
function go(rute) { const h = '#/' + String(rute).replace(/^#?\/?/, ''); if (location.hash === h) route(); else location.hash = h; }
function parseHash() { const raw = location.hash.replace(/^#\/?/, ''); const [path, q] = raw.split('?'); const parts = path.split('/').map(decodeURIComponent); return { nama: parts[0] || '', param: parts.slice(1), query: new URLSearchParams(q || '') }; }
