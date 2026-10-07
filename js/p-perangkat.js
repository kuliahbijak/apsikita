/**
 * p-perangkat.js — Perangkat Pembelajaran:
 *  • Guru: kirim tautan folder Google Drive → analisis AI → riwayat & hasil.
 *  • Kepala/Pengawas/Admin: Review & Validasi (tabel + panel verifikasi), validasi kolektif.
 */
'use strict';
const RE_DRIVE = /drive\.google\.com\/(drive\/(u\/\d+\/)?folders\/|file\/d\/|open\?id=)[A-Za-z0-9_-]{15,}|docs\.google\.com\/(document|spreadsheets|presentation)\/d\/[A-Za-z0-9_-]{15,}/;
function badgeStatusPerangkat(p) {
  const m = { Approved: ['st-ok', 'Disetujui'], Rejected: ['st-bad', 'Perlu Revisi'], Pending: ['st-wait', 'Menunggu Review'] }[p.StatusApproval] || ['st-mute', p.StatusApproval];
  return '<span class="badge ' + m[0] + '">' + m[1] + '</span>';
}
function selAnalisis(p) {
  if (p.StatusAnalisis === 'Selesai') return '<div class="skorbar">' + bar(p.SkorAI, p.Kualitas === 'Kurang' ? 'red' : (p.Kualitas === 'Cukup' ? 'gold' : '')) + '<b' + (p.Kualitas === 'Kurang' ? ' style="color:var(--k)"' : '') + '>' + p.SkorAI + '%</b></div>';
  if (p.StatusAnalisis === 'Gagal') return '<span class="badge st-bad">' + ic('circle-x') + 'Gagal</span>';
  if (p.StatusAnalisis === 'Manual') return '<span class="badge st-mute">Belum dianalisis</span>';
  return '<span class="badge st-wait"><span class="spin" style="width:11px;height:11px;border-width:2px"></span>' + (p.StatusAnalisis === 'Diproses' ? 'Dianalisis AI…' : 'Antre analisis') + '</span>';
}
let _pr = { q: '', guru: '', st: '', sel: '', hal: 1 }, _poll = { t: null, jeda: 15000 };

daftarHalaman('perangkat', {
  judul: 'Perangkat Pembelajaran',
  render(el, param, q) {
    if (q.get('id')) _pr.sel = q.get('id');
    if (App.role === 'GURU') perangkatGuru(el, q.get('id')); else perangkatReview(el);
    mulaiPoll();
  }
});

function mulaiPoll() {
  clearTimeout(_poll.t);
  const tunggu = App.boot.perangkat.filter((p) => p.StatusAnalisis === 'Menunggu' || p.StatusAnalisis === 'Diproses').map((p) => p.PerangkatID);
  if (!tunggu.length) { _poll.jeda = 15000; return; }
  _poll.t = setTimeout(async () => {
    if (parseHash().nama !== 'perangkat' || document.visibilityState !== 'visible') { _poll.jeda = 15000; return mulaiPoll(); }
    const r = await api('perangkatStatus', { ids: tunggu });
    if (r.success) {
      const berubah = r.data.perangkat.filter((p) => { const l = App.M.perangkat[p.PerangkatID]; return l && l.StatusAnalisis !== p.StatusAnalisis; });
      if (berubah.length) { App.upsert('perangkat', r.data.perangkat, 'PerangkatID'); berubah.filter((p) => p.StatusAnalisis === 'Selesai').forEach((p) => toast('Analisis "' + p.Judul + '" selesai: ' + p.SkorAI + '% (' + p.Kualitas + ').')); _poll.jeda = 15000; }
      else _poll.jeda = Math.min(60000, _poll.jeda * 2);
    }
    mulaiPoll();
  }, _poll.jeda);
}

// ============================================================================ GURU
function perangkatGuru(el, bukaId) {
  const per = App.periode(), aktif = App.diPeriodeAktif(), wajib = App.setting('UPLOAD_PERANGKAT', 'WAJIB') === 'WAJIB';
  const milik = App.boot.perangkat.filter((p) => p.GuruUserID === App.uid).sort((a, b) => b.TanggalUpload.localeCompare(a.TanggalUpload));
  const revisi = milik.filter((p) => p.StatusApproval === 'Rejected');
  const analis = milik.filter((p) => p.StatusAnalisis === 'Selesai'), rata = analis.length ? Math.round(analis.reduce((t, p) => t + p.SkorAI, 0) / analis.length) : 0;
  const lewat = per.BatasUnggah && isoHari() > per.BatasUnggah.slice(0, 10);
  el.innerHTML = '<a class="back" href="#/dashboard">' + ic('arrow-left') + 'Kembali ke Dashboard</a>' +
    '<div class="ph"><div><h1>Upload Perangkat Pembelajaran</h1><p>Kirimkan tautan folder Google Drive yang memuat RPP/Modul Ajar, Silabus, dan Asesmen untuk dianalisis oleh AI.</p></div>' +
    (per.BatasUnggah ? '<span class="chip ' + (lewat ? '' : 'chip-out') + '" style="height:40px;padding:0 14px;' + (lewat ? 'background:var(--k-bg);color:var(--k)' : '') + '">' + ic('info') + 'Batas Unggah: ' + fTglPanjang(per.BatasUnggah).replace(/^\w+, /, '') + '</span>' : '') + '</div>' +
    '<div class="split-l"><div class="stack gap-20"><div class="card"><div class="card-head" style="background:var(--surface-2);border-radius:16px 16px 0 0;padding-bottom:16px"><h3 class="row gap-8">' + ic('cloud-upload') + 'Formulir Kirim Tautan</h3><span class="chip chip-mint">' + esc(per.Nama || '') + '</span></div><div class="card-body">' +
    (!aktif ? '<div class="callout gold mb-16">' + ic('archive') + '<span>Anda sedang melihat periode arsip. Unggahan baru hanya untuk periode aktif.</span></div>' : '') +
    (lewat ? '<div class="callout red mb-16">' + ic('calendar-x') + '<span>Batas unggah periode ini sudah lewat. Hubungi kepala sekolah bila perlu perpanjangan.</span></div>' : '') +
    '<form id="fp"><div class="field"><label>Link Folder Google Drive <span class="chip chip-sm ' + (wajib ? 'chip-mint' : '') + '">' + (wajib ? 'Wajib' : 'Opsional') + '</span></label>' +
    '<div class="inp-ic">' + ic('folder-symlink') + '<input class="inp inp-soft" name="folderUrl" id="fp-url" placeholder="https://drive.google.com/drive/folders/..." autocomplete="off"></div>' +
    '<div class="row row-top gap-8 small muted mt-8">' + ic('lock') + '<span>Pastikan akses folder telah diatur ke <b style="color:var(--ink)">"Siapa saja yang memiliki link (Anyone with the link)"</b> dengan peran Pengamat (Viewer).</span></div><div id="fp-cek" class="small mt-8"></div></div>' +
    (revisi.length ? '<div class="field"><label>Kirim sebagai</label><select class="inp" name="perangkatId">' + opsi(revisi.map((p) => ({ v: p.PerangkatID, t: 'Revisi: ' + p.Judul })), revisi[0].PerangkatID, 'Perangkat baru') + '</select><span class="bantu">Perangkat yang diminta revisi bisa diganti tautannya di sini.</span></div>' : '') +
    '<details class="mb-16"><summary class="small sb6" style="cursor:pointer;color:var(--brand)">Detail tambahan (opsional)</summary><div class="grid-2 mt-12"><div class="field"><label>Judul</label><input class="inp" name="judul" placeholder="Otomatis dari nama folder"></div><div class="field"><label>Keterangan</label><input class="inp" name="keterangan" placeholder="' + esc((App.me.Mapel || '') + (App.me.Kelas ? ' • Kelas ' + App.me.Kelas : '')) + '"></div></div></details>' +
    '<div class="callout mb-16" style="border-left-width:5px">' + ic('shield-check') + '<div><b style="color:var(--ink)">Catatan Operator Madrasah</b><br>Setiap dokumen yang dimasukkan harus memiliki metadata identitas lengkap (Nama Guru, NIP/NUPTK, Kelas, dan Capaian Pembelajaran) sebelum dikirim untuk proses validasi otomatis.</div></div>' +
    '<button class="btn btn-dark btn-lg btn-block" id="fp-kirim"' + (!aktif || lewat ? ' disabled' : '') + '>' + ic('bot') + 'Submit untuk Analisis AI</button></form></div></div>' +
    '<div class="card"><div class="card-head"><div class="row gap-12"><span class="av av-sq">' + ic('list-checks') + '</span><div><h3 style="font-size:20px">Panduan Format Berkas</h3><div class="sub">Pastikan kelengkapan instrumen supervisi kurikulum</div></div></div></div><div class="card-body">' +
    [['Struktur Lengkap RPP/Modul Ajar', 'Memuat Identitas, Profil Pelajar Rahmatan lil Alamin, Tujuan, Kegiatan Berdiferensiasi, dan Penilaian.'], ['Format Dokumen Didukung', 'Google Docs, PDF, atau DOCX (' + esc(App.setting('TIPE_FILE', 'PDF,DOCX,GDOC')) + ', maks ' + esc(App.setting('MAKS_UKURAN_MB', '10')) + ' MB/berkas) agar teks dapat dibaca otomatis.'],
      ['Lampiran Rubrik Penilaian Lengkap', 'Disertai lembar asesmen diagnostik, formatif, dan sumatif beserta kunci jawaban atau kriteria skor.']].map((x) => '<div class="checkrow"><span class="ok-ic">' + ic('check') + '</span><div><div class="sb6">' + x[0] + '</div><div class="small muted">' + x[1] + '</div></div></div>').join('') +
    '<div class="row row-between small mt-16"><span class="muted">Butuh bantuan pengaturan sharing?</span><a href="https://support.google.com/drive/answer/2494822?hl=id" target="_blank" rel="noopener" class="sb6">Buka Tutorial ' + ic('external-link') + '</a></div></div></div></div>' +
    '<div class="card"><div class="card-head"><div><h3 style="font-size:22px">Riwayat Upload Perangkat</h3><div class="sub">Hasil audit kelengkapan berkas berbasis kecerdasan buatan.</div></div><div class="row gap-8"><span class="chip">Total: ' + milik.length + ' Dokumen</span><button class="btn btn-out btn-icon btn-sm" id="fp-segar" title="Segarkan">' + ic('refresh-cw') + '</button></div></div>' +
    '<div class="card-body"><div class="tbl-wrap" style="border-radius:12px;border:1px solid var(--line)"><table class="tbl"><thead><tr><th>Nama Berkas/Folder</th><th>Tanggal Upload</th><th>Analisis AI</th><th>Kualitas</th><th>Status</th></tr></thead><tbody>' +
    (milik.length ? milik.map((p) => '<tr class="klik" data-id="' + p.PerangkatID + '"><td><div class="row gap-12">' + ic('folder', '') + '<div><div class="nm">' + esc(p.Judul) + '</div><div class="sub">' + esc(p.Keterangan || '') + ' • ' + p.JumlahFile + ' berkas</div></div></div></td><td>' + fTgl(p.TanggalUpload) + '</td><td>' + selAnalisis(p) + '</td><td>' + (p.Kualitas ? badgePred(p.Kualitas) : '-') + '</td><td>' + badgeStatusPerangkat(p) + '</td></tr>').join('')
      : '<tr><td colspan="5">' + kosong('Belum ada unggahan', 'Tempel tautan folder Google Drive di formulir untuk memulai analisis.', '', 'folder-up') + '</td></tr>') + '</tbody></table></div>' +
    '<div class="soft mt-16 row row-wrap gap-16"><span class="av" style="background:var(--mint-2);color:var(--brand)">' + ic('sparkles') + '</span><div class="grow"><div class="b">Skor Kelayakan Rata-Rata Modul: ' + rata + '%</div><div class="small muted">' + analis.filter((p) => p.SkorAI >= App.batas().b).length + ' dari ' + milik.length + ' berkas telah memenuhi standar supervisi akademik wilayah binaan.</div></div>' +
    '<button class="btn btn-out" id="fp-rekap" style="background:#fff">' + ic('file-down') + 'Unduh Rekap Analisis</button></div></div></div></div>';
  const url = $('#fp-url'), cek = $('#fp-cek');
  url.oninput = () => { const v = url.value.trim(); cek.innerHTML = !v ? '' : RE_DRIVE.test(v) ? '<span style="color:var(--sb)">' + ic('circle-check') + ' Format tautan valid</span>' : '<span style="color:var(--k)">' + ic('circle-alert') + ' Bukan tautan folder/berkas Google Drive</span>'; url.classList.toggle('salah', !!v && !RE_DRIVE.test(v)); };
  $('#fp').onsubmit = (e) => {
    e.preventDefault();
    const d = formData($('#fp'));
    if (!RE_DRIVE.test(d.folderUrl)) { url.classList.add('salah'); return toast('Tempel tautan folder Google Drive yang valid.', 'error'); }
    sibuk($('#fp-kirim'), async () => {
      const r = await api('perangkatKirim', d);
      if (!hasilToast(r)) return;
      App.upsert('perangkat', r.data.perangkat, 'PerangkatID');
      mulaiPoll();
    }, 'Membaca folder…');
  };
  $('#fp-segar').onclick = (e) => sibuk(e.currentTarget, () => App.muatBoot(true));
  $('#fp-rekap').onclick = () => Dok.buat('REKAP_PERANGKAT', 'SEMUA');
  $$('tr[data-id]', el).forEach((tr) => (tr.onclick = () => detailPerangkat(tr.dataset.id)));
  if (bukaId && App.M.perangkat[bukaId]) { setTimeout(() => detailPerangkat(bukaId), 50); history.replaceState(null, '', '#/perangkat'); }
}

function blokHasilAI(p) {
  const h = pj(p.HasilAnalisis, {});
  if (p.StatusAnalisis !== 'Selesai') return '<div class="callout gold">' + ic('hourglass') + '<span>' + (p.StatusAnalisis === 'Gagal' ? 'Analisis gagal: ' + esc(h.galat || 'tidak diketahui') : p.StatusAnalisis === 'Manual' ? 'Belum dianalisis. Tekan "Analisis Sekarang".' : 'Analisis AI sedang berjalan (±1 menit). Halaman ini diperbarui otomatis.') + '</span></div>';
  return '<div class="rub" style="background:var(--surface-2);border-radius:12px;padding:16px"><div class="row row-between"><span class="row gap-8 sb6">' + ic('scan-search') + 'Skor Rubrik Otomatis APSIKITA</span><b style="font-size:24px;color:var(--brand-900)">' + p.SkorAI + '%</b></div><div class="tiny muted mb-16">' + esc(h.metode || '') + (h.berkasDibaca ? ' • isi terbaca ' + esc(h.berkasDibaca) + ' berkas' : '') + '</div>' +
    (h.kriteria || []).map((k, i) => '<div style="margin-bottom:10px"><div class="row row-between small"><span>' + (i + 1) + '. ' + esc(k.nama) + '</span><b style="color:' + (k.skor >= App.batas().b ? 'var(--mint-ink)' : k.skor >= App.batas().c ? 'var(--gold-ink)' : 'var(--k)') + '">' + k.skor + '% (' + HITUNG.predikat(k.skor, App.batas()) + ')</b></div>' + bar(k.skor, k.skor >= App.batas().b ? '' : k.skor >= App.batas().c ? 'gold' : 'red') + (k.catatan ? '<div class="tiny muted mt-8">' + esc(k.catatan) + '</div>' : '') + '</div>').join('') +
    (h.ringkasan ? '<div class="note mt-12">' + ic('lightbulb') + '<div>' + esc(h.ringkasan) + (h.saran && h.saran.length ? '<ul style="margin:8px 0 0;padding-left:18px">' + h.saran.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul>' : '') + '</div></div>' : '') +
    (h.dokumen && h.dokumen.length ? '<div class="row row-wrap gap-8 mt-12">' + h.dokumen.map((d) => '<span class="chip chip-sm ' + (d.ada ? 'chip-mint' : '') + '">' + ic(d.ada ? 'check' : 'x') + esc(d.nama) + '</span>').join('') + '</div>' : '') + '</div>';
}
function daftarBerkas(p) {
  const f = pj(p.DaftarFile, []);
  return f.length ? '<div class="stack gap-4 mt-12">' + f.map((x) => '<a class="row gap-8 small" href="' + esc(x.url) + '" target="_blank" rel="noopener" style="' + (x.layak ? '' : 'opacity:.55') + '">' + ic(x.jenis === 'PDF' ? 'file-text' : /SHEET|XLS/.test(x.jenis) ? 'file-spreadsheet' : /PNG|JPG/.test(x.jenis) ? 'image' : 'file') + '<span class="trunc grow">' + esc(x.nama) + '</span><span class="tiny muted">' + esc(x.jenis) + (x.layak ? '' : ' • ' + esc(x.alasan)) + '</span></a>').join('') + '</div>' : '';
}

function detailPerangkat(id) {
  const p = App.M.perangkat[id]; if (!p) return;
  if (App.perluDetail(p.GuruUserID)) return denganDetail(p.GuruUserID, () => detailPerangkat(id));   // mode ringkas
  const milik = p.GuruUserID === App.uid;
  modal({ judul: p.Judul, ukuran: 'lebar', atas: '<div class="eyebrow">Perangkat Pembelajaran • ' + esc(App.nama(p.GuruUserID)) + '</div>', sub: fWaktu(p.TanggalUpload) + ' • ' + p.JumlahFile + ' berkas • ' + badgeStatusPerangkat(p),
    isi: (p.StatusApproval !== 'Pending' && p.CatatanReviewer ? '<div class="callout ' + (p.StatusApproval === 'Rejected' ? 'red' : '') + ' mb-16">' + ic('message-square-text') + '<div><b>Catatan ' + esc(App.nama(p.ReviewerUserID)) + '</b> (' + fTgl(p.ReviewedAt) + ')<br>' + esc(p.CatatanReviewer) + '</div></div>' : '') +
      blokHasilAI(p) + '<div class="sb6 mt-16">Berkas di folder</div>' + daftarBerkas(p) + '<div class="mt-12"><a class="small" href="' + esc(p.FolderURL) + '" target="_blank" rel="noopener">' + ic('external-link') + ' Buka folder di Google Drive</a></div>',
    kaki: (milik && p.StatusApproval !== 'Approved' ? '<button class="btn btn-danger" id="dp-hapus">' + ic('trash-2') + 'Hapus</button>' : '') + '<span class="grow"></span>' +
      (p.StatusAnalisis !== 'Selesai' || milik ? '<button class="btn btn-out" id="dp-analisis">' + ic('scan-search') + (p.StatusAnalisis === 'Selesai' ? 'Analisis Ulang' : 'Analisis Sekarang') + '</button>' : '') +
      (p.StatusApproval === 'Approved' ? '<button class="btn btn-out" id="dp-lembar">' + ic('file-badge') + 'Lembar Verifikasi</button>' : '') + '<button class="btn btn-pri" data-tutup>Tutup</button>',
    onBuka: (el, tutup) => {
      const h = el.querySelector('#dp-hapus'), a = el.querySelector('#dp-analisis'), lb = el.querySelector('#dp-lembar');
      if (h) h.onclick = async () => { if (!(await konfirmasi('Hapus perangkat?', 'Data unggahan "' + esc(p.Judul) + '" akan dihapus dari APSIKITA (berkas di Drive Anda tetap aman).', { bahaya: true, ya: 'Hapus' }))) return; const r = await api('perangkatHapus', { id: p.PerangkatID }); if (hasilToast(r)) { tutup(); App.buang('perangkat', [p.PerangkatID], 'PerangkatID'); } };
      if (a) a.onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('perangkatAnalisis', { id: p.PerangkatID }); if (hasilToast(r)) { tutup(); App.upsert('perangkat', r.data.perangkat, 'PerangkatID'); detailPerangkat(p.PerangkatID); } }, 'Menganalisis…');
      if (lb) lb.onclick = () => { tutup(); Dok.buat('LEMBAR_VERIFIKASI', p.PerangkatID); };
    } });
}

// ============================================================================ REVIEWER
function perangkatReview(el) {
  const semua = App.boot.perangkat, b = App.batas(), per = App.periode();
  const gurus = App.guru(), pending = semua.filter((p) => p.StatusApproval === 'Pending'), analis = semua.filter((p) => p.StatusAnalisis === 'Selesai');
  const rata = analis.length ? analis.reduce((t, p) => t + p.SkorAI, 0) / analis.length : 0;
  const tepat = per.BatasUnggah ? semua.filter((p) => p.TanggalUpload.slice(0, 10) <= per.BatasUnggah.slice(0, 10)).length : semua.length;
  const patuh = semua.length ? Math.round(tepat / semua.length * 100) : 0;
  const kolektif = pending.filter((p) => p.StatusAnalisis === 'Selesai' && p.SkorAI >= b.b);
  const sekOpts = App.role === 'KEPALA' ? [] : App.boot.sekolah.map((s) => ({ v: 'S:' + s.SekolahID, t: '🏫 ' + s.Nama }));
  el.innerHTML = '<div class="ph"><div><div class="eyebrow"><span class="dot-gold"></span><b>Modul Pengawas &amp; Kepala Sekolah</b></div><h1>Review &amp; Validasi Perangkat Pembelajaran</h1><p>Triage otomatis dan verifikasi berkas kurikulum mandiri terpadu. Pantau kualitas rancangan ajar berbasis indikator standar kepengawasan.</p></div>' +
    '<div class="ph-actions" style="flex-direction:column;align-items:stretch"><button class="btn btn-out" id="rv-rekap">' + ic('download') + 'Unduh Rekapitulasi</button><button class="btn btn-dark" id="rv-kolektif"' + (kolektif.length ? '' : ' disabled') + '>' + ic('shield-check') + 'Validasi Kolektif (' + kolektif.length + ')</button></div></div>' +
    '<div class="card card-pad" style="padding:14px"><div class="filters"><div class="inp-ic cari grow">' + ic('search') + '<input class="inp inp-soft" id="rv-q" placeholder="Cari guru, NIP, mapel, atau dokumen…" value="' + esc(_pr.q) + '"></div>' +
    '<select class="inp" id="rv-guru">' + opsi(sekOpts.concat(gurus.map((g) => ({ v: 'G:' + g.UserID, t: g.Nama }))), _pr.guru, 'Semua Guru / Satuan') + '</select>' +
    '<select class="inp" id="rv-st">' + opsi([{ v: 'Pending', t: 'Menunggu review' }, { v: 'Approved', t: 'Disetujui' }, { v: 'Rejected', t: 'Perlu revisi' }, { v: 'ANALISIS', t: 'Sedang dianalisis' }], _pr.st, 'Semua Status (Menunggu, dsb)') + '</select>' +
    '<button class="btn btn-out btn-icon" id="rv-segar" style="height:44px;width:44px" title="Segarkan">' + ic('refresh-cw') + '</button></div></div>' +
    '<div class="cols-4 mt-16">' + UI.kpi('Total Terkumpul', semua.length + ' <small>Berkas</small>', '<span class="row gap-8">' + ic('circle-check') + 'Target ' + gurus.length + ' guru (' + esc(per.Semester || per.Nama || '') + ')</span>', 'files') +
    '<div class="card kpi"><div class="t"><span>Menunggu Review</span><span class="ico gold">' + ic('hourglass') + '</span></div><div class="v gold">' + pending.length + ' <small style="color:var(--gold)">Berkas</small></div><div class="s"><span class="chip chip-gold chip-sm"><span class="dot"></span>Perlu Tindakan Cepat</span><span>' + pending.filter((p) => p.StatusAnalisis !== 'Selesai').length + ' masih dianalisis</span></div></div>' +
    UI.kpi('Rata-rata Skor AI', rata.toFixed(1).replace('.', ',') + '%', '<span>Standar: ' + b.b + '%</span><span style="color:var(--mint-ink)" class="b">' + analis.length + ' dianalisis</span>', 'sparkles', 'mint', '<div class="mt-12">' + bar(rata, 'bar-lg') + '</div>') +
    UI.kpi('Tingkat Kepatuhan', patuh + '%', badgePred(HITUNG.predikat(patuh, b)) + '<span>' + tepat + ' dari ' + semua.length + ' tepat waktu</span>', 'calendar-check') + '</div>' +
    '<div class="split mt-24"><div class="card" style="overflow:hidden"><div class="card-head" style="padding-bottom:16px"><div class="row gap-12"><h3 style="font-size:19px">Daftar Dokumen Masuk</h3><span class="chip chip-sm" id="rv-jml"></span></div><span class="small muted row gap-8">' + ic('arrow-down-wide-narrow') + 'Urutkan: Dokumen Terbaru</span></div><div id="rv-tbl"></div></div>' +
    '<div class="card card-pad vpanel" id="rv-panel"></div></div>';
  const isi = () => {
    const q = _pr.q.toLowerCase();
    const f = semua.filter((p) => {
      const g = App.M.user[p.GuruUserID] || {};
      if (q && (g.Nama + ' ' + g.NIP + ' ' + g.Mapel + ' ' + p.Judul + ' ' + p.Keterangan).toLowerCase().indexOf(q) < 0) return false;
      if (_pr.guru) { const [t, v] = _pr.guru.split(':'); if (t === 'G' && p.GuruUserID !== v) return false; if (t === 'S' && p.SekolahID !== v) return false; }
      if (_pr.st === 'ANALISIS') return p.StatusAnalisis !== 'Selesai';
      return !_pr.st || p.StatusApproval === _pr.st;
    }).sort((a, b2) => b2.TanggalUpload.localeCompare(a.TanggalUpload));
    const per2 = 8, hal = Math.min(_pr.hal, Math.max(1, Math.ceil(f.length / per2)));
    $('#rv-jml').textContent = 'Menampilkan ' + Math.min(per2, f.length) + ' dari ' + f.length + ' dokumen';
    $('#rv-tbl').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Guru Pengampu</th><th>Nama Dokumen</th><th>Tanggal</th><th>Skor AI</th><th>Kualitas</th></tr></thead><tbody>' +
      (f.length ? f.slice((hal - 1) * per2, hal * per2).map((p) => { const g = App.M.user[p.GuruUserID] || {};
        return '<tr class="klik ' + (p.PerangkatID === _pr.sel ? 'pilih' : '') + '" data-id="' + p.PerangkatID + '"><td><div class="row gap-12">' + avatar(g.Nama, 'av-sm ' + (p.StatusApproval === 'Rejected' ? 'av-red' : '')) + '<div><div class="nm">' + esc(g.Nama) + '</div><div class="sub">NIP ' + esc(g.NIP || '-') + '</div></div></div></td>' +
          '<td><div class="nm" style="font-weight:500">' + esc(p.Judul) + '</div><div class="sub">' + esc(p.Keterangan || '') + '</div><div class="mt-8">' + badgeStatusPerangkat(p) + '</div></td><td style="white-space:nowrap">' + fTgl(p.TanggalUpload) + '</td><td>' + selAnalisis(p) + '</td><td>' + (p.Kualitas ? badgePred(p.Kualitas) : '-') + '</td></tr>'; }).join('')
        : '<tr><td colspan="5">' + kosong('Tidak ada dokumen', 'Belum ada perangkat yang cocok dengan filter.', '', 'inbox') + '</td></tr>') + '</tbody></table></div>' + pager(f.length, hal, per2);
    pasangPager($('#rv-tbl'), (h) => { _pr.hal = h; isi(); });
    $$('#rv-tbl tr[data-id]').forEach((tr) => (tr.onclick = () => { _pr.sel = tr.dataset.id; $$('#rv-tbl tr').forEach((x) => x.classList.toggle('pilih', x === tr)); panelVerifikasi(); if (window.innerWidth < 1280) $('#rv-panel').scrollIntoView({ behavior: 'smooth' }); }));
    if (!_pr.sel && f[0]) { _pr.sel = (f.find((p) => p.StatusApproval === 'Pending' && p.StatusAnalisis === 'Selesai') || f[0]).PerangkatID; const tr = $('#rv-tbl tr[data-id="' + _pr.sel + '"]'); if (tr) tr.classList.add('pilih'); }
    panelVerifikasi();
  };
  $('#rv-q').oninput = debounce((e) => { _pr.q = e.target.value; _pr.hal = 1; isi(); }, 220);
  $('#rv-guru').onchange = (e) => { _pr.guru = e.target.value; _pr.hal = 1; isi(); };
  $('#rv-st').onchange = (e) => { _pr.st = e.target.value; _pr.hal = 1; isi(); };
  $('#rv-segar').onclick = (e) => sibuk(e.currentTarget, () => App.muatBoot(true));
  $('#rv-rekap').onclick = () => Dok.buat('REKAP_PERANGKAT', App.role === 'KEPALA' ? Object.keys(App.M.sekolah)[0] : 'SEMUA');
  $('#rv-kolektif').onclick = async () => {
    if (!(await konfirmasi('Validasi kolektif', 'Setujui <b>' + kolektif.length + ' berkas</b> berstatus menunggu dengan skor AI ≥ ' + b.b + '%:<br><span class="small">' + kolektif.slice(0, 10).map((p) => '• ' + esc(p.Judul) + ' — ' + esc(App.nama(p.GuruUserID)) + ' (' + p.SkorAI + '%)').join('<br>') + (kolektif.length > 10 ? '<br>…' : '') + '</span>', { ya: 'Setujui Semua' }))) return;
    const r = await api('perangkatReview', { ids: kolektif.map((p) => p.PerangkatID), keputusan: 'Approved', catatan: 'Divalidasi kolektif: memenuhi standar skor AI.' });
    if (hasilToast(r)) App.upsert('perangkat', r.data.perangkat, 'PerangkatID');
  };
  isi();
}

function panelVerifikasi() {
  const box = $('#rv-panel'); if (!box) return;
  const p = App.M.perangkat[_pr.sel];
  if (!p) { box.innerHTML = kosong('Pilih dokumen', 'Klik salah satu dokumen untuk membuka lembar panel verifikasi.', '', 'mouse-pointer-click'); return; }
  if (App.perluDetail(p.GuruUserID)) { box.innerHTML = skeleton(2, 120); App.muatDetail(p.GuruUserID).then((ok) => { if (ok && _pr.sel === p.PerangkatID && box.isConnected) panelVerifikasi(); }); return; }
  const g = App.M.user[p.GuruUserID] || {}, cek = pj(p.Checklist, []);
  const KONF = ['Kesesuaian CP & TP Terverifikasi', 'Kelayakan Alokasi Waktu Jam Pelajaran', 'Asesmen & rubrik penilaian memadai'];
  box.innerHTML = '<div class="row row-between"><span class="eyebrow" style="margin:0">Lembar Panel Verifikasi</span><a href="' + esc(p.FolderURL) + '" target="_blank" rel="noopener" title="Buka folder Drive">' + ic('external-link') + '</a></div>' +
    '<h3 style="font-size:20px;margin-top:8px">' + esc(p.Judul) + '</h3><div class="small muted">' + esc(g.Nama) + ' • Diunggah ' + fTgl(p.TanggalUpload) + ' • ' + badgeStatusPerangkat(p) + '</div><div class="mt-16">' + blokHasilAI(p) + '</div>' +
    '<details class="mt-12"><summary class="small sb6" style="cursor:pointer">Berkas (' + p.JumlahFile + ')</summary>' + daftarBerkas(p) + '</details>' +
    '<div class="field mt-16"><label class="row row-between" style="width:100%"><span>Catatan Pembinaan / Rekomendasi</span><span class="tiny muted">Opsional jika approve</span></label><textarea class="inp inp-soft" id="vp-cat" rows="3" placeholder="Rancangan ajar sangat runtut dan sistematis…">' + esc(p.StatusApproval === 'Pending' ? '' : p.CatatanReviewer) + '</textarea></div>' +
    '<div class="eyebrow" style="margin-top:6px">Konfirmasi Standar Pengawasan</div>' + KONF.map((k, i) => '<label class="checkrow check" style="margin-bottom:8px"><input type="checkbox" class="vp-k" value="' + esc(k) + '"' + (cek.indexOf(k) > -1 ? ' checked' : '') + '><span>' + esc(k) + '</span></label>').join('') +
    '<label class="check small mt-8"><input type="checkbox" id="vp-lembar" checked> Terbitkan lembar verifikasi (PDF) saat menyetujui</label>' +
    '<button class="btn btn-dark btn-lg btn-block mt-16" id="vp-ok"' + (p.StatusAnalisis !== 'Selesai' ? ' disabled title="Tunggu analisis AI selesai"' : '') + '>' + ic('circle-check') + 'Approve &amp; Terbitkan Lembar Verifikasi</button>' +
    '<button class="btn btn-danger btn-lg btn-block mt-8" id="vp-rev">' + ic('file-pen') + 'Minta Revisi Berkas</button>' +
    (p.StatusAnalisis !== 'Selesai' ? '<button class="btn btn-out btn-block mt-8" id="vp-an">' + ic('scan-search') + 'Analisis Sekarang</button>' : '');
  const kirim = (kep) => async (e) => {
    const catatan = $('#vp-cat').value.trim(), checklist = $$('.vp-k').filter((c) => c.checked).map((c) => c.value), terbit = $('#vp-lembar').checked;
    if (kep === 'Rejected' && catatan.length < 5) { $('#vp-cat').classList.add('salah'); $('#vp-cat').focus(); return toast('Tuliskan catatan revisi untuk guru.', 'error'); }
    await sibuk(e.currentTarget, async () => {
      const r = await api('perangkatReview', { id: p.PerangkatID, keputusan: kep, catatan, checklist });
      if (!hasilToast(r)) return;
      App.upsert('perangkat', r.data.perangkat, 'PerangkatID');
      if (kep === 'Approved' && terbit) Dok.buat('LEMBAR_VERIFIKASI', p.PerangkatID, { langsung: true });
    });
  };
  $('#vp-ok').onclick = kirim('Approved');
  $('#vp-rev').onclick = kirim('Rejected');
  if ($('#vp-an')) $('#vp-an').onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('perangkatAnalisis', { id: p.PerangkatID }); if (hasilToast(r)) App.upsert('perangkat', r.data.perangkat, 'PerangkatID'); }, 'Menganalisis…');
}
