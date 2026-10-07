/**
 * p-refleksi.js — Form Refleksi:
 *  • Guru: refleksi narasi (3 pertanyaan) + instrumen refleksi diri 0–3, simpan draf / kirim.
 *  • Kepala/Pengawas: daftar refleksi, tanggapan berkomentar, setujui, kunci.
 */
'use strict';
const TANYA_REFLEKSI = [
  ['NarasiBaik', 'Apa yang sudah baik?', 'Ceritakan bagian pembelajaran yang berjalan efektif dan respons positif peserta didik…'],
  ['NarasiPerbaikan', 'Apa yang perlu diperbaiki?', 'Kendala, dinamika murid, atau aspek pengajaran yang belum optimal…'],
  ['NarasiRencana', 'Rencana ke depan?', 'Langkah konkret yang akan Anda lakukan pada pertemuan berikutnya…']
];
let _rf = { q: '', st: '' };

daftarHalaman('refleksi', {
  judul: 'Form Refleksi',
  formulir() { return App.role === 'GURU'; },
  render(el, param) { if (App.role === 'GURU') refleksiGuru(el); else refleksiReviewer(el, param[0]); }
});

function komentarHtml(list) {
  list = pj(list, []);
  return list.length ? list.map((k) => '<div class="komentar">' + avatar(k.nama, 'av-sm av-mint') + '<div class="grow"><div class="row row-between"><b class="small">' + esc(k.nama) + '</b><span class="tiny muted">' + lalu(k.waktu) + '</span></div><div class="small" style="white-space:pre-wrap">' + esc(k.teks) + '</div></div></div>').join('') : '<div class="muted small">Belum ada tanggapan.</div>';
}

function refleksiGuru(el) {
  const milik = App.boot.refleksi.filter((r) => r.GuruUserID === App.uid).sort((a, b) => b.DiperbaruiPada.localeCompare(a.DiperbaruiPada));
  const r = milik[0] || {}, terkunci = r.Status === 'Dikunci';
  const obsSelesai = App.boot.observasi.filter((o) => o.GuruUserID === App.uid && o.Status === 'Selesai').sort((a, b) => b.Tanggal.localeCompare(a.Tanggal));
  const insList = App.boot.instrumen.filter((i) => i.Tipe === 'Refleksi' && (i.Aktif === 'YA' || i.InstrumenID === r.InstrumenID));
  const kunciDraf = uKey('drafRef:' + (r.RefleksiID || 'baru')), draf = !terkunci ? Store.get(kunciDraf, null) : null;
  const nilai = Object.assign({ NarasiBaik: r.NarasiBaik || '', NarasiPerbaikan: r.NarasiPerbaikan || '', NarasiRencana: r.NarasiRencana || '' }, draf ? draf.narasi : {});
  let skor = Object.assign({}, pj(r.Skor, {}), draf ? draf.skor : {}), insId = (draf && draf.instrumenId) || r.InstrumenID || (insList[0] && insList[0].InstrumenID);
  const belumObs = !obsSelesai.length && !r.RefleksiID;
  const stBadge = { Draft: ['st-info', 'Draf tersimpan'], Dikirim: ['st-ok', 'Terkirim ke penilai'], Dikunci: ['st-mute', 'Dikunci penilai'] }[r.Status];
  el.innerHTML = '<div class="ph"><div><div class="eyebrow">Supervisi / <b>Refleksi Diri</b></div><h1>Form Refleksi Diri Pasca Observasi</h1><p>Tuliskan refleksi jujur atas pembelajaran yang diobservasi dan umpan balik yang Anda terima, lalu nilai diri Anda dengan instrumen refleksi.</p></div>' +
    (stBadge ? '<span class="badge ' + stBadge[0] + '" style="height:32px;padding:0 14px;font-size:13px">' + stBadge[1] + '</span>' : '') + '</div>' +
    (belumObs ? '<div class="callout gold mb-16">' + ic('lock') + '<span>Refleksi terbuka otomatis setelah nilai observasi kelas Anda diunggah penilai. Anda tetap bisa menyiapkan draf.</span></div>' : '') +
    (terkunci ? '<div class="callout mb-16">' + ic('lock') + '<span>Refleksi ini sudah <b>dikunci &amp; disetujui</b> oleh ' + esc(App.nama(r.DikunciOleh)) + ' sehingga tidak dapat diubah.</span></div>' : '') +
    (draf ? '<div class="callout gold mb-16">' + ic('history') + '<span>Isian yang belum disimpan dipulihkan dari perangkat ini. <a href="#" id="rf-buang">Buang</a></span></div>' : '') +
    '<div class="split"><div class="stack gap-20"><div class="card"><div class="card-head"><div><h3>A. Refleksi Narasi</h3><div class="sub">Jawab tiga pertanyaan pemandu berikut</div></div></div><div class="card-body">' +
    (obsSelesai.length ? '<div class="field"><label>Observasi yang direfleksikan</label><select class="inp" id="rf-obs"' + (terkunci ? ' disabled' : '') + '>' + opsi(obsSelesai.map((o) => ({ v: o.ObservasiID, t: fTgl(o.Tanggal) + ' — ' + App.nama(o.ObserverUserID) + ' (' + o.NilaiTotal + '%)' })), r.ObservasiID || obsSelesai[0].ObservasiID) + '</select></div>' : '') +
    TANYA_REFLEKSI.map((t, i) => '<div class="field"><label>' + (i + 1) + '. ' + t[1] + ' <span class="wajib">*</span></label><textarea class="inp" rows="4" data-n="' + t[0] + '" placeholder="' + t[2] + '"' + (terkunci ? ' readonly' : '') + '>' + esc(nilai[t[0]]) + '</textarea><span class="bantu" data-cnt="' + t[0] + '"></span></div>').join('') + '</div></div>' +
    '<div class="card"><div class="card-head"><div><h3>B. Instrumen Refleksi Diri</h3><div class="sub">Skala 0–3: 0 tidak/kurang sekali • 1 kurang • 2 cukup • 3 baik/sangat baik</div></div>' + (insList.length > 1 && !terkunci ? '<select class="inp" style="width:auto" id="rf-ins">' + opsi(insList.map((i) => ({ v: i.InstrumenID, t: i.Nama })), insId) + '</select>' : '') + '</div><div class="card-body" id="rf-ind"></div>' +
    (terkunci ? '' : '<div class="sticky-foot"><div class="row gap-12"><span class="tiny muted">Skor refleksi</span><b style="font-size:22px;color:var(--brand-900)" id="rf-nilai">0%</b><span class="small muted" id="rf-prog"></span></div><div class="row gap-8"><button class="btn btn-out" id="rf-draf">' + ic('save') + 'Simpan</button><button class="btn btn-pri btn-lg" id="rf-kirim">' + ic('send') + 'Simpan + Kirim ke Kepala Sekolah/Pengawas</button></div></div>') + '</div></div>' +
    '<div class="stack gap-20">' + (obsSelesai[0] ? '<div class="card card-pad"><div class="eyebrow">Hasil observasi terakhir</div><div class="row gap-16 mt-8">' + donut(obsSelesai[0].NilaiTotal, 80, 9) + '<div><div class="b">' + fTgl(obsSelesai[0].Tanggal) + '</div><div class="small muted">' + esc(App.nama(obsSelesai[0].ObserverUserID)) + '</div><div class="mt-8">' + badgePred(obsSelesai[0].Kualitas) + '</div></div></div>' +
      (obsSelesai[0].CatatanUmum ? '<div class="note mt-16">' + ic('message-square-text') + '<div>' + esc(obsSelesai[0].CatatanUmum) + '</div></div>' : '') + '<button class="btn btn-out btn-block mt-16" id="rf-lihatobs">' + ic('eye') + 'Lihat rincian penilaian</button></div>' : '') +
    '<div class="card"><div class="card-head"><h3>Tanggapan Penilai</h3></div><div class="card-body">' + komentarHtml(r.Komentar) + '</div></div></div></div>';
  const simpanLokal = () => { if (terkunci) return; const n = {}; $$('[data-n]', el).forEach((t) => (n[t.dataset.n] = t.value)); Store.set(kunciDraf, { narasi: n, skor, instrumenId: insId }); };
  const hitung = () => {
    const ind = (App.M.instrumen[insId] || {})._ind || [], n = ind.filter((i) => skor[i.id] && skor[i.id].skor !== undefined).length, v = HITUNG.nilaiSkor(skor, ind);
    if ($('#rf-nilai')) { $('#rf-nilai').textContent = v + '%'; $('#rf-prog').textContent = n + '/' + ind.length + ' dinilai'; }
    $$('[data-n]', el).forEach((t) => { const c = el.querySelector('[data-cnt="' + t.dataset.n + '"]'); c.textContent = t.value.trim().length + ' karakter' + (t.value.trim().length < 15 ? ' (min. 15)' : ''); });
  };
  const renderInd = () => {
    const ins = App.M.instrumen[insId];
    if (!ins) { $('#rf-ind').innerHTML = kosong('Instrumen refleksi belum tersedia', 'Hubungi operator.', '', 'clipboard-list'); return; }
    $('#rf-ind').innerHTML = ins._ind.map((i, n) => { const s = skor[i.id] || {}; return '<div class="ind-row" data-ind="' + i.id + '"><span class="no">' + (n + 1) + '</span><div>' + esc(i.teks) + (i.aspek ? '<div class="tiny muted mt-8">' + esc(i.aspek) + '</div>' : '') + '</div><div class="skor-seg">' + [0, 1, 2, 3].map((v) => '<button type="button" class="s' + v + (s.skor !== undefined && Number(s.skor) === v ? ' on' : '') + '" data-v="' + v + '"' + (terkunci ? ' disabled' : '') + '>' + v + '</button>').join('') + '</div></div>'; }).join('');
    $$('#rf-ind .skor-seg button').forEach((b) => (b.onclick = () => { const id = b.closest('[data-ind]').dataset.ind; skor[id] = { skor: Number(b.dataset.v) }; $$('button', b.parentNode).forEach((x) => x.classList.toggle('on', x === b)); hitung(); simpanLokal(); }));
    hitung();
  };
  $$('[data-n]', el).forEach((t) => (t.oninput = () => { hitung(); simpanLokal(); }));
  if ($('#rf-ins')) $('#rf-ins').onchange = (e) => { insId = e.target.value; renderInd(); simpanLokal(); };
  if ($('#rf-buang')) $('#rf-buang').onclick = (e) => { e.preventDefault(); Store.del(kunciDraf); App.segarkanHalaman(); };
  if ($('#rf-lihatobs')) $('#rf-lihatobs').onclick = () => lihatObservasi(obsSelesai[0].ObservasiID);
  const kirim = (final) => (e) => sibuk(e.currentTarget, async () => {
    const d = { RefleksiID: r.RefleksiID || '', observasiId: $('#rf-obs') ? $('#rf-obs').value : '', instrumenId: insId, skor, kirim: final };
    $$('[data-n]', el).forEach((t) => { d['narasi' + t.dataset.n.replace('Narasi', '')] = t.value; });
    const res = await api('refleksiSimpan', d);
    if (!hasilToast(res)) return;
    Store.del(kunciDraf);
    App.upsert('refleksi', res.data.refleksi, 'RefleksiID');
    if (final) setTimeout(() => App.muatBoot(true), 4000);        // draf tindak lanjut AI dibuat di server
  });
  if ($('#rf-draf')) { $('#rf-draf').onclick = kirim(false); $('#rf-kirim').onclick = kirim(true); }
  renderInd();
}

function refleksiReviewer(el, bukaGuru) {
  const gurus = App.guru(), ref = App.boot.refleksi;
  const baris = gurus.map((g) => ({ g, r: ref.filter((x) => x.GuruUserID === g.UserID).sort((a, b) => b.DiperbaruiPada.localeCompare(a.DiperbaruiPada))[0] }));
  const n = (s) => baris.filter((x) => (x.r ? x.r.Status : 'Belum') === s).length;
  el.innerHTML = '<div class="ph"><div><div class="eyebrow">Supervisi / <b>Refleksi Guru</b></div><h1>Refleksi Guru</h1><p>Baca refleksi diri guru, beri tanggapan pembinaan, setujui, lalu kunci agar tidak diubah lagi. Refleksi yang terkirim memicu draf rekomendasi tindak lanjut AI.</p></div></div>' +
    '<div class="cols-4">' + UI.kpi('Terkirim', n('Dikirim') + ' <small>Guru</small>', 'Menunggu tanggapan', 'inbox', 'gold') + UI.kpi('Dikunci', n('Dikunci') + ' <small>Guru</small>', 'Sudah disetujui', 'lock', 'mint') + UI.kpi('Draf', n('Draft') + ' <small>Guru</small>', 'Belum dikirim guru', 'pen-line') + UI.kpi('Belum Mengisi', n('Belum') + ' <small>Guru</small>', 'dari ' + gurus.length + ' guru', 'user-search') + '</div>' +
    '<div class="card mt-24"><div class="card-body" style="padding-bottom:0"><div class="filters"><div class="inp-ic cari grow">' + ic('search') + '<input class="inp inp-soft" id="rr-q" placeholder="Cari guru…" value="' + esc(_rf.q) + '"></div><select class="inp" id="rr-st">' + opsi([{ v: 'Dikirim', t: 'Terkirim (perlu tanggapan)' }, { v: 'Dikunci', t: 'Dikunci' }, { v: 'Draft', t: 'Draf' }, { v: 'Belum', t: 'Belum mengisi' }], _rf.st, 'Semua status') + '</select></div></div><div id="rr-list" class="mt-16"></div></div>';
  const isi = () => {
    const q = _rf.q.toLowerCase(), f = baris.filter((x) => (!q || x.g.Nama.toLowerCase().indexOf(q) > -1) && (!_rf.st || (x.r ? x.r.Status : 'Belum') === _rf.st));
    $('#rr-list').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Guru</th><th>Status</th><th>Skor diri</th><th>Cuplikan refleksi</th><th>Diperbarui</th><th></th></tr></thead><tbody>' +
      (f.length ? f.map((x) => '<tr class="klik" data-g="' + x.g.UserID + '"><td><div class="row gap-12">' + avatar(x.g.Nama, 'av-sm') + '<div><div class="nm">' + esc(x.g.Nama) + '</div><div class="sub">' + esc(App.namaSekolah(x.g.SekolahID)) + '</div></div></div></td>' +
        '<td>' + (x.r ? '<span class="badge ' + ({ Dikirim: 'st-wait', Dikunci: 'st-ok', Draft: 'st-info' }[x.r.Status]) + '">' + esc(x.r.Status === 'Dikirim' ? 'Terkirim' : x.r.Status) + '</span>' + (x.r.Disetujui === 'YA' ? ' <span class="badge st-ok">' + ic('check') + '</span>' : '') : '<span class="badge st-mute">Belum ada</span>') + '</td>' +
        '<td>' + (x.r && x.r.Status !== 'Draft' ? '<b>' + x.r.NilaiTotal + '%</b>' : '-') + '</td><td class="small" style="max-width:360px">' + (x.r && x.r.Status !== 'Draft' ? esc(String(x.r.NarasiPerbaikan || x.r.NarasiBaik).slice(0, 110)) + '…' : '<span class="muted">—</span>') + '</td>' +
        '<td class="small muted">' + (x.r ? lalu(x.r.DiperbaruiPada) : '-') + '</td><td class="right">' + (x.r && x.r.Status !== 'Draft' ? '<button class="btn btn-pri btn-sm">Tanggapi</button>' : '') + '</td></tr>').join('')
        : '<tr><td colspan="6">' + kosong('Tidak ada data', '', '', 'inbox') + '</td></tr>') + '</tbody></table></div>';
    $$('#rr-list tr[data-g]').forEach((tr) => (tr.onclick = () => { const x = baris.find((b) => b.g.UserID === tr.dataset.g); if (x.r && x.r.Status !== 'Draft') drawerRefleksi(x.r); else toast(x.g.Nama + ' belum mengirim refleksi.', 'warn'); }));
  };
  $('#rr-q').oninput = debounce((e) => { _rf.q = e.target.value; isi(); }, 220);
  $('#rr-st').onchange = (e) => { _rf.st = e.target.value; isi(); };
  isi();
  if (bukaGuru) { const x = baris.find((b) => b.g.UserID === bukaGuru); if (x && x.r) setTimeout(() => drawerRefleksi(x.r), 30); history.replaceState(null, '', '#/refleksi'); }
}

function drawerRefleksi(r) {
  if (App.perluDetail(r.GuruUserID)) return denganDetail(r.GuruUserID, () => drawerRefleksi(App.M.refleksi[r.RefleksiID] || r));
  const ins = App.M.instrumen[r.InstrumenID] || { _ind: [] }, s = pj(r.Skor, {}), obs = App.M.observasi[r.ObservasiID];
  modal({ drawer: true, judul: App.nama(r.GuruUserID), atas: '<div class="eyebrow">Refleksi Diri Guru</div>', sub: esc(App.namaSekolah(r.SekolahID)) + ' • ' + lalu(r.DiperbaruiPada) + (obs ? ' • Observasi ' + fTgl(obs.Tanggal) + ' (' + obs.NilaiTotal + '%)' : ''),
    isi: TANYA_REFLEKSI.map((t) => '<div class="soft mb-16"><div class="sb6 small" style="color:var(--brand-600)">' + t[1] + '</div><div style="white-space:pre-wrap;margin-top:6px">' + esc(r[t[0]] || '-') + '</div></div>').join('') +
      '<div class="row row-between"><b>Instrumen refleksi diri</b><span>' + badgePred(r.Kualitas) + ' <b>' + r.NilaiTotal + '%</b></span></div>' +
      ins._ind.map((i, n) => '<div class="ind-row"><span class="no">' + (n + 1) + '</span><div class="small">' + esc(i.teks) + '</div><span class="badge ' + (['pr-k', 'pr-c', 'pr-b', 'pr-sb'][(s[i.id] || {}).skor] || 'pr-n') + '">' + ((s[i.id] || {}).skor === undefined ? '-' : s[i.id].skor) + '</span></div>').join('') +
      '<div class="hr"></div><b>Tanggapan</b><div class="mt-8">' + komentarHtml(r.Komentar) + '</div>' +
      '<div class="field mt-16"><textarea class="inp" id="dr-kom" rows="3" placeholder="Tulis umpan balik pembinaan untuk guru…"></textarea></div>',
    kaki: (r.Status === 'Dikunci' ? '<button class="btn btn-out" id="dr-buka">' + ic('lock-open') + 'Buka Kunci</button>' : '<button class="btn btn-out" id="dr-kunci">' + ic('lock') + 'Setujui &amp; Kunci</button>') +
      '<a class="btn btn-out" href="#/tindak-lanjut/' + r.GuruUserID + '" data-tutup>' + ic('git-fork') + 'Tindak Lanjut</a><button class="btn btn-pri" id="dr-kirim">' + ic('send') + 'Kirim Tanggapan</button>',
    onBuka: (el, tutup) => {
      const aksi = (d, btn) => sibuk(btn, async () => {
        const res = await api('refleksiTanggapi', Object.assign({ RefleksiID: r.RefleksiID, komentar: el.querySelector('#dr-kom').value.trim() }, d));
        if (!hasilToast(res)) return;
        tutup(); App.upsert('refleksi', res.data.refleksi, 'RefleksiID');
      });
      el.querySelector('#dr-kirim').onclick = (e) => { if (!el.querySelector('#dr-kom').value.trim()) return toast('Tulis tanggapan terlebih dahulu.', 'error'); aksi({}, e.currentTarget); };
      const k = el.querySelector('#dr-kunci'), b = el.querySelector('#dr-buka');
      if (k) k.onclick = (e) => aksi({ kunci: true, setujui: true }, e.currentTarget);
      if (b) b.onclick = (e) => aksi({ buka: true }, e.currentTarget);
    } });
}
