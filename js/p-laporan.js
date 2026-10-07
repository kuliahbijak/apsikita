/**
 * p-laporan.js — Laporan & Dokumen (doc engine):
 * buat dokumen dari template Google Docs/Sheets (isian otomatis + kolom tambahan hasil pindai),
 * pratinjau PDF, terbit bernomor + QR verifikasi, tanda tangan PIN, riwayat, tarik, generate massal.
 */
'use strict';
const JENIS_DOK = {
  guru: { ikon: 'user-round', label: 'Laporan per guru', ket: 'Rekap lengkap 4 tahapan supervisi satu guru (perencanaan, observasi, refleksi, tindak lanjut).' },
  sekolah: { ikon: 'school', label: 'Rekap per sekolah', ket: 'Ringkasan capaian semua guru dalam satu sekolah beserta sebaran predikat.' },
  agregat: { ikon: 'chart-column', label: 'Agregat pengawas', ket: 'Ringkasan seluruh sekolah binaan untuk pelaporan kepengawasan.' },
  perangkat: { ikon: 'file-badge', label: 'Lembar verifikasi perangkat', ket: 'Hasil rubrik AI, berkas yang diperiksa, dan catatan validator.' },
  observasi: { ikon: 'presentation', label: 'Lembar hasil observasi', ket: 'Skor per indikator, catatan observer, dan tanda tangan.' },
  rekapPerangkat: { ikon: 'file-spreadsheet', label: 'Rekap analisis perangkat', ket: 'Tabel seluruh perangkat beserta skor AI dan status validasi (Excel/PDF).' }
};
const KUNCI_RINGKAS = ['NAMA_GURU', 'NAMA_SEKOLAH', 'JUDUL_PERANGKAT', 'TANGGAL_OBSERVASI', 'CAKUPAN', 'NAMA_PENGAWAS', 'PERIODE', 'NILAI_AKHIR', 'NILAI_SEKOLAH', 'INDEKS', 'SKOR_AI', 'NILAI_OBSERVASI', 'PREDIKAT', 'JUMLAH_GURU', 'JUMLAH_SEKOLAH', 'JUMLAH_DOKUMEN', 'PERANGKAT', 'OBSERVASI', 'TINDAK_LANJUT', 'GURU', 'SEKOLAH', 'ITEM', 'KRITERIA', 'INDIKATOR'];
const labelKunci = (k) => k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (h) => h.toUpperCase());

const Dok = {
  async buat(kode, refId, opsi) {
    opsi = opsi || {};
    const t = App.M.template[kode];
    if (!t) return toast('Template "' + kode + '" belum tersedia atau nonaktif. Hubungi operator.', 'error');
    if (t.Aktif !== 'YA') return toast('Template "' + t.Nama + '" sedang nonaktif.', 'error');
    let m = modal({ judul: t.Nama, ukuran: 'lebar', atas: '<div class="eyebrow">Buat Dokumen • ' + esc((JENIS_DOK[t.JenisData] || {}).label || t.JenisData) + '</div>', isi: skeleton(3, 56) });
    const r = await api('deSiapkan', { kode, refId, periodeId: App.periodeId });
    if (!r.success) { m.tutup(); return toast(r.message, 'error'); }
    const d = r.data;
    if (opsi.langsung && !d.bidang.length && !d.perluSetuju) { m.tutup(); return Dok.terbitkan(kode, refId, {}, null); }
    m.tutup();
    const ring = KUNCI_RINGKAS.filter((k) => d.ringkas[k] !== undefined && d.ringkas[k] !== '').slice(0, 9);
    m = modal({ judul: t.Nama, ukuran: 'lebar', atas: '<div class="eyebrow">Buat Dokumen • ' + esc(d.label) + '</div>',
      isi: '<div class="soft"><div class="sb6 small mb-16" style="color:var(--brand-600)">' + ic('database') + ' Data terisi otomatis dari APSIKITA</div><dl class="dl">' + ring.map((k) => '<dt>' + labelKunci(k) + '</dt><dd>' + esc(d.ringkas[k]) + (/^(NILAI|SKOR|INDEKS)/.test(k) ? '%' : '') + '</dd>').join('') + '</dl></div>' +
        (d.bidang.length ? '<div class="sb6 mt-16 mb-16">' + ic('pencil-line') + ' Kolom tambahan dari template</div><div id="dk-form">' + formBidang(d.bidang) + '</div>' : '') +
        '<div class="sb6 mt-16 mb-16">' + ic('signature') + ' Penanda tangan</div>' + (d.penandatangan.length ? '<div class="stack gap-8">' + d.penandatangan.map((p) => '<div class="row gap-12 soft" style="padding:10px 14px">' + avatar(p.nama || '?', 'av-sm av-mint') + '<div class="grow"><div class="sb6">' + esc(p.nama || '(belum ditetapkan)') + '</div><div class="tiny muted">' + esc(p.label) + ' • ' + esc(p.jabatan || '') + '</div></div><span class="badge ' + (p.tanda === 'qr' ? 'st-info' : 'st-mute') + '">' + (p.tanda === 'qr' ? (p.wajibSetuju ? 'QR + PIN' : 'QR') : 'TTD basah') + '</span></div>').join('') + '</div>' : '<div class="muted small">Template ini tanpa slot tanda tangan.</div>') +
        (d.perluSetuju ? '<div class="callout blue mt-16">' + ic('info') + '<span>Dokumen akan <b>diajukan</b> dulu. Nomor & PDF final terbit otomatis setelah semua penanda tangan bertanda QR menyetujui dengan PIN.</span></div>' : '') +
        '<div class="row row-wrap gap-8 mt-16 small muted">' + ic('file-output') + 'Keluaran: ' + d.template.Keluaran.map((k) => '<span class="chip chip-sm">' + k.toUpperCase() + '</span>').join('') + '</div>',
      kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-out" id="dk-pv">' + ic('eye') + 'Pratinjau PDF</button><button class="btn btn-pri" id="dk-ok">' + ic(d.perluSetuju ? 'send' : 'file-check') + (d.perluSetuju ? 'Ajukan Tanda Tangan' : 'Terbitkan Dokumen') + '</button>',
      onBuka: (el, tutup) => {
        pasangBidang(el);
        el.querySelector('#dk-pv').onclick = (e) => sibuk(e.currentTarget, async () => {
          const res = await api('deBuat', { kode, refId, periodeId: App.periodeId, isian: kumpulBidang(el, d.bidang, true), pratinjau: true });
          if (res.success) lihatPdf(res.data.file); else toast(res.message, 'error');
        }, 'Menyusun…');
        el.querySelector('#dk-ok').onclick = (e) => {
          const isian = kumpulBidang(el, d.bidang); if (!isian) return;
          sibuk(e.currentTarget, async () => { const ok = await Dok.terbitkan(kode, refId, isian); if (ok) tutup(); }, 'Menerbitkan…');
        };
      } });
  },
  async terbitkan(kode, refId, isian) {
    const tid = toastProses('Menyusun dokumen dari template…');
    const r = await api('deBuat', { kode, refId, periodeId: App.periodeId, isian });
    tid();
    if (!r.success) { toast(r.message, 'error', 'Gagal membuat dokumen'); return false; }
    toast(r.message);
    if (r.data.file) unduhBase64(r.data.file);
    Store.del(uKey('deList'));
    if (parseHash().nama === 'laporan') App.segarkanHalaman();
    if (!r.data.terbit) App.muatBoot(true);
    return true;
  },
  massal(sidAwal) {
    const tpl = (App.boot.template || []).filter((t) => t.JenisData === 'guru' && t.Aktif === 'YA');
    if (!tpl.length) return toast('Tidak ada template laporan guru yang aktif.', 'error');
    const sek = App.boot.sekolah;
    modal({ judul: 'Generate Massal Laporan Guru', ukuran: 'lebar', sub: 'Satu dokumen per guru aktif di sekolah terpilih. Diproses bertahap di server — halaman ini boleh ditutup.',
      isi: '<div class="grid-2"><div class="field"><label>Template</label><select class="inp" id="ms-tpl">' + opsi(tpl.map((t) => ({ v: t.Kode, t: t.Nama }))) + '</select></div><div class="field"><label>Sekolah</label><select class="inp" id="ms-sek">' + opsi(sek.map((s) => ({ v: s.SekolahID, t: s.Nama + ' (' + App.guru(s.SekolahID).length + ' guru)' })), sidAwal || (sek[0] && sek[0].SekolahID)) + '</select></div></div>' +
        '<div id="ms-bidang"></div><div id="ms-prog"></div>',
      kaki: '<button class="btn btn-out" data-tutup>Tutup</button><button class="btn btn-pri" id="ms-go">' + ic('play') + 'Mulai Generate</button>',
      onBuka: (el, tutup) => {
        let bidang = [], aktif = true;
        const muatBidang = () => { const t = App.M.template[el.querySelector('#ms-tpl').value]; bidang = (t.Bidang || []).filter((b) => b.kategori !== 'otomatis'); el.querySelector('#ms-bidang').innerHTML = bidang.length ? '<div class="small sb6 mb-16">Kolom tambahan (berlaku untuk semua dokumen)</div>' + formBidang(bidang) : ''; pasangBidang(el); };
        el.querySelector('#ms-tpl').onchange = muatBidang; muatBidang();
        const obs = new MutationObserver(() => { if (!el.isConnected) { aktif = false; obs.disconnect(); } }); obs.observe(document.body, { childList: true, subtree: true });
        el.querySelector('#ms-go').onclick = (e) => {
          const isian = kumpulBidang(el, bidang); if (!isian) return;
          sibuk(e.currentTarget, async () => {
            const r = await api('deMassal', { kode: el.querySelector('#ms-tpl').value, sekolahId: el.querySelector('#ms-sek').value, isian, periodeId: App.periodeId });
            if (!hasilToast(r)) return;
            e.currentTarget.hidden = true;
            const prog = el.querySelector('#ms-prog'), batch = r.data.batchId;
            const tampil = (st) => { const x = st.ringkas; prog.innerHTML = '<div class="soft mt-16"><div class="row row-between"><b>Batch ' + esc(batch) + '</b><span class="small">' + x.selesai + ' selesai • ' + x.gagal + ' gagal • ' + x.menunggu + ' antre</span></div><div class="mt-12">' + bar(x.total ? (x.selesai + x.gagal) / x.total * 100 : 0, 'bar-lg') + '</div>' +
              '<div class="mt-12 small" style="max-height:180px;overflow:auto">' + st.rows.map((j) => '<div class="row row-between" style="padding:4px 0"><span>' + esc(j.nama) + '</span><span class="badge ' + (j.Status === 'SELESAI' ? 'st-ok' : j.Status === 'GAGAL' ? 'st-bad' : 'st-wait') + '" title="' + esc(j.Galat || '') + '">' + esc(j.Status) + '</span></div>').join('') + '</div>' +
              (x.selesai ? '<button class="btn btn-pri mt-16" id="ms-zip">' + ic('file-archive') + 'Unduh ZIP (' + x.selesai + ' PDF)</button>' : '') + '</div>';
              const z = prog.querySelector('#ms-zip'); if (z) z.onclick = (ev) => sibuk(ev.currentTarget, async () => { const zr = await api('deMassalZip', { batchId: batch }); if (zr.success) unduhBase64(zr.data.file); else toast(zr.message, 'error'); }); };
            tampil({ ringkas: { total: r.data.total, selesai: 0, gagal: 0, menunggu: r.data.total }, rows: [] });
            while (aktif) {
              const st = await api('deMassalProses', { batchId: batch });
              if (!st.success) { toast(st.message, 'error'); break; }
              tampil(st.data);
              if (!st.data.ringkas.menunggu) { toast('Generate massal selesai.'); Store.del(uKey('deList')); break; }
            }
          });
        };
      } });
  }
};
function toastProses(teks) {
  const box = $('#toasts'), el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = '<span class="spin"></span><div>' + esc(teks) + '<div class="tiny" style="opacity:.75">Biasanya 5–20 detik.</div></div>';
  box.appendChild(el); return () => el.remove();
}

// ---------------------------------------------------------------------------- form dari skema template
function formBidang(bidang) {
  return bidang.map((b) => {
    const id = 'de_' + b.kunci, v = b.bawaan || '', lbl = '<label for="' + id + '">' + esc(b.label) + (b.wajib ? ' <span class="wajib">*</span>' : '') + '</label>', bantu = b.bantu ? '<span class="bantu">' + esc(b.bantu) + '</span>' : '';
    let inp;
    if (b.tipe === 'area') inp = '<textarea class="inp" id="' + id + '" rows="3">' + esc(v) + '</textarea>';
    else if (b.tipe === 'naskah') inp = '<div class="row gap-4 mb-16"><button type="button" class="btn btn-out btn-xs" data-cmd="bold"><b>B</b></button><button type="button" class="btn btn-out btn-xs" data-cmd="italic"><i>I</i></button><button type="button" class="btn btn-out btn-xs" data-cmd="underline"><u>U</u></button><button type="button" class="btn btn-out btn-xs" data-cmd="insertUnorderedList">• Daftar</button><button type="button" class="btn btn-out btn-xs" data-cmd="insertOrderedList">1. Daftar</button></div><div class="editor-isi" id="' + id + '" contenteditable="true">' + v + '</div>';
    else if (b.tipe === 'pilihan') inp = '<select class="inp" id="' + id + '">' + opsi(b.opsi || [], v, 'Pilih…') + '</select>';
    else if (b.tipe === 'daftar') inp = '<div class="callout gold">' + ic('info') + '<span>Daftar "' + esc(b.label) + '" diisi otomatis.</span></div>';
    else if (b.tipe === 'gambar') inp = '<div class="callout gold">' + ic('image') + '<span>Kolom gambar belum didukung dari form ini.</span></div>';
    else inp = '<input class="inp" id="' + id + '" type="' + ({ tanggal: 'date', angka: 'number' }[b.tipe] || 'text') + '" value="' + esc(v) + '">';
    return '<div class="field">' + lbl + inp + bantu + '</div>';
  }).join('');
}
function pasangBidang(root) {
  $$('[data-cmd]', root).forEach((b) => (b.onmousedown = (e) => { e.preventDefault(); document.execCommand(b.dataset.cmd); }));
  $$('.editor-isi', root).forEach((ed) => (ed.onpaste = (e) => {
    e.preventDefault();
    const html = (e.clipboardData.getData('text/html') || esc(e.clipboardData.getData('text/plain')).replace(/\n/g, '<br>'))
      .replace(/<(script|style|meta|link)[\s\S]*?<\/\1>|<(meta|link)[^>]*>/gi, '').replace(/\s(style|class|id|on\w+)="[^"]*"/gi, '').replace(/<\/?(span|font|o:p)[^>]*>/gi, '');
    document.execCommand('insertHTML', false, html);
  }));
}
function kumpulBidang(root, bidang, longgar) {
  const o = {};
  for (const b of bidang) {
    const el = root.querySelector('#de_' + b.kunci); if (!el) continue;
    const v = b.tipe === 'naskah' ? el.innerHTML.trim() : el.value.trim();
    if (b.wajib && !longgar && !(b.tipe === 'naskah' ? el.textContent.trim() : v)) { el.classList.add('salah'); el.focus(); toast('Kolom "' + b.label + '" wajib diisi.', 'error'); return null; }
    o[b.kunci] = b.tipe === 'angka' && v !== '' ? Number(v) : v;
  }
  return o;
}

// ============================================================================ HALAMAN LAPORAN
let _lp = { tab: 'buat', q: '', st: '' };
daftarHalaman('laporan', {
  judul: 'Laporan & Dokumen',
  render(el) {
    const ttd = App.boot.ttdMenunggu || 0;
    el.innerHTML = '<div class="ph"><div><div class="eyebrow">Doc Engine / <b>Laporan &amp; Dokumen</b></div><h1>Laporan &amp; Dokumen</h1><p>Terbitkan laporan supervisi siap cetak dari template Google Docs/Sheets yang bisa disesuaikan operator. Setiap dokumen bernomor dan ber-QR verifikasi.</p></div>' +
      (App.role === 'SUPERADMIN' ? '<div class="ph-actions"><a class="btn btn-out" href="#/pengaturan/template">' + ic('file-cog') + 'Kelola Template</a></div>' : '') + '</div>' +
      '<div class="tabs"><button data-t="buat" class="' + (_lp.tab === 'buat' ? 'on' : '') + '">' + ic('file-plus') + 'Buat Dokumen</button><button data-t="riwayat" class="' + (_lp.tab === 'riwayat' ? 'on' : '') + '">' + ic('history') + 'Riwayat Dokumen</button>' +
      '<button data-t="ttd" class="' + (_lp.tab === 'ttd' ? 'on' : '') + '">' + ic('signature') + 'Menunggu Tanda Tangan' + (ttd ? '<span class="cnt">' + ttd + '</span>' : '') + '</button></div><div id="lp-isi"></div>';
    $$('[data-t]', el).forEach((b) => (b.onclick = () => { _lp.tab = b.dataset.t; App.segarkanHalaman(); }));
    const box = $('#lp-isi');
    if (_lp.tab === 'buat') return tabBuat(box);
    box.innerHTML = skeleton(3, 64);
    swr('deList', 'deList', {}, (data) => (_lp.tab === 'riwayat' ? tabRiwayat(box, data) : tabTtd(box, data)), { fresh: 20000, onError: (r) => (box.innerHTML = kosong('Gagal memuat', esc(r.message), '<button class="btn btn-pri" onclick="App.segarkanHalaman()">Coba lagi</button>', 'wifi-off')) });
  }
});

function tabBuat(box) {
  const r = App.role, boleh = { GURU: ['guru', 'perangkat', 'observasi', 'rekapPerangkat'], KEPALA: ['guru', 'sekolah', 'perangkat', 'observasi', 'rekapPerangkat'] }[r] || Object.keys(JENIS_DOK);
  const tpl = (App.boot.template || []).filter((t) => t.Aktif === 'YA' && boleh.indexOf(t.JenisData) > -1);
  box.innerHTML = '<div class="cols-3">' + tpl.map((t) => { const j = JENIS_DOK[t.JenisData] || {};
    return '<div class="card aksi-card" data-k="' + esc(t.Kode) + '"><div class="row row-between"><span class="ico">' + ic(j.ikon || 'file-text') + '</span><span class="chip chip-sm">' + (t.Engine === 'sheets' ? 'Google Sheets' : t.Engine === 'slides' ? 'Google Slides' : 'Google Docs') + '</span></div><h4>' + esc(t.Nama) + '</h4><div class="ds">' + esc(j.ket || '') + '</div>' +
      '<div class="ft">' + t.Keluaran.map((k) => '<span class="chip chip-sm">' + k.toUpperCase() + '</span>').join('') + '<span class="grow"></span>' + ic('arrow-right') + '</div></div>'; }).join('') +
    (r !== 'GURU' ? '<div class="card aksi-card" id="lp-massal" style="background:var(--brand-900);color:#fff"><div class="row row-between"><span class="ico" style="background:rgba(255,255,255,.12);color:var(--gold)">' + ic('files') + '</span></div><h4 style="color:#fff">Generate Massal</h4><div class="ds" style="color:rgba(255,255,255,.75)">Laporan seluruh guru satu sekolah sekaligus, diproses di latar lalu diunduh sebagai ZIP.</div><div class="ft" style="color:#fff">Mulai ' + ic('arrow-right') + '</div></div>' : '') + '</div>' +
    (!tpl.length ? '<div class="card">' + kosong('Belum ada template aktif', 'Operator dapat mengaktifkan template di Pengaturan → Template Dokumen.', '', 'file-x') + '</div>' : '');
  $$('[data-k]', box).forEach((c) => (c.onclick = () => pilihTarget(App.M.template[c.dataset.k])));
  const ms = $('#lp-massal'); if (ms) ms.onclick = () => Dok.massal(App.role === 'KEPALA' ? Object.keys(App.M.sekolah)[0] : '');
}

function pilihTarget(t) {
  const r = App.role, j = t.JenisData;
  if (j === 'guru' && r === 'GURU') return Dok.buat(t.Kode, App.uid);
  if (j === 'sekolah' && r === 'KEPALA') return Dok.buat(t.Kode, Object.keys(App.M.sekolah)[0]);
  if (j === 'agregat' && r === 'PENGAWAS') return Dok.buat(t.Kode, App.uid);
  if (j === 'rekapPerangkat' && r === 'GURU') return Dok.buat(t.Kode, 'SEMUA');
  let pil = [];
  if (j === 'guru') pil = App.guru().map((g) => ({ v: g.UserID, t: g.Nama + ' — ' + App.namaSekolah(g.SekolahID) }));
  if (j === 'sekolah') pil = App.boot.sekolah.map((s) => ({ v: s.SekolahID, t: s.Nama }));
  if (j === 'agregat') pil = [{ v: 'SEMUA', t: 'Seluruh sekolah' }].concat(App.boot.users.filter((u) => u.Role === 'PENGAWAS').map((u) => ({ v: u.UserID, t: 'Binaan ' + u.Nama })));
  if (j === 'perangkat') pil = App.boot.perangkat.filter((p) => p.StatusAnalisis === 'Selesai').map((p) => ({ v: p.PerangkatID, t: p.Judul + ' — ' + App.nama(p.GuruUserID) + ' (' + p.SkorAI + '%)' }));
  if (j === 'observasi') pil = App.boot.observasi.filter((o) => o.Status === 'Selesai').map((o) => ({ v: o.ObservasiID, t: fTgl(o.Tanggal) + ' — ' + App.nama(o.GuruUserID) + ' (' + o.NilaiTotal + '%)' }));
  if (j === 'rekapPerangkat') pil = (r === 'KEPALA' ? [] : [{ v: 'SEMUA', t: 'Semua sekolah dalam cakupan' }]).concat(App.boot.sekolah.map((s) => ({ v: s.SekolahID, t: s.Nama })));
  if (!pil.length) return toast('Belum ada data untuk dokumen ini pada periode ' + (App.periode().Nama || '') + '.', 'warn');
  modal({ judul: t.Nama, ukuran: 'kecil', sub: 'Pilih ' + ({ guru: 'guru', sekolah: 'sekolah', agregat: 'cakupan', perangkat: 'perangkat', observasi: 'observasi', rekapPerangkat: 'cakupan' }[j] || 'data') + ' untuk dokumen ini.',
    isi: '<div class="field"><select class="inp" id="pt-v">' + opsi(pil) + '</select></div>', kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="pt-ok">Lanjut ' + ic('arrow-right') + '</button>',
    onBuka: (el, tutup) => { el.querySelector('#pt-ok').onclick = () => { const v = el.querySelector('#pt-v').value; tutup(); Dok.buat(t.Kode, v); }; } });
}

function urlVerif(kode) { return location.origin + location.pathname + '#/v/' + kode; }
function tabRiwayat(box, data) {
  const rows = data.rows || [], st = { TERBIT: ['st-ok', 'Terbit'], MENUNGGU_TTD: ['st-wait', 'Menunggu TTD'], DITARIK: ['st-bad', 'Ditarik'] };
  box.innerHTML = '<div class="card"><div class="card-body" style="padding-bottom:0"><div class="filters"><div class="inp-ic cari grow">' + ic('search') + '<input class="inp inp-soft" id="rw-q" placeholder="Cari nomor, nama dokumen, guru…" value="' + esc(_lp.q) + '"></div><select class="inp" id="rw-st">' + opsi([{ v: 'TERBIT', t: 'Terbit' }, { v: 'MENUNGGU_TTD', t: 'Menunggu TTD' }, { v: 'DITARIK', t: 'Ditarik' }], _lp.st, 'Semua status') + '</select>' +
    '<button class="btn btn-out btn-icon" style="height:44px;width:44px" id="rw-segar">' + ic('refresh-cw') + '</button></div></div><div id="rw-tbl" class="mt-16"></div></div>';
  let hal = 1;
  const isi = () => {
    const q = _lp.q.toLowerCase(), f = rows.filter((d) => (!q || (d.Nomor + ' ' + d.RefLabel + ' ' + d.Kode + ' ' + (App.M.template[d.Kode] || {}).Nama).toLowerCase().indexOf(q) > -1) && (!_lp.st || d.Status === _lp.st));
    const per = 20; hal = Math.min(hal, Math.max(1, Math.ceil(f.length / per)));
    $('#rw-tbl').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nomor</th><th>Dokumen</th><th>Status</th><th>Tanda tangan</th><th>Tanggal</th><th></th></tr></thead><tbody>' +
      (f.length ? f.slice((hal - 1) * per, hal * per).map((d) => { const tt = d.Penandatangan || [], ok = tt.filter((p) => p.status && p.status !== 'MENUNGGU').length, s = st[d.Status] || ['st-mute', d.Status];
        return '<tr><td class="mono">' + esc(d.Nomor || '—') + '</td><td><div class="nm">' + esc((App.M.template[d.Kode] || {}).Nama || d.Kode) + '</div><div class="sub">' + esc(d.RefLabel) + '</div></td><td><span class="badge ' + s[0] + '">' + s[1] + '</span></td>' +
          '<td class="small">' + (tt.length ? ok + '/' + tt.length + ' <span class="muted">' + tt.map((p) => esc((p.nama || '').split(',')[0])).join(', ') + '</span>' : '-') + '</td><td class="small" style="white-space:nowrap">' + fWaktu(d.Terbit || d.Dibuat) + '</td>' +
          '<td class="right" style="white-space:nowrap">' + (d.Status !== 'MENUNGGU_TTD' ? d.Berkas.filter((b) => !/^g/.test(b.format)).map((b) => '<button class="btn btn-ghost btn-sm" data-dl="' + d.DokumenID + '" data-f="' + b.format + '" title="Unduh ' + b.format.toUpperCase() + '">' + ic(b.format === 'pdf' ? 'file-down' : b.format === 'xlsx' ? 'file-spreadsheet' : 'file-text') + '<span class="tiny">' + b.format.toUpperCase() + '</span></button>').join('') : '') +
          (App.role === 'SUPERADMIN' && d.Berkas.some((b) => /^g/.test(b.format)) ? '<button class="btn btn-ghost btn-sm" data-g="' + d.DokumenID + '" data-f="' + d.Berkas.find((b) => /^g/.test(b.format)).format + '" title="Buka di Google">' + ic('external-link') + '</button>' : '') +
          (d.KodeVerifikasi ? '<button class="btn btn-ghost btn-sm" data-v="' + d.KodeVerifikasi + '" title="Salin tautan verifikasi">' + ic('qr-code') + '</button>' : '') +
          (d.Status === 'TERBIT' && (d.Oleh === App.uid || App.role === 'SUPERADMIN') && App.role !== 'GURU' ? '<button class="btn btn-ghost btn-sm" data-tarik="' + d.DokumenID + '" title="Tarik dokumen">' + ic('ban') + '</button>' : '') + '</td></tr>'; }).join('')
        : '<tr><td colspan="6">' + kosong('Belum ada dokumen', 'Dokumen yang Anda buat atau tanda tangani tampil di sini.', '', 'file-text') + '</td></tr>') + '</tbody></table></div>' + pager(f.length, hal, per);
    pasangPager($('#rw-tbl'), (h) => { hal = h; isi(); });
    $$('#rw-tbl [data-dl]').forEach((b) => (b.onclick = () => sibuk(b, async () => { const r = await api('deUnduh', { dokumenId: b.dataset.dl, format: b.dataset.f }); if (r.success) unduhBase64(r.data.file); else toast(r.message, 'error'); })));
    $$('#rw-tbl [data-g]').forEach((b) => (b.onclick = () => sibuk(b, async () => { const r = await api('deUnduh', { dokumenId: b.dataset.g, format: b.dataset.f }); if (r.success && r.data.url) window.open(r.data.url, '_blank'); else toast(r.message, 'error'); })));
    $$('#rw-tbl [data-v]').forEach((b) => (b.onclick = () => salin(urlVerif(b.dataset.v))));
    $$('#rw-tbl [data-tarik]').forEach((b) => (b.onclick = async () => {
      const alasan = await tanya('Tarik dokumen', 'Alasan penarikan', { area: true, wajib: true, ya: 'Tarik Dokumen', bahaya: true, pesan: 'QR verifikasi dokumen ini akan menampilkan status DITARIK beserta alasannya.' });
      if (!alasan) return;
      const r = await api('deTarik', { dokumenId: b.dataset.tarik, alasan });
      if (hasilToast(r)) { Store.del(uKey('deList')); App.segarkanHalaman(); }
    }));
  };
  $('#rw-q').oninput = debounce((e) => { _lp.q = e.target.value; hal = 1; isi(); }, 220);
  $('#rw-st').onchange = (e) => { _lp.st = e.target.value; hal = 1; isi(); };
  $('#rw-segar').onclick = () => { Store.del(uKey('deList')); App.segarkanHalaman(); };
  isi();
}

function tabTtd(box, data) {
  const sa = App.role === 'SUPERADMIN';
  const rows = (data.rows || []).filter((d) => d.Status === 'MENUNGGU_TTD' && (sa || (d.Penandatangan || []).some((p) => p.userId === App.uid && p.wajibSetuju && p.status !== 'SETUJU')));
  box.innerHTML = (!App.me.PunyaPin && App.role !== 'GURU' ? '<div class="callout gold mb-16">' + ic('key-round') + '<span>Anda belum mengatur <b>PIN tanda tangan</b>. <a href="#/pengaturan/profil">Atur PIN sekarang</a> agar bisa menyetujui dokumen.</span></div>' : '') +
    (rows.length ? '<div class="stack gap-16">' + rows.map((d) => { const tt = d.Penandatangan || [], minU = Math.min.apply(null, tt.filter((p) => p.wajibSetuju && p.status !== 'SETUJU').map((p) => p.urutan));
      return '<div class="card card-pad"><div class="row row-wrap row-between gap-12"><div><div class="b" style="font-size:16px">' + esc((App.M.template[d.Kode] || {}).Nama || d.Kode) + '</div><div class="small muted">' + esc(d.RefLabel) + ' • diajukan ' + esc(App.nama(d.Oleh)) + ' ' + lalu(d.Dibuat) + '</div></div><span class="badge st-wait">Menunggu tanda tangan</span></div>' +
        '<div class="stack gap-8 mt-16">' + tt.map((p) => { const giliran = p.wajibSetuju && p.status !== 'SETUJU' && p.urutan === minU, saya = p.userId === App.uid;
          return '<div class="row gap-12 soft" style="padding:10px 14px">' + avatar(p.nama || '?', 'av-sm ' + (p.status === 'SETUJU' ? '' : 'av-mint')) + '<div class="grow"><div class="sb6">' + esc(p.nama || '-') + (saya ? ' <span class="chip chip-sm chip-gold">Anda</span>' : '') + '</div><div class="tiny muted">' + esc(p.label) + (p.waktu ? ' • ' + fWaktu(p.waktu) + ' (' + esc(p.metode) + ')' : '') + '</div></div>' +
            (p.status === 'SETUJU' ? '<span class="badge st-ok">' + ic('check') + 'Disetujui</span>' : !p.wajibSetuju ? '<span class="badge st-mute">Tanpa persetujuan</span>' : giliran ? (saya ? '<button class="btn btn-pri btn-sm" data-setuju="' + d.DokumenID + '" data-slot="' + p.slot + '">' + ic('signature') + 'Setujui dengan PIN</button>' : '<span class="badge st-wait">Gilirannya</span>') + (sa && !saya ? ' <button class="btn btn-out btn-sm" data-bypass="' + d.DokumenID + '" data-slot="' + p.slot + '">Bypass</button>' : '') : '<span class="badge st-mute">Menunggu giliran</span>') + '</div>'; }).join('') + '</div></div>'; }).join('') + '</div>'
      : '<div class="card">' + kosong('Tidak ada antrean tanda tangan', 'Dokumen yang membutuhkan persetujuan Anda akan muncul di sini.', '', 'signature') + '</div>');
  $$('[data-setuju]', box).forEach((b) => (b.onclick = async () => {
    const pin = await tanya('Setujui dokumen', 'PIN tanda tangan (6 digit)', { tipe: 'password', angka: true, maks: 6, wajib: true, ya: 'Setujui', pesan: 'Persetujuan Anda dicatat dengan waktu & metode LOGIN+PIN dan tampil di halaman verifikasi QR.' });
    if (!pin) return;
    setujuiDok(b.dataset.setuju, b.dataset.slot, { pin });
  }));
  $$('[data-bypass]', box).forEach((b) => (b.onclick = async () => {
    const alasan = await tanya('Bypass tanda tangan', 'Alasan bypass (tercatat & tampil di verifikasi)', { area: true, wajib: true, ya: 'Bypass', bahaya: true });
    if (alasan) setujuiDok(b.dataset.bypass, b.dataset.slot, { bypass: true, catatan: alasan });
  }));
}
async function setujuiDok(id, slot, extra) {
  const tid = toastProses('Memproses persetujuan…');
  const r = await api('deSetujui', Object.assign({ dokumenId: id, slot: Number(slot) }, extra));
  tid();
  if (!r.success) { toast(r.message, 'error'); if (r.code === 'NO_PIN' || (r.data && r.data.code === 'NO_PIN')) go('pengaturan/profil'); return; }
  toast(r.message);
  if (r.data.file) unduhBase64(r.data.file);
  Store.del(uKey('deList'));
  await App.muatBoot(true);
  App.segarkanHalaman();
}
