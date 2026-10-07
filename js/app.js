/**
 * app.js — status aplikasi, bootstrap (SWR per periode), cangkang (sidebar + topbar),
 * login, ganti sandi wajib, notifikasi, pencarian global, router.
 */
'use strict';
const ROLE_LABEL = { SUPERADMIN: 'Super Admin', PENGAWAS: 'Pengawas', KEPALA: 'Kepala Sekolah', GURU: 'Guru' };
const REVIEWER = ['SUPERADMIN', 'PENGAWAS', 'KEPALA'];

const BOOT_OPSI = { pak: 1, ringkas: 1 };                 // kemampuan frontend v2: format kolom-baris & mode ringkas
const KOLEKSI_GURU = ['perangkat', 'observasi', 'refleksi', 'tindakLanjut'];
const PK_KOLEKSI = { perangkat: 'PerangkatID', observasi: 'ObservasiID', refleksi: 'RefleksiID', tindakLanjut: 'TindakLanjutID' };
const App = {
  token: '', uid: '', boot: null, periodeId: '', M: {}, rekap: { guru: {}, sekolah: {} }, idx: {}, segarSedang: false, serverV: '', _detail: {}, _detailP: {},
  get me() { return (this.boot && this.boot.me) || {}; },
  get role() { return this.me.Role || ''; },
  isReviewer() { return REVIEWER.indexOf(this.role) > -1; },
  batas() { const s = (this.boot && this.boot.setting) || {}; return { sb: Number(s.BATAS_SB || 86), b: Number(s.BATAS_B || 71), c: Number(s.BATAS_C || 56) }; },
  setting(k, d) { const s = (this.boot && this.boot.setting) || {}; return s[k] === undefined || s[k] === '' ? (d === undefined ? '' : d) : s[k]; },
  periode() { return ((this.boot && this.boot.periode) || []).find((p) => p.PeriodeID === this.periodeId) || {}; },
  periodeAktif() { const p = (this.boot && this.boot.periode) || []; return p.find((x) => x.Aktif === 'YA') || p[p.length - 1] || {}; },
  diPeriodeAktif() { return this.periodeId === this.periodeAktif().PeriodeID; },

  /** Indeks & rekap dihitung lokal → pindah menu instan tanpa server. */
  siapkan() {
    const b = this.boot, M = { user: {}, sekolah: {}, instrumen: {}, perangkat: {}, observasi: {}, refleksi: {}, tl: {}, template: {} };
    b.users.forEach((u) => (M.user[u.UserID] = u)); b.sekolah.forEach((s) => (M.sekolah[s.SekolahID] = s));
    b.instrumen.forEach((i) => { i._ind = pj(i.Indikator, []); M.instrumen[i.InstrumenID] = i; });
    b.perangkat.forEach((p) => (M.perangkat[p.PerangkatID] = p)); b.observasi.forEach((o) => (M.observasi[o.ObservasiID] = o));
    b.refleksi.forEach((r) => (M.refleksi[r.RefleksiID] = r)); b.tindakLanjut.forEach((t) => (M.tl[t.TindakLanjutID] = t));
    (b.template || []).forEach((t) => (M.template[t.Kode] = t));
    this.M = M;
    this.idx = HITUNG.kelompok(b);
    const bt = this.batas(), rg = {}, rs = {};
    this.guru().forEach((g) => (rg[g.UserID] = HITUNG.guru(g, this.idx, bt)));
    b.sekolah.forEach((s) => { rs[s.SekolahID] = HITUNG.sekolah(s, this.guru(s.SekolahID).map((g) => rg[g.UserID]), bt); });
    this.rekap = { guru: rg, sekolah: rs };
  },
  guru(sid, semua) { return this.boot.users.filter((u) => u.Role === 'GURU' && (semua || u.Status === 'Aktif') && (!sid || u.SekolahID === sid)).sort((a, b) => a.Nama.localeCompare(b.Nama)); },
  nama(uid) { const u = this.M.user[uid]; return u ? u.Nama : '-'; },
  namaSekolah(sid) { const s = this.M.sekolah[sid]; return s ? s.Nama : '-'; },

  terima(boot, simpan, hash) {
    bukaPak(boot);
    this.boot = boot; this.uid = boot.me.UserID; this.periodeId = boot.periodeId;
    if (boot.ringkas) this.gabungDetail(); else this._detail = {};
    this.siapkan();
    if (simpan !== false) { Store.set(uKey('boot:' + boot.periodeId), { t: Date.now(), h: hash || hashStr(JSON.stringify(boot)), data: kemasPak(boot) }); Store.set('last', { uid: this.uid, periodeId: this.periodeId }); }
  },
  simpanCache() { if (this.boot) Store.set(uKey('boot:' + this.periodeId), { t: Date.now(), h: '', data: kemasPak(this.boot) }); },
  // ---- MODE RINGKAS (cakupan besar): data lengkap per guru dimuat saat dibuka, disimpan di memori & digabung ulang
  perluDetail(guruId) { return !!(this.boot && this.boot.ringkas && guruId) && !this._detail[this.periodeId + ':' + guruId]; },
  async muatDetail(guruId) {
    if (!this.perluDetail(guruId)) return true;
    const k = this.periodeId + ':' + guruId;
    if (!this._detailP[k]) {
      this._detailP[k] = (async () => {
        const r = await apiQ('guruDetail', { guruId, periodeId: this.periodeId });
        delete this._detailP[k];
        if (!r.success) { toast(r.message, 'error'); return false; }
        this._detail[k] = r.data; this.gabungDetail(k); this.siapkan(); return true;
      })();
    }
    return this._detailP[k];
  },
  gabungDetail(baru) {
    const b = this.boot; if (!b) return;
    Object.keys(this._detail).forEach((k) => {
      const d = this._detail[k]; if (d.periodeId !== b.periodeId) return;
      const tanda = (rows, n) => rows.map((r) => r[PK_KOLEKSI[n]] + '@' + (r.DiperbaruiPada || '')).sort().join('|');
      const cocok = k === baru || KOLEKSI_GURU.every((n) => tanda(b[n].filter((r) => r.GuruUserID === d.guruId), n) === tanda(d[n], n));
      if (!cocok) { delete this._detail[k]; return; }              // data berubah di server → muat ulang saat dibuka
      KOLEKSI_GURU.forEach((n) => { b[n] = b[n].filter((r) => r.GuruUserID !== d.guruId).concat(d[n]); });
    });
  },
  /** Tambah/ganti baris lokal setelah aksi tulis berhasil, lalu render ulang halaman aktif. */
  upsert(koleksi, rows, pk, opsi) {
    const arr = this.boot[koleksi]; (Array.isArray(rows) ? rows : [rows]).forEach((r) => { if (!r) return; const i = arr.findIndex((x) => x[pk] === r[pk]); if (i > -1) arr[i] = Object.assign({}, arr[i], r); else arr.push(r); });
    this.siapkan(); this.simpanCache(); if (!opsi || opsi.render !== false) this.segarkanHalaman();
  },
  buang(koleksi, ids, pk) { const set = {}; ids.forEach((x) => (set[x] = 1)); this.boot[koleksi] = this.boot[koleksi].filter((x) => !set[x[pk]]); this.siapkan(); this.simpanCache(); this.segarkanHalaman(); },
  async muatBoot(paksa, segar) {
    const key = uKey('boot:' + this.periodeId);
    const c = Store.get(key, null);
    if (c && !paksa && Date.now() - c.t < 45000) return true;
    const res = await apiQ('boot', Object.assign({ periodeId: this.periodeId }, BOOT_OPSI, segar ? { _fresh: 1 } : {}));   // segar → server membaca ulang Sheets   // v2: ikut digabung dengan baca lain di tik yang sama
    if (res.success) {
      const h = hashStr(JSON.stringify(res.data)), lama = c && c.h;
      this.terima(res.data, true, h);
      if (lama !== h) { renderCangkang(); this.segarkanHalaman(true); }
      return true;
    }
    if (!c) toast(res.message, 'error', 'Gagal memuat data');
    return false;
  },
  async gantiPeriode(pid) {
    this.periodeId = pid;
    const c = Store.get(uKey('boot:' + pid), null);
    if (c) { this.terima(c.data, false); renderCangkang(); this.segarkanHalaman(true); }
    else $('#konten').innerHTML = skeleton(3, 160);
    await this.muatBoot(true);
    Store.set('last', { uid: this.uid, periodeId: pid });
  },
  segarkanHalaman(dariServer) {
    const h = parseHash(), def = Pages[h.nama];
    if (!def || !this.boot) return;
    if (dariServer && (typeof def.formulir === 'function' ? def.formulir() : def.formulir)) return;   // jangan timpa formulir yang sedang diisi
    const el = $('#konten'); if (!el) return;
    try { def.render(el, h.param, h.query); } catch (e) { console.error(e); el.innerHTML = kosong('Terjadi kesalahan tampilan', esc(e.message), '<button class="btn btn-pri" onclick="location.reload()">Muat ulang</button>', 'triangle-alert'); }
    const n = $('#nav-ttd'); if (n) { const t = this.boot.ttdMenunggu || 0; n.textContent = t; n.hidden = !t; }
  },
  sesiBerakhir() {
    if (!this.token) return;
    Sesi.hapus(); this.token = ''; this.boot = null;
    toast('Sesi Anda berakhir. Silakan masuk kembali.', 'warn');
    go('login');
  },
  keluar() { if (this.token) apiOnce('logout', {}, 8000, ''); Sesi.hapus(); this.token = ''; this.boot = null; this._detail = {}; Store.del('last'); go('login'); }
};

// ============================================================================ MENU
function menuUntuk(role) {
  const m = [{ r: 'dashboard', t: 'Dashboard', i: 'layout-dashboard' }];
  if (role !== 'GURU') m.push({ r: 'sekolah', t: 'Sekolah & Guru Binaan', i: 'school' });
  m.push({ r: 'perangkat', t: 'Perangkat Pembelajaran', i: 'book-open' }, { r: 'observasi', t: 'Observasi Kelas', i: 'presentation' },
    { r: 'refleksi', t: 'Form Refleksi', i: 'message-circle-question' }, { r: 'tindak-lanjut', t: 'Tindak Lanjut', i: 'git-fork' },
    { r: 'laporan', t: 'Laporan & Dokumen', i: 'folder-open', cnt: 'nav-ttd' }, { r: 'pengaturan', t: 'Pengaturan', i: 'settings' });
  return m;
}

// ============================================================================ CANGKANG
function renderCangkang() {
  const root = $('#app');
  if (!App.boot) return;
  let shell = $('#shell');
  if (!shell) {
    root.innerHTML = '<div class="shell" id="shell"><aside class="sidebar" id="sidebar"></aside><div class="main"><header class="topbar" id="topbar"></header><main class="content" id="konten"></main></div></div>';
    shell = $('#shell');
    shell.addEventListener('click', (e) => { if (shell.classList.contains('nav-buka') && e.target === shell) shell.classList.remove('nav-buka'); });
  }
  const me = App.me, pa = App.periodeAktif(), aktif = parseHash().nama;
  $('#sidebar').innerHTML =
    '<div class="brand"><div class="brand-logo">' + LOGO_SVG + '</div><div><div class="brand-name">' + esc(CFG.NAMA_APP || 'APSIKITA') + '</div><div class="brand-sub">' + esc(CFG.SUBJUDUL || 'Supervisi & Refleksi') + '</div></div></div>' +
    '<div class="siklus">' + ic('badge-check') + '<span class="grow">Siklus Aktif ' + esc(pa.TahunAjaran || pa.Nama || '') + '</span><span class="dot"></span></div>' +
    '<nav class="nav" id="nav">' + menuUntuk(me.Role).map((x) => '<a href="#/' + x.r + '" data-r="' + x.r + '" class="' + (aktif === x.r || (x.r === 'sekolah' && aktif === 'guru') ? 'on' : '') + '">' + ic(x.i) + '<span>' + x.t + '</span>' +
      (x.cnt ? '<span class="cnt" id="' + x.cnt + '"' + (App.boot.ttdMenunggu ? '' : ' hidden') + '>' + (App.boot.ttdMenunggu || 0) + '</span>' : '') + '</a>').join('') + '</nav>' +
    '<div class="bantuan"><b>' + ic('circle-help') + 'Pusat Bantuan</b>Pedoman standar instrumen supervisi terpadu. <a href="#/bantuan">Buka panduan</a></div>';
  $$('#nav a').forEach((a) => (a.onclick = () => $('#shell').classList.remove('nav-buka')));
  const belum = (App.boot.notif || []).filter((n) => n.Dibaca !== 'YA').length;
  $('#topbar').innerHTML =
    '<button class="btn btn-ghost btn-icon hamburger" id="tb-menu" aria-label="Menu">' + ic('menu') + '</button>' +
    '<label class="tb-periode" title="Periode supervisi">' + ic('calendar-days') + '<select id="tb-per" aria-label="Pilih periode">' + opsi(App.boot.periode.map((p) => ({ v: p.PeriodeID, t: p.Nama + (p.Aktif === 'YA' ? '' : ' (arsip)') })), App.periodeId) + '</select>' + ic('chevron-down') + '</label>' +
    '<div class="tb-cari" id="tb-cari">' + ic('search') + '<input class="inp" id="tb-q" placeholder="Cari guru, sekolah, dokumen…" autocomplete="off"><div class="cari-hasil" id="tb-hasil" hidden></div></div>' +
    '<div class="tb-right"><button class="btn btn-ghost btn-icon cari-mobile" id="tb-cari-m" aria-label="Cari">' + ic('search') + '</button>' +
    '<button class="bell" id="tb-bell" aria-label="Notifikasi">' + ic('bell') + (belum ? '<span class="merah"></span>' : '') + '</button><span class="tb-sep"></span>' +
    '<button class="tb-user" id="tb-user"><span class="teks"><span class="nm">' + esc(me.Nama) + '</span><br><span class="rl">' + esc(me.RoleLabel || ROLE_LABEL[me.Role]) + '</span></span>' + avatar(me.Nama) + '</button></div>';
  $('#tb-menu').onclick = () => $('#shell').classList.toggle('nav-buka');
  $('#tb-per').onchange = (e) => App.gantiPeriode(e.target.value);
  $('#tb-bell').onclick = (e) => { e.stopPropagation(); panelNotif(); };
  $('#tb-user').onclick = (e) => { e.stopPropagation(); menuUser(); };
  $('#tb-cari-m').onclick = () => { $('#tb-cari').classList.toggle('buka'); $('#tb-q').focus(); };
  pasangCari();
}
function tandaiNav() { const n = parseHash().nama; $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === n || (a.dataset.r === 'sekolah' && n === 'guru'))); }

let _dropdown = null;
function tutupDropdown() { if (_dropdown) { _dropdown.remove(); _dropdown = null; } }
document.addEventListener('click', (e) => { if (_dropdown && !_dropdown.contains(e.target)) tutupDropdown(); const h = $('#tb-hasil'); if (h && !e.target.closest('#tb-cari')) h.hidden = true; });
function bukaDropdown(anchor, html, kelas) {
  tutupDropdown();
  const r = anchor.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'dropdown ' + (kelas || ''); d.innerHTML = html;
  document.body.appendChild(d);
  const w = d.offsetWidth;
  d.style.top = (r.bottom + 8 + window.scrollY) + 'px';
  d.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, r.right - w)) + 'px';
  _dropdown = d; return d;
}
function menuUser() {
  const d = bukaDropdown($('#tb-user'), '<div style="padding:10px 12px 8px"><b>' + esc(App.me.Nama) + '</b><div class="muted small">' + esc(App.me.Email) + '</div></div><div class="hr" style="margin:4px 0"></div>' +
    '<a href="#/pengaturan/profil">' + ic('user-round') + 'Profil & Keamanan</a><a href="#/bantuan">' + ic('circle-help') + 'Panduan Penggunaan</a>' +
    '<button class="it" id="mu-segar">' + ic('refresh-cw') + 'Segarkan data</button><button class="it" id="mu-keluar" style="color:var(--k)">' + ic('log-out') + 'Keluar</button>');
  d.querySelector('#mu-keluar').onclick = () => { tutupDropdown(); App.keluar(); };
  d.querySelector('#mu-segar').onclick = async () => { tutupDropdown(); toast('Menyegarkan data…'); await App.muatBoot(true, true); toast('Data terbaru dimuat.'); };
  $$('a', d).forEach((a) => (a.onclick = () => tutupDropdown()));
}
function panelNotif() {
  const list = (App.boot.notif || []);
  const ikon = (j) => /PERANGKAT/.test(j) ? 'book-open' : /OBSERVASI/.test(j) ? 'presentation' : /REFLEKSI/.test(j) ? 'message-circle-question' : /TINDAK|TL_/.test(j) ? 'git-fork' : /TTD|DOK/.test(j) ? 'file-signature' : 'bell';
  const d = bukaDropdown($('#tb-bell'), '<div class="hd"><b>Notifikasi</b><span class="muted small">' + list.filter((n) => n.Dibaca !== 'YA').length + ' belum dibaca</span></div>' +
    (list.length ? list.map((n) => '<a class="notif-it ' + (n.Dibaca !== 'YA' ? 'baru' : '') + '" href="' + esc(n.Link || '#/dashboard') + '"><div class="ic-b">' + ic(ikon(n.Jenis)) + '</div><div class="grow"><div class="sb6">' + esc(n.Judul) + '</div><div class="small muted">' + esc(n.Pesan) + '</div><div class="tiny muted mt-8">' + lalu(n.Tanggal) + '</div></div></a>').join('')
      : kosong('Belum ada notifikasi', 'Pemberitahuan supervisi akan muncul di sini.', '', 'bell')), 'notif-panel');
  $$('a', d).forEach((a) => (a.onclick = () => tutupDropdown()));
  if (list.some((n) => n.Dibaca !== 'YA')) {
    list.forEach((n) => (n.Dibaca = 'YA')); App.simpanCache();
    const m = $('#tb-bell .merah'); if (m) m.remove();
    api('notifBaca', { semua: true });
  }
}
function pasangCari() {
  const q = $('#tb-q'), h = $('#tb-hasil'); let pilih = -1;
  const cari = debounce(() => {
    const t = q.value.trim().toLowerCase(); pilih = -1;
    if (t.length < 2) { h.hidden = true; return; }
    const hasil = [];
    App.guru(null, true).forEach((g) => { if ((g.Nama + ' ' + g.NIP + ' ' + g.Mapel).toLowerCase().indexOf(t) > -1) hasil.push({ ic: 'user-round', t: g.Nama, s: 'Guru • ' + App.namaSekolah(g.SekolahID), h: '#/guru/' + g.UserID }); });
    App.boot.sekolah.forEach((s) => { if ((s.Nama + ' ' + s.NPSN).toLowerCase().indexOf(t) > -1) hasil.push({ ic: 'school', t: s.Nama, s: 'Sekolah • NPSN ' + (s.NPSN || '-'), h: App.role === 'GURU' ? '#/dashboard' : '#/sekolah/' + s.SekolahID }); });
    App.boot.perangkat.forEach((p) => { if ((p.Judul + ' ' + p.Keterangan).toLowerCase().indexOf(t) > -1) hasil.push({ ic: 'folder', t: p.Judul, s: 'Perangkat • ' + App.nama(p.GuruUserID), h: '#/perangkat?id=' + p.PerangkatID }); });
    App.boot.instrumen.forEach((i) => { if (i.Nama.toLowerCase().indexOf(t) > -1 && App.isReviewer()) hasil.push({ ic: 'clipboard-list', t: i.Nama, s: 'Instrumen ' + i.Tipe, h: '#/observasi/instrumen' }); });
    h.innerHTML = hasil.length ? hasil.slice(0, 12).map((x) => '<a href="' + x.h + '">' + ic(x.ic) + '<div class="grow"><div class="sb6 trunc">' + esc(x.t) + '</div><div class="tiny muted trunc">' + esc(x.s) + '</div></div></a>').join('') : '<div class="muted small" style="padding:12px">Tidak ditemukan.</div>';
    h.hidden = false;
    $$('a', h).forEach((a) => (a.onclick = () => { h.hidden = true; q.value = ''; $('#tb-cari').classList.remove('buka'); }));
  }, 200);
  q.oninput = cari;
  q.onkeydown = (e) => {
    const a = $$('a', h); if (!a.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pilih = (pilih + (e.key === 'ArrowDown' ? 1 : -1) + a.length) % a.length; a.forEach((x, i) => x.classList.toggle('aktif', i === pilih)); }
    if (e.key === 'Enter' && pilih > -1) { a[pilih].click(); location.hash = a[pilih].getAttribute('href'); }
    if (e.key === 'Escape') h.hidden = true;
  };
}

// ============================================================================ LOGIN
function halamanLogin() {
  const cfg = Store.get('cfgPublik', {});
  $('#app').innerHTML = '<div class="login-wrap"><div class="login-card">' +
    '<div class="logo">' + LOGO_SVG.replace('<svg', '<svg width="40" height="40"') + '</div><div class="nama">APSIKITA<span class="dot-gold" style="width:8px;height:8px"></span></div><div class="tag">ENTERPRISE WORKSPACE</div>' +
    '<h2>Masuk ke Akun Anda</h2><p class="ket">Sistem Supervisi Terpadu ' + esc(cfg.institusi || CFG.INSTITUSI || 'STIS Al Wafa') + ' &amp; Sekolah Mitra</p>' +
    '<div id="l-status" hidden></div><form id="f-login" novalidate><div class="field"><label for="l-email">Email Dinas / Institusi</label><div class="inp-ic">' + ic('mail') + '<input class="inp" id="l-email" type="email" autocomplete="username" placeholder="nama@institusi.co.id" required></div></div>' +
    '<div class="field"><label for="l-pw" class="row row-between" style="width:100%"><span>Kata Sandi</span><a href="#" id="l-lupa" class="small sb6">Lupa password?</a></label>' +
    '<div class="inp-ic">' + ic('lock') + '<input class="inp" id="l-pw" type="password" autocomplete="current-password" placeholder="••••••••" required style="padding-right:48px"><button type="button" class="btn btn-ghost btn-icon btn-sm ujung" id="l-lihat" aria-label="Tampilkan sandi">' + ic('eye') + '</button></div></div>' +
    '<label class="check mb-16"><input type="checkbox" id="l-ingat" checked> Ingat saya di perangkat ini</label>' +
    '<div id="l-err" class="callout red mb-16" hidden></div>' +
    '<button class="btn btn-pri btn-lg btn-block" id="l-btn" type="submit">Login ke Aplikasi ' + ic('arrow-right') + '</button></form>' +
    '<div class="pemisah">Bantuan Akses</div><p class="center small" style="margin:0;color:var(--ink-2)">Hubungi Operator Sekolah jika Anda lupa akses akun.</p>' +
    '<div class="cakupan"><div class="h">' + ic('shield-check') + 'CAKUPAN PENGGUNA</div><p class="small" style="margin:8px 0 10px;color:var(--ink-2)">Mendukung login SuperAdmin, Pengawas, Kepala Sekolah, dan Guru.</p>' +
    '<div class="row row-wrap gap-8"><span class="chip chip-mint chip-sm">SuperAdmin</span><span class="chip chip-sm">Pengawas</span><span class="chip chip-sm">Kepala Sekolah</span><span class="chip chip-sm">Guru</span></div></div>' +
    '<div class="foot-login">' + esc(cfg.footer || '© 2026 STIS Al Wafa. Sistem Informasi Manajemen Penjaminan Mutu.') + '</div></div></div>';
  const em = Store.get('lastEmail', ''); if (em) $('#l-email').value = em;
  $('#l-lihat').onclick = () => { const p = $('#l-pw'); p.type = p.type === 'password' ? 'text' : 'password'; $('#l-lihat').innerHTML = ic(p.type === 'password' ? 'eye' : 'eye-off'); };
  $('#l-lupa').onclick = (e) => { e.preventDefault(); lupaSandi($('#l-email').value); };
  $('#f-login').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#l-email').value.trim(), pw = $('#l-pw').value, err = $('#l-err');
    err.hidden = true;
    if (!email || !pw) { err.textContent = 'Email dan kata sandi wajib diisi.'; err.hidden = false; return; }
    await sibuk($('#l-btn'), async () => {
      const last = Store.get('last', {});
      const res = await api('login', Object.assign({ email, password: pw, ingat: $('#l-ingat').checked, periodeId: '' }, BOOT_OPSI));
      if (!res.success) { err.innerHTML = ic('circle-alert') + '<span>' + esc(res.message) + '</span>'; err.hidden = false; return; }
      Store.set('lastEmail', email);
      App.token = res.data.token; Sesi.set(res.data.token, $('#l-ingat').checked);
      App.terima(res.data.boot);
      if (last.uid !== App.uid) Store.set('last', { uid: App.uid, periodeId: App.periodeId });
      mulaiApp();
      toast(res.message || 'Selamat datang!');
    }, 'Memeriksa…');
  };
  warmUpServer('pub');
  cekKoneksi();
}

function lupaSandi(emailAwal) {
  modal({ judul: 'Lupa Kata Sandi', ukuran: 'kecil', isi: '<p class="muted mt-8">Masukkan email akun Anda. Kode reset 6 digit akan dikirim lewat WhatsApp/Email (bila notifikasi diaktifkan operator).</p>' +
    '<div class="field"><label>Email</label><input class="inp" id="lp-email" type="email" value="' + esc(emailAwal || '') + '"></div>' +
    '<div id="lp-tahap2" hidden><div class="field"><label>Kode reset (6 digit)</label><input class="inp" id="lp-kode" inputmode="numeric" maxlength="6"></div>' +
    '<div class="field"><label>Kata sandi baru</label><input class="inp" id="lp-pw" type="password" autocomplete="new-password"><span class="bantu">Minimal 8 karakter, memuat huruf dan angka.</span></div></div>',
    kaki: '<button class="btn btn-out" data-tutup>Tutup</button><button class="btn btn-pri" id="lp-btn">Kirim Kode</button>',
    onBuka: (el, tutup) => {
      let tahap = 1;
      el.querySelector('#lp-btn').onclick = (e) => sibuk(e.currentTarget, async () => {
        const email = el.querySelector('#lp-email').value.trim();
        if (tahap === 1) {
          const r = await api('lupaPassword', { email });
          if (!r.success) return toast(r.message, 'error');
          toast(r.message);
          if (r.data && r.data.terkirim) { tahap = 2; el.querySelector('#lp-tahap2').hidden = false; e.currentTarget.textContent = 'Simpan Sandi Baru'; }
          return;
        }
        const r = await api('resetPasswordKode', { email, kode: el.querySelector('#lp-kode').value.trim(), passwordBaru: el.querySelector('#lp-pw').value });
        if (hasilToast(r)) tutup();
      });
    } });
}

function gantiSandiWajib() {
  modal({ judul: 'Ganti Kata Sandi Awal', ukuran: 'kecil', tanpaTutup: true, sub: 'Demi keamanan, ganti sandi sementara Anda sebelum melanjutkan.',
    isi: '<div class="field"><label>Sandi saat ini</label><input class="inp" id="gs-lama" type="password" autocomplete="current-password"></div>' +
      '<div class="field"><label>Sandi baru</label><input class="inp" id="gs-baru" type="password" autocomplete="new-password"><span class="bantu">Minimal 8 karakter, huruf dan angka.</span></div>' +
      '<div class="field"><label>Ulangi sandi baru</label><input class="inp" id="gs-ulang" type="password" autocomplete="new-password"></div>',
    kaki: '<button class="btn btn-ghost" id="gs-keluar">Keluar</button><button class="btn btn-pri" id="gs-ok">Simpan Sandi</button>',
    onBuka: (el, tutup) => {
      el.querySelector('#gs-keluar').onclick = () => { tutup(true); App.keluar(); };
      el.querySelector('#gs-ok').onclick = (e) => sibuk(e.currentTarget, async () => {
        const baru = el.querySelector('#gs-baru').value;
        if (baru !== el.querySelector('#gs-ulang').value) return toast('Ulangi sandi tidak sama.', 'error');
        const r = await api('gantiPassword', { passwordLama: el.querySelector('#gs-lama').value, passwordBaru: baru, ingat: Sesi.ingat() });
        if (!hasilToast(r)) return;
        App.token = r.data.token; Sesi.set(r.data.token, Sesi.ingat()); App.boot.me.HarusGantiPassword = 'TIDAK'; App.simpanCache(); tutup(true);
      });
    } });
}

// ============================================================================ VERIFIKASI PUBLIK (QR)
async function halamanVerifikasi(kode) {
  $('#app').innerHTML = '<div class="verif-wrap"><div class="card card-pad verif-card" id="vf">' + skeleton(3, 60) + '</div></div>';
  const r = await api('verif', { kode });
  const el = $('#vf');
  const kepala = '<div class="row gap-12 mb-16"><div class="brand-logo">' + LOGO_SVG + '</div><div><div class="brand-name" style="font-size:18px">Verifikasi Dokumen APSIKITA</div><div class="muted small">Kode: <span class="mono">' + esc(kode) + '</span></div></div></div>';
  if (!r.success) { el.innerHTML = kepala + '<div class="status-besar tarik">' + ic('shield-x') + '<div><b>Tidak Terverifikasi</b><div class="small">' + esc(r.message) + '</div></div></div><p class="muted small mt-16">Pastikan Anda memindai QR asli dari dokumen. Dokumen yang tidak terdaftar patut diragukan keasliannya.</p>'; return; }
  const d = r.data, sah = d.status === 'SAH';
  el.innerHTML = kepala + '<div class="status-besar ' + (sah ? 'sah' : d.status === 'DITARIK' ? 'tarik' : 'tunggu') + '">' + ic(sah ? 'shield-check' : 'shield-alert') + '<div><b>' + (sah ? 'Dokumen SAH & Terdaftar' : d.status === 'DITARIK' ? 'Dokumen DITARIK' : 'Menunggu Tanda Tangan') + '</b><div class="small">' + esc(d.institusi) + '</div></div></div>' +
    '<dl class="dl mt-16"><dt>Jenis dokumen</dt><dd>' + esc(d.jenis) + '</dd><dt>Nomor</dt><dd>' + esc(d.nomor || '-') + '</dd><dt>Perihal</dt><dd>' + esc(d.perihal) + '</dd><dt>Tanggal terbit</dt><dd>' + fWaktu(d.terbit) + '</dd>' +
    (d.catatan ? '<dt>Alasan ditarik</dt><dd style="color:var(--k)">' + esc(d.catatan) + '</dd>' : '') + '</dl>' +
    '<h4 class="mt-24 mb-16" style="font-size:15px">Penanda tangan</h4>' + d.penandatangan.map((p) => '<div class="checkrow"' + (d.slot && String(p.slot) === String(d.slot) ? ' style="outline:2px solid var(--brand-600)"' : '') + '><span class="ok-ic">' + ic(p.status === 'SETUJU' || p.status === 'OTOMATIS' ? 'check' : 'pen-line') + '</span><div class="grow"><div class="sb6">' + esc(p.nama || '-') + '</div><div class="small muted">' + esc(p.label) + ' • ' + esc(p.jabatan || '') + '</div>' +
      '<div class="tiny muted">' + esc({ SETUJU: 'Disetujui elektronik (' + (p.metode || '') + ')', OTOMATIS: 'QR elektronik', TTD_BASAH: 'Tanda tangan basah pada dokumen cetak', MENUNGGU: 'Belum menandatangani' }[p.status] || p.status) + (p.waktu ? ' • ' + fWaktu(p.waktu) : '') + '</div></div></div>').join('') +
    '<div class="soft mt-16"><div class="sb6 mb-16">Cek keaslian berkas PDF</div><p class="small muted" style="margin:-8px 0 12px">Unggah PDF yang Anda terima. Sistem menghitung sidik jari (SHA-256) di perangkat Anda — berkas tidak dikirim ke server.</p>' +
    '<input type="file" accept="application/pdf" id="vf-pdf" class="inp" style="padding:8px"><div id="vf-hasil" class="mt-12"></div></div>' +
    '<div class="center mt-16"><a href="#/login" class="small">Masuk ke APSIKITA</a></div>';
  $('#vf-pdf').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await f.arrayBuffer()))).map((b) => b.toString(16).padStart(2, '0')).join('');
    $('#vf-hasil').innerHTML = h === d.hashPdf ? '<div class="callout">' + ic('circle-check') + '<span><b>Cocok.</b> Berkas identik dengan dokumen yang diterbitkan.</span></div>' : '<div class="callout red">' + ic('circle-x') + '<span><b>Tidak cocok.</b> Berkas berbeda dari aslinya (diubah, dicetak ulang, atau bukan dokumen ini).</span></div>';
  };
}

// ============================================================================ ROUTER & MULAI
function route() {
  tutupDropdown();
  const h = parseHash();
  if (h.nama === 'v' && h.param[0]) return halamanVerifikasi(h.param[0]);
  if (!App.token) { if (h.nama !== 'login') { location.hash = '#/login'; return; } return halamanLogin(); }
  if (h.nama === 'login' || !h.nama) { location.hash = '#/dashboard'; return; }
  if (!App.boot) return;
  if (!$('#shell')) renderCangkang();
  const def = Pages[h.nama];
  if (!def) { $('#konten').innerHTML = kosong('Halaman tidak ditemukan', 'Alamat <span class="mono">' + esc(location.hash) + '</span> tidak tersedia.', '<a class="btn btn-pri" href="#/dashboard">Ke Dashboard</a>', 'map'); return; }
  if (def.roles && def.roles.indexOf(App.role) < 0) { $('#konten').innerHTML = kosong('Akses ditolak', 'Menu ini tidak tersedia untuk peran ' + esc(ROLE_LABEL[App.role]) + '.', '<a class="btn btn-pri" href="#/dashboard">Ke Dashboard</a>', 'shield-x'); tandaiNav(); return; }
  tandaiNav();
  if (h.nama === 'pengaturan' && App.role === 'SUPERADMIN') warmUpServer('admin');
  document.title = (def.judul ? def.judul + ' — ' : '') + 'APSIKITA';
  const el = $('#konten');
  el.classList.remove('page'); void el.offsetWidth; el.classList.add('page');
  window.scrollTo(0, 0);
  App.segarkanHalaman();
  if (def.setelah) def.setelah(el, h.param, h.query);
}
window.addEventListener('hashchange', route);

function mulaiApp(segarSekarang) {
  renderCangkang();
  const h = parseHash();
  if (!h.nama || h.nama === 'login') location.hash = '#/dashboard'; else route();
  setTimeout(() => { const s = $('#boot-splash'); if (s) { s.classList.add('hilang'); setTimeout(() => s.remove(), 300); } }, 50);
  if (segarSekarang) { App.muatBoot(true); prefetch(); }   // boot segar + prefetch di tik yang sama → 1 eksekusi 'batch'
  else if (window.requestIdleCallback) requestIdleCallback(() => prefetch(), { timeout: 4000 }); else setTimeout(prefetch, 1500);
  setTimeout(() => { if (App.boot && App.me.HarusGantiPassword === 'YA' && !$('#gs-lama')) gantiSandiWajib(); }, 250);
}
function prefetch() {
  apiQ('deList', {}).then((r) => { if (r.success) Store.set(uKey('deList'), { t: Date.now(), h: hashStr(JSON.stringify(r.data)), data: r.data }); });
  if (App.role === 'SUPERADMIN') warmUpServer('admin');
}
/** Halaman login: cek backend sekali → tampilkan masalah konfigurasi dengan bahasa jelas (bukan diam-diam gagal). */
async function cekKoneksi() {
  const box = $('#l-status'); if (!box) return;
  if (!gasSiap()) { box.innerHTML = '<div class="callout gold mb-16">' + ic('settings') + '<span><b>GAS_URL belum diisi.</b> Buka <span class="mono">js/config.js</span>, tempel URL Web App Apps Script (berakhiran <span class="mono">/exec</span>), lalu unggah ulang ke GitHub.</span></div>'; box.hidden = false; return; }
  const r = await apiOnce('configPublik', {}, 25000, '');
  if (!box.isConnected) return;
  if (r.success) {
    Store.set('cfgPublik', r.data);
    if (!r.data.siap) { box.innerHTML = '<div class="callout gold mb-16">' + ic('triangle-alert') + '<span><b>Backend terhubung, tetapi setup belum dijalankan.</b> Di editor Apps Script jalankan <span class="mono">setupAppEnvironment</span> sekali.</span></div>'; box.hidden = false; }
    else box.hidden = true;
  } else { box.innerHTML = '<div class="callout red mb-16">' + ic('wifi-off') + '<span><b>Tidak bisa menghubungi server.</b> ' + esc(r.message) + '</span></div>'; box.hidden = false; }
}

document.addEventListener('DOMContentLoaded', () => {
  App.token = Sesi.get();
  const h = parseHash();
  const tutupSplash = () => { const s = $('#boot-splash'); if (s) { s.classList.add('hilang'); setTimeout(() => s.remove(), 300); } };
  if (h.nama === 'v') { tutupSplash(); return route(); }
  if (!App.token) { tutupSplash(); return route(); }
  const last = Store.get('last', {});
  App.uid = last.uid || '';
  App.periodeId = last.periodeId || '';
  const c = App.uid && Store.get(uKey('boot:' + App.periodeId), null);
  if (c) { App.terima(c.data, false); mulaiApp(true); }       // tampil seketika dari cache, segarkan di latar (boot + prefetch = 1 batch)
  else {
    api('boot', Object.assign({ periodeId: App.periodeId }, BOOT_OPSI)).then((r) => {
      tutupSplash();
      if (!r.success) { if (App.token) { toast(r.message, 'error'); if (r.code === 'AUTH' || (r.data && r.data.code === 'AUTH')) App.sesiBerakhir(); else halamanGagal(r.message); } return; }
      App.terima(r.data); mulaiApp();
    });
  }
  let sembunyi = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sembunyi = Date.now();
    else if (App.boot && sembunyi && Date.now() - sembunyi > 120000) { Activity.last.boot = Date.now(); App.muatBoot(true); }
  });
  // penyegaran latar adaptif: tiap ±90 dtk saat aktif, ±10 mnt saat diam, berhenti saat tab tersembunyi (server menjawab dari cache)
  setInterval(() => { if (App.boot && App.token && !App.segarSedang && Activity.due('boot', 90000, 600000)) { App.segarSedang = true; App.muatBoot(true).finally(() => (App.segarSedang = false)); } }, 15000);
  Activity.last.boot = Date.now();
});
function halamanGagal(pesan) {
  $('#app').innerHTML = '<div class="login-wrap"><div class="card card-pad" style="max-width:480px">' + kosong('Tidak bisa terhubung ke server', esc(pesan), '<button class="btn btn-pri" onclick="location.reload()">' + ic('refresh-cw') + ' Coba lagi</button> <button class="btn btn-out" onclick="App.keluar()">Keluar</button>', 'wifi-off') + '</div></div>';
}

/** Jalankan fn setelah data lengkap guru tersedia (mode ringkas); tampilkan proses singkat bila perlu memuat. */
async function denganDetail(guruId, fn) {
  if (!App.perluDetail(guruId)) return fn();
  const tid = toastProses('Memuat data lengkap guru…');
  const ok = await App.muatDetail(guruId); tid();
  if (ok) return fn();
}
