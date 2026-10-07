/**
 * p-dashboard.js — dashboard per peran (Super Admin, Pengawas, Kepala Sekolah, Guru)
 * + komponen bersama: kartu guru, kartu sekolah, timeline 4 tahapan supervisi.
 */
'use strict';
const UI = {
  kartuGuru(g) {
    const r = App.rekap.guru[g.UserID] || {}, sch = App.M.sekolah[g.SekolahID];
    const obsJadwal = App.boot.observasi.find((o) => o.GuruUserID === g.UserID && (o.Status === 'Terjadwal' || o.Status === 'Draft'));
    const ikonMapel = /matematika/i.test(g.Mapel) ? 'sigma' : /bahasa|inggris|arab/i.test(g.Mapel) ? 'languages' : /ipa|fisika|kimia|biologi/i.test(g.Mapel) ? 'flask-conical' : /ips|sejarah|geografi/i.test(g.Mapel) ? 'globe' : 'book-open';
    return '<div class="card gcard"><div class="hd">' + avatar(g.Nama, 'av-lg') + '<div class="grow" style="min-width:0"><div class="row row-top row-between gap-8"><div class="nm trunc" title="' + esc(g.Nama) + '">' + esc(g.Nama) + '</div>' + badgePred(r.predikat) + '</div>' +
      '<div class="meta trunc">NIP. ' + esc(g.NIP || '-') + (App.role === 'PENGAWAS' || App.role === 'SUPERADMIN' ? ' • ' + esc(sch ? sch.Nama : '') : '') + '</div>' +
      '<span class="mp trunc">' + ic(ikonMapel) + '<span class="trunc">' + esc(g.Mapel || 'Mapel belum diisi') + (g.Kelas ? ' • Kelas ' + esc(g.Kelas) : '') + '</span></span></div></div>' +
      '<div class="box">' + prog('Perencanaan', r.perencanaan, kelasBarPred(r.predikat)) + prog('Observasi', r.observasi, kelasBarPred(r.predikat)) + prog('Refleksi', r.refleksi, kelasBarPred(r.predikat)) + prog('Tindak Lanjut', r.tindakLanjut, 'gold') + '</div>' +
      '<div class="acts"><a class="btn btn-out" style="background:var(--surface-3);border:0" href="#/guru/' + g.UserID + '">' + ic('eye') + 'Lihat Detail</a>' +
      (App.isReviewer() ? '<a class="btn btn-pri" href="#/observasi/' + (obsJadwal ? 'isi/' + obsJadwal.ObservasiID : 'baru/' + g.UserID) + '">' + ic('notebook-pen') + 'Input Observasi</a>' : '') + '</div></div>';
  },
  kartuSekolah(s) {
    const r = App.rekap.sekolah[s.SekolahID] || {}, k = App.M.user[s.KepalaUserID], alarm = r.predikat === 'Kurang';
    const kode = inisial(s.Nama.replace(/^(SDN|SMPN|SMAN|SD|SMP|SMA|MI|MTs|MA|SMK)\s*/i, (m) => m.trim()[0] + ' '));
    const tUbah = [App.boot.perangkat, App.boot.observasi, App.boot.refleksi, App.boot.tindakLanjut].reduce((m, arr) => { arr.forEach((x) => { if (x.SekolahID === s.SekolahID && x.DiperbaruiPada > m) m = x.DiperbaruiPada; }); return m; }, '');
    const kelas = alarm ? 'red' : '';
    return '<div class="card scard ' + (alarm ? 'alarm' : '') + '"><div class="in"><div class="row row-top gap-12"><div class="av av-sq av-lg ' + (alarm ? 'av-red' : '') + '" style="font-size:17px">' + esc(kode) + '</div>' +
      '<div class="grow" style="min-width:0"><div class="row row-top row-between gap-8"><div class="b" style="font-size:18px;line-height:1.25">' + esc(s.Nama) + '</div>' + badgePred(r.predikat) + '</div>' +
      '<div class="small muted mt-8">NPSN: ' + esc(s.NPSN || '-') + ' • ' + (r.jumlahGuru || 0) + ' Guru</div></div></div>' +
      '<div class="ks">' + ic('user-round') + '<span class="grow trunc">KS: ' + esc(k ? k.Nama : 'Belum ditetapkan') + '</span>' + (alarm ? '<span class="tiny b" style="white-space:nowrap">' + ic('triangle-alert') + ' Perlu Perhatian</span>' : '') + '</div>' +
      '<div>' + prog('Perencanaan', r.perencanaan, kelas) + prog('Observasi', r.observasi, kelas || 'mid') + prog('Refleksi', r.refleksi, kelas) + prog('Tindak Lanjut', r.tindakLanjut, kelas || 'gold') + '</div></div>' +
      '<div class="ft">' + (alarm ? '<span>' + ic('flag') + ' Jadwalkan Visit Khusus</span><a href="#/sekolah/' + s.SekolahID + '">Bina Sekarang ' + ic('arrow-right') + '</a>'
        : '<span>' + ic('clock') + ' Diperbarui ' + (tUbah ? lalu(tUbah) : '-') + '</span><a href="#/sekolah/' + s.SekolahID + '">Lihat Detail ' + ic('arrow-right') + '</a>') + '</div></div>';
  },
  /** Timeline 4 tahapan untuk satu guru. */
  timeline(g, opsi) {
    opsi = opsi || {};
    const r = App.rekap.guru[g.UserID], t = r.tahap, saya = App.uid === g.UserID;
    const per = App.boot.perangkat.filter((p) => p.GuruUserID === g.UserID).sort((a, b) => b.TanggalUpload.localeCompare(a.TanggalUpload));
    const appr = per.find((p) => p.StatusApproval === 'Approved');
    const jadwal = App.boot.observasi.find((o) => o.GuruUserID === g.UserID && o.Status === 'Terjadwal');
    const badgeTahap = (x) => '<span class="badge ' + ({ selesai: 'st-ok', proses: 'st-wait', terjadwal: 'st-wait', menunggu: 'st-wait', revisi: 'st-bad', siap: 'st-info' }[x.status] || 'st-mute') + '">' + esc(x.label) + '</span>';
    const it = (no, x, judul, ds, isi) => {
      const aktif = x.status !== 'selesai' && x.status !== 'terkunci' && x.status !== 'belum' || (x.status === 'belum' && no === 1);
      return '<div class="tl-it ' + x.status + (aktif ? ' aktif' : '') + '"><div class="bul">' + (x.status === 'selesai' ? ic('check') : (['proses', 'terjadwal', 'menunggu', 'revisi'].indexOf(x.status) > -1 ? ic('clock') : no)) + '</div>' +
        '<div class="bx"><div class="row row-between row-top gap-12 row-wrap"><h4>' + no + '. ' + judul + '</h4>' + badgeTahap(x) + '</div><div class="ds">' + ds + '</div>' + (isi || '') + '</div></div>';
    };
    let s1 = '';
    if (appr) s1 = '<div class="mt">' + ic('calendar-check') + '<span>Disetujui ' + fTgl(appr.ReviewedAt) + '</span><span>•</span><a href="' + esc(appr.FolderURL) + '" target="_blank" rel="noopener">' + ic('folder-open') + ' Buka Berkas Arsip</a></div>';
    else if (per[0]) s1 = '<div class="mt">' + ic('upload') + '<span>Diunggah ' + fTgl(per[0].TanggalUpload) + '</span>' + (per[0].StatusApproval === 'Rejected' && per[0].CatatanReviewer ? '<span class="chip chip-sm" style="background:var(--k-bg);color:var(--k)">Revisi: ' + esc(per[0].CatatanReviewer.slice(0, 80)) + '</span>' : '') + '</div>';
    if (saya && t[0].status !== 'selesai') s1 += '<div class="mt-12"><a class="btn btn-pri btn-sm" href="#/perangkat">' + ic('upload') + (per.length ? 'Kelola Perangkat' : 'Unggah Perangkat') + '</a></div>';
    let s2 = '';
    if (jadwal) {
      s2 = '<div class="jadwal-box">' + ic('presentation') + '<div class="grow small"><div class="b" style="font-size:14px">Jadwal: ' + fTglPanjang(jadwal.Tanggal) + ' (' + esc(jadwal.JamMulai) + (jadwal.JamSelesai ? ' - ' + esc(jadwal.JamSelesai) : '') + ' WIB)</div>Penilai Utama: ' + esc(App.nama(jadwal.ObserverUserID)) + (jadwal.Topik ? ' • ' + esc(jadwal.Topik) : '') + '</div>' +
        (saya ? (jadwal.KonfirmasiGuru === 'YA' ? '<span class="chip chip-mint">' + ic('check') + 'Siap</span>' : '<button class="btn btn-dark btn-sm" data-konfirmasi="' + jadwal.ObservasiID + '">Konfirmasi Kesiapan</button>')
          : (App.isReviewer() ? '<a class="btn btn-pri btn-sm" href="#/observasi/isi/' + jadwal.ObservasiID + '">Isi Penilaian</a>' : '')) + '</div>';
    } else if (t[1].status === 'selesai') {
      const o = App.boot.observasi.filter((x) => x.GuruUserID === g.UserID && x.Status === 'Selesai').sort((a, b) => b.Tanggal.localeCompare(a.Tanggal))[0];
      s2 = '<div class="mt">' + ic('user-check') + '<span>Penilai: ' + esc(App.nama(o.ObserverUserID)) + '</span><span>•</span><a href="#/observasi?id=' + o.ObservasiID + '">Lihat hasil</a></div>';
    } else if (App.isReviewer() && !saya) s2 = '<div class="mt-12"><a class="btn btn-pri btn-sm" href="#/observasi/baru/' + g.UserID + '">' + ic('calendar-plus') + 'Jadwalkan / Input Observasi</a></div>';
    let s3 = '';
    if (t[2].status === 'terkunci') s3 = '<div class="mt">' + ic('lock') + '<span>Terbuka otomatis setelah nilai observasi kelas diunggah penilai</span></div>';
    else if (saya && t[2].status !== 'selesai') s3 = '<div class="mt-12"><a class="btn btn-pri btn-sm" href="#/refleksi">' + ic('pen-line') + 'Isi Refleksi</a></div>';
    else if (t[2].status === 'selesai') s3 = '<div class="mt"><a href="#/refleksi' + (saya ? '' : '/' + g.UserID) + '">' + ic('message-square-text') + ' Lihat refleksi</a></div>';
    let s4 = '';
    if (t[3].status === 'terkunci') s4 = '<div class="mt">' + ic('lock') + '<span>Menunggu penuntasan tahapan refleksi bersama kepala madrasah</span></div>';
    else s4 = '<div class="mt-12"><a class="btn btn-' + (t[3].status === 'menunggu' && App.isReviewer() ? 'pri' : 'out') + ' btn-sm" href="#/tindak-lanjut' + (saya ? '' : '/' + g.UserID) + '">' + ic('git-fork') + (saya ? 'Perbarui Progres' : (t[3].status === 'menunggu' ? 'Tinjau Draf AI' : 'Kelola Tindak Lanjut')) + '</a></div>';
    return '<div class="tl">' +
      it(1, t[0], 'Upload Perangkat Pembelajaran', 'Modul Ajar, Alur Tujuan Pembelajaran (ATP), dan rubrik asesmen ' + (t[0].status === 'selesai' ? 'telah diverifikasi.' : 'dianalisis AI lalu divalidasi kepala sekolah/pengawas.'), s1) +
      it(2, t[1], 'Observasi Kelas Tatap Muka', 'Observasi implementasi pembelajaran berdiferensiasi dan manajemen kelas oleh tim penilai.', s2) +
      it(3, t[2], 'Form Refleksi Diri Pasca Observasi', 'Analisis kendala, dinamika murid saat belajar, dan instrumen refleksi pedagogik mandiri.', s3) +
      it(4, t[3], 'Rencana Tindak Lanjut & Pembimbingan', 'Target pelatihan mandiri dan pendampingan rekan sejawat berdasarkan rekomendasi akhir.', s4) + '</div>';
  },
  pasangKonfirmasi(root) {
    $$('[data-konfirmasi]', root).forEach((b) => (b.onclick = () => sibuk(b, async () => {
      const r = await api('observasiKonfirmasi', { ObservasiID: b.dataset.konfirmasi });
      if (hasilToast(r)) App.upsert('observasi', r.data.observasi, 'ObservasiID');
    })));
  },
  kpi(label, nilai, sub, ikon, kelasIkon, ekstra) {
    return '<div class="card kpi"><div class="t"><span>' + label + '</span><span class="ico ' + (kelasIkon || '') + '">' + ic(ikon) + '</span></div><div class="v">' + nilai + '</div>' + (ekstra || '') + '<div class="s">' + sub + '</div></div>';
  }
};

// ============================================================================ DASHBOARD
daftarHalaman('dashboard', {
  judul: 'Dashboard',
  render(el) {
    const r = App.role;
    if (r === 'GURU') return dashGuru(el);
    if (r === 'KEPALA') return dashKepala(el);
    return dashPengawas(el, r === 'SUPERADMIN');
  }
});

let _dk = { q: '', mapel: '', pred: '', hal: 1 };
function dashKepala(el) {
  const sid = Object.keys(App.M.sekolah)[0], s = App.M.sekolah[sid] || {}, gurus = App.guru(sid), rs = App.rekap.sekolah[sid] || {};
  const rg = gurus.map((g) => App.rekap.guru[g.UserID]);
  const unggah = rg.filter((x) => x.jumlah.perangkat > 0), obs = rg.filter((x) => x.jumlah.observasi > 0);
  const avg = (a, k) => a.length ? Math.round(a.reduce((t, x) => t + x[k], 0) / a.length) : 0;
  const tlAktif = App.boot.tindakLanjut.filter((t) => t.Status === 'Assigned').length, tlDraft = App.boot.tindakLanjut.filter((t) => t.Status === 'AI-Draft' || t.Status === 'Draft').length;
  const mapel = Array.from(new Set(gurus.map((g) => g.Mapel).filter(Boolean))).sort();
  el.innerHTML = '<div class="ph"><div><div class="eyebrow">Overview / <b>Principal View</b></div><h1>Dashboard Kepala Sekolah</h1><p>Pemantauan supervisi terpadu, instrumen refleksi, dan percepatan tindak lanjut guru binaan' + (s.Nama ? ' di <b>' + esc(s.Nama) + '</b>' : '') + '.</p></div>' +
    '<div class="ph-actions"><button class="btn btn-dark btn-lg" id="dk-unduh">' + ic('download') + 'Unduh Laporan Sekolah</button></div></div>' +
    '<div class="cols-4">' +
    UI.kpi('Jumlah Guru Binaan', gurus.length + ' <small>Guru</small>', '<span class="row gap-8"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:var(--brand-600)"></span>Aktif &amp; Terdaftar dalam Siklus</span>', 'users', '', '<span class="deco"></span>') +
    UI.kpi('Rata-rata Perencanaan', avg(unggah, 'perencanaan') + '%', unggah.length + ' dari ' + gurus.length + ' guru sudah mengunggah modul ajar', 'clipboard-check', 'mint') +
    UI.kpi('Rata-rata Observasi', avg(obs, 'observasi') + '%', obs.length + ' dari ' + gurus.length + ' guru telah disupervisi', 'presentation', 'gold', '<div class="mt-12">' + bar(gurus.length ? obs.length / gurus.length * 100 : 0, 'bar-lg') + '</div>') +
    UI.kpi('Tindak Lanjut Aktif', tlAktif + ' <small>Rekomendasi</small>', '<span class="row gap-8">' + ic('clock') + (tlDraft ? tlDraft + ' draf AI menunggu penetapan' : 'Dalam pendampingan &amp; refleksi') + '</span>', 'git-fork', 'gold') + '</div>' +
    '<div class="sec-h"><div><h2>Daftar Guru &amp; Progres Kinerja</h2><div class="sub">Pantau real-time 4 tahapan supervisi siklus berkelanjutan</div></div>' +
    '<div class="filters"><div class="inp-ic cari">' + ic('search') + '<input class="inp" id="dk-q" placeholder="Cari nama atau NIP guru…" value="' + esc(_dk.q) + '"></div>' +
    '<select class="inp" id="dk-mapel">' + opsi(mapel, _dk.mapel, 'Semua Mata Pelajaran') + '</select><select class="inp" id="dk-pred">' + opsi(['Sangat Baik', 'Baik', 'Cukup', 'Kurang', 'Belum Mulai'], _dk.pred, 'Semua Status Kinerja') + '</select></div></div>' +
    '<div id="dk-grid"></div>';
  const isi = () => {
    const q = _dk.q.toLowerCase();
    const f = gurus.filter((g) => (!q || (g.Nama + ' ' + g.NIP).toLowerCase().indexOf(q) > -1) && (!_dk.mapel || g.Mapel === _dk.mapel) && (!_dk.pred || App.rekap.guru[g.UserID].predikat === _dk.pred));
    const per = 9, hal = Math.min(_dk.hal, Math.max(1, Math.ceil(f.length / per)));
    $('#dk-grid').innerHTML = f.length ? '<div class="cols-3">' + f.slice((hal - 1) * per, hal * per).map(UI.kartuGuru).join('') + '</div>' + '<div class="card mt-16">' + pager(f.length, hal, per) + '</div>'
      : '<div class="card">' + kosong(gurus.length ? 'Tidak ada guru yang cocok' : 'Belum ada guru terdaftar', gurus.length ? 'Ubah kata kunci atau filter.' : 'Tambahkan guru di menu Sekolah & Guru Binaan.', gurus.length ? '' : '<a class="btn btn-pri" href="#/sekolah">' + ic('user-plus') + 'Tambah Guru</a>', 'users') + '</div>';
    if (f.length <= per) { const pg = $('#dk-grid .card.mt-16'); if (pg) pg.remove(); }
    pasangPager($('#dk-grid'), (h) => { _dk.hal = h; isi(); window.scrollTo({ top: $('#dk-grid').offsetTop - 90, behavior: 'smooth' }); });
  };
  $('#dk-q').oninput = debounce((e) => { _dk.q = e.target.value; _dk.hal = 1; isi(); }, 250);
  $('#dk-mapel').onchange = (e) => { _dk.mapel = e.target.value; _dk.hal = 1; isi(); };
  $('#dk-pred').onchange = (e) => { _dk.pred = e.target.value; _dk.hal = 1; isi(); };
  $('#dk-unduh').onclick = () => Dok.buat('LAP_SEKOLAH', sid);
  isi();
}

let _dp = { q: '', pred: '' };
function dashPengawas(el, admin) {
  const sek = App.boot.sekolah.filter((s) => s.Status !== 'Nonaktif'), rs = sek.map((s) => App.rekap.sekolah[s.SekolahID]);
  const aktifRs = rs.filter((x) => x.mulai), avg = (k, arr) => { arr = arr || aktifRs; return arr.length ? (arr.reduce((t, x) => t + x[k], 0) / arr.length) : 0; };
  const sebar = { 'Sangat Baik': 0, 'Baik': 0, 'Cukup': 0, 'Kurang': 0 };
  rs.forEach((x) => { if (sebar[x.predikat] !== undefined) sebar[x.predikat]++; });
  const terlaksana = rs.filter((x) => x.guruDiobservasi > 0).length;
  const tlAktif = App.boot.tindakLanjut.filter((t) => t.Status === 'Assigned'), prioritas = tlAktif.filter((t) => t.Deadline && t.Deadline <= isoHari(new Date(Date.now() + 7 * 864e5))).length;
  const indeks = Math.round(avg('nilai', rs)), baikKeatas = rs.length ? Math.round((sebar['Sangat Baik'] + sebar.Baik) / rs.length * 100) : 0;
  const pa = App.periodeAktif(), arsip = App.boot.periode.filter((p) => p.PeriodeID !== pa.PeriodeID).sort((a, b) => b.TanggalMulai.localeCompare(a.TanggalMulai))[0];
  const minggu = App.boot.observasi.filter((o) => o.Status === 'Terjadwal' && o.Tanggal >= isoHari() && o.Tanggal <= isoHari(new Date(Date.now() + 7 * 864e5)));
  const sekMinggu = Array.from(new Set(minggu.map((o) => App.namaSekolah(o.SekolahID))));
  el.innerHTML = '<div class="card card-pad" style="margin-bottom:22px"><div class="ph" style="margin:0"><div class="row row-top gap-16"><div class="brand-logo" style="width:56px;height:56px;border-radius:14px">' + ic('chart-column', '') + '</div><div>' +
    '<div class="eyebrow"><b>' + (admin ? 'Panel Super Admin' : 'Portal Supervisi Akademik Terpadu') + '</b> • ' + (admin ? 'Seluruh sekolah' : 'Wilayah Binaan') + '</div><h1>' + (admin ? 'Dashboard Operator APSIKITA' : 'Dashboard Pengawas Madrasah &amp; Sekolah') + '</h1>' +
    '<p>' + (admin ? 'Kelola pengguna, template laporan, notifikasi, dan pantau progres supervisi seluruh sekolah.' : 'Pemantauan progres riil siklus supervisi pembelajaran, modul ajar, dan refleksi pedagogik.') + '</p></div></div>' +
    '<div class="seg" style="padding:6px">' + '<button class="' + (App.diPeriodeAktif() ? 'on' : '') + '" data-per="' + esc(pa.PeriodeID) + '" style="height:auto;padding:8px 18px">' + esc(pa.Nama || 'Periode aktif') + '</button>' +
    (arsip ? '<button class="' + (App.periodeId === arsip.PeriodeID ? 'on' : '') + '" data-per="' + esc(arsip.PeriodeID) + '" style="height:auto;padding:8px 18px">Arsip ' + esc(arsip.TahunAjaran || 'Lalu') + '</button>' : '') + '</div></div></div>' +
    (admin ? panelAdmin() : '') +
    '<div class="cols-4">' +
    UI.kpi('Sekolah Binaan', sek.length + ' <small>Sekolah</small>', '<span>Aktif dalam binaan semester ini</span><span class="b" style="color:var(--ink)">' + angka(App.guru().length) + ' guru</span>', 'school', '', '<div class="mt-12">' + bar(100, 'bar-lg') + '</div>') +
    UI.kpi('Rata-rata Perencanaan', avg('perencanaan').toFixed(1).replace('.', ',') + '%', '<span>Kepatuhan silabus &amp; RPP / Modul</span><span class="b" style="color:var(--mint-ink)">' + (avg('perencanaan') >= App.batas().b ? 'Optimal' : 'Perlu dorongan') + '</span>', 'clipboard-check', 'mint', '<div class="mt-12">' + bar(avg('perencanaan'), 'mid') + '</div>') +
    UI.kpi('Rata-rata Observasi', avg('observasi').toFixed(1).replace('.', ',') + '%', '<span>' + terlaksana + ' dari ' + sek.length + ' sekolah terlaksana</span><span class="b" style="color:var(--ink)">' + (sek.length ? Math.round(terlaksana / sek.length * 100) : 0) + '%</span>', 'eye', '', '<div class="mt-12">' + bar(sek.length ? terlaksana / sek.length * 100 : 0, 'bar-lg') + '</div>') +
    '<div class="card kpi"><div class="t"><span>Tindak Lanjut Aktif</span><span class="ico gold">' + ic('lightbulb') + '</span></div><div class="v gold">' + tlAktif.length + ' <small style="color:var(--gold)">Butir</small></div><div class="mt-12">' + bar(tlAktif.length ? Math.min(100, tlAktif.reduce((t, x) => t + Number(x.Progress || 0), 0) / tlAktif.length) : 0, 'gold bar-lg') + '</div><div class="s"><span>Dalam proses pendampingan</span><span class="b" style="color:var(--gold-ink)">' + prioritas + ' Prioritas</span></div></div></div>' +
    '<div class="card indeks mt-24">' + donut(indeks, 96, 10) + '<div class="grow" style="min-width:240px"><h3 style="font-size:20px">Indeks Kesiapan Akreditasi &amp; Mutu</h3><p class="muted" style="margin:6px 0 0">' + baikKeatas + '% sekolah binaan berada pada predikat Baik ke atas menuju keunggulan akademis.</p></div>' +
    '<div class="row row-wrap gap-8" style="max-width:420px;justify-content:flex-end"><span class="chip">' + '<span class="dot" style="color:var(--sb)"></span>Sangat Baik: ' + sebar['Sangat Baik'] + '</span><span class="chip"><span class="dot" style="color:var(--b)"></span>Baik: ' + sebar.Baik + '</span>' +
    '<span class="chip"><span class="dot" style="color:#b7791f"></span>Cukup: ' + sebar.Cukup + '</span><span class="chip"><span class="dot" style="color:var(--k)"></span>Perhatian Khusus: ' + sebar.Kurang + '</span></div></div>' +
    '<div class="sec-h"><div><h2>' + ic('building-2') + 'Daftar Sekolah Binaan</h2><div class="sub">Monitoring &amp; Evaluasi Kualitas Pendidikan Sekolah Binaan</div></div>' +
    '<div class="filters"><div class="inp-ic cari">' + ic('search') + '<input class="inp" id="dp-q" placeholder="Cari nama sekolah, NPSN, KS…" value="' + esc(_dp.q) + '"></div><select class="inp" id="dp-pred">' + opsi(['Sangat Baik', 'Baik', 'Cukup', 'Kurang', 'Belum Mulai'], _dp.pred, 'Semua Predikat') + '</select>' +
    '<button class="btn btn-dark" style="height:44px" id="dp-agregat">' + ic('download') + 'Unduh Laporan Agregat</button></div></div><div id="dp-grid"></div>' +
    '<div class="agenda"><div class="av av-sq" style="background:#fff">' + ic('calendar-days') + '</div><div class="grow"><div class="b">Jadwal Agenda Visitasi Pengawasan Minggu Ini</div><div class="small muted">' +
    (minggu.length ? minggu.length + ' visitasi tatap muka dijadwalkan ke ' + esc(sekMinggu.slice(0, 3).join(' & ')) + (sekMinggu.length > 3 ? ' dan lainnya' : '') + '.' : 'Belum ada observasi terjadwal dalam 7 hari ke depan.') + '</div></div>' +
    '<a class="btn btn-out" href="#/observasi">Lihat Kalender Kerja</a><a class="btn btn-dark" href="#/observasi/baru">' + ic('plus') + 'Buat Jadwal Observasi</a></div>';
  const isi = () => {
    const q = _dp.q.toLowerCase();
    const f = sek.filter((s) => { const k = App.M.user[s.KepalaUserID]; return (!q || (s.Nama + ' ' + s.NPSN + ' ' + (k ? k.Nama : '')).toLowerCase().indexOf(q) > -1) && (!_dp.pred || App.rekap.sekolah[s.SekolahID].predikat === _dp.pred); });
    $('#dp-grid').innerHTML = f.length ? '<div class="cols-3">' + f.map(UI.kartuSekolah).join('') + '</div>' : '<div class="card">' + kosong(sek.length ? 'Tidak ada sekolah yang cocok' : 'Belum ada sekolah binaan', sek.length ? 'Ubah kata kunci atau filter.' : 'Tambahkan sekolah binaan pertama Anda.', sek.length ? '' : '<a class="btn btn-pri" href="#/sekolah">' + ic('plus') + 'Tambah Sekolah</a>', 'school') + '</div>';
  };
  $('#dp-q').oninput = debounce((e) => { _dp.q = e.target.value; isi(); }, 250);
  $('#dp-pred').onchange = (e) => { _dp.pred = e.target.value; isi(); };
  $('#dp-agregat').onclick = () => Dok.buat('LAP_AGREGAT', admin ? 'SEMUA' : App.uid);
  $$('[data-per]', el).forEach((b) => (b.onclick = () => { if (b.dataset.per !== App.periodeId) App.gantiPeriode(b.dataset.per); }));
  isi();
}
function panelAdmin() {
  const u = App.boot.users, n = (r) => u.filter((x) => x.Role === r && x.Status === 'Aktif').length;
  const tautan = [['users', 'Pengguna & Akun', n('GURU') + ' guru • ' + n('KEPALA') + ' kepala • ' + n('PENGAWAS') + ' pengawas', '#/pengaturan/pengguna'],
    ['file-text', 'Template Dokumen', (App.boot.template || []).length + ' template Google Docs/Sheets', '#/pengaturan/template'],
    ['message-circle', 'WhatsApp & Notifikasi', App.setting('NOTIF_WA_AKTIF') === 'YA' ? 'WA aktif' : 'WA nonaktif', '#/pengaturan/notifikasi'],
    ['contact', 'CRM Kontak', 'Nama • Email • WhatsApp', '#/pengaturan/crm'], ['database', 'Migrasi Data', 'Impor dari spreadsheet lama', '#/pengaturan/migrasi'],
    ['server-cog', 'Sistem & Data Contoh', 'Trigger, backup, reset data contoh', '#/pengaturan/sistem']];
  return '<div class="cols-3 mb-16" style="margin-bottom:22px">' + tautan.map((t) => '<a class="card aksi-card" href="' + t[3] + '" style="flex-direction:row;align-items:center;padding:18px 20px"><span class="ico">' + ic(t[0]) + '</span><div class="grow"><div class="b" style="font-size:15.5px">' + t[1] + '</div><div class="small muted">' + esc(t[2]) + '</div></div>' + ic('chevron-right') + '</a>').join('') + '</div>';
}

function dashGuru(el) {
  const g = App.me, r = App.rekap.guru[g.UserID] || { tahap: [{}, {}, {}, {}], jumlah: {} }, s = App.M.sekolah[g.SekolahID] || {};
  const notif = (App.boot.notif || []).filter((n) => /PERANGKAT_(DISETUJUI|REVISI)|OBSERVASI_SELESAI|REFLEKSI_DITANGGAPI|TINDAK_LANJUT_DITUGASKAN|TL_KOMENTAR/.test(n.Jenis));
  const fb = notif.find((n) => n.Dibaca !== 'YA') || notif[0];
  const per = App.boot.perangkat.filter((p) => p.GuruUserID === g.UserID), berkas = per.reduce((t, p) => t + Number(p.JumlahFile || 0), 0);
  const belumBaca = (App.boot.notif || []).filter((n) => n.Dibaca !== 'YA').length;
  const tlAktif = App.boot.tindakLanjut.filter((t) => t.GuruUserID === g.UserID && t.Status === 'Assigned');
  el.innerHTML = '<div class="hero"><div class="grow" style="min-width:260px"><div class="eyebrow"><span class="dot-gold" style="background:var(--brand-900)"></span><b>Dashboard Saya / Guru</b> • ' + esc(s.Nama || '') + '</div><h1>Selamat Datang, ' + esc(g.Nama) + '</h1>' +
    '<p>Kelola unggahan perangkat ajar, pantau jadwal observasi kelas, dan evaluasi refleksi tindak lanjut kompetensi Anda secara berkesinambungan.</p></div>' +
    '<div class="profil-card">' + avatar(g.Nama, 'av-lg') + '<div class="grow" style="min-width:0"><div class="row row-between gap-8"><b class="trunc">' + esc(g.Nama) + '</b><span class="chip chip-mint chip-sm">Aktif</span></div><div class="small muted">NIP: ' + esc(g.NIP || '-') + '</div>' +
    '<div class="row row-wrap gap-8 mt-8"><span class="chip chip-sm">' + esc(g.Golongan || 'Guru') + '</span><span class="chip chip-sm">' + esc(g.Mapel || '-') + '</span></div></div></div></div>' +
    (fb ? '<div class="banner mt-24"><div class="ic-b">' + ic('bell-ring') + '</div><div class="grow"><span class="lbl">PEMBERITAHUAN TIM ASESOR</span> <span class="small" style="opacity:.75;margin-left:6px">' + lalu(fb.Tanggal) + '</span><div class="msg">' + esc(fb.Pesan) + '</div></div>' +
      '<a class="btn" style="background:#fff;color:var(--brand-900)" href="' + esc(fb.Link || '#/perangkat') + '">Lihat Detail Feedback ' + ic('arrow-right') + '</a></div>' : '') +
    '<div class="sec-h" style="margin-top:26px"><h2 style="color:var(--ink);font-size:19px">Aksi Cepat Supervisi</h2><span class="muted small">Tindakan langsung guru pembelajar</span></div>' +
    '<div class="cols-3">' +
    '<a class="card aksi-card" href="#/perangkat"><div class="row row-between"><span class="ico">' + ic('cloud-upload') + '</span>' + ic('arrow-up-right') + '</div><h4>Upload Dokumen</h4><div class="ds">Unggah tautan Google Drive modul ajar, ATP, serta asesmen formatif semester aktif.</div><div class="ft">' + ic('link') + berkas + ' File Tersemat</div></a>' +
    '<a class="card aksi-card" href="#/refleksi"><div class="row row-between"><span class="ico" style="background:var(--surface-3)">' + ic('notebook-pen') + '</span>' + ic('arrow-up-right') + '</div><h4>Isi Refleksi</h4><div class="ds">Evaluasi diri pasca kegiatan observasi kelas dan identifikasi respon keterlibatan siswa.</div><div class="ft">' + ic(r.tahap[2].status === 'terkunci' ? 'hourglass' : 'circle-check') + (r.tahap[2].status === 'terkunci' ? 'Menunggu Observasi Selesai' : esc(r.tahap[2].label)) + '</div></a>' +
    '<a class="card aksi-card" href="' + (fb ? esc(fb.Link || '#/perangkat') : '#/tindak-lanjut') + '"><div class="row row-between"><span class="ico" style="background:var(--gold-soft);color:var(--gold-600)">' + ic('message-square-text') + '</span>' + ic('arrow-up-right') + '</div><h4>Lihat Feedback</h4><div class="ds">Catatan pembinaan komprehensif dari Kepala Sekolah &amp; Pengawas Pembina madrasah.</div><div class="ft"><span class="dot-gold" style="margin:0"></span>' + (tlAktif.length ? tlAktif.length + ' Ulasan Perlu Tindak Lanjut' : notif.length + ' catatan pembinaan') + '</div></a></div>' +
    '<div class="split mt-24"><div class="card"><div class="card-head"><div><h3 style="font-size:21px">Tahapan Kinerja Guru</h3><div class="sub">Alur pembimbingan bertahap ' + esc(App.periode().Nama || '') + '</div></div>' +
    '<span class="chip chip-mint">Fase Aktif: ' + esc(['Perencanaan', 'Observasi Lapangan', 'Refleksi', 'Tindak Lanjut', 'Tuntas'][Math.min(4, r.tahap.findIndex((t) => t.status !== 'selesai') < 0 ? 4 : r.tahap.findIndex((t) => t.status !== 'selesai'))]) + '</span></div><div class="card-body" id="dg-tl">' + UI.timeline(g) + '</div></div>' +
    '<div class="stack gap-20"><div class="card card-pad"><div class="row row-between"><h3 style="font-size:18px">Progres Keseluruhan</h3>' + ic('chart-pie') + '</div><p class="small muted" style="margin:6px 0 16px">Ketercapaian pemenuhan siklus supervisi akademik Anda semester ini.</p>' +
    '<div class="center" style="display:grid;place-items:center">' + donut(r.persenTahap || 0, 170, 16, '#0a3a2c', 'SELESAI') + '<span class="chip chip-mint mt-16" style="height:32px;padding:0 16px">' + (r.tahapSelesai || 0) + ' dari 4 Tahapan Selesai</span></div>' +
    '<div class="mt-24">' + prog('Tahap 1: Dokumen Ajar', r.tahap[0].status === 'selesai' ? 100 : (per.length ? 50 : 0)) + prog('Tahap 2: Observasi Kelas', r.tahap[1].status === 'selesai' ? 100 : (r.tahap[1].status === 'terjadwal' ? 50 : 0), 'gold', r.tahap[1].status === 'selesai' ? '100%' : (r.tahap[1].status === 'terjadwal' ? '50% (Terjadwal)' : '0%')) +
    prog('Tahap 3: Refleksi', r.tahap[2].status === 'selesai' ? 100 : (r.tahap[2].status === 'proses' ? 50 : 0)) + prog('Tahap 4: Tindak Lanjut', r.tindakLanjut || 0, 'gold') + '</div></div>' +
    '<div class="dark-card"><div class="row row-between"><span class="lbl-b">STATUS BERKAS &amp; AKUN</span>' + ic('shield-check') + '</div><h3>Status Dokumen &amp; Pembinaan</h3><p class="small" style="opacity:.8;margin:6px 0 4px">Keterpaduan sinkronisasi berkas kurikulum merdeka pada portal APSIKITA.</p>' +
    '<div class="it">' + ic('circle-check') + '<span class="grow">Dokumen Terunggah</span><b>' + per.filter((p) => p.StatusApproval === 'Approved').length + ' / ' + per.length + ' Berkas</b></div>' +
    '<div class="it">' + ic('message-square-dot') + '<span class="grow">Catatan Baru</span><span class="chip chip-sm" style="background:var(--gold);color:#fff">' + belumBaca + ' Belum Dibaca</span></div>' +
    '<div class="it">' + ic('shield') + '<span class="grow">Status Akun Guru</span><span class="small">' + (g.PunyaPin ? 'Terverifikasi + PIN' : 'Terverifikasi') + '</span></div>' +
    '<button class="btn btn-block btn-lg mt-16" style="background:#fff;color:var(--brand-900)" id="dg-porto">' + ic('download') + 'Unduh Rekap Portofolio</button></div></div></div>';
  UI.pasangKonfirmasi(el);
  $('#dg-porto').onclick = () => Dok.buat('LAP_GURU', g.UserID);
}
