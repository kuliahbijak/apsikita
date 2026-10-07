/**
 * p-admin.js — Panel operator (SuperAdmin), bagian 2:
 *  • Template Dokumen (doc engine): daftar template Google Docs/Sheets, pindai ulang placeholder otomatis,
 *    atur kolom isian & penanda tangan, template baru dari URL, katalog placeholder, buat ulang bawaan.
 *  • Notifikasi WA/Email: Blast WhatsApp per batch, Antrean & Riwayat, Konfigurasi + matriks kejadian.
 *  • CRM Kontak: KPI, segmen, filter, aksi massal, detail + timeline, sinkron, impor CSV, gabung duplikat.
 *  • Migrasi Data: baca spreadsheet lama → petakan sheet → pindai (dry-run) → jalankan (delta sync aman).
 */
'use strict';

// ============================================================================ TEMPLATE DOKUMEN
const ENGINE_LABEL = { docs: 'Google Docs', sheets: 'Google Sheets', slides: 'Google Slides' };
const PERAN_TTD = [{ v: 'kepala', t: 'Kepala sekolah (otomatis dari data)' }, { v: 'guru', t: 'Guru yang bersangkutan' }, { v: 'pengawas', t: 'Pengawas binaan' },
  { v: 'reviewer', t: 'Reviewer / validator' }, { v: 'pembuat', t: 'Pembuat dokumen' }, { v: 'tetap', t: 'Pejabat tetap (pilih akun)' }];
const TIPE_KOLOM = [{ v: 'teks', t: 'Teks singkat' }, { v: 'area', t: 'Teks panjang' }, { v: 'naskah', t: 'Naskah (editor kaya)' }, { v: 'tanggal', t: 'Tanggal' }, { v: 'angka', t: 'Angka' }, { v: 'pilihan', t: 'Pilihan' }];
const peranLabel = (p) => (PERAN_TTD.find((x) => x.v === p) || { t: p }).t.replace(/ \(.*\)$/, '');
function urlBerkas(t) { return 'https://docs.google.com/' + ({ sheets: 'spreadsheets', slides: 'presentation' }[t.Engine] || 'document') + '/d/' + t.FileID + '/edit'; }
function labelJenis(j) { const k = App.boot.katalog && App.boot.katalog.jenis && App.boot.katalog.jenis[j]; return (k && k.label) || (JENIS_DOK[j] || {}).label || j; }
function simpanTplLokal(tpl) {
  const arr = App.boot.template, i = arr.findIndex((x) => x.Kode === tpl.Kode);
  if (i > -1) arr[i] = Object.assign({}, arr[i], tpl); else arr.push(tpl);
  App.siapkan(); App.simpanCache(); App.segarkanHalaman();
}

function tabTemplate(box) {
  const list = (App.boot.template || []).slice().sort((a, b) => ((a.Bawaan === 'YA' ? 0 : 1) - (b.Bawaan === 'YA' ? 0 : 1)) || a.Nama.localeCompare(b.Nama));
  box.innerHTML = '<div class="callout mb-16">' + ic('lightbulb') + '<div><b>Sesuaikan dokumen tanpa koding.</b> Klik <b>Buka di Google</b> → ubah kop, teks, tata letak, atau sisipkan placeholder <span class="mono">{{NAMA_KUNCI}}</span> dari <a href="#" data-katalog>katalog placeholder</a> → kembali ke sini dan klik <b>Pindai Ulang</b>. Placeholder baru otomatis menjadi kolom isian atau slot tanda tangan; setelan lama tetap dipertahankan.</div></div>' +
    '<div class="row row-wrap gap-8 mb-16"><span class="sb6">' + list.length + ' template</span><span class="small muted">• ' + list.filter((t) => t.Aktif === 'YA').length + ' aktif</span><span class="grow"></span>' +
    '<button class="btn btn-out btn-sm" data-katalog>' + ic('book-open') + 'Katalog Placeholder</button><button class="btn btn-pri btn-sm" id="tp-baru">' + ic('file-plus') + 'Template Baru</button></div>' +
    (list.length ? '<div class="cols-2">' + list.map(kartuTemplate).join('') + '</div>' : '<div class="card">' + kosong('Belum ada template', 'Jalankan setupAppEnvironment() untuk membuat 6 template bawaan, atau tambahkan template baru dari URL Google Docs.', '', 'file-x') + '</div>');
  $$('[data-katalog]', box).forEach((b) => (b.onclick = (e) => { e.preventDefault(); katalogPlaceholder(); }));
  $('#tp-baru', box).onclick = () => templateBaru();
  $$('.tpl-card', box).forEach((c) => {
    const kode = c.dataset.kode, t = App.M.template[kode];
    c.querySelector('[data-aktif]').onchange = async (e) => {
      const aktif = e.target.checked; e.target.disabled = true;
      const r = await api('deTemplateSimpan', { kode, aktif });
      e.target.disabled = false;
      if (!r.success) { e.target.checked = !aktif; return toast(r.message, 'error'); }
      toast(t.Nama + (aktif ? ' diaktifkan.' : ' dinonaktifkan.')); simpanTplLokal(r.data.template);
    };
    c.querySelector('[data-pindai]').onclick = (e) => pindaiTemplate(kode, t.FileID, e.currentTarget);
    c.querySelector('[data-atur]').onclick = () => aturTemplate(kode);
    c.querySelector('[data-uji]').onclick = () => (t.Aktif === 'YA' ? pilihTarget(t) : toast('Aktifkan template dulu untuk menguji.', 'warn'));
    c.querySelector('[data-lain]').onclick = (e) => {
      e.stopPropagation();
      const d = bukaDropdown(e.currentTarget, (t.FileID ? '<button class="it" data-a="salin">' + ic('copy') + 'Salin tautan berkas</button>' : '') +
        (t.Bawaan === 'YA' ? '<button class="it" data-a="bawaan">' + ic('rotate-ccw') + 'Buat ulang dari bawaan</button>' : '<button class="it" data-a="hapus" style="color:var(--k)">' + ic('trash-2') + 'Hapus template</button>'));
      $$('[data-a]', d).forEach((b) => (b.onclick = async () => {
        tutupDropdown();
        if (b.dataset.a === 'salin') return salin(urlBerkas(t));
        if (b.dataset.a === 'bawaan') {
          if (!(await konfirmasi('Buat ulang template bawaan?', 'Berkas Google Docs/Sheets baru dibuat di folder Templates dengan tata letak bawaan, lalu dipindai. Berkas lama <b>tidak dihapus</b> (tetap bisa dibuka dari Drive). Setelan kolom & penanda tangan dipertahankan.', { ya: 'Buat Ulang' }))) return;
          const tid = toastProses('Membuat berkas template bawaan…');
          const r = await api('deTemplateBawaan', { kode }); tid();
          if (!r.success) return toast(r.message, 'error');
          simpanTplLokal(r.data.template); hasilPindai(r.data, r.message);
        } else {
          if (!(await konfirmasi('Hapus template ' + esc(t.Nama) + '?', 'Template tidak bisa dipakai lagi. Dokumen yang sudah terbit tetap aman, dan berkas Google-nya tetap ada di Drive.', { bahaya: true, ya: 'Hapus', ketik: t.Kode }))) return;
          const r = await api('deTemplateHapus', { kode });
          if (!hasilToast(r)) return;
          App.boot.template = App.boot.template.filter((x) => x.Kode !== kode); App.siapkan(); App.simpanCache(); App.segarkanHalaman();
        }
      }));
    };
  });
}
function kartuTemplate(t) {
  const isian = (t.Bidang || []).filter((b) => b.kategori !== 'otomatis' && b.tipe !== 'daftar'), daftar = (t.Bidang || []).filter((b) => b.tipe === 'daftar'), slot = t.SlotTtd || [];
  return '<div class="card tpl-card' + (t.Aktif === 'YA' ? '' : ' redup') + '" data-kode="' + esc(t.Kode) + '"><div class="card-body">' +
    '<div class="row gap-12 row-top"><span class="ico-box ' + (t.Engine === 'sheets' ? 'mint' : '') + '">' + ic(t.Engine === 'sheets' ? 'file-spreadsheet' : t.Engine === 'slides' ? 'presentation' : 'file-text') + '</span>' +
    '<div class="grow"><div class="b">' + esc(t.Nama) + '</div><div class="tiny muted mono">' + esc(t.Kode) + ' • versi ' + esc(t.Versi || 1) + '</div></div>' +
    '<label class="switch" title="Aktif / nonaktif"><input type="checkbox" data-aktif' + (t.Aktif === 'YA' ? ' checked' : '') + '><span class="trk"></span></label></div>' +
    '<div class="row row-wrap gap-8 mt-12"><span class="chip chip-sm">' + esc(labelJenis(t.JenisData)) + '</span><span class="chip chip-sm chip-out">' + (ENGINE_LABEL[t.Engine] || t.Engine) + '</span>' + (t.Bawaan === 'YA' ? '<span class="chip chip-sm chip-mint">Bawaan</span>' : '<span class="chip chip-sm chip-gold">Kustom</span>') + '</div>' +
    '<dl class="dl dl-rapat mt-12 small"><dt>Kolom isian</dt><dd>' + (isian.length ? isian.map((b) => esc(b.label) + (b.wajib ? '<span class="wajib">*</span>' : '')).join(', ') : '<span class="muted">— semua terisi otomatis</span>') + '</dd>' +
    '<dt>Tabel otomatis</dt><dd>' + (daftar.length ? daftar.map((b) => '<span class="mono">#' + esc(b.kunci) + '</span>').join(' ') : '—') + '</dd>' +
    '<dt>Penanda tangan</dt><dd>' + (slot.length ? slot.map((s) => esc(s.label) + ' <span class="tiny muted">(' + esc(peranLabel(s.peran)) + (s.tanda === 'qr' ? ' • QR' + (s.wajibSetuju ? '+PIN' : '') : ' • TTD basah') + ')</span>').join('<br>') : '—') + '</dd>' +
    '<dt>Nomor</dt><dd class="mono">' + esc(t.FormatNomor || '-') + '</dd><dt>Keluaran</dt><dd>' + (t.Keluaran || []).map((k) => k.toUpperCase()).join(' · ') + '</dd></dl>' +
    '<div class="row row-wrap gap-8 mt-16">' + (t.FileID ? '<a class="btn btn-out btn-sm" target="_blank" rel="noopener" href="' + esc(urlBerkas(t)) + '">' + ic('external-link') + 'Buka di Google</a>' : '') +
    '<button class="btn btn-out btn-sm" data-pindai>' + ic('scan-search') + 'Pindai Ulang</button><button class="btn btn-out btn-sm" data-atur>' + ic('sliders-horizontal') + 'Atur</button><button class="btn btn-ghost btn-sm" data-uji>' + ic('eye') + 'Uji</button>' +
    '<span class="grow"></span><button class="btn btn-ghost btn-icon btn-sm" data-lain title="Lainnya" aria-label="Lainnya">' + ic('ellipsis-vertical') + '</button></div></div></div>';
}
async function pindaiTemplate(kode, url, btn) {
  let hasil = false;
  await sibuk(btn, async () => {
    const r = await api('dePindai', { kode, url });
    if (!r.success) return toast(r.message, 'error');
    simpanTplLokal(r.data.template); hasilPindai(r.data, r.message); hasil = true;
  }, 'Memindai…');
  return hasil;
}
function hasilPindai(d, pesan) {
  const t = d.template, isian = t.Bidang.filter((b) => b.kategori !== 'otomatis' && b.tipe !== 'daftar');
  modal({ judul: 'Hasil Pindai — ' + t.Nama, ukuran: 'lebar', sub: esc(pesan || ''),
    isi: '<div class="cols-3 mb-16">' + [['scan-text', d.jumlahPenanda || 0, 'placeholder ditemukan'], ['pencil-line', isian.length, 'kolom isian di form'], ['signature', t.SlotTtd.length, 'slot tanda tangan']].map((x) => '<div class="soft center"><div class="b" style="font-size:26px;color:var(--brand-900)">' + x[1] + '</div><div class="small muted">' + x[2] + '</div></div>').join('') + '</div>' +
      (isian.length ? '<div class="sb6 mb-16">' + ic('pencil-line') + ' Kolom isian</div><div class="row row-wrap gap-8 mb-16">' + isian.map((b) => '<span class="chip chip-sm">' + esc(b.label) + ' <span class="muted">· ' + esc(b.tipe) + '</span></span>').join('') + '</div>' : '') +
      (t.SlotTtd.length ? '<div class="sb6 mb-16">' + ic('signature') + ' Slot tanda tangan</div><div class="stack gap-8 mb-16">' + t.SlotTtd.map((s) => '<div class="row gap-8 small"><span class="chip chip-sm chip-mint">Slot ' + s.slot + '</span><b>' + esc(s.label) + '</b><span class="muted">' + esc(peranLabel(s.peran)) + '</span><span class="mono tiny muted">' + s.penanda.map((p) => p + '_' + s.slot).join(' ') + '</span></div>').join('') + '</div>' : '') +
      ((d.kustom || []).length ? '<div class="callout gold mb-16">' + ic('triangle-alert') + '<div><b>Placeholder kustom (diisi manual):</b> <span class="mono">' + d.kustom.map(esc).join(', ') + '</span>. Bila maksudnya data otomatis, cek ejaan di katalog placeholder.</div></div>' : '') +
      ((d.hilang || []).length ? '<div class="callout blue">' + ic('info') + '<div><b>Tidak ada lagi di template:</b> <span class="mono">' + d.hilang.map(esc).join(', ') + '</span> — kolom ini tidak ditampilkan di form.</div></div>' : ''),
    kaki: '<button class="btn btn-out" data-tutup>Tutup</button><button class="btn btn-pri" id="hp-atur">' + ic('sliders-horizontal') + 'Atur Kolom & Penanda Tangan</button>',
    onBuka: (el, tutup) => { el.querySelector('#hp-atur').onclick = () => { tutup(true); aturTemplate(t.Kode); }; } });
}

function templateBaru() {
  const kat = (App.boot.katalog && App.boot.katalog.jenis) || {};
  modal({ judul: 'Template Baru', ukuran: 'lebar', sub: 'Buat dokumen di Google Docs/Sheets/Slides milik akun pemilik Apps Script, tulis placeholder {{...}}, lalu tempel tautannya di sini.',
    isi: '<div id="tb"><div class="grid-2"><div class="field"><label>Kode template <span class="wajib">*</span></label><input class="inp mono" name="kode" placeholder="LAP_KHUSUS" maxlength="30" style="text-transform:uppercase"><span class="bantu">3–30 huruf kapital/angka/_ — dipakai pada nomor dokumen.</span></div>' +
      '<div class="field"><label>Nama template <span class="wajib">*</span></label><input class="inp" name="nama" placeholder="mis. Laporan Supervisi Khusus"></div></div>' +
      '<div class="field"><label>Jenis data (sumber isian otomatis) <span class="wajib">*</span></label><select class="inp" name="jenisData" id="tb-jenis">' + opsi(Object.keys(kat).map((k) => ({ v: k, t: kat[k].label }))) + '</select><span class="bantu" id="tb-ket"></span></div>' +
      '<div class="field"><label>Tautan berkas template <span class="wajib">*</span></label><input class="inp" name="url" placeholder="https://docs.google.com/document/d/…/edit"><span class="bantu">Tip: buka template bawaan → <b>File → Buat salinan</b>, ubah salinan, lalu tempel tautannya di sini.</span></div></div>',
    kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="tb-ok">' + ic('scan-search') + 'Pindai & Simpan</button>',
    onBuka: (el, tutup) => {
      const ket = () => { const j = kat[el.querySelector('#tb-jenis').value]; el.querySelector('#tb-ket').innerHTML = j ? 'Kunci otomatis: <span class="mono">' + j.kunci.slice(0, 8).join(', ') + (j.kunci.length > 8 ? ', …' : '') + '</span>' : ''; };
      el.querySelector('#tb-jenis').onchange = ket; ket();
      el.querySelector('#tb-ok').onclick = (e) => sibuk(e.currentTarget, async () => {
        const d = formData(el.querySelector('#tb')); d.kode = d.kode.toUpperCase();
        if (!/^[A-Z0-9_]{3,30}$/.test(d.kode)) return toast('Kode: 3–30 huruf kapital, angka, atau _.', 'error');
        if (!d.nama || !d.url) return toast('Nama dan tautan berkas wajib diisi.', 'error');
        const r = await api('dePindai', Object.assign(d, { baru: true }));
        if (!r.success) return toast(r.message, 'error');
        tutup(true); simpanTplLokal(r.data.template); hasilPindai(r.data, r.message);
      }, 'Memindai…');
    } });
}

function katalogPlaceholder() {
  const kat = App.boot.katalog || { jenis: {}, umum: [] };
  const blok = (judul, kunci) => '<div class="kat-blok" data-teks="' + esc((judul + ' ' + kunci.join(' ')).toLowerCase()) + '"><div class="sb6 small mb-8">' + judul + '</div><div class="row row-wrap gap-4">' + kunci.map((k) => '<span class="kbd" data-salin="' + esc(k) + '" title="Klik untuk menyalin">' + esc(k) + '</span>').join('') + '</div></div>';
  let isi = '<div class="inp-ic mb-16">' + ic('search') + '<input class="inp inp-soft" id="kp-q" placeholder="Cari placeholder…"></div>' +
    '<div class="callout blue mb-16">' + ic('info') + '<div class="small"><b>Cara menulis:</b> <span class="mono">{{NAMA_GURU}}</span> · pengubah <span class="mono">{{NAMA_GURU|kapital}}</span>, <span class="mono">{{TGL_OBSERVASI|tanggal:dd/MM/yyyy}}</span>, <span class="mono">{{CATATAN|bawaan:-}}</span> · ' +
      'tabel berulang: taruh <span class="mono">{{#OBSERVASI}}</span> di satu baris tabel, kolomnya <span class="mono">{{OBSERVASI.SKOR}}</span> · bagian bersyarat <span class="mono">{{?CATATAN}}…{{/CATATAN}}</span> · tanda tangan slot n: <span class="mono">{{LABEL_TTD_1}} {{TTD_1}} {{NAMA_PEJABAT_1}} {{NIP_1}} {{QR_1}}</span>. Placeholder di luar katalog menjadi <b>kolom isian manual</b>.</div></div>' +
    blok('Umum (semua template)', (kat.umum || []).map((k) => '{{' + k + '}}'));
  Object.keys(kat.jenis || {}).forEach((j) => {
    const x = kat.jenis[j];
    isi += blok(esc(x.label) + ' <span class="tiny muted mono">(' + j + ')</span>', x.kunci.map((k) => '{{' + k + '}}'));
    Object.keys(x.daftar || {}).forEach((d) => { isi += blok('Tabel berulang ' + d + ' — ' + esc(x.label), ['{{#' + d + '}}'].concat(x.daftar[d].map((k) => '{{' + d + '.' + k + '}}'))); });
  });
  modal({ judul: 'Katalog Placeholder', ukuran: 'xl', sub: 'Klik placeholder untuk menyalin, lalu tempel di Google Docs/Sheets.', isi: '<div id="kp">' + isi + '</div>', kaki: '<button class="btn btn-pri" data-tutup>Selesai</button>',
    onBuka: (el) => {
      $$('[data-salin]', el).forEach((k) => (k.onclick = () => salin(k.dataset.salin)));
      el.querySelector('#kp-q').oninput = debounce((e) => { const q = e.target.value.trim().toLowerCase(); $$('.kat-blok', el).forEach((b) => (b.hidden = q && b.dataset.teks.indexOf(q) < 0)); }, 120);
    } });
}

function aturTemplate(kode, awal) {
  const asli = App.M.template[kode]; if (!asli) return;
  const t = JSON.parse(JSON.stringify(asli)), bisaKeluar = { docs: ['pdf', 'docx'], sheets: ['pdf', 'xlsx'], slides: ['pdf', 'pptx', 'png'] }[t.Engine] || ['pdf', 'docx'];
  const pejabat = App.boot.users.filter((u) => u.Role !== 'GURU' && u.Status === 'Aktif').map((u) => ({ v: u.UserID, t: u.Nama + ' — ' + ROLE_LABEL[u.Role] }));
  let tab = awal || 'kolom';
  modal({ judul: 'Atur Template', ukuran: 'xl', atas: '<div class="eyebrow">' + esc(t.Kode) + ' • ' + esc(labelJenis(t.JenisData)) + '</div>', sub: esc(t.Nama),
    isi: '<div class="seg mb-16" id="at-seg"><button data-t="kolom">' + ic('pencil-line') + 'Kolom Isian</button><button data-t="ttd">' + ic('signature') + 'Penanda Tangan</button><button data-t="umum">' + ic('settings') + 'Umum & Nomor</button></div><div id="at-isi"></div>',
    kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="at-ok">' + ic('save') + 'Simpan Setelan</button>',
    onBuka: (el, tutup) => {
      const isi = el.querySelector('#at-isi');
      const gambar = () => {
        $$('#at-seg button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
        if (tab === 'kolom') {
          isi.innerHTML = t.Bidang.length ? '<p class="small muted" style="margin-top:0">Urutan di sini = urutan di form "Buat Dokumen". Kolom <b>otomatis</b> diisi dari data APSIKITA dan tidak tampil di form.</p><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th style="width:60px">Urut</th><th>Placeholder</th><th>Label di form</th><th>Tipe</th><th>Wajib</th><th>Petunjuk / opsi / nilai bawaan</th></tr></thead><tbody>' +
            t.Bidang.map((b, i) => { const oto = b.kategori === 'otomatis' || b.tipe === 'daftar';
              return '<tr class="' + (oto ? 'redup' : '') + '"><td style="white-space:nowrap"><button class="btn btn-ghost btn-icon btn-sm" data-naik="' + i + '"' + (i ? '' : ' disabled') + ' aria-label="Naik">' + ic('chevron-up') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-turun="' + i + '"' + (i < t.Bidang.length - 1 ? '' : ' disabled') + ' aria-label="Turun">' + ic('chevron-down') + '</button></td>' +
                '<td><span class="mono small">' + (b.tipe === 'daftar' ? '#' : '') + esc(b.kunci) + '</span><div><span class="chip chip-sm' + (oto ? ' chip-mint' : '') + '">' + esc(oto ? 'otomatis' : b.kategori) + '</span></div></td>' +
                '<td><input class="inp" data-i="' + i + '" data-f="label" value="' + esc(b.label) + '"' + (oto ? ' disabled' : '') + '></td>' +
                '<td>' + (oto ? '<span class="small muted">' + (b.tipe === 'daftar' ? 'tabel' : 'otomatis') + '</span>' : '<select class="inp" data-i="' + i + '" data-f="tipe">' + opsi(TIPE_KOLOM, b.tipe) + '</select>') + '</td>' +
                '<td class="center">' + (oto ? '—' : '<input type="checkbox" data-i="' + i + '" data-f="wajib"' + (b.wajib ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--brand)">') + '</td>' +
                '<td>' + (oto ? '<span class="tiny muted">' + (b.kolom && b.kolom.length ? 'Kolom: ' + b.kolom.map((k) => esc(k.kunci)).join(', ') : 'Diisi otomatis') + '</span>' :
                  '<input class="inp" data-i="' + i + '" data-f="bantu" value="' + esc(b.bantu || '') + '" placeholder="Petunjuk pengisian (opsional)">' +
                  (b.tipe === 'pilihan' ? '<input class="inp mt-8" data-i="' + i + '" data-f="opsi" value="' + esc((b.opsi || []).join(', ')) + '" placeholder="Opsi dipisah koma: Ya, Tidak">' : '') +
                  '<input class="inp mt-8" data-i="' + i + '" data-f="bawaan" value="' + esc(b.bawaan || '') + '" placeholder="Nilai bawaan (opsional)">') + '</td></tr>'; }).join('') + '</tbody></table></div>'
            : kosong('Tidak ada kolom', 'Semua placeholder template ini terisi otomatis.', '', 'circle-check');
          $$('[data-f]', isi).forEach((x) => (x.oninput = x.onchange = () => {
            const b = t.Bidang[x.dataset.i], f = x.dataset.f;
            b[f] = x.type === 'checkbox' ? x.checked : f === 'opsi' ? x.value.split(',').map((s) => s.trim()).filter(Boolean) : x.value;
            if (f === 'tipe') gambar();
          }));
          $$('[data-naik],[data-turun]', isi).forEach((x) => (x.onclick = () => { const i = Number(x.dataset.naik !== undefined ? x.dataset.naik : x.dataset.turun), j = x.dataset.naik !== undefined ? i - 1 : i + 1; const tmp = t.Bidang[i]; t.Bidang[i] = t.Bidang[j]; t.Bidang[j] = tmp; gambar(); }));
        } else if (tab === 'ttd') {
          isi.innerHTML = '<label class="switch mb-16"><input type="checkbox" id="at-qrp"' + (t.QrPerPenandatangan === 'YA' ? ' checked' : '') + '><span class="trk"></span>QR per penanda tangan (QR menggantikan TTD pada slot ber-QR)</label>' +
            (t.SlotTtd.length ? '<div class="stack gap-12">' + t.SlotTtd.map((s, i) => '<div class="soft"><div class="row row-wrap gap-8 mb-16"><span class="chip chip-sm chip-brand">Slot ' + s.slot + '</span>' + s.penanda.map((p) => '<span class="mono tiny muted">{{' + p + '_' + s.slot + '}}</span>').join(' ') + '</div>' +
              '<div class="grid-3"><div class="field"><label>Label</label><input class="inp" data-s="' + i + '" data-f="label" value="' + esc(s.label) + '" placeholder="Mengetahui / Menyetujui"></div>' +
              '<div class="field"><label>Penanda tangan</label><select class="inp" data-s="' + i + '" data-f="peran">' + opsi(PERAN_TTD, s.peran) + '</select></div>' +
              '<div class="field"' + (s.peran === 'tetap' ? '' : ' hidden') + '><label>Akun pejabat</label><select class="inp" data-s="' + i + '" data-f="userId">' + opsi(pejabat, s.userId, 'Pilih akun…') + '</select></div>' +
              '<div class="field"><label>Jabatan tampil</label><input class="inp" data-s="' + i + '" data-f="jabatan" value="' + esc(s.jabatan || '') + '" placeholder="Kosong = jabatan otomatis"></div>' +
              '<div class="field"><label>Bentuk tanda</label><select class="inp" data-s="' + i + '" data-f="tanda">' + opsi([{ v: 'kosong', t: 'Ruang TTD basah (dicetak)' }, { v: 'qr', t: 'QR tanda tangan elektronik' }], s.tanda) + '</select></div>' +
              '<div class="field"><label>Urutan persetujuan</label><input class="inp" type="number" min="1" max="9" data-s="' + i + '" data-f="urutan" value="' + esc(s.urutan || s.slot) + '"><span class="bantu">Angka sama = paralel.</span></div></div>' +
              (s.tanda === 'qr' ? '<label class="check"><input type="checkbox" data-s="' + i + '" data-f="wajibSetuju"' + (s.wajibSetuju !== false ? ' checked' : '') + '> Wajib disetujui dengan PIN sebelum dokumen terbit</label>' : '') + '</div>').join('') + '</div>'
              : kosong('Tanpa slot tanda tangan', 'Tambahkan <span class="mono">{{TTD_1}}</span> / <span class="mono">{{NAMA_PEJABAT_1}}</span> di template lalu pindai ulang.', '', 'signature'));
          const q = isi.querySelector('#at-qrp'); q.onchange = () => (t.QrPerPenandatangan = q.checked ? 'YA' : 'TIDAK');
          $$('[data-s]', isi).forEach((x) => (x.oninput = x.onchange = () => {
            const s = t.SlotTtd[x.dataset.s], f = x.dataset.f;
            s[f] = x.type === 'checkbox' ? x.checked : f === 'urutan' ? Number(x.value) || s.slot : x.value;
            if (f === 'peran' || f === 'tanda') gambar();
          }));
        } else {
          const contoh = () => { const v = isi.querySelector('#at-no').value, now = new Date(); return v.replace('{URUT}', '007').replace('{KODE}', t.Kode).replace('{BULAN}', ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][now.getMonth()]).replace('{TAHUN}', now.getFullYear()); };
          isi.innerHTML = '<div class="grid-2"><div class="field"><label>Nama template</label><input class="inp" id="at-nama" value="' + esc(t.Nama) + '"></div>' +
            '<div class="field"><label>Status</label><label class="switch" style="height:42px"><input type="checkbox" id="at-aktif"' + (t.Aktif === 'YA' ? ' checked' : '') + '><span class="trk"></span>Aktif — tampil di menu Laporan &amp; Dokumen</label></div></div>' +
            '<div class="field"><label>Format nomor dokumen</label><input class="inp mono" id="at-no" value="' + esc(t.FormatNomor || '{URUT}/' + t.Kode + '/{BULAN}/{TAHUN}') + '"><span class="bantu">Token: <span class="kbd" data-tok="{URUT}">{URUT}</span> <span class="kbd" data-tok="{KODE}">{KODE}</span> <span class="kbd" data-tok="{BULAN}">{BULAN}</span> (romawi) <span class="kbd" data-tok="{TAHUN}">{TAHUN}</span> — urutan direset tiap tahun. Contoh: <b id="at-contoh"></b></span></div>' +
            '<div class="field"><label>Format keluaran</label><div class="row row-wrap gap-16">' + bisaKeluar.map((k) => '<label class="check"><input type="checkbox" data-kel="' + k + '"' + (t.Keluaran.indexOf(k) > -1 ? ' checked' : '') + (k === 'pdf' ? ' disabled' : '') + '> ' + k.toUpperCase() + (k === 'pdf' ? ' (selalu)' : '') + '</label>').join('') + '</div></div>' +
            '<div class="hr"></div><div class="sb6 mb-16">' + ic('replace') + ' Ganti berkas template</div><p class="small muted" style="margin-top:-8px">Tempel tautan berkas Google lain (mis. salinan yang sudah didesain ulang). Berkas lama tidak dihapus; setelan kolom & TTD yang kuncinya sama tetap dipakai.</p>' +
            '<div class="row gap-8"><input class="inp grow" id="at-url" placeholder="https://docs.google.com/document/d/…"><button class="btn btn-out" id="at-ganti">' + ic('scan-search') + 'Pindai Berkas Ini</button></div>' +
            (t.FileID ? '<div class="tiny muted mt-8">Berkas sekarang: <a target="_blank" rel="noopener" href="' + esc(urlBerkas(t)) + '">' + esc(t.FileID) + '</a></div>' : '');
          const no = isi.querySelector('#at-no'), upd = () => { isi.querySelector('#at-contoh').textContent = contoh(); t.FormatNomor = no.value; no.classList.toggle('salah', no.value.indexOf('{URUT}') < 0); };
          no.oninput = upd; upd();
          $$('[data-tok]', isi).forEach((k) => (k.onclick = () => { no.value += k.dataset.tok; upd(); }));
          isi.querySelector('#at-nama').oninput = (e) => (t.Nama = e.target.value);
          isi.querySelector('#at-aktif').onchange = (e) => (t.Aktif = e.target.checked ? 'YA' : 'TIDAK');
          $$('[data-kel]', isi).forEach((c) => (c.onchange = () => (t.Keluaran = $$('[data-kel]', isi).filter((x) => x.checked).map((x) => x.dataset.kel))));
          isi.querySelector('#at-ganti').onclick = async (e) => { const u = isi.querySelector('#at-url').value.trim(); if (!u) return toast('Tempel tautan berkas terlebih dahulu.', 'error'); if (await pindaiTemplate(kode, u, e.currentTarget)) tutup(true); };
        }
      };
      $$('#at-seg button', el).forEach((b) => (b.onclick = () => { tab = b.dataset.t; gambar(); }));
      gambar();
      el.querySelector('#at-ok').onclick = (e) => sibuk(e.currentTarget, async () => {
        if (String(t.FormatNomor).indexOf('{URUT}') < 0) { tab = 'umum'; gambar(); return toast('Format nomor wajib memuat {URUT}.', 'error'); }
        const tetapKosong = t.SlotTtd.find((s) => s.peran === 'tetap' && !s.userId);
        if (tetapKosong) { tab = 'ttd'; gambar(); return toast('Pilih akun pejabat untuk slot ' + tetapKosong.slot + '.', 'error'); }
        const r = await api('deTemplateSimpan', { kode, nama: t.Nama, aktif: t.Aktif === 'YA', qrPerPenandatangan: t.QrPerPenandatangan === 'YA', formatNomor: t.FormatNomor, keluaran: t.Keluaran,
          bidang: t.Bidang.map((b) => ({ kunci: b.kunci, label: b.label, tipe: b.tipe, wajib: !!b.wajib, bantu: b.bantu || '', opsi: b.opsi || [], bawaan: b.bawaan || '' })),
          slot: t.SlotTtd.map((s) => ({ slot: s.slot, label: s.label, peran: s.peran, userId: s.userId || '', jabatan: s.jabatan || '', tanda: s.tanda, urutan: s.urutan, wajibSetuju: s.wajibSetuju !== false })) });
        if (!hasilToast(r)) return;
        tutup(true); simpanTplLokal(r.data.template);
      });
    } });
}

// ============================================================================ NOTIFIKASI WA / EMAIL
let _nt = { aud: null, src: { sumber: 'crm', segmen: '', sekolahId: '', tag: '', manual: '' }, ids: null, idsLabel: '', hanyaWA: false, mati: {}, judul: '', pesan: '', stop: false, batch: 0, jeda: '', auto: {}, qSt: '', qKanal: '' };
const CONTOH_VAR = () => ({ nama: 'Ibu Siti Aminah, S.Pd.', peran: 'Guru', email: 'siti@contoh.sch.id', sandi: 'Xy7k2m9p', link: (App.setting('APP_URL') || location.origin + location.pathname) + '#/dashboard', institusi: App.setting('NAMA_INSTITUSI', 'STIS Al Wafa'),
  kode: '482913', judul: 'Modul Ajar IPA Kelas VII', skor: '86', kualitas: 'Sangat Baik', catatan: 'Lengkapi asesmen diagnostik.', tanggal: fTglPanjang(isoHari()), jam: '08.00', topik: 'Sistem Organisasi Kehidupan',
  sekolah: 'SMP IT Al Wafa', mapel: 'IPA', guru: 'Ahmad Fauzi, S.Pd.', observer: 'Dr. H. Sulaiman, M.Pd.', jumlah: '3', deadline: fTgl(isoHari()), sisa: '3', progress: '60', nomor: '007/LAP_GURU/X/2026', dokumen: 'Laporan Supervisi Guru', reviewer: 'Kepala Sekolah', status: 'Disetujui', nilai: '86', predikat: 'Sangat Baik' });
function isiVar(teks, v) { return String(teks || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== '' ? v[k] : m)); }
function waHtml(teks) { return esc(teks).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>').replace(/~([^~\n]+)~/g, '<s>$1</s>'); }
function rataJeda(j) { const p = String(j || '5').split('-').map(Number); return p.length > 1 ? (p[0] + p[1]) / 2 : p[0] || 5; }
function badgeWA(st) { return st === 'Terdaftar' ? '<span class="wa-badge ya">✓ WA</span>' : st === 'Tidak Terdaftar' ? '<span class="wa-badge tidak">✕ bukan WA</span>' : '<span class="wa-badge belum">? belum dicek</span>'; }

function tabNotif(box, sub) {
  const t = ['blast', 'antrean', 'konfigurasi'].indexOf(sub[0]) > -1 ? sub[0] : 'blast';
  box.innerHTML = '<div class="seg seg-lebar mb-16">' + [['blast', 'megaphone', 'Blast WhatsApp'], ['antrean', 'inbox', 'Antrean & Riwayat'], ['konfigurasi', 'settings', 'Konfigurasi']].map((x) => '<button data-nt="' + x[0] + '" class="' + (x[0] === t ? 'on' : '') + '">' + ic(x[1]) + x[2] + '</button>').join('') + '</div><div id="nt-isi"></div>';
  $$('[data-nt]', box).forEach((b) => (b.onclick = () => go('pengaturan/notifikasi/' + b.dataset.nt)));
  const isi = $('#nt-isi', box);
  if (t === 'blast') return ntBlast(isi);
  if (t === 'antrean') return ntAntrean(isi);
  return ntKonfig(isi);
}

// ---------------------------------------------------------------------------- Konfigurasi
function ntKonfig(isi) {
  isi.innerHTML = skeleton(2, 220);
  let kotor = false;
  const tandai = () => { kotor = true; const u = isi.querySelector('#nk-ubah'); if (u) u.innerHTML = '<b style="color:var(--gold-ink)">Ada perubahan belum disimpan.</b>'; };
  isi.addEventListener('input', tandai); isi.addEventListener('change', tandai);
  swrBatch('notifKonfig', [{ action: 'notif.config' }], (d) => { if (!kotor && isi.isConnected && d['notif.config']) gambar(d['notif.config']); }, { fresh: 15000,
    onError: (r) => (isi.innerHTML = '<div class="card">' + kosong('Gagal memuat konfigurasi', esc(r.message), '', 'wifi-off') + '</div>') });
  function gambar(cfg) {
    const st = { wa: cfg.waAktif, email: cfg.emailAktif, batch: cfg.batchDefault || 20, matriks: JSON.parse(JSON.stringify(cfg.matriks || {})) }, buka = {};
    isi.innerHTML = '<div class="cols-2">' +
      '<div class="card"><div class="card-head"><div><h3>' + ic('message-circle') + ' WhatsApp (Fonnte)</h3><div class="sub">Notifikasi otomatis & blast lewat nomor WA lembaga.</div></div>' +
        '<label class="switch switch-lg"><input type="checkbox" id="nk-wa"' + (st.wa ? ' checked' : '') + '><span class="trk"></span><b id="nk-wa-l">' + (st.wa ? 'AKTIF' : 'NONAKTIF') + '</b></label></div><div class="card-body">' +
        '<div class="field"><label>Token perangkat Fonnte ' + (cfg.adaToken ? '<span class="badge st-ok">tersimpan</span>' : '<span class="badge st-wait">belum ada</span>') + '</label><input class="inp mono" type="password" id="nk-token" autocomplete="off" placeholder="' + esc(cfg.tokenMask || 'Tempel token dari fonnte.com → Device') + '">' +
          '<span class="bantu">Disimpan di Script Properties (tidak pernah tampil utuh).' + (cfg.adaToken ? ' <a href="#" id="nk-hapus">Hapus token</a>' : '') + '</span></div>' +
        '<div class="row row-wrap gap-8 mb-16"><button class="btn btn-out btn-sm" id="nk-dev">' + ic('smartphone') + 'Cek Perangkat</button><button class="btn btn-out btn-sm" id="nk-twa">' + ic('send') + 'Kirim Tes WA</button></div><div id="nk-devh" class="mb-16"></div>' +
        '<div class="grid-2"><div class="field"><label>Ukuran batch blast bawaan</label><div class="seg" id="nk-batch">' + [10, 20, 50].map((n) => '<button type="button" data-b="' + n + '" class="' + (n === st.batch ? 'on' : '') + '">' + n + '</button>').join('') + '</div></div>' +
        '<div class="field"><label>Jeda antarpesan (detik)</label><input class="inp" id="nk-jeda" value="' + esc(cfg.jeda) + '" placeholder="5 atau 3-8"><span class="bantu">Rentang acak (mis. 3-8) lebih aman dari blokir.</span></div></div>' +
        '<label class="switch"><input type="checkbox" id="nk-det"' + (cfg.deteksiOtomatis ? ' checked' : '') + '><span class="trk"></span>Deteksi otomatis nomor WA kontak baru (±10 menit sekali)</label></div></div>' +
      '<div class="card"><div class="card-head"><div><h3>' + ic('mail') + ' Email</h3><div class="sub">Dikirim lewat akun Google pemilik Apps Script.</div></div>' +
        '<label class="switch switch-lg"><input type="checkbox" id="nk-em"' + (st.email ? ' checked' : '') + '><span class="trk"></span><b id="nk-em-l">' + (st.email ? 'AKTIF' : 'NONAKTIF') + '</b></label></div><div class="card-body">' +
        '<div class="soft mb-16"><div class="row row-between"><span class="small">Sisa kuota email hari ini</span><b>' + angka(cfg.kuotaEmail) + '</b></div><div class="tiny muted mt-8">Gmail biasa ±100/hari, Google Workspace ±1.500/hari.</div></div>' +
        '<div class="field"><label>Nama pengirim</label><input class="inp" id="nk-nama" value="' + esc(cfg.namaPengirim) + '"></div>' +
        '<div class="field"><label>Alamat aplikasi (untuk tautan di pesan)</label><input class="inp mono" id="nk-url" value="' + esc(cfg.appUrl) + '" placeholder="https://akun.github.io/apsikita/"></div>' +
        '<div class="row row-wrap gap-8"><button class="btn btn-out btn-sm" id="nk-tem">' + ic('send') + 'Kirim Tes Email</button><span class="badge ' + (cfg.triggerAktif ? 'st-ok' : 'st-bad') + '">' + ic('timer') + 'Trigger ' + (cfg.triggerAktif ? 'aktif' : 'belum terpasang') + '</span></div></div></div></div>' +
      '<div class="card mt-24"><div class="card-head"><div><h3>' + ic('list-checks') + ' Matriks Notifikasi Otomatis</h3><div class="sub">Pilih kanal per kejadian dan ubah isi pesan. Variabel <span class="mono">{nama}</span> dst. terisi otomatis. Notifikasi di aplikasi (lonceng) selalu aktif.</div></div></div>' +
        '<div class="card-body" style="padding:12px 0 0"><div class="tbl-wrap"><table class="tbl compact" id="nk-mx"><thead><tr><th>Kejadian</th><th class="center" style="width:90px">WhatsApp</th><th class="center" style="width:90px">Email</th><th class="right" style="width:90px"></th></tr></thead><tbody></tbody></table></div></div></div>' +
      '<div class="save-bar"><span class="small muted" id="nk-ubah">Perubahan belum disimpan akan hilang bila meninggalkan halaman.</span><button class="btn btn-pri" id="nk-simpan">' + ic('save') + 'Simpan Konfigurasi</button></div>';

    const contoh = CONTOH_VAR();
    const gambarMx = () => {
      isi.querySelector('#nk-mx tbody').innerHTML = Object.keys(st.matriks).map((k) => {
        const m = st.matriks[k];
        return '<tr><td><div class="sb6">' + esc(m.label) + '</div><div class="tiny muted mono">' + esc(k) + '</div></td>' +
          '<td class="center"><label class="switch"><input type="checkbox" data-mx="' + k + '" data-kanal="wa"' + (m.wa ? ' checked' : '') + (st.wa ? '' : ' disabled') + '><span class="trk"></span></label></td>' +
          '<td class="center"><label class="switch"><input type="checkbox" data-mx="' + k + '" data-kanal="email"' + (m.email ? ' checked' : '') + (st.email ? '' : ' disabled') + '><span class="trk"></span></label></td>' +
          '<td class="right"><button class="btn btn-ghost btn-sm" data-ubah="' + k + '">' + ic(buka[k] ? 'chevron-up' : 'pencil') + (buka[k] ? 'Tutup' : 'Ubah') + '</button></td></tr>' +
          (buka[k] ? '<tr class="mx-detail"><td colspan="4"><div class="cols-2"><div><div class="field"><label>Subjek email</label><input class="inp" data-sub="' + k + '" value="' + esc(m.subjek) + '"></div>' +
            '<div class="field"><label>Isi pesan</label><textarea class="inp" rows="7" data-psn="' + k + '">' + esc(m.pesan) + '</textarea><span class="bantu">*tebal* _miring_ · variabel: ' + (m.variabel || []).map((v) => '<span class="kbd" data-var="' + k + '" data-v="' + esc(v) + '">' + esc(v) + '</span>').join(' ') + '</span></div>' +
            '<button class="btn btn-ghost btn-sm" data-reset="' + k + '">' + ic('rotate-ccw') + 'Kembalikan bawaan</button></div>' +
            '<div><div class="small sb6 mb-8">Pratinjau</div><div class="wa-preview" data-pv="' + k + '">' + waHtml(isiVar(m.pesan, contoh)) + '</div></div></div></td></tr>' : '');
      }).join('');
      const mx = isi.querySelector('#nk-mx');
      $$('[data-mx]', mx).forEach((c) => (c.onchange = () => (st.matriks[c.dataset.mx][c.dataset.kanal] = c.checked)));
      $$('[data-ubah]', mx).forEach((b) => (b.onclick = () => { buka[b.dataset.ubah] = !buka[b.dataset.ubah]; gambarMx(); }));
      $$('[data-sub]', mx).forEach((x) => (x.oninput = () => (st.matriks[x.dataset.sub].subjek = x.value)));
      $$('[data-psn]', mx).forEach((x) => (x.oninput = () => { st.matriks[x.dataset.psn].pesan = x.value; mx.querySelector('[data-pv="' + x.dataset.psn + '"]').innerHTML = waHtml(isiVar(x.value, contoh)); }));
      $$('[data-var]', mx).forEach((v) => (v.onclick = () => { const ta = mx.querySelector('[data-psn="' + v.dataset.var + '"]'), p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + v.dataset.v + ta.value.slice(ta.selectionEnd || p); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); }));
      $$('[data-reset]', mx).forEach((b) => (b.onclick = () => { const m = st.matriks[b.dataset.reset]; m.pesan = m.pesanDefault; m.subjek = m.subjekDefault; gambarMx(); tandai(); }));
    };
    gambarMx();
    const sakelar = (id, kunci, label) => { const c = isi.querySelector(id); c.onchange = () => { st[kunci] = c.checked; isi.querySelector(label).textContent = c.checked ? 'AKTIF' : 'NONAKTIF'; gambarMx(); }; };
    sakelar('#nk-wa', 'wa', '#nk-wa-l'); sakelar('#nk-em', 'email', '#nk-em-l');
    $$('#nk-batch button', isi).forEach((b) => (b.onclick = () => { st.batch = Number(b.dataset.b); $$('#nk-batch button', isi).forEach((x) => x.classList.toggle('on', x === b)); tandai(); }));
    const h = isi.querySelector('#nk-hapus');
    if (h) h.onclick = async (e) => { e.preventDefault(); if (!(await konfirmasi('Hapus token Fonnte?', 'WhatsApp otomatis dinonaktifkan sampai token baru diisi.', { bahaya: true, ya: 'Hapus Token' }))) return; const r = await api('notif.configSave', { token: '__HAPUS__', waAktif: false }); if (hasilToast(r, 'Token dihapus.')) { kotor = false; Store.set(uKey('notifKonfig'), { t: Date.now(), h: '', data: { 'notif.config': r.data } }); App.boot.setting.NOTIF_WA_AKTIF = 'TIDAK'; gambar(r.data); } };
    isi.querySelector('#nk-dev').onclick = (e) => sibuk(e.currentTarget, async () => {
      const r = await api('wa.device', {}), out = isi.querySelector('#nk-devh');
      out.innerHTML = r.success ? '<div class="callout">' + ic('smartphone') + '<span>Nomor <b>' + esc(r.data.nomor || '-') + '</b> · status <b>' + esc(r.data.status || '-') + '</b> · paket ' + esc(r.data.paket || '-') + ' · kuota ' + esc(r.data.kuota || '-') + (r.data.kedaluwarsa ? ' · aktif s.d. ' + esc(r.data.kedaluwarsa) : '') + '</span></div>'
        : '<div class="callout red">' + ic('circle-alert') + '<span>' + esc(r.message) + '</span></div>';
    });
    isi.querySelector('#nk-twa').onclick = async () => { const n = await tanya('Kirim Tes WhatsApp', 'Nomor tujuan', { nilai: App.me.NoWA || '', ph: '08xxxxxxxxxx', wajib: true, ya: 'Kirim' }); if (n) { const r = await api('wa.test', { nomor: n }); hasilToast(r); } };
    isi.querySelector('#nk-tem').onclick = async () => { const em = await tanya('Kirim Tes Email', 'Email tujuan', { nilai: App.me.Email || '', wajib: true, ya: 'Kirim', tipe: 'email' }); if (em) { const r = await api('email.test', { email: em }); hasilToast(r); } };
    isi.querySelector('#nk-simpan').onclick = (e) => sibuk(e.currentTarget, async () => {
      const token = isi.querySelector('#nk-token').value.trim(), jeda = isi.querySelector('#nk-jeda').value.trim();
      if (st.wa && !cfg.adaToken && !token) return toast('Isi token Fonnte sebelum mengaktifkan WhatsApp.', 'error');
      if (!/^\d{1,3}(-\d{1,3})?$/.test(jeda)) return toast('Jeda harus angka (mis. 5) atau rentang (mis. 3-8).', 'error');
      const mx = {}; Object.keys(st.matriks).forEach((k) => { const m = st.matriks[k]; mx[k] = { wa: m.wa, email: m.email, pesan: m.pesan, subjek: m.subjek }; });
      const r = await api('notif.configSave', { waAktif: st.wa, emailAktif: st.email, token: token || undefined, batchDefault: st.batch, jeda, deteksiOtomatis: isi.querySelector('#nk-det').checked,
        namaPengirim: isi.querySelector('#nk-nama').value.trim(), appUrl: isi.querySelector('#nk-url').value.trim(), matriks: mx });
      if (!hasilToast(r, 'Konfigurasi notifikasi disimpan.')) return;
      kotor = false;
      Object.assign(App.boot.setting, { NOTIF_WA_AKTIF: r.data.waAktif ? 'YA' : 'TIDAK', NOTIF_EMAIL_AKTIF: r.data.emailAktif ? 'YA' : 'TIDAK', APP_URL: r.data.appUrl, WA_BATCH_DEFAULT: String(r.data.batchDefault), WA_JEDA_DETIK: r.data.jeda });
      App.simpanCache();
      Store.set(uKey('notifKonfig'), { t: Date.now(), h: '', data: { 'notif.config': r.data } });
      gambar(r.data);
    });
  }
}

// ---------------------------------------------------------------------------- Antrean & riwayat
function ntAntrean(isi) {
  const ST = { Antri: ['st-wait', 'Menunggu', 'hourglass'], Terkirim: ['st-ok', 'Terkirim', 'circle-check'], Gagal: ['st-bad', 'Gagal', 'circle-x'], Batal: ['st-mute', 'Dibatalkan', 'circle-slash'] };
  const ST2 = Object.assign({}, ST, { Proses: ['st-wait', 'Sedang dikirim', 'loader'] });   // v2: status klaim prosesor
  isi.innerHTML = '<div class="cols-4 mb-16" id="aq-kpi">' + skeleton(1, 90).repeat(4) + '</div>' +
    '<div class="card"><div class="card-body" style="padding-bottom:0"><div class="filters"><select class="inp" id="aq-st">' + opsi(Object.keys(ST2).map((k) => ({ v: k, t: ST2[k][1] })), _nt.qSt, 'Semua status') + '</select>' +
    '<select class="inp" id="aq-kanal">' + opsi([{ v: 'WA', t: 'WhatsApp' }, { v: 'EMAIL', t: 'Email' }], _nt.qKanal, 'Semua kanal') + '</select><span class="grow"></span>' +
    '<button class="btn btn-out" id="aq-proses">' + ic('play') + 'Proses Sekarang</button><button class="btn btn-out" id="aq-ulang">' + ic('rotate-ccw') + 'Ulangi yang Gagal</button><button class="btn btn-out btn-icon" id="aq-segar" title="Muat ulang">' + ic('refresh-cw') + '</button></div></div><div id="aq-tbl">' + skeleton(4, 44) + '</div></div>';
  const gambar = (d) => {
    if (!isi.isConnected) return;
    const g = d.ringkas || {};
    $('#aq-kpi', isi).innerHTML = Object.keys(ST).map((k) => '<div class="card kpi kpi-kecil"><div class="t"><span>' + ST[k][1] + '</span><span class="ico ' + (k === 'Terkirim' ? 'mint' : k === 'Antri' ? 'gold' : '') + '">' + ic(ST[k][2]) + '</span></div><div class="v">' + angka(g[k] || 0) + '</div></div>').join('');
    const rows = d.rows || [];
    $('#aq-tbl', isi).innerHTML = rows.length ? '<div class="tbl-wrap" style="max-height:620px;overflow:auto"><table class="tbl compact"><thead><tr><th>Waktu</th><th>Kanal</th><th>Tujuan</th><th>Kejadian</th><th>Pesan</th><th>Status</th></tr></thead><tbody>' + rows.map((r) =>
      '<tr><td class="small" style="white-space:nowrap">' + fWaktu(r.DikirimPada || r.DibuatPada) + '</td><td><span class="chip chip-sm ' + (r.Kanal === 'WA' ? 'chip-mint' : '') + '">' + ic(r.Kanal === 'WA' ? 'message-circle' : 'mail') + (r.Kanal === 'WA' ? 'WA' : 'Email') + '</span></td>' +
      '<td class="small"><div class="sb6 trunc" style="max-width:180px">' + esc(r.NamaPenerima || '-') + '</div><div class="tiny muted mono">' + esc(r.Tujuan) + '</div></td><td class="small"><span class="mono tiny">' + esc(r.Event) + '</span>' + (r.BlastID ? '<div class="tiny muted">' + esc(r.BlastID) + '</div>' : '') + '</td>' +
      '<td class="small" style="max-width:340px"><div class="trunc" title="' + esc(r.Pesan) + '">' + esc((r.Subjek ? r.Subjek + ' — ' : '') + String(r.Pesan || '').replace(/\s+/g, ' ').slice(0, 140)) + '</div></td>' +
      '<td><span class="badge ' + (ST2[r.Status] || ['st-mute'])[0] + '">' + esc((ST2[r.Status] || [0, r.Status])[1]) + '</span>' + (r.Respon && r.Status !== 'Terkirim' ? '<div class="tiny muted mt-8" style="max-width:200px">' + esc(r.Respon) + '</div>' : '') + (Number(r.Percobaan) > 1 ? '<div class="tiny muted">' + r.Percobaan + '× percobaan</div>' : '') + '</td></tr>').join('') + '</tbody></table></div>'
      : kosong('Antrean kosong', 'Notifikasi WA/Email yang dikirim sistem tercatat di sini.', '', 'inbox');
  };
  const muat = (paksa) => swr('notifQ:' + _nt.qSt + ':' + _nt.qKanal, 'notif.queue', { status: _nt.qSt, kanal: _nt.qKanal }, gambar, { fresh: 8000, force: paksa,
    onError: (r) => ($('#aq-tbl', isi).innerHTML = kosong('Gagal memuat antrean', esc(r.message), '', 'wifi-off')) });
  muat(false);
  $('#aq-st', isi).onchange = (e) => { _nt.qSt = e.target.value; muat(false); };
  $('#aq-kanal', isi).onchange = (e) => { _nt.qKanal = e.target.value; muat(false); };
  $('#aq-segar', isi).onclick = (e) => sibuk(e.currentTarget, () => muat(true));
  $('#aq-proses', isi).onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('notif.processNow', {}); if (hasilToast(r)) await muat(true); }, 'Memproses…');
  $('#aq-ulang', isi).onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('notif.retry', {}); if (hasilToast(r)) await muat(true); });
}

// ---------------------------------------------------------------------------- Blast WhatsApp
function ntBlast(isi) {
  const s = _nt.src;
  if (!_nt.batch) _nt.batch = Number(App.setting('WA_BATCH_DEFAULT', 20)) || 20;
  if (!_nt.jeda) _nt.jeda = App.setting('WA_JEDA_DETIK', '5') || '5';
  isi.innerHTML = '<div id="bl-warn"></div><div class="cols-2 bl-grid">' +
    '<div class="card"><div class="card-head"><div><h3><span class="langkah">1</span> Pilih Sasaran</h3><div class="sub">Kontak dari CRM (guru, kepala sekolah, pengawas, operator) atau nomor manual.</div></div></div><div class="card-body">' +
      '<div class="seg mb-16" id="bl-sumber"><button data-s="crm" class="' + (s.sumber === 'crm' ? 'on' : '') + '">' + ic('contact') + 'CRM Kontak</button><button data-s="manual" class="' + (s.sumber === 'manual' ? 'on' : '') + '">' + ic('keyboard') + 'Nomor Manual</button></div>' +
      '<div id="bl-crm"' + (s.sumber === 'crm' ? '' : ' hidden') + '>' + (_nt.ids ? '<div class="callout blue mb-16">' + ic('users') + '<div class="grow"><b>' + _nt.ids.length + ' kontak terpilih</b> dari CRM. <a href="#" id="bl-ids-x">Batalkan pilihan</a></div></div>' : '') +
        '<div class="grid-2"><div class="field"><label>Segmen</label><select class="inp" id="bl-seg">' + opsi(['Guru', 'Kepala Sekolah', 'Pengawas', 'Operator', 'Kontak Luar'], s.segmen, 'Semua segmen') + '</select></div>' +
        '<div class="field"><label>Sekolah</label><select class="inp" id="bl-sek">' + opsi(App.boot.sekolah.map((x) => ({ v: x.SekolahID, t: x.Nama })), s.sekolahId, 'Semua sekolah') + '</select></div></div>' +
        '<div class="field"><label>Tag (opsional)</label><input class="inp" id="bl-tag" value="' + esc(s.tag) + '" placeholder="mis. MGMP-IPA"></div></div>' +
      '<div id="bl-man"' + (s.sumber === 'manual' ? '' : ' hidden') + '><div class="field"><label>Daftar nomor</label><textarea class="inp mono" id="bl-manual" rows="6" placeholder="0812xxxxxxx|Nama Penerima&#10;0813xxxxxxx|Nama Lain">' + esc(s.manual) + '</textarea><span class="bantu">Satu baris satu nomor. Format <span class="mono">nomor|nama</span> (nama opsional).</span></div></div>' +
      '<div class="row row-wrap gap-8"><button class="btn btn-dark" id="bl-muat">' + ic('users') + 'Muat Penerima</button><button class="btn btn-out" id="bl-cek">' + ic('smartphone') + 'Deteksi Nomor WA</button></div>' +
      '<div id="bl-aud" class="mt-16"></div></div></div>' +
    '<div class="card"><div class="card-head"><div><h3><span class="langkah">2</span> Tulis Pesan</h3><div class="sub">Gunakan variabel agar pesan terasa personal.</div></div></div><div class="card-body">' +
      '<div class="field"><label>Judul blast (internal)</label><input class="inp" id="bl-judul" value="' + esc(_nt.judul) + '" placeholder="mis. Pengingat unggah perangkat Oktober"></div>' +
      '<div class="field"><label class="row row-between" style="width:100%"><span>Isi pesan</span><span class="tiny muted" id="bl-jml">0 karakter</span></label>' +
        '<div class="row row-wrap gap-4 mb-8">' + ['{nama}', '{sekolah}', '{mapel}', '{institusi}', '{link}'].map((v) => '<span class="kbd" data-v="' + v + '">' + v + '</span>').join('') + '</div>' +
        '<textarea class="inp" id="bl-pesan" rows="7" placeholder="Assalamu\'alaikum {nama}, ...">' + esc(_nt.pesan) + '</textarea>' +
        '<label class="check mt-8"><input type="checkbox" id="bl-stop"' + (_nt.stop ? ' checked' : '') + '> Tambahkan “Balas STOP untuk berhenti.”</label></div>' +
      '<div class="small sb6 mb-8">Pratinjau <span class="muted" id="bl-pv-nama"></span></div><div class="wa-preview" id="bl-pv"><span class="muted">Pesan akan tampil di sini…</span></div>' +
      '<div class="hr"></div><h3 style="font-size:16px" class="mb-16"><span class="langkah">3</span> Ukuran Batch &amp; Jeda</h3>' +
      '<div class="row row-wrap gap-16 row-top"><div class="field"><label>Pesan per batch</label><div class="seg" id="bl-batch">' + [10, 20, 50].map((n) => '<button data-b="' + n + '" class="' + (n === _nt.batch ? 'on' : '') + '">' + n + '</button>').join('') + '</div></div>' +
        '<div class="field" style="max-width:160px"><label>Jeda (detik)</label><input class="inp" id="bl-jeda" value="' + esc(_nt.jeda) + '" placeholder="5 / 3-8"></div></div>' +
      '<div class="soft small mb-16" id="bl-ring">Muat penerima terlebih dahulu.</div>' +
      '<button class="btn btn-pri btn-lg btn-block" id="bl-mulai" disabled>' + ic('rocket') + 'Mulai Blast</button>' +
      '<p class="tiny muted mt-12" style="margin-bottom:0">Tips anti-blokir: gunakan nomor yang sudah “hangat”, mulai dari batch 10, jeda acak ≥ 5 detik, hindari tautan sama ke ratusan orang dalam 1 jam.</p></div></div></div>' +
    '<div id="bl-aktif" class="mt-24"></div>' +
    '<div class="sec-h"><div><h2>' + ic('history') + 'Riwayat Blast</h2><div class="sub">Server tetap mengirim 1 batch per menit walau halaman ditutup.</div></div><button class="btn btn-out btn-icon" id="bl-segar" title="Muat ulang">' + ic('refresh-cw') + '</button></div><div class="card" id="bl-riw">' + skeleton(3, 44) + '</div>';

  // ---- sasaran
  $$('#bl-sumber button', isi).forEach((b) => (b.onclick = () => { s.sumber = b.dataset.s; $$('#bl-sumber button', isi).forEach((x) => x.classList.toggle('on', x === b)); $('#bl-crm', isi).hidden = s.sumber !== 'crm'; $('#bl-man', isi).hidden = s.sumber !== 'manual'; }));
  const ix = $('#bl-ids-x', isi); if (ix) ix.onclick = (e) => { e.preventDefault(); _nt.ids = null; _nt.aud = null; App.segarkanHalaman(); };
  const eligible = (r) => r.valid && !r.ganda && !r.optOut && (!_nt.hanyaWA || r.statusWA === 'Terdaftar');
  const terpilih = () => (_nt.aud ? _nt.aud.rows.filter((r) => eligible(r) && !_nt.mati[r.hp]) : []);
  const pesanAkhir = () => { const p = $('#bl-pesan', isi).value.trim(); return p + (_nt.stop && p ? '\n\nBalas STOP untuk berhenti.' : ''); };
  const gambarAud = () => {
    const box = $('#bl-aud', isi), a = _nt.aud;
    if (!a) { box.innerHTML = ''; ringkas(); return; }
    const g = a.ringkas, tp = terpilih();
    box.innerHTML = '<div class="row row-wrap gap-8 mb-12"><span class="chip chip-sm">Total ' + g.total + '</span><span class="chip chip-sm chip-mint">Valid ' + g.valid + '</span>' + (g.tidakValid ? '<span class="chip chip-sm chip-gold">Tidak valid ' + g.tidakValid + '</span>' : '') +
      (g.ganda ? '<span class="chip chip-sm chip-gold">Ganda ' + g.ganda + '</span>' : '') + (g.optOut ? '<span class="chip chip-sm">Opt-out ' + g.optOut + '</span>' : '') + '<span class="chip chip-sm">✓ WA ' + g.terdaftarWA + '</span></div>' +
      '<label class="check mb-12"><input type="checkbox" id="bl-hanya"' + (_nt.hanyaWA ? ' checked' : '') + '> Kirim hanya ke nomor terdeteksi WhatsApp</label>' +
      '<div class="tbl-wrap" style="max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:10px"><table class="tbl compact"><thead><tr><th style="width:36px"><input type="checkbox" id="bl-semua" checked aria-label="Pilih semua"></th><th>Penerima</th><th>Nomor</th><th>WA</th></tr></thead><tbody>' +
      a.rows.map((r) => { const ok = eligible(r); return '<tr class="' + (ok ? '' : 'redup') + '"><td><input type="checkbox" data-hp="' + esc(r.hp) + '"' + (ok && !_nt.mati[r.hp] ? ' checked' : '') + (ok ? '' : ' disabled') + '></td><td><div class="sb6 trunc" style="max-width:200px">' + esc(r.nama || '-') + '</div><div class="tiny muted">' + esc([r.segmen, r.sekolah].filter(Boolean).join(' • ')) + '</div></td>' +
        '<td class="mono small">' + esc(r.hp || '-') + (!r.valid ? ' <span class="tiny" style="color:var(--k)">tidak valid</span>' : r.ganda ? ' <span class="tiny muted">ganda</span>' : r.optOut ? ' <span class="tiny muted">opt-out</span>' : '') + '</td><td>' + badgeWA(r.statusWA) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="small muted mt-8"><b>' + tp.length + '</b> nomor akan dikirimi.</div>';
    $('#bl-hanya', box).onchange = (e) => { _nt.hanyaWA = e.target.checked; gambarAud(); };
    $('#bl-semua', box).onchange = (e) => { a.rows.forEach((r) => { if (eligible(r)) _nt.mati[r.hp] = !e.target.checked; }); gambarAud(); };
    $$('[data-hp]', box).forEach((c) => (c.onchange = () => { _nt.mati[c.dataset.hp] = !c.checked; ringkas(); box.querySelector('.mt-8 b').textContent = terpilih().length; }));
    ringkas();
  };
  const ringkas = () => {
    const n = terpilih().length, b = _nt.batch, nb = Math.ceil(n / b), menit = Math.max(nb, Math.ceil(n * rataJeda(_nt.jeda) / 60));
    $('#bl-ring', isi).innerHTML = n ? '<b>' + n + '</b> penerima → <b>' + nb + '</b> batch × ' + b + ' · ±' + menit + ' menit (1 batch per menit, jeda ' + esc(_nt.jeda) + ' dtk)' : (_nt.aud ? 'Tidak ada penerima yang memenuhi syarat.' : 'Muat penerima terlebih dahulu.');
    const btn = $('#bl-mulai', isi); btn.disabled = !n; btn.innerHTML = ic('rocket') + 'Mulai Blast' + (n ? ' (' + n + ' nomor)' : '');
    pratinjau();
  };
  const pratinjau = () => {
    const p = pesanAkhir(), r = terpilih()[0] || {}, v = Object.assign(CONTOH_VAR(), { nama: r.nama || 'Bapak/Ibu', sekolah: r.sekolah || '', mapel: r.mapel || '' });
    $('#bl-jml', isi).textContent = p.length + ' karakter';
    $('#bl-pv', isi).innerHTML = p ? waHtml(isiVar(p, v)) : '<span class="muted">Pesan akan tampil di sini…</span>';
    $('#bl-pv-nama', isi).textContent = r.nama ? '(untuk ' + r.nama + ')' : '';
  };
  $('#bl-muat', isi).onclick = (e) => sibuk(e.currentTarget, async () => {
    Object.assign(s, { segmen: $('#bl-seg', isi).value, sekolahId: $('#bl-sek', isi).value, tag: $('#bl-tag', isi).value.trim(), manual: $('#bl-manual', isi).value });
    if (s.sumber === 'manual' && !s.manual.trim()) return toast('Isi daftar nomor terlebih dahulu.', 'error');
    const r = await api('wa.audience', s.sumber === 'manual' ? { sumber: 'manual', manual: s.manual } : { segmen: s.segmen, sekolahId: s.sekolahId, tag: s.tag, ids: _nt.ids || undefined });
    if (!r.success) return toast(r.message, 'error');
    _nt.aud = r.data; _nt.mati = {}; gambarAud();
    if (!r.data.rows.length) toast('Tidak ada kontak yang cocok dengan filter.', 'warn');
  }, 'Memuat…');
  $('#bl-cek', isi).onclick = (e) => {
    if (!_nt.aud) return toast('Muat penerima terlebih dahulu.', 'warn');
    const nomor = _nt.aud.rows.filter((r) => r.valid && !r.ganda && !r.statusWA).map((r) => r.hp);
    if (!nomor.length) return toast('Semua nomor valid sudah dicek.');
    const btn = e.currentTarget;
    sibuk(btn, async () => {
      for (let i = 0; i < nomor.length; i += 50) {
        btn.innerHTML = '<span class="spin"></span> Mengecek ' + Math.min(i + 50, nomor.length) + '/' + nomor.length + '…';
        const r = await api('wa.validate', { nomor: nomor.slice(i, i + 50) });
        if (!r.success) { toast(r.message, 'error'); break; }
        const h = r.data.hasil || {};
        _nt.aud.rows.forEach((x) => { if (h[x.hp]) x.statusWA = h[x.hp]; });
        _nt.aud.ringkas.terdaftarWA = _nt.aud.rows.filter((x) => x.statusWA === 'Terdaftar').length;
        _nt.aud.ringkas.tidakTerdaftarWA = _nt.aud.rows.filter((x) => x.statusWA === 'Tidak Terdaftar').length;
        gambarAud();
      }
      hapusCacheCrm();
    });
  };
  // ---- pesan & batch
  $$('[data-v]', isi).forEach((v) => (v.onclick = () => { const ta = $('#bl-pesan', isi), p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + v.dataset.v + ta.value.slice(ta.selectionEnd || p); ta.focus(); _nt.pesan = ta.value; pratinjau(); }));
  $('#bl-pesan', isi).oninput = (e) => { _nt.pesan = e.target.value; pratinjau(); };
  $('#bl-judul', isi).oninput = (e) => (_nt.judul = e.target.value);
  $('#bl-stop', isi).onchange = (e) => { _nt.stop = e.target.checked; pratinjau(); };
  $$('#bl-batch button', isi).forEach((b) => (b.onclick = () => { _nt.batch = Number(b.dataset.b); $$('#bl-batch button', isi).forEach((x) => x.classList.toggle('on', x === b)); ringkas(); }));
  $('#bl-jeda', isi).oninput = (e) => { _nt.jeda = e.target.value.trim(); ringkas(); };
  $('#bl-mulai', isi).onclick = async (e) => {
    const btn = e.currentTarget, tp = terpilih(), pesan = pesanAkhir();
    if (pesan.length < 5) return toast('Isi pesan terlebih dahulu.', 'error');
    if (!/^\d{1,3}(-\d{1,3})?$/.test(_nt.jeda)) return toast('Format jeda: 5 atau 3-8.', 'error');
    if (!(await konfirmasi('Mulai blast ke ' + tp.length + ' nomor?', 'Pesan dikirim bertahap ' + _nt.batch + ' nomor per batch dengan jeda ' + esc(_nt.jeda) + ' detik. Blast bisa dihentikan kapan saja.', { ya: 'Mulai Blast' }))) return;
    sibuk(btn, async () => {
      const sasaran = s.sumber === 'manual' ? 'Nomor manual' : (_nt.ids ? _nt.ids.length + ' kontak CRM terpilih' : [s.segmen || 'Semua segmen', s.sekolahId ? App.namaSekolah(s.sekolahId) : '', s.tag ? 'tag ' + s.tag : ''].filter(Boolean).join(' • '));
      const r = await api('wa.blastCreate', { judul: _nt.judul, pesan, sasaran, ukuranBatch: _nt.batch, jeda: _nt.jeda, penerima: tp.map((x) => ({ id: x.id, hp: x.hp, nama: x.nama, sekolah: x.sekolah || '', mapel: x.mapel || '' })) });
      if (!hasilToast(r)) return;
      _nt.aud = null; _nt.ids = null; _nt.pesan = ''; _nt.judul = ''; _nt.mati = {};
      _nt.auto[r.data.blast.BlastID] = true;
      Store.del(uKey('notifBlast'));
      App.segarkanHalaman();
    }, 'Membuat antrean…');
  };
  // ---- progres & riwayat
  const gambarRiw = (d) => {
    if (!isi.isConnected) return;
    const rows = (d['wa.blastList'] && d['wa.blastList'].rows) || [], cfg = d['notif.config'];
    if (cfg && !cfg.adaToken) $('#bl-warn', isi).innerHTML = '<div class="callout red mb-16">' + ic('circle-alert') + '<span>Token Fonnte belum diisi. Buka <a href="#/pengaturan/notifikasi/konfigurasi">Konfigurasi</a> untuk menghubungkan nomor WhatsApp.</span></div>';
    else if (cfg && !cfg.triggerAktif) $('#bl-warn', isi).innerHTML = '<div class="callout gold mb-16">' + ic('timer') + '<span>Trigger latar belum aktif — blast hanya terkirim saat tombol “Kirim Batch Berikutnya” ditekan. Pasang di <a href="#/pengaturan/sistem">Sistem</a>.</span></div>';
    const jalan = rows.filter((b) => b.Status === 'Berjalan');
    $('#bl-aktif', isi).innerHTML = jalan.map((b) => '<div class="card card-pad blast-aktif mb-16" data-b="' + esc(b.BlastID) + '"><div class="row row-wrap row-between gap-8"><div><div class="eyebrow">Blast berjalan • ' + esc(b.BlastID) + '</div><div class="b" style="font-size:17px">' + esc(b.Judul) + '</div><div class="small muted">' + esc(b.Sasaran || '') + ' · batch ' + b.UkuranBatch + ' · jeda ' + esc(b.JedaDetik) + ' dtk</div></div>' +
      '<div class="row gap-8 row-wrap"><label class="switch"><input type="checkbox" data-auto' + (_nt.auto[b.BlastID] ? ' checked' : '') + '><span class="trk"></span>Otomatis <span class="tiny muted" data-cd></span></label><button class="btn btn-pri btn-sm" data-kirim>' + ic('play') + 'Kirim Batch Berikutnya</button><button class="btn btn-danger btn-sm" data-stop>' + ic('square') + 'Hentikan</button></div></div>' +
      '<div class="mt-16">' + bar(b.persen, 'bar-lg') + '</div><div class="row row-wrap gap-16 mt-12 small"><span><b>' + b.persen + '%</b></span><span style="color:var(--sb)">✓ ' + b.Terkirim + ' terkirim</span><span style="color:var(--k)">✕ ' + b.Gagal + ' gagal</span><span class="muted">' + b.sisa + ' sisa dari ' + b.Total + '</span></div></div>').join('');
    $('#bl-riw', isi).innerHTML = rows.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Blast</th><th>Sasaran</th><th>Batch · jeda</th><th style="min-width:160px">Progres</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map((b) =>
      '<tr><td><div class="sb6">' + esc(b.Judul) + '</div><div class="tiny muted">' + fWaktu(b.Tanggal) + ' • ' + esc(b.DibuatOleh || '') + '</div></td><td class="small">' + esc(b.Sasaran || '-') + '</td><td class="small">' + b.UkuranBatch + ' · ' + esc(b.JedaDetik) + ' dtk</td>' +
      '<td>' + bar(b.persen) + '<div class="tiny muted mt-8">' + b.Terkirim + ' terkirim · ' + b.Gagal + ' gagal · ' + b.sisa + ' sisa</div></td><td><span class="badge ' + ({ Berjalan: 'st-wait', Selesai: 'st-ok', Dihentikan: 'st-mute' }[b.Status] || 'st-info') + '">' + esc(b.Status) + '</span></td>' +
      '<td class="right">' + (b.Status === 'Berjalan' ? '<button class="btn btn-ghost btn-sm" data-stop-r="' + esc(b.BlastID) + '">' + ic('square') + 'Hentikan</button>' : '<a class="btn btn-ghost btn-sm" href="#/pengaturan/notifikasi/antrean">' + ic('eye') + 'Pantau</a>') + '</td></tr>').join('') + '</tbody></table></div>'
      : kosong('Belum ada blast', 'Blast WhatsApp yang dibuat akan tampil di sini.', '', 'megaphone');
    const terapkan = (res) => { if (res.success) { const lama = Store.get(uKey('notifBlast'), { data: {} }).data || {}; lama['wa.blastList'] = res.data; Store.set(uKey('notifBlast'), { t: Date.now(), h: '', data: lama }); gambarRiw(lama); } else toast(res.message, 'error'); };
    const hentikan = async (id) => { if (!(await konfirmasi('Hentikan blast?', 'Pesan yang belum terkirim dibatalkan. Yang sudah terkirim tidak terpengaruh.', { bahaya: true, ya: 'Hentikan' }))) return; delete _nt.auto[id]; terapkan(await api('wa.blastStop', { blastId: id })); };
    $$('.blast-aktif', isi).forEach((c) => {
      const id = c.dataset.b, b = jalan.find((x) => x.BlastID === id);
      c.querySelector('[data-kirim]').onclick = (e) => sibuk(e.currentTarget, async () => terapkan(await api('wa.blastProcess', { blastId: id })), 'Mengirim…');
      c.querySelector('[data-stop]').onclick = () => hentikan(id);
      c.querySelector('[data-auto]').onchange = (e) => { _nt.auto[id] = e.target.checked; if (e.target.checked) jalankanAuto(id, Math.max(30, b.UkuranBatch * rataJeda(b.JedaDetik))); };
      if (_nt.auto[id]) jalankanAuto(id, Math.max(30, b.UkuranBatch * rataJeda(b.JedaDetik)));
    });
    $$('[data-stop-r]', isi).forEach((x) => (x.onclick = () => hentikan(x.dataset.stopR)));
    function jalankanAuto(id, detik) {
      if (_nt.timer && _nt.timer.id === id) return;
      if (_nt.timer) clearInterval(_nt.timer.h);
      let sisa = Math.round(detik);
      const h = setInterval(async () => {
        const c = isi.querySelector('.blast-aktif[data-b="' + id + '"]');
        if (!isi.isConnected || !c || !_nt.auto[id]) { clearInterval(h); if (_nt.timer && _nt.timer.h === h) _nt.timer = null; return; }
        sisa--; const cd = c.querySelector('[data-cd]'); if (cd) cd.textContent = sisa > 0 ? '(' + sisa + ' dtk)' : '(mengirim…)';
        if (sisa === 0) { clearInterval(h); _nt.timer = null; terapkan(await api('wa.blastProcess', { blastId: id })); }
      }, 1000);
      _nt.timer = { id, h };
    }
  };
  const muatRiw = (paksa) => swrBatch('notifBlast', [{ action: 'wa.blastList' }, { action: 'notif.config' }], gambarRiw, { fresh: 10000, force: paksa,
    onError: (r) => ($('#bl-riw', isi).innerHTML = kosong('Gagal memuat riwayat', esc(r.message), '', 'wifi-off')) });
  muatRiw(false);
  $('#bl-segar', isi).onclick = (e) => sibuk(e.currentTarget, () => muatRiw(true));
  gambarAud();
  if (_nt.ids && !_nt.aud) $('#bl-muat', isi).click();          // datang dari CRM "Blast ke Terpilih"
}

// ============================================================================ CRM KONTAK
let _crm = { cari: '', segmen: '', sumber: '', tag: '', statusWA: '', emailValid: '', optOut: '', duplikat: false, tanpaKontak: false, halaman: 1, pilih: {}, rows: [] };
const SUMBER_LABEL = { guru: 'Guru', kepala: 'Kepala Sekolah', pengawas: 'Pengawas', operator: 'Operator', manual: 'Manual' };
function hapusCacheCrm() { try { Object.keys(localStorage).filter((k) => k.indexOf(LS + uKey('crm:')) === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* abaikan */ } }
function paramCrm() { const c = _crm; return { cari: c.cari, segmen: c.segmen, sumber: c.sumber, tag: c.tag, statusWA: c.statusWA, emailValid: c.emailValid, optOut: c.optOut, duplikat: c.duplikat || undefined, tanpaKontak: c.tanpaKontak || undefined, halaman: c.halaman, per: 50 }; }

function tabCrm(box) {
  box.innerHTML = '<div class="row row-wrap gap-8 mb-16"><div class="small muted" id="crm-sync">Sinkron terakhir: -</div><span class="grow"></span>' +
    '<button class="btn btn-out btn-sm" id="crm-sinkron">' + ic('refresh-cw') + 'Sinkron Sekarang</button><button class="btn btn-out btn-sm" id="crm-impor">' + ic('upload') + 'Impor CSV</button>' +
    '<button class="btn btn-out btn-sm" id="crm-dup">' + ic('copy') + 'Periksa Duplikat</button><button class="btn btn-out btn-sm" id="crm-ekspor">' + ic('download') + 'Ekspor</button></div>' +
    '<div class="cols-6 mb-16" id="crm-kpi">' + skeleton(1, 92).repeat(6) + '</div><div class="row row-wrap gap-8 mb-16" id="crm-seg"></div>' +
    '<div class="card"><div class="card-body" style="padding-bottom:0"><div class="filters"><div class="inp-ic cari grow">' + ic('search') + '<input class="inp inp-soft" id="crm-q" placeholder="Cari nama, email, nomor, tag…" value="' + esc(_crm.cari) + '"></div>' +
      '<select class="inp" id="crm-sumber">' + opsi(Object.keys(SUMBER_LABEL).map((k) => ({ v: k, t: SUMBER_LABEL[k] })), _crm.sumber, 'Semua sumber') + '</select>' +
      '<select class="inp" id="crm-wa">' + opsi([{ v: 'Terdaftar', t: '✓ Terdaftar WA' }, { v: 'Tidak Terdaftar', t: '✕ Bukan WA' }, { v: 'Belum', t: '? Belum dicek' }], _crm.statusWA, 'Status WA') + '</select>' +
      '<select class="inp" id="crm-em">' + opsi([{ v: 'YA', t: 'Email valid' }, { v: 'TIDAK', t: 'Email tidak valid' }], _crm.emailValid, 'Status email') + '</select>' +
      '<select class="inp" id="crm-oo">' + opsi([{ v: 'TIDAK', t: 'Bisa dihubungi' }, { v: 'YA', t: 'Opt-out' }], _crm.optOut, 'Opt-out') + '</select>' +
      '<input class="inp" id="crm-tag" placeholder="Tag" value="' + esc(_crm.tag) + '" style="min-width:120px;max-width:160px">' +
      '<label class="check"><input type="checkbox" id="crm-tk"' + (_crm.tanpaKontak ? ' checked' : '') + '> Tanpa kontak</label></div></div>' +
    '<div id="crm-bulk"></div><div id="crm-tbl">' + skeleton(5, 48) + '</div></div>';

  const muat = (paksa) => {
    const p = paramCrm(), key = 'crm:' + hashStr(JSON.stringify(p));
    if (!Store.get(uKey(key), null)) $('#crm-tbl', box).style.opacity = '.55';
    return swrBatch(key, [{ action: 'crm.stats' }, { action: 'crm.list', data: p }], (d) => { if (box.isConnected) { $('#crm-tbl', box).style.opacity = ''; gambar(d); } }, { fresh: 20000, force: paksa,
      onError: (r) => { $('#crm-tbl', box).style.opacity = ''; $('#crm-tbl', box).innerHTML = kosong('Gagal memuat kontak', esc(r.message), '', 'wifi-off'); } });
  };
  const ulang = () => { hapusCacheCrm(); return muat(true); };
  const gambar = (d) => {
    const s = d['crm.stats'], l = d['crm.list'];
    if (s) {
      $('#crm-sync', box).innerHTML = ic('clock') + ' Sinkron terakhir: <b>' + (s.syncTerakhir ? lalu(new Date(s.syncTerakhir).toISOString()) : 'belum pernah') + '</b> · otomatis tiap ' + esc(App.setting('CRM_SYNC_MENIT', '30')) + ' menit';
      const K = [['total', 'Total Kontak', 'contact', {}], ['terdaftarWA', 'WA Terverifikasi', 'circle-check', { statusWA: 'Terdaftar' }], ['emailValid', 'Email Valid', 'mail', { emailValid: 'YA' }],
        ['belumCekWA', 'Belum Dicek WA', 'circle-help', { statusWA: 'Belum' }], ['optOut', 'Opt-out', 'circle-slash', { optOut: 'YA' }], ['duplikat', 'Duplikat', 'copy', { duplikat: true }]];
      $('#crm-kpi', box).innerHTML = K.map((k) => { const on = Object.keys(k[3]).length && Object.keys(k[3]).every((x) => _crm[x] === k[3][x]);
        return '<button class="card kpi kpi-kecil kpi-klik' + (on ? ' on' : '') + '" data-kpi="' + k[0] + '"><div class="t"><span>' + k[1] + '</span><span class="ico ' + (k[0] === 'terdaftarWA' ? 'mint' : k[0] === 'duplikat' || k[0] === 'belumCekWA' ? 'gold' : '') + '">' + ic(k[2]) + '</span></div><div class="v">' + angka(s[k[0]]) + '</div></button>'; }).join('');
      $$('[data-kpi]', box).forEach((b) => (b.onclick = () => { const k = K.find((x) => x[0] === b.dataset.kpi); Object.assign(_crm, { statusWA: '', emailValid: '', optOut: '', duplikat: false, halaman: 1 }, b.classList.contains('on') ? {} : k[3]); App.segarkanHalaman(); }));
      const seg = s.segmen || {};
      $('#crm-seg', box).innerHTML = '<button class="chip ' + (!_crm.segmen ? 'chip-brand' : 'chip-out') + '" data-seg="">Semua <b>' + angka(s.total) + '</b></button>' + Object.keys(seg).sort().map((k) => '<button class="chip ' + (_crm.segmen === k ? 'chip-brand' : 'chip-out') + '" data-seg="' + esc(k) + '">' + esc(k) + ' <b>' + angka(seg[k]) + '</b></button>').join('');
      $$('[data-seg]', box).forEach((b) => (b.onclick = () => { _crm.segmen = b.dataset.seg; _crm.halaman = 1; App.segarkanHalaman(); }));
    }
    if (l) { _crm.rows = l.rows; _crm.last = l; gambarTabel(l); }
  };
  const gambarTabel = (l) => {
    const t = $('#crm-tbl', box), rows = l.rows;
    t.innerHTML = rows.length ? (_crm.duplikat ? '<div class="callout gold" style="margin:12px 22px">' + ic('copy') + '<div class="grow">Menampilkan kontak dengan nomor/email sama. <button class="btn btn-gold btn-xs" id="crm-gab">' + ic('merge') + 'Gabungkan duplikat di halaman ini</button></div></div>' : '') +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:36px"><input type="checkbox" id="crm-all" aria-label="Pilih semua"' + (rows.every((r) => _crm.pilih[r.KontakID]) ? ' checked' : '') + '></th><th>Kontak</th><th>Email</th><th>WhatsApp</th><th>Tag</th><th>Terakhir dihubungi</th><th class="center">Pesan</th><th></th></tr></thead><tbody>' +
      rows.map((k) => { const masalah = !k.waValid || k.EmailValid === 'TIDAK' || k.duplikat;
        return '<tr class="' + (masalah ? 'warn ' : '') + (_crm.pilih[k.KontakID] ? 'pilih' : '') + '"><td><input type="checkbox" data-pk="' + esc(k.KontakID) + '"' + (_crm.pilih[k.KontakID] ? ' checked' : '') + '></td>' +
          '<td><div class="row gap-12">' + avatar(k.Nama, 'av-sm ' + (k.Segmen === 'Guru' ? 'av-mint' : '')) + '<div class="grow"><div class="nm trunc" style="max-width:220px">' + esc(k.Nama) + '</div><div class="row gap-4 row-wrap"><span class="chip chip-sm">' + esc(k.Segmen) + '</span>' + (k.OptOut === 'YA' ? '<span class="chip chip-sm chip-gold">opt-out</span>' : '') + (k.duplikat ? '<span class="chip chip-sm chip-gold">duplikat</span>' : '') + '</div>' + (k.sekolah ? '<div class="tiny muted trunc" style="max-width:220px">' + esc(k.sekolah) + '</div>' : '') + '</div></div></td>' +
          '<td class="small">' + (k.Email ? esc(k.Email) + ' ' + (k.EmailValid === 'YA' ? '<span style="color:var(--sb)">' + ic('circle-check') + '</span>' : '<span style="color:var(--gold-ink)" title="Email tidak valid">' + ic('triangle-alert') + '</span>') : '<span class="muted">—</span>') + '</td>' +
          '<td class="small">' + (k.NoWA ? '<span class="mono">' + esc(k.NoWA) + '</span> ' + badgeWA(k.StatusWA) + (k.waValid ? ' <a href="https://wa.me/' + esc(k.NoWA.replace(/^0/, '62')) + '" target="_blank" rel="noopener" title="Buka WhatsApp">' + ic('external-link') + '</a>' : '') : '<span class="muted">—</span>') + '</td>' +
          '<td>' + String(k.Tag || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => '<span class="chip chip-sm chip-out">' + esc(x) + '</span>').join(' ') + '</td>' +
          '<td class="small muted">' + (k.TerakhirDihubungi ? lalu(k.TerakhirDihubungi) : '—') + '</td><td class="center">' + angka(k.JumlahPesan) + '</td>' +
          '<td class="right"><button class="btn btn-ghost btn-sm" data-detail="' + esc(k.KontakID) + '">Detail</button></td></tr>'; }).join('') + '</tbody></table></div>' + pager(l.total, l.halaman, l.per)
      : kosong('Tidak ada kontak', 'Ubah filter, atau klik Sinkron Sekarang untuk menarik kontak dari data pengguna.', '', 'contact');
    pasangPager(t, (p) => { _crm.halaman = p; muat(false); });
    const all = $('#crm-all', t); if (all) all.onchange = () => { rows.forEach((r) => { if (all.checked) _crm.pilih[r.KontakID] = r; else delete _crm.pilih[r.KontakID]; }); gambarTabel(l); gambarBulk(); };
    $$('[data-pk]', t).forEach((c) => (c.onchange = () => { const r = rows.find((x) => x.KontakID === c.dataset.pk); if (c.checked) _crm.pilih[r.KontakID] = r; else delete _crm.pilih[r.KontakID]; c.closest('tr').classList.toggle('pilih', c.checked); gambarBulk(); }));
    $$('[data-detail]', t).forEach((b) => (b.onclick = () => detailKontak(b.dataset.detail, ulang)));
    const g = $('#crm-gab', t); if (g) g.onclick = () => gabungDuplikat(rows, ulang);
    gambarBulk();
  };
  const gambarBulk = () => {
    const ids = Object.keys(_crm.pilih), b = $('#crm-bulk', box);
    if (!ids.length) { b.innerHTML = ''; return; }
    b.innerHTML = '<div class="bulk-bar"><b>' + ids.length + ' dipilih</b><button class="btn btn-out btn-xs" data-bk="cek">' + ic('smartphone') + 'Deteksi WA</button><button class="btn btn-out btn-xs" data-bk="tag">' + ic('tag') + 'Beri Tag</button><button class="btn btn-out btn-xs" data-bk="untag">' + ic('tags') + 'Hapus Tag</button>' +
      '<button class="btn btn-pri btn-xs" data-bk="blast">' + ic('megaphone') + 'Blast ke Terpilih</button><button class="btn btn-out btn-xs" data-bk="optout">' + ic('circle-slash') + 'Opt-out</button><button class="btn btn-out btn-xs" data-bk="optin">' + ic('circle-check') + 'Opt-in</button>' +
      '<button class="btn btn-out btn-xs" data-bk="csv">' + ic('download') + 'Ekspor</button><button class="btn btn-ghost btn-xs" data-bk="hapusManual" style="color:var(--k)">' + ic('trash-2') + 'Hapus manual</button><span class="grow"></span><button class="btn btn-ghost btn-xs" data-bk="batal">' + ic('x') + 'Batal pilih</button></div>';
    $$('[data-bk]', b).forEach((x) => (x.onclick = (e) => aksiMassal(x.dataset.bk, e.currentTarget)));
  };
  const aksiMassal = async (aksi, btn) => {
    const rows = Object.values(_crm.pilih), ids = rows.map((r) => r.KontakID);
    if (aksi === 'batal') { _crm.pilih = {}; return App.segarkanHalaman(); }
    if (aksi === 'csv') return unduhTeks('kontak-terpilih-' + isoHari() + '.csv', keCsv(rows.map((k) => ({ Nama: k.Nama, Email: k.Email, WhatsApp: k.NoWA, Segmen: k.Segmen, Sekolah: k.sekolah, Tag: k.Tag, StatusWA: k.StatusWA, OptOut: k.OptOut }))));
    if (aksi === 'blast') { _nt.ids = ids; _nt.aud = null; _nt.src.sumber = 'crm'; _crm.pilih = {}; return go('pengaturan/notifikasi/blast'); }
    if (aksi === 'cek') {
      const nomor = rows.filter((r) => r.waValid).map((r) => r.NoWA);
      if (!nomor.length) return toast('Tidak ada nomor valid di pilihan.', 'warn');
      return sibuk(btn, async () => { let n = 0; for (let i = 0; i < nomor.length; i += 50) { const r = await api('wa.validate', { nomor: nomor.slice(i, i + 50) }); if (!r.success) { toast(r.message, 'error'); break; } n += r.data.dicek; } if (n) toast(n + ' nomor dicek.'); await ulang(); });
    }
    let nilai = '';
    if (aksi === 'tag' || aksi === 'untag') { nilai = await tanya(aksi === 'tag' ? 'Beri Tag' : 'Hapus Tag', 'Nama tag', { wajib: true, ph: 'mis. MGMP-IPA', ya: aksi === 'tag' ? 'Beri Tag' : 'Hapus Tag' }); if (!nilai) return; }
    if (aksi === 'hapusManual' && !(await konfirmasi('Hapus kontak manual?', 'Hanya kontak hasil impor manual yang dihapus. Kontak dari data pengguna tetap ada.', { bahaya: true, ya: 'Hapus' }))) return;
    // optimistis: ubah tampilan lebih dulu, kembalikan bila gagal
    const cadangan = rows.map((r) => Object.assign({}, r));
    rows.forEach((r) => {
      const tags = String(r.Tag || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (aksi === 'tag' && tags.indexOf(nilai) < 0) r.Tag = tags.concat(nilai).join(', ');
      if (aksi === 'untag') r.Tag = tags.filter((x) => x !== nilai).join(', ');
      if (aksi === 'optout') r.OptOut = 'YA'; if (aksi === 'optin') r.OptOut = 'TIDAK';
    });
    if (_crm.last) gambarTabel(_crm.last);
    const r = await api('crm.bulk', { aksi, ids, nilai });
    if (!r.success) { cadangan.forEach((c) => Object.assign(_crm.pilih[c.KontakID] || {}, c)); toast(r.message, 'error'); return muat(false); }
    toast(r.message); _crm.pilih = {}; ulang();
  };

  muat(false);
  $('#crm-q', box).oninput = debounce((e) => { _crm.cari = e.target.value.trim(); _crm.halaman = 1; muat(false); }, 350);
  const ubah = (id, k) => ($(id, box).onchange = (e) => { _crm[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim(); _crm.halaman = 1; muat(false); });
  ubah('#crm-sumber', 'sumber'); ubah('#crm-wa', 'statusWA'); ubah('#crm-em', 'emailValid'); ubah('#crm-oo', 'optOut'); ubah('#crm-tag', 'tag'); ubah('#crm-tk', 'tanpaKontak');
  $('#crm-sinkron', box).onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('crm.sync', {}); if (hasilToast(r)) await ulang(); }, 'Sinkron…');
  $('#crm-dup', box).onclick = () => { Object.assign(_crm, { duplikat: !_crm.duplikat, halaman: 1 }); App.segarkanHalaman(); };
  $('#crm-ekspor', box).onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('crm.export', { segmen: _crm.segmen }); if (!r.success) return toast(r.message, 'error'); unduhTeks('crm-kontak-' + (_crm.segmen || 'semua') + '-' + isoHari() + '.csv', keCsv(r.data.rows)); });
  $('#crm-impor', box).onclick = () => imporKontak(ulang);
}

function detailKontak(id, setelah) {
  const m = modal({ drawer: true, judul: 'Detail Kontak', isi: skeleton(4, 60) });
  api('crm.detail', { kontakId: id }).then((r) => {
    if (!m.el.isConnected) return;
    if (!r.success) { m.el.querySelector('.modal-b').innerHTML = kosong('Gagal memuat', esc(r.message), '', 'wifi-off'); return; }
    gambar(r.data);
  });
  function gambar(d) {
    const k = d.kontak, wa = k.NoWA ? k.NoWA.replace(/^0/, '62') : '';
    m.el.querySelector('h3').textContent = k.Nama;
    m.el.querySelector('.modal-b').innerHTML = '<div class="row gap-12 mb-16">' + avatar(k.Nama, 'av-lg') + '<div class="grow"><div class="b">' + esc(k.Nama) + '</div><div class="row gap-4 row-wrap mt-8"><span class="chip chip-sm">' + esc(k.Segmen) + '</span><span class="chip chip-sm chip-out">Sumber: ' + esc(SUMBER_LABEL[k.Sumber] || k.Sumber) + '</span>' + (d.sumber ? '<span class="chip chip-sm ' + (d.sumber.Status === 'Aktif' ? 'chip-mint' : '') + '">Akun ' + esc(d.sumber.Status) + '</span>' : '') + '</div></div></div>' +
      '<div class="row row-wrap gap-8 mb-16">' + (wa ? '<a class="btn btn-out btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '">' + ic('message-circle') + 'WhatsApp</a><button class="btn btn-out btn-sm" id="dk-salin">' + ic('copy') + 'Salin nomor</button>' : '') + (k.Email ? '<a class="btn btn-out btn-sm" href="mailto:' + esc(k.Email) + '">' + ic('mail') + 'Email</a>' : '') +
        (d.sumber && d.sumber.Role === 'GURU' ? '<a class="btn btn-ghost btn-sm" href="#/guru/' + esc(d.sumber.UserID) + '">' + ic('external-link') + 'Data guru</a>' : '') + '</div>' +
      '<div id="dk-f"><div class="field"><label>Nama</label><input class="inp" name="Nama" value="' + esc(k.Nama) + '"></div><div class="grid-2"><div class="field"><label>Email</label><input class="inp" name="Email" value="' + esc(k.Email) + '"></div>' +
        '<div class="field"><label>WhatsApp ' + badgeWA(k.StatusWA) + '</label><input class="inp" name="NoWA" value="' + esc(k.NoWA) + '" inputmode="tel"></div></div>' +
        (k.Sumber !== 'manual' ? '<div class="tiny muted" style="margin:-6px 0 12px">Perubahan nama/email/nomor ditulis balik ke data pengguna (satu sumber kebenaran).</div>' : '') +
        '<div class="field"><label>Tag</label><input class="inp" name="Tag" value="' + esc(k.Tag) + '" placeholder="pisahkan dengan koma"></div><div class="field"><label>Catatan</label><textarea class="inp" name="Catatan" rows="2">' + esc(k.Catatan) + '</textarea></div>' +
        '<label class="switch mb-16"><input type="checkbox" name="OptOut"' + (k.OptOut === 'YA' ? ' checked' : '') + '><span class="trk"></span>Opt-out (tidak dikirimi blast; notifikasi transaksional tetap)</label>' +
        '<button class="btn btn-pri btn-block" id="dk-simpan">' + ic('save') + 'Simpan Kontak</button></div>' +
      '<div class="hr"></div><div class="sb6 mb-16">' + ic('history') + ' Timeline interaksi</div>' +
      '<div class="soft mb-16"><div class="row gap-8"><select class="inp" id="dk-kanal" style="max-width:140px">' + opsi(['Telepon', 'WhatsApp', 'Email', 'Tatap muka', 'Catatan']) + '</select><input class="inp grow" id="dk-ring" placeholder="Ringkasan interaksi…"><button class="btn btn-dark" id="dk-catat">Catat</button></div></div>' +
      (d.timeline.length ? '<div class="stack gap-8">' + d.timeline.map((x) => '<div class="komentar"><span class="ico-box kecil ' + (x.tipe === 'interaksi' ? 'mint' : '') + '">' + ic(x.kanal === 'WA' || x.kanal === 'WhatsApp' ? 'message-circle' : x.kanal === 'EMAIL' || x.kanal === 'Email' ? 'mail' : x.kanal === 'Telepon' ? 'phone' : 'notebook-pen') + '</span><div class="grow"><div class="small">' + esc(x.ringkasan) + '</div>' +
        '<div class="tiny muted">' + fWaktu(x.waktu) + (x.status ? ' · ' + esc(x.status) : '') + (x.event ? ' · ' + esc(x.event) : '') + (x.oleh ? ' · ' + esc(x.oleh) : '') + '</div></div></div>').join('') + '</div>' : '<div class="small muted">Belum ada interaksi tercatat.</div>');
    const s = m.el.querySelector('#dk-salin'); if (s) s.onclick = () => salin(k.NoWA);
    m.el.querySelector('#dk-simpan').onclick = (e) => sibuk(e.currentTarget, async () => {
      const f = formData(m.el.querySelector('#dk-f')); f.OptOut = f.OptOut ? 'YA' : 'TIDAK'; f.KontakID = k.KontakID;
      const r = await api('crm.save', f);
      if (!hasilToast(r)) return;
      if (k.Sumber !== 'manual') App.muatBoot(true);
      setelah && setelah();
    });
    m.el.querySelector('#dk-catat').onclick = (e) => sibuk(e.currentTarget, async () => {
      const ring = m.el.querySelector('#dk-ring').value.trim(); if (!ring) return toast('Isi ringkasan interaksi.', 'error');
      const r = await api('crm.interaksi', { kontakId: k.KontakID, kanal: m.el.querySelector('#dk-kanal').value, ringkasan: ring });
      if (!r.success) return toast(r.message, 'error');
      toast('Interaksi dicatat.'); gambar(r.data);
    });
  }
}

function gabungDuplikat(rows, setelah) {
  const grup = {}, dipakai = {};
  rows.filter((r) => r.duplikat).forEach((r) => { const k = r.NoWA || r.Email; if (k) (grup[k] = grup[k] || []).push(r); });
  const list = Object.keys(grup).filter((k) => grup[k].length > 1 && grup[k].every((r) => !dipakai[r.KontakID] && (dipakai[r.KontakID] = 1)));
  if (!list.length) return toast('Duplikat di halaman ini berada di halaman lain — gunakan pencarian nomor/email untuk menampilkannya bersama.', 'warn');
  modal({ judul: 'Gabungkan Kontak Duplikat', ukuran: 'lebar', sub: 'Pilih kontak utama di tiap grup. Tag, catatan, dan jumlah pesan digabung ke kontak utama; sisanya disembunyikan dari CRM.',
    isi: list.map((k, gi) => '<div class="soft mb-16"><div class="sb6 small mb-8 mono">' + esc(k) + '</div>' + grup[k].map((r, i) => '<label class="check mb-8"><input type="radio" name="g' + gi + '" value="' + esc(r.KontakID) + '"' + (i === 0 ? ' checked' : '') + '> <b>' + esc(r.Nama) + '</b> <span class="muted small">' + esc(r.Segmen) + ' · ' + esc(SUMBER_LABEL[r.Sumber] || r.Sumber) + ' · ' + esc(r.Email || '') + '</span></label>').join('') +
      '<button class="btn btn-gold btn-xs" data-g="' + gi + '">' + ic('merge') + 'Gabungkan grup ini</button></div>').join(''),
    kaki: '<button class="btn btn-out" data-tutup>Selesai</button>',
    onBuka: (el, tutup) => { $$('[data-g]', el).forEach((b) => (b.onclick = (e) => sibuk(e.currentTarget, async () => {
      const gi = b.dataset.g, utama = el.querySelector('input[name=g' + gi + ']:checked').value, gabung = grup[list[gi]].map((r) => r.KontakID).filter((x) => x !== utama);
      const r = await api('crm.merge', { utama, gabung });
      if (!hasilToast(r)) return;
      b.closest('.soft').innerHTML = '<div class="row gap-8 small">' + ic('circle-check') + 'Grup ' + esc(list[gi]) + ' digabung.</div>';
      setelah && setelah();
    }))); } });
}

function imporKontak(setelah) {
  let rows = [];
  modal({ judul: 'Impor Kontak dari CSV / Excel', ukuran: 'lebar',
    isi: '<div class="callout blue mb-16">' + ic('info') + '<div>Kolom: <span class="mono">nama, wa, email, segmen, tag</span>. Nomor/email yang sudah ada dilewati (tidak digandakan). Kontak dari data pengguna tidak perlu diimpor — sudah tersinkron otomatis. <a href="#" id="ik-tpl">Unduh template CSV</a></div></div>' +
      '<label class="drop" id="ik-drop">' + ic('file-spreadsheet') + '<div class="sb6 mt-8">Klik atau seret berkas .csv / .xlsx ke sini</div><div class="small" id="ik-nama">Belum ada berkas</div><input type="file" id="ik-file" accept=".csv,.xlsx,.xls,text/csv" hidden></label><div id="ik-pv" class="mt-16"></div>',
    kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="ik-ok" disabled>' + ic('upload') + 'Impor</button>',
    onBuka: (el, tutup) => {
      el.querySelector('#ik-tpl').onclick = (e) => { e.preventDefault(); unduhTeks('template-kontak.csv', 'nama,wa,email,segmen,tag\nBudi Santoso,081234567890,budi@contoh.com,Wali Murid,Kelas 7A\n'); };
      const baca = async (f) => {
        if (!f) return;
        el.querySelector('#ik-nama').textContent = f.name;
        try { rows = await bacaBerkasTabel(f); } catch (err) { return toast('Berkas tidak terbaca: ' + err.message, 'error'); }
        el.querySelector('#ik-pv').innerHTML = '<div class="small mb-8"><b>' + rows.length + '</b> baris terbaca. Pratinjau 5 baris pertama:</div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Nama</th><th>WA</th><th>Email</th><th>Segmen</th><th>Tag</th></tr></thead><tbody>' +
          rows.slice(0, 5).map((r) => '<tr><td>' + esc(r.nama || '') + '</td><td class="mono">' + esc(r.wa || r.no_wa || r.nowa || '') + '</td><td>' + esc(r.email || '') + '</td><td>' + esc(r.segmen || '') + '</td><td>' + esc(r.tag || '') + '</td></tr>').join('') + '</tbody></table></div>';
        el.querySelector('#ik-ok').disabled = !rows.length;
      };
      const drop = el.querySelector('#ik-drop'), inp = el.querySelector('#ik-file');
      inp.onchange = () => baca(inp.files[0]);
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); baca(e.dataTransfer.files[0]); };
      el.querySelector('#ik-ok').onclick = (e) => sibuk(e.currentTarget, async () => { const r = await api('crm.import', { rows }); if (!hasilToast(r)) return; tutup(true); setelah && setelah(); }, 'Mengimpor…');
    } });
}

// ============================================================================ MIGRASI DATA
let _mg = { source: '', info: null, peta: {}, ikut: {}, timpa: false, sandi: 'Apsikita#2026', hasil: null };
function tabMigrasi(box) {
  const inf = _mg.info;
  box.innerHTML = '<div class="split"><div class="stack gap-20">' +
    '<div class="card"><div class="card-head"><div><h3><span class="langkah">1</span> Spreadsheet Sumber</h3><div class="sub">Spreadsheet APSIKITA lama atau spreadsheet lain. <b>Hanya dibaca</b> — tidak ada yang diubah di sumber.</div></div></div><div class="card-body">' +
      '<div class="row gap-8"><input class="inp grow mono" id="mg-src" value="' + esc(_mg.source) + '" placeholder="https://docs.google.com/spreadsheets/d/… atau ID"><button class="btn btn-dark" id="mg-baca">' + ic('scan-search') + 'Baca Sumber</button></div>' +
      '<span class="bantu">Akun pemilik Apps Script minimal harus punya akses <b>Pelihat</b> ke spreadsheet ini.</span>' +
      (inf ? '<div class="soft mt-16"><div class="row gap-8">' + ic('table') + '<b>' + esc(inf.judul) + '</b><span class="muted small">' + inf.sheets.length + ' sheet</span></div><div class="row row-wrap gap-4 mt-8">' + inf.sheets.map((s) => '<span class="chip chip-sm chip-out" title="' + esc(s.kolom.join(', ')) + '">' + esc(s.nama) + ' · ' + angka(s.baris) + '</span>').join('') + '</div></div>' : '') + '</div></div>' +
    (inf ? '<div class="card"><div class="card-head"><div><h3><span class="langkah">2</span> Petakan Data</h3><div class="sub">Pemetaan otomatis berdasarkan nama sheet; kolom dibaca berdasarkan <b>nama kolom</b>, bukan urutan.</div></div></div><div class="card-body" style="padding:12px 0 0">' +
      '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th style="width:40px">Ikut</th><th>Data di APSIKITA</th><th>Sheet sumber</th><th class="right">Baris</th></tr></thead><tbody>' + inf.target.map((t) => {
        const sh = inf.sheets.find((x) => x.nama === _mg.peta[t.kode]);
        return '<tr><td><input type="checkbox" data-ikut="' + t.kode + '"' + (_mg.ikut[t.kode] ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--brand)"></td><td class="sb6">' + esc(t.label) + '</td>' +
          '<td><select class="inp" data-peta="' + t.kode + '" style="height:36px">' + opsi(inf.sheets.map((s) => ({ v: s.nama, t: s.nama })), _mg.peta[t.kode], '— tidak diimpor —') + '</select></td><td class="right small">' + (sh ? angka(sh.baris) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div><div style="padding:16px 22px 22px"><div class="grid-2"><div class="field"><label>Sandi awal akun hasil impor</label><input class="inp mono" id="mg-sandi" value="' + esc(_mg.sandi) + '"><span class="bantu">Untuk akun baru tanpa sandi; wajib diganti saat masuk pertama.</span></div>' +
      '<div class="field"><label>Data yang sudah ada</label><label class="switch" style="min-height:42px"><input type="checkbox" id="mg-timpa"' + (_mg.timpa ? ' checked' : '') + '><span class="trk"></span>Timpa dengan data sumber</label><span class="bantu">Mati (disarankan): data yang sudah diubah di APSIKITA baru tidak ditimpa.</span></div></div>' +
      '<div class="row row-wrap gap-8"><button class="btn btn-out" id="mg-pindai">' + ic('scan-search') + 'Pindai (Dry-run)</button><button class="btn btn-pri" id="mg-jalan">' + ic('database-zap') + 'Jalankan Impor</button></div></div></div></div>' : '') +
    '<div id="mg-hasil"></div></div>' +
    '<div class="stack gap-20"><div class="card card-pad"><div class="sb6 mb-16">' + ic('shield-check') + ' Prinsip migrasi aman</div><ul class="small muted" style="margin:0;padding-left:18px;line-height:1.75">' +
      '<li>Sumber <b>hanya dibaca</b>.</li><li>Kolom dicocokkan berdasarkan <b>nama</b> (Email, NIP, NPSN, Nama…), bukan posisi.</li><li>Data dicocokkan dengan <b>kunci alami</b> (email pengguna, NPSN/nama sekolah, nama periode) → aman dijalankan berulang (<b>delta sync</b>), tidak membuat data ganda.</li>' +
      '<li>Selalu <b>Pindai</b> dulu: menghitung yang akan ditambah/diperbarui/dilewati tanpa menulis apa pun.</li><li>Sesi login lama tidak dipindahkan — pengguna masuk dengan email + sandi awal.</li></ul></div>' +
      '<div class="card card-pad"><div class="sb6 mb-16">' + ic('list-checks') + ' Langkah cutover</div><ol class="small muted" style="margin:0;padding-left:18px;line-height:1.75"><li>Backup (tab Sistem).</li><li>Pindai → periksa angka & peringatan.</li><li>Jalankan impor.</li><li>Uji masuk beberapa akun (guru, kepala, pengawas).</li><li>Saat pindah resmi: jalankan sekali lagi (delta), lalu bekukan aplikasi lama.</li><li>Hapus data contoh bila belum.</li></ol></div>' +
      '<div class="card card-pad"><div class="sb6 mb-16">' + ic('file-spreadsheet') + ' Impor cepat dari CSV/Excel</div><div class="stack gap-8"><button class="btn btn-out btn-sm" id="mg-guru">' + ic('users') + 'Impor Guru (CSV/Excel)</button><button class="btn btn-out btn-sm" id="mg-kontak">' + ic('contact') + 'Impor Kontak CRM</button></div></div></div></div>';

  $('#mg-baca', box).onclick = (e) => sibuk(e.currentTarget, async () => {
    const src = $('#mg-src', box).value.trim(); if (!src) return toast('Tempel URL atau ID spreadsheet sumber.', 'error');
    const r = await api('migrasi.sumber', { source: src });
    if (!r.success) return toast(r.message, 'error');
    _mg.source = src; _mg.info = r.data; _mg.hasil = null; _mg.peta = {}; _mg.ikut = {};
    r.data.target.forEach((t) => { _mg.peta[t.kode] = r.data.usul[t.kode] || ''; _mg.ikut[t.kode] = !!r.data.usul[t.kode] && t.kode !== 'Logs'; });
    App.segarkanHalaman();
  }, 'Membaca…');
  if (_mg.hasil) gambarHasilMigrasi($('#mg-hasil', box), _mg.hasil);
  if (!inf) return;
  $$('[data-peta]', box).forEach((s) => (s.onchange = () => { const k = s.dataset.peta; _mg.peta[k] = s.value; _mg.ikut[k] = !!s.value && (k !== 'Logs' || !!_mg.ikut[k]); App.segarkanHalaman(); }));
  $$('[data-ikut]', box).forEach((c) => (c.onchange = () => { if (c.checked && !_mg.peta[c.dataset.ikut]) { c.checked = false; return toast('Pilih sheet sumbernya dulu.', 'warn'); } _mg.ikut[c.dataset.ikut] = c.checked; }));
  $('#mg-sandi', box).oninput = (e) => (_mg.sandi = e.target.value);
  $('#mg-timpa', box).onchange = (e) => (_mg.timpa = e.target.checked);
  const jalankan = async (dry, btn) => {
    const pilih = inf.target.map((t) => t.kode).filter((k) => _mg.ikut[k] && _mg.peta[k]);
    if (!pilih.length) return toast('Centang minimal satu data yang akan diimpor.', 'error');
    if (!polaSandi(_mg.sandi)) return toast('Sandi awal minimal 8 karakter berisi huruf dan angka.', 'error');
    if (!dry && !(await konfirmasi('Jalankan impor?', 'Data dari <b>' + esc(inf.judul) + '</b> akan ditulis ke APSIKITA (' + pilih.length + ' jenis data). ' + (_mg.timpa ? '<b>Data yang sudah ada akan ditimpa.</b>' : 'Data yang sudah ada tidak ditimpa.') + ' Disarankan backup terlebih dahulu.', { ya: 'Jalankan Impor', ketik: 'IMPOR' }))) return;
    const peta = {}; pilih.forEach((k) => (peta[k] = _mg.peta[k]));
    await sibuk(btn, async () => {
      const r = await api('migrasi.jalankan', { source: _mg.source, peta, sheets: pilih, dryRun: dry, overwrite: _mg.timpa, sandiAwal: _mg.sandi });
      if (!r.success) return toast(r.message, 'error');
      toast(r.message); _mg.hasil = r.data;
      gambarHasilMigrasi($('#mg-hasil', box), r.data);
      if (!dry) { Store.del(uKey('deList')); hapusCacheCrm(); App.muatBoot(true); }
    }, dry ? 'Memindai…' : 'Mengimpor…');
  };
  $('#mg-pindai', box).onclick = (e) => jalankan(true, e.currentTarget);
  $('#mg-jalan', box).onclick = (e) => jalankan(false, e.currentTarget);
  $('#mg-guru', box).onclick = () => imporGuru();
  $('#mg-kontak', box).onclick = () => imporKontak(() => hapusCacheCrm());
}
function gambarHasilMigrasi(el, d) {
  const lab = {}; ((_mg.info && _mg.info.target) || []).forEach((t) => (lab[t.kode] = t.label));
  const rep = d.report || {}, keys = Object.keys(rep), tot = { sumber: 0, ditambah: 0, diperbarui: 0, dilewati: 0 };
  keys.forEach((k) => Object.keys(tot).forEach((f) => (tot[f] += Number(rep[k][f] || 0))));
  el.innerHTML = '<div class="card"><div class="card-head"><div><h3>' + ic(d.dryRun ? 'scan-search' : 'circle-check') + ' ' + (d.dryRun ? 'Hasil Pindai (belum ditulis)' : 'Hasil Impor') + '</h3><div class="sub">Sumber: ' + esc((d.source || {}).nama || '') + '</div></div><span class="badge ' + (d.dryRun ? 'st-info' : 'st-ok') + '">' + (d.dryRun ? 'Dry-run' : 'Selesai') + '</span></div><div class="card-body" style="padding:12px 0 0">' +
    '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Data</th><th class="right">Di sumber</th><th class="right">Ditambah</th><th class="right">Diperbarui</th><th class="right">Dilewati</th></tr></thead><tbody>' +
    keys.map((k) => '<tr><td><div class="sb6">' + esc(lab[k] || k) + '</div><div class="tiny muted">sheet: ' + esc(rep[k].sumberSheet || '') + '</div></td><td class="right">' + angka(rep[k].sumber) + '</td><td class="right" style="color:var(--sb)"><b>' + angka(rep[k].ditambah) + '</b></td><td class="right" style="color:var(--b)">' + angka(rep[k].diperbarui) + '</td><td class="right muted">' + angka(rep[k].dilewati) + '</td></tr>').join('') +
    '<tr style="background:var(--surface-2)"><td class="b">Total</td><td class="right b">' + angka(tot.sumber) + '</td><td class="right b">' + angka(tot.ditambah) + '</td><td class="right b">' + angka(tot.diperbarui) + '</td><td class="right b">' + angka(tot.dilewati) + '</td></tr></tbody></table></div>' +
    '<div style="padding:16px 22px 22px">' + ((d.warnings || []).length ? '<div class="callout gold">' + ic('triangle-alert') + '<div><b>' + d.warnings.length + ' peringatan</b><ul class="small" style="margin:6px 0 0;padding-left:18px;max-height:200px;overflow:auto">' + d.warnings.slice(0, 100).map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul></div></div>' : '<div class="callout">' + ic('circle-check') + '<span>Tidak ada peringatan.</span></div>') +
    (!d.dryRun && d.sandiAwal ? '<div class="callout blue mt-12">' + ic('key-round') + '<span>Akun baru hasil impor masuk dengan sandi awal <b class="mono">' + esc(d.sandiAwal) + '</b> (wajib diganti saat masuk pertama).</span></div>' : '') +
    (d.dryRun ? '<p class="small muted" style="margin:12px 0 0">Belum ada data yang ditulis. Bila angka sudah sesuai, klik <b>Jalankan Impor</b>.</p>' : '') + '</div></div></div>';
}
