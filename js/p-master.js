/**
 * p-master.js — Sekolah & Guru Binaan (pengawas: sekolah; kepala: guru; super admin: keduanya),
 * detail sekolah, detail guru (timeline supervisi), impor guru CSV/Excel.
 */
'use strict';
const JENJANG = ['TK/RA', 'SD', 'MI', 'SMP', 'MTs', 'SMA', 'MA', 'SMK', 'Pesantren', 'Lainnya'];
let _ms = { tab: '', q: '', sek: '', st: 'Aktif' };

daftarHalaman('sekolah', {
  judul: 'Sekolah & Guru Binaan', roles: ['SUPERADMIN', 'PENGAWAS', 'KEPALA'],
  render(el, param) {
    if (param[0]) return detailSekolah(el, param[0]);
    const r = App.role, tab = _ms.tab || (r === 'KEPALA' ? 'guru' : 'sekolah');
    const bisaSekolah = r !== 'KEPALA', bisaGuru = r !== 'PENGAWAS';
    const sid = r === 'KEPALA' ? Object.keys(App.M.sekolah)[0] : '';
    el.innerHTML = '<div class="ph"><div><div class="eyebrow">Master Data / <b>' + (r === 'KEPALA' ? 'Guru Binaan' : 'Sekolah Binaan') + '</b></div><h1>' + (r === 'KEPALA' ? 'Guru Binaan' : 'Sekolah &amp; Guru Binaan') + '</h1>' +
      '<p>' + (r === 'KEPALA' ? 'Kelola daftar guru di <b>' + esc(App.namaSekolah(sid)) + '</b>: tambah, ubah, impor massal, dan reset sandi.' : 'Kelola sekolah binaan beserta kepala sekolahnya. Akun kepala sekolah dibuat otomatis dari email yang Anda isi.') + '</p></div>' +
      '<div class="ph-actions">' + (bisaGuru && tab === 'guru' ? '<button class="btn btn-out" id="ms-impor">' + ic('file-up') + 'Impor CSV/Excel</button><button class="btn btn-pri" id="ms-tambah-g">' + ic('user-plus') + 'Tambah Guru</button>' : '') +
      (bisaSekolah && tab === 'sekolah' ? '<button class="btn btn-pri" id="ms-tambah-s">' + ic('plus') + 'Tambah Sekolah</button>' : '') + '</div></div>' +
      (r !== 'KEPALA' ? '<div class="tabs"><button data-tab="sekolah" class="' + (tab === 'sekolah' ? 'on' : '') + '">' + ic('school') + 'Sekolah (' + App.boot.sekolah.length + ')</button><button data-tab="guru" class="' + (tab === 'guru' ? 'on' : '') + '">' + ic('users') + 'Guru (' + App.guru(null, true).length + ')</button></div>' : '') +
      '<div id="ms-isi"></div>';
    $$('[data-tab]', el).forEach((b) => (b.onclick = () => { _ms.tab = b.dataset.tab; App.segarkanHalaman(); }));
    if ($('#ms-tambah-s')) $('#ms-tambah-s').onclick = () => formSekolah();
    if ($('#ms-tambah-g')) $('#ms-tambah-g').onclick = () => formGuru();
    if ($('#ms-impor')) $('#ms-impor').onclick = () => imporGuru();
    if (tab === 'sekolah') tabelSekolah($('#ms-isi')); else tabelGuru($('#ms-isi'), bisaGuru);
  }
});

function tabelSekolah(box) {
  const rows = App.boot.sekolah.slice().sort((a, b) => a.Nama.localeCompare(b.Nama));
  box.innerHTML = '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sekolah</th><th>Jenjang</th><th>Kepala Sekolah</th>' + (App.role === 'SUPERADMIN' ? '<th>Pengawas</th>' : '') + '<th>Guru</th><th>Predikat</th><th></th></tr></thead><tbody>' +
    (rows.length ? rows.map((s) => { const k = App.M.user[s.KepalaUserID], r = App.rekap.sekolah[s.SekolahID] || {};
      return '<tr class="klik" data-id="' + s.SekolahID + '"><td><div class="nm">' + esc(s.Nama) + (s.Status === 'Nonaktif' ? ' <span class="badge st-mute">Nonaktif</span>' : '') + '</div><div class="sub">NPSN ' + esc(s.NPSN || '-') + ' • ' + esc(s.Alamat || '') + '</div></td><td>' + esc(s.Jenjang || '-') + '</td>' +
        '<td>' + (k ? '<div class="nm">' + esc(k.Nama) + '</div><div class="sub">' + esc(k.Email) + '</div>' : '<span class="muted">Belum ditetapkan</span>') + '</td>' +
        (App.role === 'SUPERADMIN' ? '<td>' + esc(App.nama(s.PengawasUserID)) + '</td>' : '') + '<td>' + (r.jumlahGuru || 0) + '</td><td>' + badgePred(r.predikat) + '</td>' +
        '<td class="right" style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ubah="' + s.SekolahID + '">' + ic('pencil') + '</button><button class="btn btn-ghost btn-sm" data-hapus="' + s.SekolahID + '" title="' + (App.role === 'PENGAWAS' ? 'Lepas dari binaan' : 'Hapus') + '">' + ic('trash-2') + '</button></td></tr>'; }).join('')
      : '<tr><td colspan="7">' + kosong('Belum ada sekolah binaan', 'Tambahkan sekolah pertama beserta email kepala sekolahnya.', '', 'school') + '</td></tr>') + '</tbody></table></div></div>';
  $$('tr[data-id]', box).forEach((tr) => (tr.onclick = (e) => { if (!e.target.closest('button')) go('sekolah/' + tr.dataset.id); }));
  $$('[data-ubah]', box).forEach((b) => (b.onclick = () => formSekolah(App.M.sekolah[b.dataset.ubah])));
  $$('[data-hapus]', box).forEach((b) => (b.onclick = async () => {
    const s = App.M.sekolah[b.dataset.hapus], lepas = App.role === 'PENGAWAS';
    if (!(await konfirmasi(lepas ? 'Lepas sekolah dari binaan?' : 'Hapus sekolah?', lepas ? '<b>' + esc(s.Nama) + '</b> akan dilepas dari daftar binaan Anda. Data sekolah &amp; guru tetap tersimpan.' : 'Sekolah <b>' + esc(s.Nama) + '</b> akan dihapus permanen. Hanya bisa bila tidak ada guru terdaftar.', { bahaya: true, ya: lepas ? 'Lepas' : 'Hapus' }))) return;
    const r = await api('sekolahHapus', { SekolahID: s.SekolahID });
    if (hasilToast(r)) App.buang('sekolah', [s.SekolahID], 'SekolahID');
  }));
}

function tabelGuru(box, bisa) {
  const sekOpts = App.boot.sekolah.map((s) => ({ v: s.SekolahID, t: s.Nama }));
  box.innerHTML = '<div class="card"><div class="card-body" style="padding-bottom:0"><div class="filters"><div class="inp-ic cari grow">' + ic('search') + '<input class="inp" id="mg-q" placeholder="Cari nama, email, NIP, mapel…" value="' + esc(_ms.q) + '"></div>' +
    (App.role !== 'KEPALA' ? '<select class="inp" id="mg-sek">' + opsi(sekOpts, _ms.sek, 'Semua sekolah') + '</select>' : '') + '<select class="inp" id="mg-st">' + opsi(['Aktif', 'Nonaktif'], _ms.st, 'Semua status') + '</select></div></div><div id="mg-tbl" class="mt-16"></div></div>';
  let hal = 1;
  const isi = () => {
    const q = _ms.q.toLowerCase();
    const f = App.guru(null, true).filter((g) => (!q || (g.Nama + ' ' + g.Email + ' ' + g.NIP + ' ' + g.Mapel).toLowerCase().indexOf(q) > -1) && (!_ms.sek || g.SekolahID === _ms.sek) && (!_ms.st || g.Status === _ms.st));
    const per = 25; hal = Math.min(hal, Math.max(1, Math.ceil(f.length / per)));
    $('#mg-tbl').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Guru</th><th>NIP</th><th>Mapel / Kelas</th><th>WhatsApp</th>' + (App.role !== 'KEPALA' ? '<th>Sekolah</th>' : '') + '<th>Status</th><th>Masuk terakhir</th><th></th></tr></thead><tbody>' +
      (f.length ? f.slice((hal - 1) * per, hal * per).map((g) => '<tr><td><div class="row gap-12">' + avatar(g.Nama, 'av-sm') + '<div><a class="nm" href="#/guru/' + g.UserID + '">' + esc(g.Nama) + '</a><div class="sub">' + esc(g.Email) + '</div></div></div></td>' +
        '<td class="mono">' + esc(g.NIP || '-') + '</td><td>' + esc(g.Mapel || '-') + '<div class="sub">' + esc(g.Kelas ? 'Kelas ' + g.Kelas : '') + '</div></td><td class="mono">' + esc(g.NoWA || '-') + (g.StatusWA ? ' <span class="wa-badge ' + (g.StatusWA === 'Terdaftar' ? 'ya' : 'tidak') + '">' + (g.StatusWA === 'Terdaftar' ? '✓ WA' : '✕') + '</span>' : '') + '</td>' +
        (App.role !== 'KEPALA' ? '<td class="small">' + esc(App.namaSekolah(g.SekolahID)) + '</td>' : '') +
        '<td><span class="badge ' + (g.Status === 'Aktif' ? 'st-ok' : 'st-mute') + '">' + g.Status + '</span>' + (g.PunyaSandi === false ? ' <span class="badge st-wait">Tanpa sandi</span>' : '') + '</td><td class="small muted">' + (g.LastLoginAt ? lalu(g.LastLoginAt) : 'Belum pernah') + '</td>' +
        '<td class="right" style="white-space:nowrap">' + (bisa ? '<button class="btn btn-ghost btn-sm" data-ubah="' + g.UserID + '" title="Ubah">' + ic('pencil') + '</button><button class="btn btn-ghost btn-sm" data-reset="' + g.UserID + '" title="Reset sandi">' + ic('key-round') + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-st="' + g.UserID + '" title="' + (g.Status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan') + '">' + ic(g.Status === 'Aktif' ? 'user-x' : 'user-check') + '</button><button class="btn btn-ghost btn-sm" data-hapus="' + g.UserID + '" title="Hapus">' + ic('trash-2') + '</button>' : '<a class="btn btn-ghost btn-sm" href="#/guru/' + g.UserID + '">' + ic('eye') + '</a>') + '</td></tr>').join('')
        : '<tr><td colspan="8">' + kosong('Belum ada guru', 'Tambah guru satu per satu atau impor dari CSV/Excel.', '', 'users') + '</td></tr>') + '</tbody></table></div>' + pager(f.length, hal, per);
    pasangPager($('#mg-tbl'), (h) => { hal = h; isi(); });
    $$('[data-ubah]', box).forEach((b) => (b.onclick = () => formGuru(App.M.user[b.dataset.ubah])));
    $$('[data-reset]', box).forEach((b) => (b.onclick = () => resetSandiUser(App.M.user[b.dataset.reset])));
    $$('[data-st]', box).forEach((b) => (b.onclick = () => ubahStatusUser(App.M.user[b.dataset.st])));
    $$('[data-hapus]', box).forEach((b) => (b.onclick = async () => {
      const g = App.M.user[b.dataset.hapus];
      if (!(await konfirmasi('Hapus guru?', '<b>' + esc(g.Nama) + '</b> akan dihapus. Bila sudah punya riwayat supervisi, akunnya dinonaktifkan agar data tetap utuh.', { bahaya: true, ya: 'Hapus' }))) return;
      const r = await api('guruHapus', { UserID: g.UserID });
      if (!hasilToast(r)) return;
      if (r.data.mode === 'hapus') App.buang('users', [g.UserID], 'UserID'); else App.upsert('users', Object.assign({}, g, { Status: 'Nonaktif' }), 'UserID');
    }));
  };
  $('#mg-q').oninput = debounce((e) => { _ms.q = e.target.value; hal = 1; isi(); }, 220);
  if ($('#mg-sek')) $('#mg-sek').onchange = (e) => { _ms.sek = e.target.value; hal = 1; isi(); };
  $('#mg-st').onchange = (e) => { _ms.st = e.target.value; hal = 1; isi(); };
  isi();
}

function tampilAkunBaru(judul, email, sandi, nama) {
  const teks = 'Akun APSIKITA\nNama: ' + nama + '\nEmail: ' + email + '\nSandi awal: ' + sandi + '\nMasuk: ' + location.origin + location.pathname;
  modal({ judul, ukuran: 'kecil', isi: '<p class="muted">Sampaikan data masuk berikut kepada <b>' + esc(nama) + '</b>. Sandi wajib diganti saat masuk pertama.' + (App.setting('NOTIF_WA_AKTIF') === 'YA' || App.setting('NOTIF_EMAIL_AKTIF') === 'YA' ? ' Pesan juga dikirim otomatis via WA/Email.' : '') + '</p>' +
    '<dl class="dl soft"><dt>Email</dt><dd class="mono">' + esc(email) + '</dd><dt>Sandi awal</dt><dd class="mono b">' + esc(sandi) + '</dd></dl>',
    kaki: '<button class="btn btn-out" id="ak-salin">' + ic('copy') + 'Salin</button><a class="btn btn-out" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(teks) + '">' + ic('message-circle') + 'Kirim WA</a><button class="btn btn-pri" data-tutup>Selesai</button>',
    onBuka: (el) => { el.querySelector('#ak-salin').onclick = () => salin(teks); } });
}

function formSekolah(s) {
  s = s || {};
  const k = App.M.user[s.KepalaUserID] || {}, admin = App.role === 'SUPERADMIN';
  const pengawas = App.boot.users.filter((u) => u.Role === 'PENGAWAS').map((u) => ({ v: u.UserID, t: u.Nama }));
  modal({ judul: s.SekolahID ? 'Ubah Sekolah' : 'Tambah Sekolah Binaan', ukuran: 'lebar',
    isi: '<form id="fs"><div class="grid-2"><div class="field"><label>Nama sekolah <span class="wajib">*</span></label><input class="inp" name="Nama" value="' + esc(s.Nama || '') + '" required></div>' +
      '<div class="field"><label>NPSN</label><input class="inp" name="NPSN" inputmode="numeric" value="' + esc(s.NPSN || '') + '"></div>' +
      '<div class="field"><label>Jenjang</label><select class="inp" name="Jenjang">' + opsi(JENJANG, s.Jenjang, 'Pilih jenjang') + '</select></div><div class="field"><label>Telepon</label><input class="inp" name="Telepon" value="' + esc(s.Telepon || '') + '"></div></div>' +
      '<div class="field"><label>Alamat</label><input class="inp" name="Alamat" value="' + esc(s.Alamat || '') + '"></div>' +
      (admin ? '<div class="grid-2"><div class="field"><label>Pengawas pembina</label><select class="inp" name="PengawasUserID">' + opsi(pengawas, s.PengawasUserID, '— belum ada —') + '</select></div><div class="field"><label>Status</label><select class="inp" name="Status">' + opsi(['Aktif', 'Nonaktif'], s.Status || 'Aktif') + '</select></div></div>' : '') +
      '<div class="soft mt-8"><div class="sb6 mb-16">' + ic('user-round') + ' Kepala Sekolah</div><div class="grid-2"><div class="field"><label>Email kepala sekolah</label><input class="inp" name="KepalaEmail" type="email" value="' + esc(k.Email || '') + '" placeholder="kepala@sekolah.sch.id"><span class="bantu">Akun dibuat otomatis bila belum ada.</span></div>' +
      '<div class="field"><label>Nama kepala sekolah</label><input class="inp" name="KepalaNama" value="' + esc(k.Nama || '') + '"></div><div class="field mb-0"><label>NIP</label><input class="inp" name="KepalaNIP" value="' + esc(k.NIP || '') + '"></div>' +
      '<div class="field mb-0"><label>No. WhatsApp</label><input class="inp" name="KepalaWA" inputmode="tel" value="' + esc(k.NoWA || '') + '" placeholder="0812xxxxxxxx"></div></div></div></form>',
    kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="fs-ok">' + ic('save') + 'Simpan</button>',
    onBuka: (el, tutup) => {
      el.querySelector('#fs-ok').onclick = (e) => sibuk(e.currentTarget, async () => {
        const d = formData(el.querySelector('#fs')); if (!d.Nama) return toast('Nama sekolah wajib diisi.', 'error');
        if (s.SekolahID) d.SekolahID = s.SekolahID;
        const r = await api('sekolahSimpan', d);
        if (!hasilToast(r)) return;
        tutup(); App.upsert('sekolah', r.data.sekolah, 'SekolahID', { render: false });
        if (r.data.kepala) App.upsert('users', r.data.kepala, 'UserID', { render: false });
        App.segarkanHalaman();
        if (r.data.sandiAwal) tampilAkunBaru('Akun Kepala Sekolah Dibuat', r.data.kepala.Email, r.data.sandiAwal, r.data.kepala.Nama);
      });
    } });
}

function formGuru(g) {
  g = g || {};
  const admin = App.role === 'SUPERADMIN';
  modal({ judul: g.UserID ? 'Ubah Data Guru' : 'Tambah Guru', ukuran: 'lebar',
    isi: '<form id="fg"><div class="grid-2"><div class="field"><label>Email <span class="wajib">*</span></label><input class="inp" name="Email" type="email" value="' + esc(g.Email || '') + '" required><span class="bantu">Dipakai untuk masuk; harus unik.</span></div>' +
      '<div class="field"><label>Nama lengkap &amp; gelar <span class="wajib">*</span></label><input class="inp" name="Nama" value="' + esc(g.Nama || '') + '" required></div>' +
      '<div class="field"><label>NIP / NUPTK</label><input class="inp" name="NIP" value="' + esc(g.NIP || '') + '"></div><div class="field"><label>No. WhatsApp</label><input class="inp" name="NoWA" inputmode="tel" value="' + esc(g.NoWA || '') + '" placeholder="0812xxxxxxxx"></div>' +
      '<div class="field"><label>Mata pelajaran</label><input class="inp" name="Mapel" value="' + esc(g.Mapel || '') + '"></div><div class="field"><label>Kelas</label><input class="inp" name="Kelas" value="' + esc(g.Kelas || '') + '" placeholder="mis. VII, VIII"></div>' +
      '<div class="field"><label>Pangkat / Golongan</label><input class="inp" name="Golongan" value="' + esc(g.Golongan || '') + '" placeholder="Guru Madya - Gol. III/c"></div>' +
      (admin ? '<div class="field"><label>Sekolah <span class="wajib">*</span></label><select class="inp" name="SekolahID">' + opsi(App.boot.sekolah.map((s) => ({ v: s.SekolahID, t: s.Nama })), g.SekolahID, 'Pilih sekolah') + '</select></div>' : '') + '</div></form>',
    kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="fg-ok">' + ic('save') + 'Simpan</button>',
    onBuka: (el, tutup) => {
      el.querySelector('#fg-ok').onclick = (e) => sibuk(e.currentTarget, async () => {
        const d = formData(el.querySelector('#fg')); if (g.UserID) d.UserID = g.UserID;
        const r = await api('guruSimpan', d);
        if (!hasilToast(r)) return;
        tutup(); App.upsert('users', r.data.user, 'UserID');
        if (r.data.sandiAwal) tampilAkunBaru('Akun Guru Dibuat', r.data.user.Email, r.data.sandiAwal, r.data.user.Nama);
      });
    } });
}

async function resetSandiUser(u) {
  if (!(await konfirmasi('Reset kata sandi?', 'Sandi <b>' + esc(u.Nama) + '</b> akan diganti sandi sementara dan semua sesinya dikeluarkan.', { ya: 'Reset Sandi' }))) return;
  const r = await api('userResetPassword', { UserID: u.UserID });
  if (!hasilToast(r)) return;
  App.upsert('users', r.data.user, 'UserID');
  tampilAkunBaru('Sandi Sementara', u.Email, r.data.sandiBaru, u.Nama);
}
async function ubahStatusUser(u) {
  const nonaktif = u.Status === 'Aktif';
  if (nonaktif && !(await konfirmasi('Nonaktifkan akun?', '<b>' + esc(u.Nama) + '</b> tidak akan bisa masuk sampai diaktifkan kembali.', { bahaya: true, ya: 'Nonaktifkan' }))) return;
  const r = await api('userStatus', { UserID: u.UserID, Status: nonaktif ? 'Nonaktif' : 'Aktif' });
  if (hasilToast(r)) App.upsert('users', r.data.user, 'UserID');
}

function imporGuru() {
  const ks = App.role === 'KEPALA', kolom = ['email', 'nama', 'nip', 'mapel', 'kelas', 'no_wa'].concat(ks ? [] : ['sekolah']);
  let rows = [];
  modal({ judul: 'Impor Guru dari CSV / Excel', ukuran: 'lebar',
    isi: '<div class="callout blue mb-16">' + ic('info') + '<div>Kolom: <span class="mono">' + kolom.join(', ') + '</span>' + (ks ? '' : ' (sekolah = NPSN atau nama sekolah)') + '. Guru yang emailnya sudah ada akan <b>diperbarui</b>, bukan digandakan. <a href="#" id="im-tpl">Unduh template CSV</a></div></div>' +
      '<label class="drop" id="im-drop">' + ic('file-spreadsheet') + '<div class="sb6 mt-8">Klik atau seret berkas .csv / .xlsx ke sini</div><div class="small" id="im-nama">Belum ada berkas</div><input type="file" id="im-file" accept=".csv,.xlsx,.xls,text/csv" hidden></label>' +
      '<div class="field mt-16"><label>Sandi awal akun baru (opsional)</label><input class="inp" id="im-sandi" placeholder="Kosongkan agar dibuat otomatis"><span class="bantu">Semua akun baru memakai sandi ini dan wajib menggantinya saat masuk.</span></div><div id="im-hasil"></div>',
    kaki: '<button class="btn btn-out" data-tutup>Tutup</button><button class="btn btn-out" id="im-pindai" disabled>' + ic('scan-search') + 'Pratinjau (Dry-run)</button><button class="btn btn-pri" id="im-jalan" disabled>' + ic('upload') + 'Jalankan Impor</button>',
    onBuka: (el) => {
      el.querySelector('#im-tpl').onclick = (e) => { e.preventDefault(); unduhTeks('template_impor_guru.csv', keCsv([{ email: 'guru1@sekolah.sch.id', nama: 'Nama Guru, S.Pd', nip: '198001012005011001', mapel: 'Matematika', kelas: 'VII', no_wa: '081234567890', sekolah: ks ? undefined : 'NPSN atau nama sekolah' }], kolom)); };
      const drop = el.querySelector('#im-drop'), file = el.querySelector('#im-file');
      const muat = async (f) => {
        try { rows = await bacaBerkasTabel(f); } catch (e) { return toast(e.message, 'error'); }
        el.querySelector('#im-nama').textContent = f.name + ' — ' + rows.length + ' baris';
        el.querySelector('#im-pindai').disabled = el.querySelector('#im-jalan').disabled = !rows.length;
        el.querySelector('#im-hasil').innerHTML = rows.length ? '<div class="tbl-wrap mt-16" style="max-height:220px"><table class="tbl compact"><thead><tr>' + kolom.map((k) => '<th>' + k + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(0, 8).map((r) => '<tr>' + kolom.map((k) => '<td>' + esc(r[k] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' + (rows.length > 8 ? '<div class="tiny muted mt-8">…dan ' + (rows.length - 8) + ' baris lainnya</div>' : '') : '';
      };
      file.onchange = () => file.files[0] && muat(file.files[0]);
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) muat(e.dataTransfer.files[0]); };
      const jalan = (dry) => async (e) => sibuk(e.currentTarget, async () => {
        const r = await api('guruImpor', { rows, dryRun: dry, sandiAwal: el.querySelector('#im-sandi').value.trim() });
        if (!r.success) return toast(r.message, 'error');
        const d = r.data;
        el.querySelector('#im-hasil').innerHTML = '<div class="cols-3 mt-16"><div class="soft center"><div class="b" style="font-size:24px;color:var(--brand)">' + d.ditambah + '</div><div class="small muted">' + (dry ? 'akan ditambah' : 'ditambah') + '</div></div><div class="soft center"><div class="b" style="font-size:24px">' + d.diperbarui + '</div><div class="small muted">' + (dry ? 'akan diperbarui' : 'diperbarui') + '</div></div><div class="soft center"><div class="b" style="font-size:24px;color:var(--k)">' + d.dilewati + '</div><div class="small muted">dilewati</div></div></div>' +
          (d.galat.length ? '<div class="callout red mt-16"><div><b>Baris bermasalah:</b><br>' + d.galat.slice(0, 20).map((g) => 'Baris ' + g.baris + ' (' + esc(g.email || '-') + '): ' + esc(g.pesan)).join('<br>') + '</div></div>' : '') +
          (!dry && d.ditambah ? '<div class="callout mt-16">' + ic('key-round') + '<div>Sandi awal akun baru: <b class="mono">' + esc(d.sandiAwal) + '</b> (wajib diganti saat masuk).</div></div>' : '');
        if (!dry) { toast(r.message); App.muatBoot(true); }
      });
      el.querySelector('#im-pindai').onclick = jalan(true);
      el.querySelector('#im-jalan').onclick = jalan(false);
    } });
}

// ============================================================================ DETAIL SEKOLAH
function detailSekolah(el, sid) {
  const s = App.M.sekolah[sid];
  if (!s) { el.innerHTML = kosong('Sekolah tidak ditemukan', 'Mungkin di luar cakupan Anda.', '<a class="btn btn-pri" href="#/sekolah">Kembali</a>', 'school'); return; }
  const r = App.rekap.sekolah[sid], k = App.M.user[s.KepalaUserID], gurus = App.guru(sid);
  el.innerHTML = '<a class="back" href="#/' + (App.role === 'KEPALA' ? 'dashboard' : 'sekolah') + '">' + ic('arrow-left') + 'Kembali</a>' +
    '<div class="ph"><div><div class="eyebrow">Sekolah Binaan / <b>NPSN ' + esc(s.NPSN || '-') + '</b></div><h1>' + esc(s.Nama) + '</h1><p>' + esc(s.Alamat || '') + ' • Kepala Sekolah: <b>' + esc(k ? k.Nama : 'belum ditetapkan') + '</b> • Pengawas: ' + esc(App.nama(s.PengawasUserID)) + '</p></div>' +
    '<div class="ph-actions"><button class="btn btn-out" id="ds-massal">' + ic('files') + 'Laporan Semua Guru</button><button class="btn btn-dark" id="ds-lap">' + ic('download') + 'Unduh Laporan Sekolah</button></div></div>' +
    '<div class="cols-4">' + UI.kpi('Guru Aktif', gurus.length + ' <small>Guru</small>', r.guruDiobservasi + ' sudah diobservasi', 'users') + UI.kpi('Perencanaan', r.perencanaan + '%', badgePred(HITUNG.predikat(r.perencanaan, App.batas())), 'clipboard-check', 'mint') +
    UI.kpi('Observasi', r.observasi + '%', 'Refleksi ' + r.refleksi + '%', 'presentation', 'gold') + UI.kpi('Nilai Sekolah', r.nilai + '%', badgePred(r.predikat) + '<span>TL ' + r.tindakLanjut + '%</span>', 'award', 'gold') + '</div>' +
    '<div class="sec-h"><div><h2>Guru &amp; Progres Kinerja</h2><div class="sub">' + gurus.length + ' guru aktif</div></div>' + (App.isReviewer() ? '<a class="btn btn-pri" href="#/observasi/baru">' + ic('calendar-plus') + 'Jadwalkan Observasi</a>' : '') + '</div>' +
    (gurus.length ? '<div class="cols-3">' + gurus.map(UI.kartuGuru).join('') + '</div>' : '<div class="card">' + kosong('Belum ada guru', 'Kepala sekolah dapat menambah guru dari menu Sekolah & Guru Binaan.', '', 'users') + '</div>');
  $('#ds-lap').onclick = () => Dok.buat('LAP_SEKOLAH', sid);
  $('#ds-massal').onclick = () => Dok.massal(sid);
}

// ============================================================================ DETAIL GURU
daftarHalaman('guru', {
  judul: 'Detail Guru',
  render(el, param) {
    const g = App.M.user[param[0]];
    if (!g || g.Role !== 'GURU') { el.innerHTML = kosong('Guru tidak ditemukan', 'Mungkin di luar cakupan Anda atau berada di periode lain.', '<a class="btn btn-pri" href="#/dashboard">Kembali</a>', 'user-x'); return; }
    if (App.role === 'GURU' && g.UserID !== App.uid) { go('dashboard'); return; }
    if (App.perluDetail(g.UserID)) { el.innerHTML = skeleton(3, 140); App.muatDetail(g.UserID).then((ok) => { if (ok && parseHash().param[0] === g.UserID) App.segarkanHalaman(); }); return; }
    const r = App.rekap.guru[g.UserID], per = App.boot.perangkat.filter((p) => p.GuruUserID === g.UserID), obs = App.boot.observasi.filter((o) => o.GuruUserID === g.UserID);
    el.innerHTML = '<a class="back" href="javascript:history.back()">' + ic('arrow-left') + 'Kembali</a>' +
      '<div class="card card-pad"><div class="row row-wrap gap-20">' + avatar(g.Nama, 'av-xl') + '<div class="grow" style="min-width:240px"><div class="row row-wrap gap-12"><h1 style="font-size:26px;color:var(--brand-900)">' + esc(g.Nama) + '</h1>' + badgePred(r.predikat) + (g.Status !== 'Aktif' ? '<span class="badge st-mute">Nonaktif</span>' : '') + '</div>' +
      '<div class="muted mt-8">NIP. ' + esc(g.NIP || '-') + ' • ' + esc(g.Mapel || '-') + (g.Kelas ? ' • Kelas ' + esc(g.Kelas) : '') + ' • ' + esc(App.namaSekolah(g.SekolahID)) + '</div>' +
      '<div class="row row-wrap gap-8 mt-12">' + (g.NoWA ? '<a class="chip" href="https://wa.me/' + hp08(g.NoWA).replace(/^0/, '62') + '" target="_blank" rel="noopener">' + ic('message-circle') + esc(g.NoWA) + '</a>' : '') + '<span class="chip">' + ic('mail') + esc(g.Email) + '</span></div></div>' +
      '<div class="row row-wrap gap-8">' + (App.isReviewer() ? '<a class="btn btn-pri" href="#/observasi/baru/' + g.UserID + '">' + ic('notebook-pen') + 'Input Observasi</a><a class="btn btn-out" href="#/tindak-lanjut/' + g.UserID + '">' + ic('git-fork') + 'Tindak Lanjut</a>' : '') +
      '<button class="btn btn-dark" id="dg-lap">' + ic('download') + 'Laporan Guru</button></div></div>' +
      '<div class="cols-4 mt-24">' + [['Perencanaan', r.perencanaan, ''], ['Observasi', r.observasi, ''], ['Refleksi', r.refleksi, ''], ['Tindak Lanjut', r.tindakLanjut, 'gold']].map((x) => '<div class="soft"><div class="row row-between small"><span>' + x[0] + '</span><b>' + x[1] + '%</b></div><div class="mt-8">' + bar(x[1], x[2]) + '</div></div>').join('') + '</div></div>' +
      '<div class="split mt-24"><div class="card"><div class="card-head"><div><h3>Timeline Supervisi</h3><div class="sub">' + esc(App.periode().Nama || '') + ' • ' + r.tahapSelesai + ' dari 4 tahapan selesai</div></div></div><div class="card-body">' + UI.timeline(g) + '</div></div>' +
      '<div class="stack gap-20"><div class="card"><div class="card-head"><h3>Perangkat Pembelajaran</h3><span class="chip">' + per.length + '</span></div><div class="card-body">' +
      (per.length ? per.map((p) => '<a class="row gap-12" style="padding:10px 0;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none" href="#/perangkat?id=' + p.PerangkatID + '">' + ic('folder') + '<div class="grow" style="min-width:0"><div class="sb6 trunc">' + esc(p.Judul) + '</div><div class="tiny muted">' + fTgl(p.TanggalUpload) + ' • ' + (p.StatusAnalisis === 'Selesai' ? p.SkorAI + '% ' + esc(p.Kualitas) : esc(p.StatusAnalisis)) + '</div></div>' + badgeStatusPerangkat(p) + '</a>').join('') : '<div class="muted small">Belum ada unggahan.</div>') + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Riwayat Observasi</h3><span class="chip">' + obs.length + '</span></div><div class="card-body">' +
      (obs.length ? obs.sort((a, b) => b.Tanggal.localeCompare(a.Tanggal)).map((o) => '<a class="row gap-12" style="padding:10px 0;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none" href="#/observasi' + (o.Status === 'Selesai' ? '?id=' + o.ObservasiID : '/isi/' + o.ObservasiID) + '">' + ic('presentation') + '<div class="grow"><div class="sb6">' + fTglPanjang(o.Tanggal) + '</div><div class="tiny muted">' + esc(App.nama(o.ObserverUserID)) + (o.Topik ? ' • ' + esc(o.Topik) : '') + '</div></div>' + (o.Status === 'Selesai' ? '<b>' + o.NilaiTotal + '%</b>' : '<span class="badge st-wait">' + esc(o.Status) + '</span>') + '</a>').join('') : '<div class="muted small">Belum ada observasi.</div>') + '</div></div></div></div>';
    UI.pasangKonfirmasi(el);
    $('#dg-lap').onclick = () => Dok.buat('LAP_GURU', g.UserID);
  }
});
