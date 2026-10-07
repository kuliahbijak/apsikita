/**
 * p-pengaturan.js — Pengaturan:
 *  • Profil & Keamanan (semua peran): data diri, ganti sandi, PIN tanda tangan, keluar semua perangkat.
 *  • Panel operator (SuperAdmin): Umum & Aturan, Pengguna, Periode, Sistem (info, trigger, backup,
 *    reset/hapus data contoh, log aktivitas).
 *  Tab Template Dokumen, Notifikasi WA/Email, CRM Kontak, dan Migrasi Data ada di p-admin.js.
 *  Juga halaman #/bantuan (panduan per peran).
 */
'use strict';
const TAB_SET = [
  { k: 'profil', t: 'Profil & Keamanan', i: 'user-round' },
  { k: 'umum', t: 'Umum & Aturan', i: 'sliders-horizontal', sa: 1 },
  { k: 'pengguna', t: 'Pengguna', i: 'users', sa: 1 },
  { k: 'periode', t: 'Periode', i: 'calendar-days', sa: 1 },
  { k: 'template', t: 'Template Dokumen', i: 'file-cog', sa: 1 },
  { k: 'notifikasi', t: 'Notifikasi WA/Email', i: 'message-circle', sa: 1 },
  { k: 'crm', t: 'CRM Kontak', i: 'contact', sa: 1 },
  { k: 'migrasi', t: 'Migrasi Data', i: 'database-zap', sa: 1 },
  { k: 'sistem', t: 'Sistem', i: 'server-cog', sa: 1 }
];
const TAB_FORM = { profil: 1, umum: 1, template: 1, notifikasi: 1, crm: 1, migrasi: 1 };   // jangan ditimpa refresh latar
let _pg = { q: '', role: '', sek: '', st: '', hal: 1, logq: '', logAksi: '' };

function tabPengaturan() {
  const p = parseHash().param[0], sa = App.role === 'SUPERADMIN';
  return TAB_SET.some((t) => t.k === p && (!t.sa || sa)) ? p : (sa ? 'umum' : 'profil');
}

daftarHalaman('pengaturan', {
  judul: 'Pengaturan',
  formulir() { return !!TAB_FORM[tabPengaturan()]; },
  render(el, param) {
    const sa = App.role === 'SUPERADMIN', tab = tabPengaturan(), def = TAB_SET.find((t) => t.k === tab);
    el.innerHTML = '<div class="ph"><div><div class="eyebrow">Pengaturan / <b>' + esc(def.t) + '</b></div><h1>' + (sa ? 'Pengaturan Sistem' : 'Profil &amp; Keamanan') + '</h1>' +
      '<p>' + (sa ? 'Kelola aturan supervisi, pengguna, periode, template dokumen, notifikasi WhatsApp/Email, kontak, migrasi data, dan pemeliharaan sistem.' : 'Perbarui data diri, kata sandi, dan PIN tanda tangan elektronik Anda.') + '</p></div></div>' +
      (sa ? '<div class="tabs" id="pg-tabs">' + TAB_SET.map((t) => '<a href="#/pengaturan/' + t.k + '" class="' + (t.k === tab ? 'on' : '') + '">' + ic(t.i) + t.t + '</a>').join('') + '</div>' : '') +
      '<div id="pg-isi"></div>';
    const on = $('#pg-tabs .on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    const box = $('#pg-isi');
    const fn = { profil: tabProfil, umum: tabUmum, pengguna: tabPengguna, periode: tabPeriode, sistem: tabSistem,
      template: window.tabTemplate, notifikasi: window.tabNotif, crm: window.tabCrm, migrasi: window.tabMigrasi }[tab];
    if (typeof fn !== 'function') { box.innerHTML = kosong('Modul belum dimuat', 'Muat ulang halaman untuk membuka menu ini.', '<button class="btn btn-pri" onclick="location.reload()">Muat ulang</button>', 'triangle-alert'); return; }
    fn(box, param.slice(1));
  }
});

// ============================================================================ PROFIL & KEAMANAN
function polaSandi(pw) { return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw); }
function tabProfil(box) {
  const me = App.me, guru = me.Role === 'GURU', pin = !!me.PunyaPin;
  const wa = me.StatusWA === 'Terdaftar' ? '<span class="badge st-ok">' + ic('check') + 'Terdaftar WA</span>' : me.StatusWA === 'Tidak Terdaftar' ? '<span class="badge st-bad">Tidak terdaftar WA</span>' : '';
  box.innerHTML = '<div class="split">' +
    '<div class="card"><div class="card-head"><div><h3>Data Diri</h3><div class="sub">Dipakai pada kop laporan, tanda tangan dokumen, dan pengiriman notifikasi.</div></div></div><div class="card-body" id="pf-form">' +
      '<div class="row gap-16 mb-16 soft">' + '<div class="av av-xl">' + esc(inisial(me.Nama)) + '</div><div class="grow"><div class="b" style="font-size:17px">' + esc(me.Nama) + '</div><div class="small muted">' + esc(me.Email) + '</div>' +
        '<div class="row row-wrap gap-8 mt-8"><span class="chip chip-sm chip-mint">' + esc(me.RoleLabel || ROLE_LABEL[me.Role]) + '</span>' + (me.SekolahNama ? '<span class="chip chip-sm">' + ic('school') + esc(me.SekolahNama) + '</span>' : '') + '</div></div></div>' +
      '<div class="grid-2"><div class="field"><label>Nama lengkap &amp; gelar <span class="wajib">*</span></label><input class="inp" name="Nama" value="' + esc(me.Nama) + '" maxlength="120"></div>' +
        '<div class="field"><label>Email</label><input class="inp" value="' + esc(me.Email) + '" disabled><span class="bantu">Hubungi operator untuk mengganti email masuk.</span></div>' +
        '<div class="field"><label>NIP / NIY</label><input class="inp" name="NIP" value="' + esc(me.NIP || '') + '" maxlength="30"></div>' +
        '<div class="field"><label>No. WhatsApp ' + wa + '</label><input class="inp" name="NoWA" value="' + esc(me.NoWA || '') + '" inputmode="tel" placeholder="08xxxxxxxxxx"><span class="bantu">Untuk notifikasi supervisi & kode reset sandi.</span></div>' +
        '<div class="field"><label>Jabatan</label><input class="inp" name="Jabatan" value="' + esc(me.Jabatan || '') + '" maxlength="80" placeholder="' + esc({ GURU: 'Guru Mata Pelajaran', KEPALA: 'Kepala Sekolah', PENGAWAS: 'Pengawas Sekolah', SUPERADMIN: 'Operator' }[me.Role] || '') + '"></div>' +
        (guru ? '<div class="field"><label>Mata pelajaran</label><input class="inp" name="Mapel" value="' + esc(me.Mapel || '') + '"></div><div class="field"><label>Kelas diampu</label><input class="inp" name="Kelas" value="' + esc(me.Kelas || '') + '" placeholder="mis. VII A, VIII B"></div>' +
          '<div class="field"><label>Pangkat / golongan</label><input class="inp" name="Golongan" value="' + esc(me.Golongan || '') + '"></div>' : '') + '</div>' +
      '<div class="row row-between row-wrap gap-8 mt-8"><span class="tiny muted">Masuk terakhir: ' + (me.LastLoginAt ? fWaktu(me.LastLoginAt) : '-') + '</span><button class="btn btn-pri" id="pf-simpan">' + ic('save') + 'Simpan Profil</button></div></div></div>' +
    '<div class="stack gap-20">' +
      '<div class="card"><div class="card-head"><div><h3>' + ic('key-round') + ' Ganti Kata Sandi</h3><div class="sub">Minimal 8 karakter, memuat huruf dan angka.</div></div></div><div class="card-body" id="pf-pw">' +
        '<div class="field"><label>Sandi saat ini</label><input class="inp" type="password" id="pw-lama" autocomplete="current-password"></div>' +
        '<div class="field"><label>Sandi baru</label><input class="inp" type="password" id="pw-baru" autocomplete="new-password"><span class="bantu" id="pw-kuat"></span></div>' +
        '<div class="field"><label>Ulangi sandi baru</label><input class="inp" type="password" id="pw-ulang" autocomplete="new-password"></div>' +
        '<button class="btn btn-dark btn-block" id="pw-ok">Perbarui Sandi</button></div></div>' +
      '<div class="card"><div class="card-head"><div><h3>' + ic('fingerprint') + ' PIN Tanda Tangan</h3><div class="sub">Dipakai untuk menyetujui dokumen ber-QR secara elektronik.</div></div><span class="badge ' + (pin ? 'st-ok' : 'st-wait') + '">' + (pin ? 'Sudah diatur' : 'Belum diatur') + '</span></div><div class="card-body" id="pf-pin">' +
        '<div class="field"><label>Sandi akun (konfirmasi)</label><input class="inp" type="password" id="pin-pw" autocomplete="current-password"></div>' +
        '<div class="grid-2"><div class="field"><label>PIN baru (6 angka)</label><input class="inp mono" type="password" id="pin-a" inputmode="numeric" maxlength="6" autocomplete="off"></div>' +
        '<div class="field"><label>Ulangi PIN</label><input class="inp mono" type="password" id="pin-b" inputmode="numeric" maxlength="6" autocomplete="off"></div></div>' +
        '<button class="btn btn-out btn-block" id="pin-ok">' + (pin ? 'Ganti PIN' : 'Simpan PIN') + '</button></div></div>' +
      '<div class="card card-pad"><div class="row gap-12 row-top"><span class="ico-box">' + ic('smartphone') + '</span><div class="grow"><div class="sb6">Sesi di perangkat lain</div><div class="small muted">Keluarkan akun dari semua perangkat (termasuk perangkat ini) bila Anda curiga akun dipakai orang lain.</div>' +
        '<button class="btn btn-danger btn-sm mt-12" id="pf-logout">' + ic('log-out') + 'Keluar dari Semua Perangkat</button></div></div></div>' +
    '</div></div>';

  $('#pf-simpan', box).onclick = (e) => sibuk(e.currentTarget, async () => {
    const d = formData($('#pf-form', box));
    if (!d.Nama) return toast('Nama wajib diisi.', 'error');
    const r = await api('profilSimpan', d);
    if (!hasilToast(r)) return;
    Object.assign(App.boot.me, r.data.user);
    const i = App.boot.users.findIndex((u) => u.UserID === App.uid); if (i > -1) App.boot.users[i] = Object.assign({}, App.boot.users[i], r.data.user);
    App.siapkan(); App.simpanCache(); renderCangkang();
  });
  const kuat = $('#pw-kuat', box);
  $('#pw-baru', box).oninput = (e) => { const v = e.target.value; kuat.innerHTML = !v ? '' : polaSandi(v) ? '<span style="color:var(--sb)">' + ic('circle-check') + ' Sandi memenuhi syarat</span>' : 'Belum memenuhi: ' + [v.length < 8 ? 'min. 8 karakter' : '', /[a-zA-Z]/.test(v) ? '' : 'huruf', /\d/.test(v) ? '' : 'angka'].filter(Boolean).join(', '); };
  $('#pw-ok', box).onclick = (e) => sibuk(e.currentTarget, async () => {
    const lama = $('#pw-lama', box).value, baru = $('#pw-baru', box).value;
    if (!lama) return toast('Isi sandi saat ini.', 'error');
    if (!polaSandi(baru)) return toast('Sandi baru minimal 8 karakter berisi huruf dan angka.', 'error');
    if (baru !== $('#pw-ulang', box).value) return toast('Ulangi sandi baru tidak sama.', 'error');
    const r = await api('gantiPassword', { passwordLama: lama, passwordBaru: baru, ingat: Sesi.ingat() });
    if (!hasilToast(r)) return;
    App.token = r.data.token; Sesi.set(r.data.token, Sesi.ingat()); App.boot.me.HarusGantiPassword = 'TIDAK'; App.simpanCache();
    $$('#pf-pw input', box).forEach((x) => (x.value = '')); kuat.innerHTML = '';
  });
  $('#pin-ok', box).onclick = (e) => sibuk(e.currentTarget, async () => {
    const pw = $('#pin-pw', box).value, a = $('#pin-a', box).value.trim();
    if (!pw) return toast('Isi sandi akun untuk konfirmasi.', 'error');
    if (!/^\d{6}$/.test(a)) return toast('PIN harus 6 angka.', 'error');
    if (a !== $('#pin-b', box).value.trim()) return toast('Ulangi PIN tidak sama.', 'error');
    if (/^(\d)\1{5}$|^(012345|123456|234567|345678|456789|987654|654321)$/.test(a) && !(await konfirmasi('PIN mudah ditebak', 'PIN <b>' + esc(a.replace(/\d/g, '•')) + '</b> berpola berurutan/berulang. Tetap gunakan?', { ya: 'Tetap simpan' }))) return;
    const r = await api('pinAtur', { password: pw, pin: a });
    if (!hasilToast(r)) return;
    App.boot.me.PunyaPin = true; App.simpanCache(); App.segarkanHalaman();
  });
  $('#pf-logout', box).onclick = async () => {
    if (!(await konfirmasi('Keluar dari semua perangkat?', 'Semua sesi akun Anda — termasuk di perangkat ini — akan diakhiri. Anda perlu masuk kembali.', { ya: 'Keluar Semua', bahaya: true }))) return;
    const r = await api('logoutSemua', {});
    if (hasilToast(r)) App.keluar();
  };
}

// ============================================================================ UMUM & ATURAN (SuperAdmin)
const TIPE_BERKAS = [['PDF', 'PDF'], ['DOCX', 'Word (DOCX)'], ['GDOC', 'Google Docs'], ['XLSX', 'Excel (XLSX)'], ['GSHEET', 'Google Sheets'], ['PPTX', 'PowerPoint'], ['GSLIDE', 'Google Slides'], ['PNG', 'Gambar PNG'], ['JPG', 'Gambar JPG']];
const SET_DIKELOLA = ['NAMA_INSTITUSI', 'ALAMAT_INSTITUSI', 'KOTA_INSTITUSI', 'LOGO_FILE_ID', 'FOOTER_APP', 'APP_URL', 'UPLOAD_PERANGKAT', 'MAKS_UKURAN_MB', 'TIPE_FILE', 'AI_OTOMATIS',
  'BATAS_SB', 'BATAS_B', 'BATAS_C', 'TENGGAT_TL_HARI', 'PENGINGAT_TL_HARI', 'RATE_LIMIT_PER_MENIT'];
const SET_NOTIF = /^(NOTIF_|WA_|EMAIL_NAMA|CRM_SYNC)/;
function fSet(k, label, o) {
  o = o || {};
  const v = App.setting(k, '');
  return '<div class="field' + (o.kelas ? ' ' + o.kelas : '') + '"><label for="st-' + k + '">' + esc(label) + (o.wajib ? ' <span class="wajib">*</span>' : '') + '</label>' +
    (o.area ? '<textarea class="inp" id="st-' + k + '" name="' + k + '" rows="2">' + esc(v) + '</textarea>'
      : '<input class="inp' + (o.mono ? ' mono' : '') + '" id="st-' + k + '" name="' + k + '" value="' + esc(v) + '"' + (o.tipe ? ' type="' + o.tipe + '"' : '') + (o.min !== undefined ? ' min="' + o.min + '"' : '') + (o.max !== undefined ? ' max="' + o.max + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>') +
    (o.bantu ? '<span class="bantu">' + o.bantu + '</span>' : '') + '</div>';
}
function tabUmum(box) {
  const s = App.boot.setting || {}, tipe = String(s.TIPE_FILE || '').toUpperCase().split(/[,;\s]+/).filter(Boolean), gem = App.boot.ai && App.boot.ai.gemini;
  const lain = (s.__daftar || []).filter((r) => SET_DIKELOLA.indexOf(r.Kunci) < 0 && !SET_NOTIF.test(r.Kunci));
  const urlIni = location.origin + location.pathname.replace(/index\.html$/, '');
  box.innerHTML = '<div id="su-form"><div class="cols-2">' +
    '<div class="card"><div class="card-head"><div><h3>' + ic('building-2') + ' Identitas Lembaga</h3><div class="sub">Tampil di kop dokumen, halaman login, dan pesan notifikasi.</div></div></div><div class="card-body">' +
      fSet('NAMA_INSTITUSI', 'Nama lembaga', { wajib: 1 }) + fSet('ALAMAT_INSTITUSI', 'Alamat lembaga', { area: 1 }) +
      '<div class="grid-2">' + fSet('KOTA_INSTITUSI', 'Kota (tanggal tanda tangan)') + fSet('LOGO_FILE_ID', 'ID/URL logo (Google Drive)', { mono: 1, bantu: 'Untuk {{LOGO}} di template.' }) + '</div>' +
      fSet('FOOTER_APP', 'Teks kaki halaman login') +
      fSet('APP_URL', 'Alamat aplikasi (GitHub Pages)', { mono: 1, ph: 'https://akun.github.io/apsikita/', bantu: 'Untuk tautan di notifikasi & QR verifikasi dokumen. <a href="#" id="su-url">Pakai alamat ini</a> (' + esc(urlIni) + ')' }) +
    '</div></div>' +
    '<div class="card"><div class="card-head"><div><h3>' + ic('cloud-upload') + ' Unggah Perangkat &amp; Analisis AI</h3><div class="sub">Aturan berlaku untuk semua guru; pengguna diberi tahu saat berubah.</div></div></div><div class="card-body">' +
      '<div class="field"><label>Unggah perangkat pembelajaran</label><div class="seg" id="su-up"><button type="button" data-v="WAJIB" class="' + (s.UPLOAD_PERANGKAT !== 'OPSIONAL' ? 'on' : '') + '">Wajib</button><button type="button" data-v="OPSIONAL" class="' + (s.UPLOAD_PERANGKAT === 'OPSIONAL' ? 'on' : '') + '">Opsional</button></div>' +
        '<input type="hidden" name="UPLOAD_PERANGKAT" value="' + esc(s.UPLOAD_PERANGKAT === 'OPSIONAL' ? 'OPSIONAL' : 'WAJIB') + '"><span class="bantu">Opsional: tahap perencanaan bisa dilewati, nilai dihitung dari tahap lain.</span></div>' +
      fSet('MAKS_UKURAN_MB', 'Maksimal ukuran per berkas (MB)', { tipe: 'number', min: 1, max: 100 }) +
      '<div class="field"><label>Tipe berkas yang diizinkan</label><div class="grid-3" id="su-tipe">' + TIPE_BERKAS.map((t) => '<label class="check"><input type="checkbox" value="' + t[0] + '"' + (tipe.indexOf(t[0]) > -1 ? ' checked' : '') + '> ' + t[1] + '</label>').join('') + '</div></div>' +
      '<div class="hr"></div><label class="switch"><input type="checkbox" name="AI_OTOMATIS"' + (s.AI_OTOMATIS !== 'TIDAK' ? ' checked' : '') + '><span class="trk"></span>Analisis AI otomatis saat unggah &amp; draf tindak lanjut otomatis</label>' +
      '<div class="callout ' + (gem ? '' : 'gold') + ' mt-12">' + ic(gem ? 'sparkles' : 'info') + '<span>' + (gem ? '<b>Gemini aktif.</b> Analisis memakai model AI Google.' : '<b>Mode rubrik heuristik.</b> Isi <span class="mono">GEMINI_API_KEY</span> di Script Properties Apps Script untuk analisis AI penuh. Tanpa kunci, sistem tetap menilai dengan rubrik bawaan.') + '</span></div>' +
    '</div></div>' +
    '<div class="card"><div class="card-head"><div><h3>' + ic('gauge') + ' Predikat &amp; Penilaian</h3><div class="sub">Batas bawah tiap predikat (persen). Dashboard & laporan langsung menyesuaikan.</div></div></div><div class="card-body">' +
      '<div class="grid-3">' + fSet('BATAS_SB', 'Sangat Baik ≥', { tipe: 'number', min: 1, max: 100 }) + fSet('BATAS_B', 'Baik ≥', { tipe: 'number', min: 1, max: 99 }) + fSet('BATAS_C', 'Cukup ≥', { tipe: 'number', min: 1, max: 98 }) + '</div>' +
      '<div id="su-pred"></div>' +
    '</div></div>' +
    '<div class="card"><div class="card-head"><div><h3>' + ic('git-fork') + ' Tindak Lanjut &amp; Keamanan</h3><div class="sub">Tenggat bawaan, pengingat otomatis, dan pembatasan permintaan.</div></div></div><div class="card-body">' +
      '<div class="grid-2">' + fSet('TENGGAT_TL_HARI', 'Tenggat bawaan RTL (hari)', { tipe: 'number', min: 1, max: 365 }) + fSet('PENGINGAT_TL_HARI', 'Pengingat H-n sebelum tenggat', { tipe: 'number', min: 1, max: 30 }) + '</div>' +
      fSet('RATE_LIMIT_PER_MENIT', 'Batas permintaan per pengguna per menit', { tipe: 'number', min: 20, max: 600, bantu: 'Melindungi server dari penyalahgunaan. Bawaan 90 (cukup untuk pemakaian normal).' }) +
      '<div class="callout blue">' + ic('message-circle') + '<span>Pengaturan WhatsApp, Email, dan CRM ada di tab <a href="#/pengaturan/notifikasi">Notifikasi WA/Email</a>.</span></div>' +
    '</div></div></div>' +
    (lain.length ? '<details class="card card-pad mt-24 lipat"><summary class="sb6">' + ic('settings') + ' Pengaturan lanjutan (' + lain.length + ')</summary><div class="grid-2 mt-16">' +
      lain.map((r) => fSet(r.Kunci, r.Kunci, { mono: 1, bantu: esc(r.Keterangan || '') })).join('') + '</div></details>' : '') +
    '<div class="save-bar"><span class="small muted" id="su-ubah">Tidak ada perubahan.</span><button class="btn btn-out" id="su-batal">Batalkan</button><button class="btn btn-pri" id="su-simpan">' + ic('save') + 'Simpan Pengaturan</button></div></div>';

  const form = $('#su-form', box);
  const nilaiForm = () => {
    const o = formData(form); o.AI_OTOMATIS = o.AI_OTOMATIS ? 'YA' : 'TIDAK';
    o.TIPE_FILE = $$('#su-tipe input:checked', box).map((x) => x.value).join(',');
    if (o.LOGO_FILE_ID) o.LOGO_FILE_ID = (o.LOGO_FILE_ID.match(/[-\w]{25,}/) || [o.LOGO_FILE_ID])[0];
    if (o.APP_URL) o.APP_URL = o.APP_URL.replace(/#.*$/, '').replace(/index\.html$/, '');
    return o;
  };
  const awal = nilaiForm();
  const berubah = () => { const n = nilaiForm(), k = Object.keys(n).filter((x) => String(n[x]) !== String(awal[x])); $('#su-ubah', box).textContent = k.length ? k.length + ' perubahan belum disimpan' : 'Tidak ada perubahan.'; return { n, k }; };
  const pratinjau = () => {
    const sb = Number($('#st-BATAS_SB', box).value), b = Number($('#st-BATAS_B', box).value), c = Number($('#st-BATAS_C', box).value), ok = sb <= 100 && sb > b && b > c && c > 0;
    $('#su-pred', box).innerHTML = ok ? '<div class="pred-skala"><span class="pr-k" style="flex:' + c + '">Kurang<br><b>0–' + (c - 1) + '</b></span><span class="pr-c" style="flex:' + (b - c) + '">Cukup<br><b>' + c + '–' + (b - 1) + '</b></span><span class="pr-b" style="flex:' + (sb - b) + '">Baik<br><b>' + b + '–' + (sb - 1) + '</b></span><span class="pr-sb" style="flex:' + (101 - sb) + '">Sangat Baik<br><b>' + sb + '–100</b></span></div>'
      : '<div class="callout red">' + ic('circle-alert') + '<span>Urutan harus: Sangat Baik &gt; Baik &gt; Cukup &gt; 0, maksimal 100.</span></div>';
    return ok;
  };
  pratinjau();
  form.addEventListener('input', () => { pratinjau(); berubah(); });
  form.addEventListener('change', berubah);
  $$('#su-up button', box).forEach((b) => (b.onclick = () => { $$('#su-up button', box).forEach((x) => x.classList.toggle('on', x === b)); form.querySelector('[name=UPLOAD_PERANGKAT]').value = b.dataset.v; berubah(); }));
  $('#su-url', box).onclick = (e) => { e.preventDefault(); $('#st-APP_URL', box).value = urlIni; berubah(); };
  $('#su-batal', box).onclick = () => App.segarkanHalaman();
  $('#su-simpan', box).onclick = (e) => sibuk(e.currentTarget, async () => {
    const { n, k } = berubah();
    if (!k.length) return toast('Tidak ada perubahan.', 'warn');
    if (!pratinjau()) return toast('Periksa batas predikat.', 'error');
    if (!n.NAMA_INSTITUSI) return toast('Nama lembaga wajib diisi.', 'error');
    if (!n.TIPE_FILE) return toast('Pilih minimal satu tipe berkas.', 'error');
    const nilai = {}; k.forEach((x) => (nilai[x] = n[x]));
    const r = await api('settingSimpan', { nilai });
    if (!hasilToast(r)) return;
    App.boot.setting = r.data.setting; App.siapkan(); App.simpanCache(); App.segarkanHalaman();
  }, 'Menyimpan…');
}

// ============================================================================ PENGGUNA (SuperAdmin)
const URUT_PERAN = { SUPERADMIN: 0, PENGAWAS: 1, KEPALA: 2, GURU: 3 };
function tabPengguna(box) {
  const semua = App.boot.users.slice(), per = 25;
  const hitung = {}; semua.forEach((u) => (hitung[u.Role] = (hitung[u.Role] || 0) + 1));
  box.innerHTML = '<div class="row row-wrap gap-8 mb-16">' + ['SUPERADMIN', 'PENGAWAS', 'KEPALA', 'GURU'].map((r) => '<button class="chip ' + (_pg.role === r ? 'chip-brand' : 'chip-out') + '" data-peran="' + r + '">' + esc(ROLE_LABEL[r]) + ' <b>' + (hitung[r] || 0) + '</b></button>').join('') +
    '<span class="grow"></span><button class="btn btn-out btn-sm" id="pu-csv">' + ic('download') + 'Ekspor CSV</button><button class="btn btn-pri btn-sm" id="pu-baru">' + ic('user-plus') + 'Tambah Pengguna</button></div>' +
    '<div class="card"><div class="card-body" style="padding-bottom:0"><div class="filters"><div class="inp-ic cari grow">' + ic('search') + '<input class="inp inp-soft" id="pu-q" placeholder="Cari nama, email, NIP, nomor WA…" value="' + esc(_pg.q) + '"></div>' +
    '<select class="inp" id="pu-sek">' + opsi(App.boot.sekolah.map((s) => ({ v: s.SekolahID, t: s.Nama })), _pg.sek, 'Semua sekolah') + '</select>' +
    '<select class="inp" id="pu-st">' + opsi(['Aktif', 'Nonaktif'], _pg.st, 'Semua status') + '</select></div></div><div id="pu-tbl"></div></div>';
  const isi = $('#pu-tbl', box);
  const gambar = () => {
    const q = _pg.q.toLowerCase();
    const f = semua.filter((u) => (!_pg.role || u.Role === _pg.role) && (!_pg.sek || u.SekolahID === _pg.sek) && (!_pg.st || u.Status === _pg.st) &&
      (!q || (u.Nama + ' ' + u.Email + ' ' + (u.NIP || '') + ' ' + (u.NoWA || '')).toLowerCase().indexOf(q) > -1))
      .sort((a, b) => (URUT_PERAN[a.Role] - URUT_PERAN[b.Role]) || a.Nama.localeCompare(b.Nama));
    const hal = Math.min(_pg.hal, Math.max(1, Math.ceil(f.length / per)));
    isi.innerHTML = f.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pengguna</th><th>Peran</th><th>Sekolah</th><th>WhatsApp</th><th>Masuk terakhir</th><th>Status</th><th class="right">Aksi</th></tr></thead><tbody>' +
      f.slice((hal - 1) * per, hal * per).map((u) => '<tr><td><div class="row gap-12">' + avatar(u.Nama, 'av-sm ' + (u.Role === 'GURU' ? 'av-mint' : u.Role === 'SUPERADMIN' ? 'av-gold' : '')) + '<div class="grow"><div class="nm trunc">' + esc(u.Nama) + (u.Sumber === 'DUMMY' ? ' <span class="chip chip-sm chip-gold">contoh</span>' : '') + '</div><div class="sub trunc">' + esc(u.Email) + '</div></div></div></td>' +
        '<td><span class="chip chip-sm">' + esc(ROLE_LABEL[u.Role] || u.Role) + '</span></td><td class="small">' + esc(u.SekolahID ? App.namaSekolah(u.SekolahID) : '—') + '</td>' +
        '<td class="small">' + (u.NoWA ? '<span class="mono">' + esc(u.NoWA) + '</span>' + (u.StatusWA === 'Terdaftar' ? ' <span title="Terdaftar WA" style="color:var(--sb)">' + ic('circle-check') + '</span>' : u.StatusWA === 'Tidak Terdaftar' ? ' <span title="Tidak terdaftar WA" style="color:var(--k)">' + ic('circle-x') + '</span>' : '') : '<span class="muted">—</span>') + '</td>' +
        '<td class="small muted">' + (u.LastLoginAt ? lalu(u.LastLoginAt) : 'belum pernah') + (u.HarusGantiPassword === 'YA' ? '<div class="tiny" style="color:var(--gold-ink)">sandi sementara</div>' : '') + '</td>' +
        '<td><span class="badge ' + (u.Status === 'Aktif' ? 'st-ok' : 'st-mute') + '">' + esc(u.Status) + '</span></td>' +
        '<td class="right" style="white-space:nowrap"><button class="btn btn-ghost btn-icon btn-sm" data-ubah="' + u.UserID + '" title="Ubah">' + ic('pencil') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-reset="' + u.UserID + '" title="Reset sandi">' + ic('key-round') + '</button>' +
        (u.UserID !== App.uid ? '<button class="btn btn-ghost btn-icon btn-sm" data-status="' + u.UserID + '" title="' + (u.Status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan') + '">' + ic(u.Status === 'Aktif' ? 'user-x' : 'user-check') + '</button>' : '') + '</td></tr>').join('') +
      '</tbody></table></div>' + pager(f.length, hal, per, null, 'pu-pg') : kosong('Tidak ada pengguna', 'Ubah filter atau tambahkan pengguna baru.', '', 'users');
    pasangPager(isi, (p) => { _pg.hal = p; gambar(); });
    $$('[data-ubah]', isi).forEach((b) => (b.onclick = () => formPengguna(App.M.user[b.dataset.ubah])));
    $$('[data-reset]', isi).forEach((b) => (b.onclick = () => resetSandiUser(App.M.user[b.dataset.reset])));
    $$('[data-status]', isi).forEach((b) => (b.onclick = () => ubahStatusUser(App.M.user[b.dataset.status])));
  };
  gambar();
  $('#pu-q', box).oninput = debounce((e) => { _pg.q = e.target.value.trim(); _pg.hal = 1; gambar(); }, 150);
  $('#pu-sek', box).onchange = (e) => { _pg.sek = e.target.value; _pg.hal = 1; gambar(); };
  $('#pu-st', box).onchange = (e) => { _pg.st = e.target.value; _pg.hal = 1; gambar(); };
  $$('[data-peran]', box).forEach((b) => (b.onclick = () => { _pg.role = _pg.role === b.dataset.peran ? '' : b.dataset.peran; _pg.hal = 1; App.segarkanHalaman(); }));
  $('#pu-baru', box).onclick = () => formPengguna({ Role: _pg.role || 'GURU', SekolahID: _pg.sek });
  $('#pu-csv', box).onclick = () => unduhTeks('pengguna-apsikita-' + isoHari() + '.csv', keCsv(semua.map((u) => ({ Nama: u.Nama, Email: u.Email, Peran: ROLE_LABEL[u.Role], Sekolah: u.SekolahID ? App.namaSekolah(u.SekolahID) : '', NIP: u.NIP, Mapel: u.Mapel, Kelas: u.Kelas, NoWA: u.NoWA, StatusWA: u.StatusWA, Status: u.Status, MasukTerakhir: u.LastLoginAt }))));
}

function formPengguna(u) {
  u = u || {}; const baru = !u.UserID;
  modal({ judul: baru ? 'Tambah Pengguna' : 'Ubah Pengguna', ukuran: 'lebar', sub: baru ? 'Akun langsung aktif. Sandi awal wajib diganti saat masuk pertama.' : esc(u.Email),
    isi: '<div id="fpu"><div class="grid-2">' +
      '<div class="field"><label>Nama lengkap &amp; gelar <span class="wajib">*</span></label><input class="inp" name="Nama" value="' + esc(u.Nama || '') + '" maxlength="120"></div>' +
      '<div class="field"><label>Email <span class="wajib">*</span></label><input class="inp" name="Email" type="email" value="' + esc(u.Email || '') + '"></div>' +
      '<div class="field"><label>Peran</label><select class="inp" name="Role" id="fp-role">' + opsi(Object.keys(URUT_PERAN).map((r) => ({ v: r, t: ROLE_LABEL[r] })), u.Role || 'GURU') + '</select></div>' +
      '<div class="field" id="fp-sek"><label>Sekolah <span class="wajib">*</span></label><select class="inp" name="SekolahID">' + opsi(App.boot.sekolah.map((s) => ({ v: s.SekolahID, t: s.Nama })), u.SekolahID, 'Pilih sekolah…') + '</select></div>' +
      '<div class="field"><label>NIP / NIY</label><input class="inp" name="NIP" value="' + esc(u.NIP || '') + '"></div>' +
      '<div class="field"><label>No. WhatsApp</label><input class="inp" name="NoWA" value="' + esc(u.NoWA || '') + '" inputmode="tel" placeholder="08xxxxxxxxxx"></div>' +
      '<div class="field"><label>Jabatan</label><input class="inp" name="Jabatan" value="' + esc(u.Jabatan || '') + '"></div>' +
      '<div class="field fp-guru"><label>Mata pelajaran</label><input class="inp" name="Mapel" value="' + esc(u.Mapel || '') + '"></div>' +
      '<div class="field fp-guru"><label>Kelas diampu</label><input class="inp" name="Kelas" value="' + esc(u.Kelas || '') + '"></div>' +
      '<div class="field fp-guru"><label>Pangkat / golongan</label><input class="inp" name="Golongan" value="' + esc(u.Golongan || '') + '"></div>' +
      (baru ? '<div class="field"><label>Sandi awal (opsional)</label><input class="inp" name="Sandi" type="text" autocomplete="off" placeholder="Kosongkan = dibuat acak"><span class="bantu">Min. 8 karakter, huruf & angka.</span></div>' : '') +
      '</div>' + (!baru && u.Role !== 'SUPERADMIN' ? '<div class="callout gold mt-8">' + ic('info') + '<span>Mengubah peran/email akan mengeluarkan sesi pengguna ini; peran baru berlaku saat ia masuk kembali.</span></div>' : '') + '</div>',
    kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="fp-ok">' + ic('save') + (baru ? 'Buat Akun' : 'Simpan') + '</button>',
    onBuka: (el, tutup) => {
      const atur = () => { const r = el.querySelector('#fp-role').value; el.querySelector('#fp-sek').hidden = !(r === 'GURU' || r === 'KEPALA'); $$('.fp-guru', el).forEach((x) => (x.hidden = r !== 'GURU')); };
      el.querySelector('#fp-role').onchange = atur; atur();
      el.querySelector('#fp-ok').onclick = (e) => sibuk(e.currentTarget, async () => {
        const d = formData(el.querySelector('#fpu'));
        if (!d.Nama || !d.Email) return toast('Nama dan email wajib diisi.', 'error');
        if ((d.Role === 'GURU' || d.Role === 'KEPALA') && !d.SekolahID) return toast('Pilih sekolah.', 'error');
        if (d.Sandi && !polaSandi(d.Sandi)) return toast('Sandi awal minimal 8 karakter berisi huruf dan angka.', 'error');
        if (d.Role !== 'GURU' && d.Role !== 'KEPALA') d.SekolahID = '';
        if (!baru) d.UserID = u.UserID;
        const r = await api('userSimpan', d);
        if (!hasilToast(r)) return;
        tutup(true);
        App.upsert('users', r.data.user, 'UserID');
        if (r.data.sandiAwal) tampilAkunBaru('Akun Dibuat', r.data.user.Email, r.data.sandiAwal, r.data.user.Nama);
        if (d.Role === 'KEPALA' || u.Role === 'KEPALA') App.muatBoot(true);
      });
    } });
}

// ============================================================================ PERIODE (SuperAdmin)
function tabPeriode(box) {
  const rows = App.boot.periode.slice().sort((a, b) => String(b.TanggalMulai).localeCompare(String(a.TanggalMulai)));
  box.innerHTML = '<div class="split">' +
    '<div class="card"><div class="card-head"><div><h3>Periode Supervisi</h3><div class="sub">Hanya satu periode aktif. Periode lain tetap bisa dibuka sebagai arsip dari pemilih periode di bilah atas.</div></div><button class="btn btn-pri btn-sm" id="pe-baru">' + ic('plus') + 'Periode Baru</button></div><div class="card-body" style="padding:12px 0 0">' +
      (rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Periode</th><th>Rentang</th><th>Batas unggah</th><th>Status</th><th class="right">Aksi</th></tr></thead><tbody>' + rows.map((p) =>
        '<tr><td><div class="nm">' + esc(p.Nama) + '</div><div class="sub">' + esc([p.TahunAjaran, p.Semester].filter(Boolean).join(' • ')) + '</div></td><td class="small">' + fTgl(p.TanggalMulai) + ' – ' + fTgl(p.TanggalSelesai) + '</td>' +
        '<td class="small">' + (p.BatasUnggah ? fTgl(p.BatasUnggah) : '—') + '</td><td>' + (p.Aktif === 'YA' ? '<span class="badge st-ok">' + ic('circle-check') + 'Aktif</span>' : '<span class="badge st-mute">Arsip</span>') + (p.PeriodeID === App.periodeId ? ' <span class="chip chip-sm chip-mint">dibuka</span>' : '') + '</td>' +
        '<td class="right" style="white-space:nowrap">' + (p.Aktif !== 'YA' ? '<button class="btn btn-out btn-xs" data-aktif="' + p.PeriodeID + '">Jadikan aktif</button> ' : '') + '<button class="btn btn-ghost btn-icon btn-sm" data-ubah="' + p.PeriodeID + '" title="Ubah">' + ic('pencil') + '</button></td></tr>').join('') +
      '</tbody></table></div>' : kosong('Belum ada periode', 'Buat periode supervisi pertama.', '', 'calendar-days')) + '</div></div>' +
    '<div class="card card-pad"><div class="sb6 mb-16">' + ic('info') + ' Cara kerja periode</div><ul class="small muted" style="margin:0;padding-left:18px;line-height:1.7">' +
      '<li>Semua data supervisi (perangkat, observasi, refleksi, tindak lanjut) tercatat pada periode aktif.</li><li>Mengaktifkan periode baru otomatis mengarsipkan periode sebelumnya — datanya tetap utuh.</li>' +
      '<li><b>Batas unggah</b> ditampilkan ke guru sebagai tenggat perangkat pembelajaran.</li><li>Laporan periode lama tetap bisa diterbitkan dengan memilih periode di bilah atas.</li></ul></div></div>';
  $('#pe-baru', box).onclick = () => formPeriode({});
  $$('[data-ubah]', box).forEach((b) => (b.onclick = () => formPeriode(App.boot.periode.find((p) => p.PeriodeID === b.dataset.ubah))));
  $$('[data-aktif]', box).forEach((b) => (b.onclick = async () => {
    const p = App.boot.periode.find((x) => x.PeriodeID === b.dataset.aktif);
    if (!(await konfirmasi('Aktifkan ' + esc(p.Nama) + '?', 'Periode aktif saat ini akan menjadi arsip. Aktivitas supervisi baru akan tercatat pada <b>' + esc(p.Nama) + '</b>.', { ya: 'Aktifkan' }))) return;
    simpanPeriode(Object.assign({}, p, { Aktif: 'YA' }), b);
  }));
}
async function simpanPeriode(d, btn) {
  return sibuk(btn, async () => {
    const r = await api('periodeSimpan', d);
    if (!hasilToast(r)) return false;
    App.boot.periode = r.data.periode; App.simpanCache(); renderCangkang(); App.segarkanHalaman();
    return true;
  });
}
function formPeriode(p) {
  const baru = !p.PeriodeID, th = new Date().getFullYear();
  modal({ judul: baru ? 'Periode Baru' : 'Ubah Periode', isi: '<div id="fpe"><div class="field"><label>Nama periode <span class="wajib">*</span></label><input class="inp" name="Nama" value="' + esc(p.Nama || '') + '" placeholder="mis. Semester Ganjil ' + th + '/' + (th + 1) + '"></div>' +
      '<div class="grid-2"><div class="field"><label>Tahun ajaran</label><input class="inp" name="TahunAjaran" value="' + esc(p.TahunAjaran || '') + '" placeholder="' + th + '/' + (th + 1) + '"></div><div class="field"><label>Semester</label><select class="inp" name="Semester">' + opsi(['Ganjil', 'Genap'], p.Semester || 'Ganjil') + '</select></div>' +
      '<div class="field"><label>Tanggal mulai <span class="wajib">*</span></label><input class="inp" type="date" name="TanggalMulai" value="' + esc(p.TanggalMulai || '') + '"></div><div class="field"><label>Tanggal selesai <span class="wajib">*</span></label><input class="inp" type="date" name="TanggalSelesai" value="' + esc(p.TanggalSelesai || '') + '"></div>' +
      '<div class="field"><label>Batas unggah perangkat</label><input class="inp" type="date" name="BatasUnggah" value="' + esc(p.BatasUnggah || '') + '"></div></div>' +
      '<label class="switch"><input type="checkbox" name="Aktif"' + (p.Aktif === 'YA' ? ' checked' : '') + '><span class="trk"></span>Jadikan periode aktif</label></div>',
    kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="fpe-ok">' + ic('save') + 'Simpan</button>',
    onBuka: (el, tutup) => {
      el.querySelector('#fpe-ok').onclick = async (e) => {
        const d = formData(el.querySelector('#fpe')); d.Aktif = d.Aktif ? 'YA' : 'TIDAK'; if (!baru) d.PeriodeID = p.PeriodeID;
        if (!d.Nama || !d.TanggalMulai || !d.TanggalSelesai) return toast('Nama dan rentang tanggal wajib diisi.', 'error');
        if (d.TanggalSelesai < d.TanggalMulai) return toast('Tanggal selesai harus setelah tanggal mulai.', 'error');
        if (await simpanPeriode(d, e.currentTarget)) tutup(true);
      };
    } });
}

// ============================================================================ SISTEM (SuperAdmin)
const LABEL_TABEL = { Users: 'Pengguna', Sekolah: 'Sekolah', PerangkatPembelajaran: 'Perangkat', Observasi: 'Observasi', Refleksi: 'Refleksi', TindakLanjut: 'Tindak lanjut', DE_Dokumen: 'Dokumen terbit', AntrianNotif: 'Antrean notifikasi', CRM_Kontak: 'Kontak CRM', Logs: 'Log aktivitas' };
function tabSistem(box) {
  box.innerHTML = '<div id="si-info">' + skeleton(2, 140) + '</div>' +
    '<div class="sec-h"><div><h2>' + ic('history') + 'Log Aktivitas</h2><div class="sub">Jejak audit login, perubahan data, dan aksi operator (terbaru di atas).</div></div>' +
    '<div class="filters"><div class="inp-ic cari">' + ic('search') + '<input class="inp inp-soft" id="lg-q" placeholder="Cari email, aksi, detail…" value="' + esc(_pg.logq) + '"></div><button class="btn btn-out" id="lg-csv">' + ic('download') + 'CSV</button><button class="btn btn-out btn-icon" id="lg-segar" title="Muat ulang">' + ic('refresh-cw') + '</button></div></div>' +
    '<div class="card" id="si-log">' + skeleton(4, 44) + '</div>';
  let log = [];
  const gambarLog = () => {
    const q = _pg.logq.toLowerCase(), f = log.filter((r) => !q || (r.Email + ' ' + r.Aksi + ' ' + r.Detail + ' ' + r.Role).toLowerCase().indexOf(q) > -1);
    $('#si-log', box).innerHTML = f.length ? '<div class="tbl-wrap" style="max-height:560px;overflow:auto"><table class="tbl compact"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>' +
      f.slice(0, 300).map((r) => '<tr><td class="small" style="white-space:nowrap">' + fWaktu(r.Waktu) + (r.antre ? ' <span class="chip chip-sm" title="Belum ditulis ke sheet">antre</span>' : '') + '</td><td class="small"><div class="trunc" style="max-width:220px">' + esc(r.Email) + '</div><div class="tiny muted">' + esc(ROLE_LABEL[r.Role] || r.Role || '') + '</div></td>' +
        '<td><span class="chip chip-sm' + (/GAGAL|HAPUS|TARIK|RESET/.test(r.Aksi) ? ' chip-gold' : '') + '">' + esc(r.Aksi) + '</span></td><td class="small" style="max-width:420px">' + esc(r.Detail) + '</td></tr>').join('') + '</tbody></table></div>'
      : kosong('Belum ada log', q ? 'Tidak ada yang cocok dengan pencarian.' : 'Aktivitas akan tercatat di sini.', '', 'history');
  };
  const render = (d) => {
    if (!box.isConnected) return;
    if (d['sistem.info']) gambarInfo($('#si-info', box), d['sistem.info']);
    if (d['sistem.log']) { log = d['sistem.log'].rows || []; gambarLog(); }
  };
  const muat = (paksa) => swrBatch('sistem', [{ action: 'sistem.info' }, { action: 'sistem.log', data: { n: 300 } }], render, { fresh: 20000, force: paksa,
    onError: (r) => { $('#si-info', box).innerHTML = '<div class="card">' + kosong('Gagal memuat info sistem', esc(r.message), '<button class="btn btn-pri" id="si-ulang">Coba lagi</button>', 'wifi-off') + '</div>'; const b = $('#si-ulang', box); if (b) b.onclick = () => muat(true); } });
  muat(false);
  $('#lg-q', box).oninput = debounce((e) => { _pg.logq = e.target.value.trim(); gambarLog(); }, 150);
  $('#lg-segar', box).onclick = (e) => sibuk(e.currentTarget, () => muat(true));
  $('#lg-csv', box).onclick = () => unduhTeks('log-apsikita-' + isoHari() + '.csv', keCsv(log, ['Waktu', 'Email', 'Role', 'Aksi', 'Detail', 'Target']));

  function gambarInfo(el, d) {
    const trig = d.trigger || [], tOk = trig.indexOf('pekerjaMenit') > -1 && trig.indexOf('pekerjaHarian') > -1;
    const cron = d.cronTerakhir ? Math.round((Date.now() - d.cronTerakhir) / 60000) : null;
    const baris = (ikon, judul, nilai, ok) => '<div class="checkrow"><span class="ok-ic" style="' + (ok === false ? 'background:var(--k-bg);color:var(--k)' : ok === null ? 'background:var(--gold-soft);color:var(--gold-ink)' : '') + '">' + ic(ikon) + '</span><div class="grow"><div class="sb6">' + judul + '</div><div class="small muted">' + nilai + '</div></div></div>';
    el.innerHTML = '<div class="cols-3">' +
      '<div class="card card-pad"><div class="row row-between mb-16"><div class="sb6">' + ic('server-cog') + ' Status Layanan</div><span class="chip chip-sm">v' + esc(d.versi) + '</span></div>' +
        baris('timer', 'Pekerja latar (trigger)', tOk ? 'Aktif — ' + (cron === null ? 'belum berjalan' : 'terakhir ' + (cron < 1 ? 'baru saja' : cron + ' menit lalu')) : 'Belum terpasang. Notifikasi, analisis AI antre & pengingat tidak berjalan.', tOk ? (cron !== null && cron > 15 ? null : true) : false) +
        baris('sparkles', 'Analisis AI', d.gemini ? 'Gemini (' + esc(d.geminiModel) + ')' : 'Rubrik heuristik (GEMINI_API_KEY belum diisi)', d.gemini ? true : null) +
        baris('file-scan', 'Drive API (baca PDF/DOCX)', d.driveApi ? 'Aktif' : 'Belum diaktifkan di Services Apps Script', d.driveApi) +
        baris('link', 'Alamat aplikasi', d.appUrl ? '<span class="mono">' + esc(d.appUrl) + '</span>' : 'Belum diisi — tautan notifikasi & QR tidak lengkap', d.appUrl ? true : null) +
        baris('mail', 'Kuota email harian', angka(d.kuotaEmail) + ' tersisa', d.kuotaEmail > 20 ? true : null) +
        (d.keepWarm === undefined ? '' : (() => {   // v2: status pemanasan cache (backend v1 tidak mengirim → baris disembunyikan)
          const w = d.warmTerakhir, mnt = w && w.at ? Math.round((Date.now() - new Date(w.at).getTime()) / 60000) : null;
          const teks = (d.keepWarm ? 'Aktif' : 'Dimatikan (matikanKeepWarm) — cache tetap dipanaskan saat aplikasi dibuka') + (mnt === null ? '' : ' · terakhir ' + (mnt < 1 ? 'baru saja' : mnt + ' menit lalu')) + (d.antreanNotif ? ' · antrean notifikasi sedang diproses' : '');
          return baris('flame', 'Pemanasan cache (keepWarm)', teks, d.keepWarm ? true : null);
        })()) +
        '<div class="row row-wrap gap-8 mt-12"><button class="btn btn-out btn-sm" id="si-trig">' + ic('timer') + 'Pasang Ulang Trigger</button><button class="btn btn-out btn-sm" id="si-bak">' + ic('hard-drive-download') + 'Backup Sekarang</button>' + (d.keepWarm === undefined ? '' : '<button class="btn btn-out btn-sm" id="si-cache" title="Pakai setelah mengedit data langsung di spreadsheet">' + ic('refresh-cw') + 'Segarkan Cache Server</button>') + '</div></div>' +
      '<div class="card card-pad"><div class="sb6 mb-16">' + ic('database') + ' Data Tersimpan</div><dl class="dl">' + Object.keys(LABEL_TABEL).map((k) => '<dt>' + LABEL_TABEL[k] + '</dt><dd>' + (d.jumlah[k] === '-' ? '-' : angka(d.jumlah[k])) + '</dd>').join('') + '</dl>' +
        (d.antreanAnalisis ? '<div class="callout gold mt-16">' + ic('hourglass') + '<span>' + d.antreanAnalisis + ' perangkat menunggu analisis AI.</span></div>' : '') +
        '<div class="row row-wrap gap-8 mt-16"><a class="btn btn-out btn-sm" target="_blank" rel="noopener" href="' + esc(d.spreadsheetUrl) + '">' + ic('table') + 'Buka Database</a>' + (d.folderUrl ? '<a class="btn btn-out btn-sm" target="_blank" rel="noopener" href="' + esc(d.folderUrl) + '">' + ic('folder-open') + 'Folder Drive</a>' : '') + '</div></div>' +
      '<div class="card card-pad"><div class="sb6 mb-16">' + ic('flask-conical') + ' Data Contoh (Dummy)</div><p class="small muted" style="margin-top:0">Data contoh: 1 pengawas, 6 sekolah, 6 kepala sekolah, 24 guru beserta perangkat, observasi, refleksi & tindak lanjut. Sandi akun contoh <span class="mono">Demo#2026</span>, PIN <span class="mono">123456</span>.</p>' +
        '<div class="soft mb-16"><div class="row row-between"><span class="small">Akun contoh saat ini</span><b>' + angka(d.dummy) + '</b></div></div>' +
        '<div class="stack gap-8"><button class="btn btn-gold" id="si-reset">' + ic('rotate-ccw') + 'Reset Data Contoh</button><button class="btn btn-danger" id="si-hapus"' + (d.dummy ? '' : ' disabled') + '>' + ic('trash-2') + 'Hapus Data Contoh</button></div>' +
        '<p class="tiny muted mt-12" style="margin-bottom:0">Hanya data bertanda contoh yang disentuh. Data asli tidak berubah.</p></div></div>' +
      '<div class="callout blue mt-16">' + ic('key-round') + '<div><b>Lupa sandi Super Admin?</b> Buka editor Apps Script → berkas <span class="mono">Setup.gs</span> → isi <span class="mono">EMAIL_SUPERADMIN</span> (dan opsional <span class="mono">SANDI_BARU_SUPERADMIN</span>) → pilih fungsi <span class="mono">resetPasswordSuperAdmin</span> → <b>Run</b>. Sandi baru tampil di <i>Execution log</i>. Fungsi <span class="mono">resetDataDummy</span> / <span class="mono">hapusDataDummy</span> juga bisa dijalankan dari editor.</div></div>';
    $('#si-trig', el).onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('sistem.trigger', {}); if (hasilToast(r, 'Trigger terpasang.')) muat(true); });
    if ($('#si-cache', el)) $('#si-cache', el).onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('sistem.segarCache', {}); if (hasilToast(r)) { await App.muatBoot(true, true); muat(true); } }, 'Menyegarkan…');
    $('#si-bak', el).onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('sistem.backup', {}); if (hasilToast(r) && r.data && r.data.url) window.open(r.data.url, '_blank', 'noopener'); }, 'Membuat backup…');
    $('#si-reset', el).onclick = async (e) => {
      const btn = e.currentTarget;
      if (!(await konfirmasi('Reset data contoh?', 'Semua data contoh (akun, sekolah, perangkat, observasi, refleksi, tindak lanjut, dokumen contoh) dihapus lalu dibuat ulang ke kondisi awal. <b>Data asli tidak tersentuh.</b>', { ketik: 'RESET', ya: 'Reset Sekarang' }))) return;
      sibuk(btn, async () => { const r = await api('sistem.resetDummy', { konfirmasi: 'RESET' }); if (!hasilToast(r)) return; Store.del(uKey('deList')); await App.muatBoot(true); muat(true); }, 'Mereset…');
    };
    $('#si-hapus', el).onclick = async (e) => {
      const btn = e.currentTarget;
      if (!(await konfirmasi('Hapus semua data contoh?', 'Akun contoh tidak bisa masuk lagi dan data contoh hilang permanen. Lakukan ini sebelum aplikasi dipakai sungguhan.', { ketik: 'HAPUS', ya: 'Hapus Permanen', bahaya: true }))) return;
      sibuk(btn, async () => { const r = await api('sistem.hapusDummy', { konfirmasi: 'HAPUS' }); if (!hasilToast(r)) return; Store.del(uKey('deList')); await App.muatBoot(true); muat(true); }, 'Menghapus…');
    };
  }
}

// ============================================================================ BANTUAN
const PANDUAN = {
  GURU: [['upload', 'Unggah perangkat', 'Menu <b>Perangkat Pembelajaran</b> → tempel tautan folder/berkas Google Drive (bagikan “Siapa saja yang memiliki link”). AI menilai kelengkapan & kualitas, lalu kepala sekolah/pengawas memvalidasi.'],
    ['presentation', 'Observasi kelas', 'Jadwal observasi tampil di <b>Observasi Kelas</b>. Konfirmasi kehadiran; setelah observasi, lihat skor per indikator dan catatan observer.'],
    ['message-circle-question', 'Isi refleksi', 'Di <b>Form Refleksi</b>, jawab pertanyaan reflektif dan nilai diri. Draf tersimpan otomatis di perangkat. Klik <b>Kirim</b> bila selesai.'],
    ['git-fork', 'Jalankan tindak lanjut', 'Rencana tindak lanjut dari reviewer tampil di <b>Tindak Lanjut</b>. Perbarui progres & bukti hingga tuntas sebelum tenggat.']],
  KEPALA: [['users', 'Kelola guru', 'Menu <b>Sekolah & Guru Binaan</b>: tambah/impor guru (CSV/Excel), reset sandi, nonaktifkan akun.'],
    ['badge-check', 'Validasi perangkat', 'Tinjau hasil analisis AI di <b>Perangkat Pembelajaran</b>, setujui atau minta revisi dengan catatan. Bisa validasi kolektif.'],
    ['presentation', 'Observasi', 'Jadwalkan observasi, isi instrumen (skor 0–3 per indikator) langsung dari HP, catatan tersimpan otomatis.'],
    ['file-signature', 'Laporan & tanda tangan', 'Terbitkan laporan guru/sekolah di <b>Laporan & Dokumen</b>. Setujui dokumen yang menunggu tanda tangan dengan PIN Anda.']],
  PENGAWAS: [['school', 'Sekolah binaan', 'Tambah sekolah binaan beserta akun kepala sekolah. Pantau capaian tiap sekolah di Dashboard.'],
    ['presentation', 'Supervisi', 'Observasi, tanggapi refleksi, dan susun tindak lanjut (bisa dibantu draf AI) untuk guru di sekolah binaan.'],
    ['files', 'Laporan agregat', 'Terbitkan laporan agregat kepengawasan dan generate massal laporan guru per sekolah (ZIP).']],
  SUPERADMIN: [['sliders-horizontal', 'Aturan supervisi', '<b>Pengaturan → Umum & Aturan</b>: unggah wajib/opsional, tipe & ukuran berkas, AI otomatis, batas predikat.'],
    ['file-cog', 'Template dokumen', 'Ubah template di Google Docs, lalu klik <b>Pindai Ulang</b> — placeholder <span class="mono">{{...}}</span> terbaca otomatis dan kolom isian/penanda tangan terbentuk.'],
    ['message-circle', 'Notifikasi WA/Email', 'Isi token Fonnte, aktifkan kanal, atur pesan per kejadian, dan kirim blast per batch.'],
    ['database-zap', 'Migrasi & pemeliharaan', 'Impor data spreadsheet lama (pratinjau dulu), backup, pasang trigger, serta reset/hapus data contoh di tab Sistem.']]
};
daftarHalaman('bantuan', {
  judul: 'Panduan',
  render(el) {
    const r = App.role, b = App.batas(), list = PANDUAN[r] || [];
    el.innerHTML = '<div class="ph"><div><div class="eyebrow">Pusat Bantuan / <b>Panduan</b></div><h1>Panduan Penggunaan</h1><p>Alur supervisi akademik terpadu APSIKITA untuk peran <b>' + esc(ROLE_LABEL[r]) + '</b>.</p></div></div>' +
      '<div class="card card-pad mb-16"><div class="sb6 mb-16">' + ic('workflow') + ' Siklus supervisi (4 tahap)</div><div class="cols-4">' +
        [['book-open', '1. Perencanaan', 'Perangkat pembelajaran diunggah, dianalisis AI, divalidasi.'], ['presentation', '2. Observasi', 'Pengamatan kelas dengan instrumen skor 0–3.'], ['message-circle-question', '3. Refleksi', 'Guru merefleksikan pembelajaran; reviewer menanggapi.'], ['git-fork', '4. Tindak Lanjut', 'Rencana perbaikan berbatas waktu hingga tuntas.']]
          .map((x) => '<div class="soft"><div class="row gap-8 sb6">' + ic(x[0]) + x[1] + '</div><div class="small muted mt-8">' + x[2] + '</div></div>').join('') + '</div></div>' +
      '<div class="cols-2">' + list.map((x) => '<div class="card card-pad"><div class="row gap-12 row-top"><span class="ico-box mint">' + ic(x[0]) + '</span><div class="grow"><div class="b">' + esc(x[1]) + '</div><div class="small muted mt-8" style="line-height:1.6">' + x[2] + '</div></div></div></div>').join('') + '</div>' +
      '<div class="sec-h"><div><h2>' + ic('circle-help') + 'Pertanyaan Umum</h2></div></div><div class="stack gap-8">' +
      [['Bagaimana nilai dan predikat dihitung?', 'Nilai akhir = rata-rata tahap yang sudah berjalan (perencanaan = skor AI/validasi, observasi = skor instrumen, refleksi = nilai diri & kelengkapan, tindak lanjut = rata-rata progres). Predikat: <b>Sangat Baik ≥ ' + b.sb + '</b>, <b>Baik ≥ ' + b.b + '</b>, <b>Cukup ≥ ' + b.c + '</b>, di bawahnya <b>Kurang</b>.'],
        ['Saya lupa kata sandi.', 'Klik <b>Lupa password?</b> di halaman masuk untuk menerima kode reset via WhatsApp/Email (bila diaktifkan operator), atau minta kepala sekolah/operator mereset sandi Anda.'],
        ['Apa itu PIN tanda tangan?', 'PIN 6 angka untuk menyetujui dokumen ber-QR secara elektronik. Atur di <a href="#/pengaturan/profil">Profil & Keamanan</a>. Jangan bagikan PIN kepada siapa pun.'],
        ['Bagaimana memeriksa keaslian dokumen?', 'Pindai QR pada dokumen → halaman verifikasi menampilkan status, nomor, penanda tangan, dan pemeriksa sidik jari PDF.'],
        ['Data tidak muncul / terasa lama?', 'APSIKITA menampilkan data tersimpan di perangkat lalu menyegarkan di latar. Gunakan menu profil → <b>Segarkan data</b> untuk memaksa memuat ulang.']]
        .map((x) => '<details class="card card-pad lipat"><summary class="sb6">' + esc(x[0]) + '</summary><div class="small muted mt-12" style="line-height:1.7">' + x[1] + '</div></details>').join('') + '</div>' +
      '<div class="callout mt-24">' + ic('life-buoy') + '<span>Butuh bantuan lain? Hubungi operator ' + esc(App.setting('NAMA_INSTITUSI', 'lembaga')) + '.</span></div>';
  }
});
