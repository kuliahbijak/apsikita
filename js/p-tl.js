/**
 * p-tl.js — Tindak Lanjut:
 *  • Kepala/Pengawas: tinjau draf rekomendasi AI, ubah/tambah/hapus, tetapkan tenggat, kirim ke guru, pantau progres.
 *  • Guru: perbarui progres (0–100%), catatan, tandai selesai, diskusi.
 */
'use strict';
const ASPEK_TL = ['Perencanaan', 'Pelaksanaan', 'Asesmen', 'Refleksi', 'Pengembangan Diri', 'Kolaborasi', 'Umum'];
let _tl = { q: '', f: '' };

daftarHalaman('tindak-lanjut', {
  judul: 'Tindak Lanjut',
  formulir() { return App.isReviewer() && !!parseHash().param[0]; },
  render(el, param) {
    if (App.role === 'GURU') return tlGuru(el);
    if (param[0]) return tlEditor(el, param[0]);
    tlDaftar(el);
  }
});

function sisaHari(d) { if (!d) return ''; const n = Math.ceil((tgl(d) - tgl(isoHari())) / 864e5); return n < 0 ? '<span style="color:var(--k)" class="b">Lewat ' + (-n) + ' hari</span>' : n === 0 ? '<span style="color:var(--gold-ink)" class="b">Hari ini</span>' : n + ' hari lagi'; }
function badgeTL(t) { const m = { 'AI-Draft': ['st-info', '✨ Draf AI'], Draft: ['st-info', 'Draf'], Assigned: ['st-wait', 'Berjalan'], Selesai: ['st-ok', 'Tuntas'], Closed: ['st-mute', 'Ditutup'] }[t.Status] || ['st-mute', t.Status]; return '<span class="badge ' + m[0] + '">' + m[1] + '</span>'; }
function catatanProgresHtml(t) {
  const log = pj(t.CatatanProgress, []);
  return log.length ? log.slice().reverse().map((x) => '<div class="row row-top gap-8 small" style="padding:6px 0"><span class="chip chip-sm chip-mint">' + x.progress + '%</span><div class="grow">' + esc(x.teks || '(tanpa catatan)') + '<div class="tiny muted">' + fWaktu(x.waktu) + '</div></div></div>').join('') : '<div class="tiny muted">Belum ada pembaruan progres.</div>';
}

function tlDaftar(el) {
  const gurus = App.guru(), tl = App.boot.tindakLanjut;
  const baris = gurus.map((g) => {
    const x = tl.filter((t) => t.GuruUserID === g.UserID), aktif = x.filter((t) => t.Status === 'Assigned' || t.Status === 'Selesai' || t.Status === 'Closed');
    const dl = x.filter((t) => t.Status === 'Assigned' && t.Deadline).map((t) => t.Deadline).sort()[0];
    return { g, draf: x.filter((t) => t.Status === 'AI-Draft' || t.Status === 'Draft').length, aktif: aktif.length, tuntas: aktif.filter((t) => t.Status !== 'Assigned').length, prog: App.rekap.guru[g.UserID].tindakLanjut, dl, siapAI: App.rekap.guru[g.UserID].tahap[2].status === 'selesai' && !x.length };
  });
  const perlu = baris.filter((b) => b.draf || b.siapAI).length, berjalan = tl.filter((t) => t.Status === 'Assigned'), telat = berjalan.filter((t) => t.Deadline && t.Deadline < isoHari()).length;
  el.innerHTML = '<div class="ph"><div><div class="eyebrow">Supervisi / <b>Tindak Lanjut</b></div><h1>Rencana Tindak Lanjut</h1><p>AI menyusun 3–5 rekomendasi dari kelemahan perencanaan, observasi, dan refleksi. Tinjau, sesuaikan, tetapkan tenggat, lalu kirim ke guru dan pantau progresnya.</p></div></div>' +
    '<div class="cols-4">' + UI.kpi('Perlu Ditinjau', perlu + ' <small>Guru</small>', 'Draf AI / siap dibuatkan', 'sparkles', 'gold') + UI.kpi('Rencana Berjalan', berjalan.length + ' <small>Butir</small>', 'Rata-rata progres ' + (berjalan.length ? Math.round(berjalan.reduce((t, x) => t + Number(x.Progress), 0) / berjalan.length) : 0) + '%', 'git-fork') +
    UI.kpi('Tuntas', tl.filter((t) => t.Status === 'Selesai').length + ' <small>Butir</small>', 'Ditandai selesai oleh guru', 'circle-check', 'mint') + UI.kpi('Melewati Tenggat', telat + ' <small>Butir</small>', telat ? '<span style="color:var(--k)">Perlu pendampingan</span>' : 'Semua sesuai jadwal', 'alarm-clock') + '</div>' +
    '<div class="card mt-24"><div class="card-body" style="padding-bottom:0"><div class="filters"><div class="inp-ic cari grow">' + ic('search') + '<input class="inp inp-soft" id="tl-q" placeholder="Cari guru…" value="' + esc(_tl.q) + '"></div><select class="inp" id="tl-f">' + opsi([{ v: 'perlu', t: 'Perlu ditinjau' }, { v: 'jalan', t: 'Sedang berjalan' }, { v: 'tuntas', t: 'Tuntas' }], _tl.f, 'Semua guru') + '</select></div></div><div id="tl-list" class="mt-16"></div></div>';
  const isi = () => {
    const q = _tl.q.toLowerCase(), f = baris.filter((b) => (!q || b.g.Nama.toLowerCase().indexOf(q) > -1) && (!_tl.f || (_tl.f === 'perlu' ? (b.draf || b.siapAI) : _tl.f === 'jalan' ? b.aktif > b.tuntas : b.aktif && b.aktif === b.tuntas)));
    $('#tl-list').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Guru</th><th>Draf AI</th><th>Ditugaskan</th><th>Progres</th><th>Tenggat terdekat</th><th></th></tr></thead><tbody>' +
      (f.length ? f.map((b) => '<tr class="klik" data-g="' + b.g.UserID + '"><td><div class="row gap-12">' + avatar(b.g.Nama, 'av-sm') + '<div><div class="nm">' + esc(b.g.Nama) + '</div><div class="sub">' + esc(App.namaSekolah(b.g.SekolahID)) + '</div></div></div></td>' +
        '<td>' + (b.draf ? '<span class="badge st-info">✨ ' + b.draf + ' draf</span>' : b.siapAI ? '<span class="badge st-wait">Siap dibuat</span>' : '-') + '</td><td>' + (b.aktif ? b.tuntas + '/' + b.aktif + ' tuntas' : '-') + '</td>' +
        '<td style="min-width:150px">' + (b.aktif ? '<div class="skorbar">' + bar(b.prog, 'gold') + '<b>' + b.prog + '%</b></div>' : '-') + '</td><td class="small">' + (b.dl ? fTgl(b.dl) + '<div class="tiny">' + sisaHari(b.dl) + '</div>' : '-') + '</td><td class="right"><button class="btn btn-' + (b.draf || b.siapAI ? 'pri' : 'out') + ' btn-sm">Kelola</button></td></tr>').join('')
        : '<tr><td colspan="6">' + kosong('Tidak ada data', '', '', 'git-fork') + '</td></tr>') + '</tbody></table></div>';
    $$('#tl-list tr[data-g]').forEach((tr) => (tr.onclick = () => go('tindak-lanjut/' + tr.dataset.g)));
  };
  $('#tl-q').oninput = debounce((e) => { _tl.q = e.target.value; isi(); }, 220);
  $('#tl-f').onchange = (e) => { _tl.f = e.target.value; isi(); };
  isi();
}

function tlEditor(el, guruId) {
  if (App.perluDetail(guruId)) { el.innerHTML = skeleton(3, 140); App.muatDetail(guruId).then((ok) => { if (ok && parseHash().param[0] === guruId) tlEditor(el, guruId); }); return; }
  const g = App.M.user[guruId];
  if (!g) { el.innerHTML = kosong('Guru tidak ditemukan', '', '<a class="btn btn-pri" href="#/tindak-lanjut">Kembali</a>'); return; }
  const semua = App.boot.tindakLanjut.filter((t) => t.GuruUserID === guruId);
  let draf = semua.filter((t) => t.Status === 'AI-Draft' || t.Status === 'Draft').map((t) => Object.assign({}, t));
  const jalan = semua.filter((t) => t.Status !== 'AI-Draft' && t.Status !== 'Draft').sort((a, b) => (a.Status === 'Assigned' ? 0 : 1) - (b.Status === 'Assigned' ? 0 : 1));
  const hapus = [], r = App.rekap.guru[guruId], tenggat = isoHari(new Date(Date.now() + Number(App.setting('TENGGAT_TL_HARI', 30)) * 864e5));
  el.innerHTML = '<a class="back" href="#/tindak-lanjut">' + ic('arrow-left') + 'Semua guru</a>' +
    '<div class="card card-pad"><div class="row row-wrap gap-16">' + avatar(g.Nama, 'av-lg') + '<div class="grow"><div class="eyebrow" style="margin:0">Rencana Tindak Lanjut</div><h1 style="font-size:24px;color:var(--brand-900)">' + esc(g.Nama) + '</h1><div class="small muted">' + esc(g.Mapel || '') + ' • ' + esc(App.namaSekolah(g.SekolahID)) + '</div></div>' +
    '<div class="row row-wrap gap-8">' + [['Perencanaan', r.perencanaan], ['Observasi', r.observasi], ['Refleksi', r.refleksi]].map((x) => '<span class="chip">' + x[0] + ' <b>' + x[1] + '%</b></span>').join('') + '<a class="btn btn-out btn-sm" href="#/guru/' + guruId + '">' + ic('user-round') + 'Profil</a></div></div></div>' +
    '<div class="split mt-24"><div class="card"><div class="card-head"><div><h3>Draf Rekomendasi</h3><div class="sub">Edit bebas sebelum dikirim. Guru hanya melihat rencana setelah Anda menyetujuinya.</div></div><button class="btn btn-gold btn-sm" id="te-ai">' + ic('sparkles') + 'Generate Rekomendasi AI</button></div><div class="card-body" id="te-draf"></div>' +
    '<div class="sticky-foot"><button class="btn btn-out" id="te-tambah">' + ic('plus') + 'Tambah Rekomendasi</button><div class="row gap-8"><button class="btn btn-out" id="te-simpan">' + ic('save') + 'Simpan Draf</button><button class="btn btn-pri btn-lg" id="te-kirim">' + ic('send') + 'Setujui &amp; Kirim ke Guru</button></div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Rencana Berjalan</h3><span class="chip">' + jalan.length + '</span></div><div class="card-body">' +
    (jalan.length ? jalan.map((t) => '<div class="soft mb-16"><div class="row row-between gap-8"><span class="chip chip-sm">' + esc(t.Aspek) + '</span>' + badgeTL(t) + '</div><div class="mt-8 sb6">' + esc(t.Rekomendasi) + '</div>' + (t.Indikator ? '<div class="tiny muted mt-8">🎯 ' + esc(t.Indikator) + '</div>' : '') +
      '<div class="mt-12">' + prog('Progres', t.Status === 'Selesai' || t.Status === 'Closed' ? 100 : t.Progress, 'gold') + '</div><div class="tiny muted">Tenggat ' + fTgl(t.Deadline) + ' • ' + sisaHari(t.Deadline) + '</div>' +
      '<details class="mt-8"><summary class="small sb6" style="cursor:pointer">Catatan progres &amp; diskusi</summary><div class="mt-8">' + catatanProgresHtml(t) + '</div><div class="mt-8">' + komentarHtml(t.Komentar) + '</div>' +
      '<div class="row gap-8 mt-8"><input class="inp" style="height:36px" data-kom="' + t.TindakLanjutID + '" placeholder="Tulis komentar…"><button class="btn btn-out btn-sm" data-kirimkom="' + t.TindakLanjutID + '">' + ic('send') + '</button></div></details>' +
      (t.Status === 'Assigned' || t.Status === 'Selesai' ? '<button class="btn btn-ghost btn-xs mt-8" data-tutuptl="' + t.TindakLanjutID + '">' + ic('archive') + 'Tutup rencana</button>' : '') + '</div>').join('') : '<div class="muted small">Belum ada rencana yang ditugaskan.</div>') + '</div></div></div>';
  const render = () => {
    $('#te-draf').innerHTML = draf.length ? draf.map((t, n) => '<div class="soft mb-16" data-n="' + n + '"><div class="row row-between gap-8 mb-16"><div class="row gap-8"><span class="badge ' + (t.Sumber === 'AI' ? 'st-info' : 'st-mute') + '">' + (t.Sumber === 'AI' ? '✨ AI' : 'Manual') + '</span><select class="inp" style="height:34px;width:auto" data-f="Aspek">' + opsi(ASPEK_TL.indexOf(t.Aspek) < 0 && t.Aspek ? ASPEK_TL.concat([t.Aspek]) : ASPEK_TL, t.Aspek || 'Umum') + '</select></div>' +
      '<button class="btn btn-ghost btn-sm" data-del="' + n + '" title="Hapus">' + ic('trash-2') + '</button></div><div class="field"><textarea class="inp" rows="3" data-f="Rekomendasi" placeholder="Rekomendasi konkret…">' + esc(t.Rekomendasi || '') + '</textarea></div>' +
      '<div class="grid-2"><div class="field mb-0"><label class="tiny">Indikator keberhasilan</label><input class="inp" data-f="Indikator" value="' + esc(t.Indikator || '') + '"></div><div class="field mb-0"><label class="tiny">Tenggat</label><input class="inp" type="date" data-f="Deadline" value="' + esc((t.Deadline || tenggat).slice(0, 10)) + '"></div></div></div>').join('')
      : kosong('Belum ada draf', 'Tekan "Generate Rekomendasi AI" atau tambahkan rekomendasi manual.', '', 'sparkles');
    $$('#te-draf [data-f]').forEach((i) => (i.oninput = i.onchange = () => { draf[Number(i.closest('[data-n]').dataset.n)][i.dataset.f] = i.value; }));
    $$('#te-draf [data-del]').forEach((b) => (b.onclick = () => { const t = draf.splice(Number(b.dataset.del), 1)[0]; if (t.TindakLanjutID) hapus.push(t.TindakLanjutID); render(); }));
  };
  const simpan = (kirim) => (e) => {
    const isi = draf.filter((t) => String(t.Rekomendasi || '').trim());
    if (kirim && !isi.length) return toast('Belum ada rekomendasi untuk dikirim.', 'error');
    sibuk(e.currentTarget, async () => {
      const res = await api('tlSimpan', { guruId, periodeId: App.periodeId, items: isi.map((t) => ({ TindakLanjutID: t.TindakLanjutID || '', Aspek: t.Aspek, Rekomendasi: t.Rekomendasi, Indikator: t.Indikator, Deadline: t.Deadline || tenggat })), hapus, kirim });
      if (!hasilToast(res)) return;
      gantiTLGuru(guruId, res.data.items);
      tlEditor(el, guruId);
    });
  };
  $('#te-tambah').onclick = () => { draf.push({ Sumber: 'Manual', Aspek: 'Umum', Rekomendasi: '', Indikator: '', Deadline: tenggat }); render(); const t = $$('#te-draf textarea').pop(); if (t) t.focus(); };
  $('#te-simpan').onclick = simpan(false);
  $('#te-kirim').onclick = simpan(true);
  $('#te-ai').onclick = async (e) => {
    if (draf.length && !(await konfirmasi('Buat ulang dengan AI?', 'Draf AI yang ada akan diganti rekomendasi baru. Draf manual yang belum disimpan ikut hilang.', { ya: 'Generate' }))) return;
    sibuk(e.currentTarget, async () => {
      const res = await api('tlGenerate', { guruId, periodeId: App.periodeId });
      if (!hasilToast(res)) return;
      App.boot.tindakLanjut = App.boot.tindakLanjut.filter((t) => !(t.GuruUserID === guruId && t.Status === 'AI-Draft'));
      App.upsert('tindakLanjut', res.data.items, 'TindakLanjutID', { render: false });
      tlEditor(el, guruId);
    }, 'AI menyusun…');
  };
  $$('[data-kirimkom]', el).forEach((b) => (b.onclick = () => kirimKomentarTL(b.dataset.kirimkom, el.querySelector('[data-kom="' + b.dataset.kirimkom + '"]'), b, () => tlEditor(el, guruId))));
  $$('[data-tutuptl]', el).forEach((b) => (b.onclick = async () => {
    if (!(await konfirmasi('Tutup rencana?', 'Rencana ditandai ditutup (tidak dihitung sebagai beban aktif guru).', { ya: 'Tutup' }))) return;
    sibuk(b, async () => { const res = await api('tlSimpan', { guruId, periodeId: App.periodeId, items: [], tutup: [b.dataset.tutuptl] }); if (hasilToast(res)) { gantiTLGuru(guruId, res.data.items); tlEditor(el, guruId); } });
  }));
  render();
}

/** Server mengembalikan SEMUA rencana guru di periode ini → ganti salinan lokal sekaligus. */
function gantiTLGuru(guruId, items) {
  App.boot.tindakLanjut = App.boot.tindakLanjut.filter((t) => !(t.GuruUserID === guruId && t.PeriodeID === App.periodeId));
  App.upsert('tindakLanjut', items, 'TindakLanjutID', { render: false });
}
function kirimKomentarTL(id, input, btn, setelah) {
  const teks = input.value.trim(); if (!teks) return;
  sibuk(btn, async () => { const r = await api('tlKomentar', { TindakLanjutID: id, teks }); if (hasilToast(r)) { App.upsert('tindakLanjut', r.data.item, 'TindakLanjutID', { render: false }); setelah ? setelah() : App.segarkanHalaman(); } });
}

function tlGuru(el) {
  const milik = App.boot.tindakLanjut.filter((t) => t.GuruUserID === App.uid && t.Status !== 'AI-Draft' && t.Status !== 'Draft');
  const aktif = milik.filter((t) => t.Status === 'Assigned').sort((a, b) => String(a.Deadline).localeCompare(String(b.Deadline))), tuntas = milik.filter((t) => t.Status !== 'Assigned');
  const r = App.rekap.guru[App.uid] || {};
  el.innerHTML = '<div class="ph"><div><div class="eyebrow">Supervisi / <b>Tindak Lanjut Saya</b></div><h1>Rencana Tindak Lanjut</h1><p>Rekomendasi pembinaan dari kepala sekolah/pengawas. Perbarui progres secara berkala dan tandai selesai bila indikator keberhasilan tercapai.</p></div>' +
    '<div class="card card-pad row gap-16" style="min-width:260px">' + donut(r.tindakLanjut || 0, 76, 9, '#c9a227') + '<div><div class="b">' + tuntas.filter((t) => t.Status === 'Selesai').length + ' dari ' + milik.length + ' tuntas</div><div class="small muted">Rata-rata progres</div></div></div></div>' +
    (aktif.length ? '<div class="cols-2">' + aktif.map((t) => '<div class="card card-pad" data-id="' + t.TindakLanjutID + '"><div class="row row-between gap-8"><span class="chip chip-sm chip-mint">' + esc(t.Aspek) + '</span><span class="small">' + ic('calendar') + ' ' + fTgl(t.Deadline) + ' • ' + sisaHari(t.Deadline) + '</span></div>' +
      '<div class="b mt-12" style="font-size:16px">' + esc(t.Rekomendasi) + '</div>' + (t.Indikator ? '<div class="small muted mt-8">🎯 Indikator: ' + esc(t.Indikator) + '</div>' : '') +
      '<div class="mt-16"><div class="row row-between small"><span>Progres</span><b data-pv>' + t.Progress + '%</b></div><input type="range" class="range" min="0" max="100" step="5" value="' + t.Progress + '" data-rg></div>' +
      '<textarea class="inp mt-8" rows="2" data-cat placeholder="Apa yang sudah dikerjakan? (bukti, tautan, catatan)"></textarea>' +
      '<div class="row gap-8 mt-12"><button class="btn btn-out" data-upd>' + ic('save') + 'Update Progres</button><button class="btn btn-pri" data-done>' + ic('circle-check') + 'Tandai Selesai</button></div>' +
      '<details class="mt-12"><summary class="small sb6" style="cursor:pointer">Riwayat &amp; diskusi (' + (pj(t.CatatanProgress, []).length + pj(t.Komentar, []).length) + ')</summary><div class="mt-8">' + catatanProgresHtml(t) + '</div><div class="mt-8">' + komentarHtml(t.Komentar) + '</div>' +
      '<div class="row gap-8 mt-8"><input class="inp" style="height:36px" data-kom placeholder="Tanya / tanggapi penilai…"><button class="btn btn-out btn-sm" data-kirimkom>' + ic('send') + '</button></div></details></div>').join('') + '</div>'
      : '<div class="card">' + kosong('Belum ada rencana aktif', milik.length ? 'Semua rencana sudah tuntas. Hebat! 🎉' : 'Rencana tindak lanjut muncul setelah kepala sekolah/pengawas menyetujui rekomendasi.', '', 'git-fork') + '</div>') +
    (tuntas.length ? '<div class="sec-h"><h2>Tuntas &amp; Ditutup</h2></div><div class="card"><div class="tbl-wrap"><table class="tbl"><tbody>' + tuntas.map((t) => '<tr><td><span class="chip chip-sm">' + esc(t.Aspek) + '</span></td><td>' + esc(t.Rekomendasi) + '</td><td>' + badgeTL(t) + '</td><td class="small muted">' + fTgl(t.TanggalSelesai || t.DiperbaruiPada) + '</td></tr>').join('') + '</tbody></table></div></div>' : '');
  $$('[data-id]', el).forEach((card) => {
    const id = card.dataset.id, rg = card.querySelector('[data-rg]');
    rg.oninput = () => (card.querySelector('[data-pv]').textContent = rg.value + '%');
    const kirim = (selesai) => (e) => sibuk(e.currentTarget, async () => {
      const r2 = await api('tlProgress', { TindakLanjutID: id, progress: Number(rg.value), catatan: card.querySelector('[data-cat]').value.trim(), selesai });
      if (hasilToast(r2)) App.upsert('tindakLanjut', r2.data.item, 'TindakLanjutID');
    });
    card.querySelector('[data-upd]').onclick = kirim(false);
    card.querySelector('[data-done]').onclick = async (e) => { const b = e.currentTarget; if (await konfirmasi('Tandai selesai?', 'Pastikan indikator keberhasilan sudah tercapai. Kepala sekolah akan diberi tahu.', { ya: 'Ya, selesai' })) kirim(true)({ currentTarget: b }); };
    card.querySelector('[data-kirimkom]').onclick = (e) => kirimKomentarTL(id, card.querySelector('[data-kom]'), e.currentTarget);
  });
}
