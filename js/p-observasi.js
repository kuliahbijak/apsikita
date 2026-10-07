/**
 * p-observasi.js — Observasi Kelas: jadwal, input penilaian skala 0–3 per indikator,
 * riwayat & lembar hasil, serta pengelolaan instrumen observasi/refleksi.
 */
'use strict';
const KET_SKOR = ['Tidak ada / Kurang sekali', 'Kurang', 'Cukup', 'Baik / Sangat Baik'];
let _ob = { tab: 'jadwal', q: '' };

daftarHalaman('observasi', {
  judul: 'Observasi Kelas',
  formulir() { const p = parseHash().param[0]; return p === 'isi' || p === 'baru'; },
  render(el, param, q) {
    if (param[0] === 'instrumen') { _ob.tab = 'instrumen'; history.replaceState(null, '', '#/observasi'); }
    if (param[0] === 'isi' || param[0] === 'baru') {
      if (!App.isReviewer()) { go('observasi'); return; }
      const ox = param[0] === 'isi' && App.M.observasi[param[1]];
      if (ox && App.perluDetail(ox.GuruUserID)) { el.innerHTML = skeleton(3, 140); App.muatDetail(ox.GuruUserID).then((ok) => { if (ok && parseHash().param[1] === ox.ObservasiID) App.segarkanHalaman(); }); return; }
      return param[0] === 'isi' ? formObservasi(el, App.M.observasi[param[1]]) : pilihMulaiObservasi(el, param[1]);
    }
    if (App.role === 'GURU') obsGuru(el); else obsReviewer(el);
    if (q.get('id') && App.M.observasi[q.get('id')]) { setTimeout(() => lihatObservasi(q.get('id')), 30); history.replaceState(null, '', '#/observasi'); }
  }
});

function obsReviewer(el) {
  const obs = App.boot.observasi, gurus = App.guru(), minggu = isoHari(new Date(Date.now() + 7 * 864e5));
  const jadwal = obs.filter((o) => o.Status === 'Terjadwal' || o.Status === 'Draft').sort((a, b) => (a.Tanggal + a.JamMulai).localeCompare(b.Tanggal + b.JamMulai));
  const selesai = obs.filter((o) => o.Status === 'Selesai').sort((a, b) => b.Tanggal.localeCompare(a.Tanggal));
  const sudah = {}; selesai.forEach((o) => (sudah[o.GuruUserID] = 1)); const belum = gurus.filter((g) => !sudah[g.UserID]);
  const rata = selesai.length ? Math.round(selesai.reduce((t, o) => t + o.NilaiTotal, 0) / selesai.length) : 0;
  el.innerHTML = '<div class="ph"><div><div class="eyebrow">Supervisi / <b>Observasi Pembelajaran</b></div><h1>Observasi Kelas</h1><p>Jadwalkan kunjungan kelas, isi instrumen observasi skala 0–3, lalu kirim hasilnya ke guru untuk direfleksikan.</p></div>' +
    '<div class="ph-actions"><button class="btn btn-out" id="ob-jadwal">' + ic('calendar-plus') + 'Jadwalkan Observasi</button><a class="btn btn-pri" href="#/observasi/baru">' + ic('notebook-pen') + 'Isi Penilaian</a></div></div>' +
    '<div class="tabs"><button data-t="jadwal" class="' + (_ob.tab === 'jadwal' ? 'on' : '') + '">' + ic('calendar-days') + 'Jadwal &amp; Penilaian</button><button data-t="instrumen" class="' + (_ob.tab === 'instrumen' ? 'on' : '') + '">' + ic('clipboard-list') + 'Instrumen</button></div><div id="ob-isi"></div>';
  $$('[data-t]', el).forEach((b) => (b.onclick = () => { _ob.tab = b.dataset.t; App.segarkanHalaman(); }));
  $('#ob-jadwal').onclick = () => formJadwal();
  const box = $('#ob-isi');
  if (_ob.tab === 'instrumen') return daftarInstrumen(box);
  box.innerHTML = '<div class="cols-4">' + UI.kpi('Terjadwal (7 hari)', jadwal.filter((o) => o.Tanggal >= isoHari() && o.Tanggal <= minggu).length + ' <small>Kunjungan</small>', jadwal.length + ' total belum dinilai', 'calendar-clock', 'gold') +
    UI.kpi('Observasi Selesai', selesai.length + ' <small>Kelas</small>', Object.keys(sudah).length + ' guru teramati', 'circle-check', 'mint') + UI.kpi('Rata-rata Nilai', rata + '%', badgePred(HITUNG.predikat(rata, App.batas())), 'gauge') +
    UI.kpi('Belum Diobservasi', belum.length + ' <small>Guru</small>', 'dari ' + gurus.length + ' guru binaan', 'user-search') + '</div>' +
    '<div class="split mt-24"><div class="stack gap-20"><div class="card"><div class="card-head"><div><h3>Riwayat Penilaian</h3><div class="sub">' + esc(App.periode().Nama || '') + '</div></div><div class="inp-ic" style="width:260px">' + ic('search') + '<input class="inp inp-soft" id="ob-q" placeholder="Cari guru…" value="' + esc(_ob.q) + '"></div></div><div class="card-body" id="ob-tbl" style="padding:14px 0 0"></div></div></div>' +
    '<div class="stack gap-20"><div class="card"><div class="card-head"><h3>Agenda Terjadwal</h3><span class="chip chip-gold">' + jadwal.length + '</span></div><div class="card-body">' +
    (jadwal.length ? jadwal.slice(0, 12).map((o) => { const d = tgl(o.Tanggal) || new Date(), g = App.M.user[o.GuruUserID] || {};
      return '<div class="row gap-12 row-top" style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="center" style="width:52px;flex:none;border-radius:10px;background:' + (o.Tanggal < isoHari() ? 'var(--k-bg)' : 'var(--mint)') + ';padding:6px 0"><div class="tiny b">' + BLN[d.getMonth()] + '</div><div class="b" style="font-size:20px;line-height:1">' + d.getDate() + '</div></div>' +
        '<div class="grow" style="min-width:0"><div class="sb6 trunc">' + esc(g.Nama || '-') + '</div><div class="tiny muted">' + esc(o.JamMulai || '') + (o.JamSelesai ? '–' + esc(o.JamSelesai) : '') + ' • ' + esc(App.namaSekolah(o.SekolahID)) + '</div>' +
        '<div class="row row-wrap gap-8 mt-8">' + (o.Status === 'Draft' ? '<span class="badge st-info">Draf penilaian</span>' : '') + (o.KonfirmasiGuru === 'YA' ? '<span class="badge st-ok">' + ic('check') + 'Guru siap</span>' : '<span class="badge st-mute">Belum konfirmasi</span>') + '</div></div>' +
        '<div class="stack gap-4"><a class="btn btn-pri btn-xs" href="#/observasi/isi/' + o.ObservasiID + '">Isi</a>' + (o.Status === 'Terjadwal' ? '<button class="btn btn-ghost btn-xs" data-ubahj="' + o.ObservasiID + '">Ubah</button>' : '') + '</div></div>'; }).join('')
      : '<div class="muted small">Belum ada jadwal. Klik "Jadwalkan Observasi".</div>') + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Belum Diobservasi</h3><span class="chip">' + belum.length + '</span></div><div class="card-body"><div class="row row-wrap gap-8">' +
    (belum.length ? belum.slice(0, 30).map((g) => '<button class="chip" style="border:0;cursor:pointer" data-jg="' + g.UserID + '">' + ic('plus') + esc(g.Nama) + '</button>').join('') : '<span class="muted small">Semua guru sudah diobservasi. 🎉</span>') + '</div></div></div></div></div>';
  const isi = () => {
    const q = _ob.q.toLowerCase(), f = selesai.concat(jadwal.filter((o) => o.Status === 'Draft')).filter((o) => !q || App.nama(o.GuruUserID).toLowerCase().indexOf(q) > -1);
    $('#ob-tbl').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Guru</th><th>Penilai</th><th>Nilai</th><th>Status</th><th></th></tr></thead><tbody>' +
      (f.length ? f.map((o) => '<tr class="klik" data-id="' + o.ObservasiID + '"><td style="white-space:nowrap">' + fTgl(o.Tanggal) + '<div class="sub">' + esc(o.Topik || '') + '</div></td><td><div class="nm">' + esc(App.nama(o.GuruUserID)) + '</div><div class="sub">' + esc(App.namaSekolah(o.SekolahID)) + '</div></td>' +
        '<td class="small">' + esc(App.nama(o.ObserverUserID)) + '</td><td>' + (o.Status === 'Selesai' ? '<b>' + o.NilaiTotal + '%</b> ' + badgePred(o.Kualitas) : '-') + '</td><td><span class="badge ' + (o.Status === 'Selesai' ? 'st-ok' : 'st-info') + '">' + (o.Status === 'Selesai' ? 'Terkirim ke guru' : 'Draf') + '</span></td>' +
        '<td class="right" style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-cetak="' + o.ObservasiID + '" title="Cetak lembar observasi">' + ic('printer') + '</button>' + (o.ObserverUserID === App.uid || App.role === 'SUPERADMIN' ? '<a class="btn btn-ghost btn-sm" href="#/observasi/isi/' + o.ObservasiID + '" title="Ubah">' + ic('pencil') + '</a><button class="btn btn-ghost btn-sm" data-hapus="' + o.ObservasiID + '" title="Hapus">' + ic('trash-2') + '</button>' : '') + '</td></tr>').join('')
        : '<tr><td colspan="6">' + kosong('Belum ada penilaian', 'Hasil observasi yang sudah dinilai tampil di sini.', '', 'presentation') + '</td></tr>') + '</tbody></table></div>';
    $$('#ob-tbl tr[data-id]').forEach((tr) => (tr.onclick = (e) => { if (!e.target.closest('button,a')) lihatObservasi(tr.dataset.id); }));
    $$('#ob-tbl [data-cetak]').forEach((b) => (b.onclick = () => Dok.buat('LEMBAR_OBSERVASI', b.dataset.cetak)));
    $$('#ob-tbl [data-hapus]').forEach((b) => (b.onclick = () => hapusObservasi(b.dataset.hapus)));
  };
  $('#ob-q').oninput = debounce((e) => { _ob.q = e.target.value; isi(); }, 220);
  $$('[data-jg]', el).forEach((b) => (b.onclick = () => formJadwal(null, b.dataset.jg)));
  $$('[data-ubahj]', el).forEach((b) => (b.onclick = () => formJadwal(App.M.observasi[b.dataset.ubahj])));
  isi();
}
async function hapusObservasi(id) {
  if (!(await konfirmasi('Hapus observasi?', 'Data penilaian/jadwal ini akan dihapus permanen.', { bahaya: true, ya: 'Hapus' }))) return;
  const r = await api('observasiHapus', { ObservasiID: id });
  if (hasilToast(r)) App.buang('observasi', [id], 'ObservasiID');
}

function opsiGuruBerkelompok(pilih) {
  const per = {};
  App.guru().forEach((g) => { (per[g.SekolahID] = per[g.SekolahID] || []).push(g); });
  return '<option value="">Pilih guru…</option>' + Object.keys(per).map((sid) => '<optgroup label="' + esc(App.namaSekolah(sid)) + '">' + per[sid].map((g) => '<option value="' + g.UserID + '"' + (g.UserID === pilih ? ' selected' : '') + '>' + esc(g.Nama) + (g.Mapel ? ' — ' + esc(g.Mapel) : '') + '</option>').join('') + '</optgroup>').join('');
}
function instrumenAktif(tipe) { return App.boot.instrumen.filter((i) => i.Tipe === tipe && i.Aktif === 'YA'); }

function formJadwal(o, guruId) {
  o = o || {};
  const ins = instrumenAktif('Observasi');
  modal({ judul: o.ObservasiID ? 'Ubah Jadwal Observasi' : 'Jadwalkan Observasi Kelas', ukuran: 'lebar',
    isi: '<form id="fj"><div class="field"><label>Guru <span class="wajib">*</span></label><select class="inp" name="guruId"' + (o.ObservasiID ? ' disabled' : '') + '>' + opsiGuruBerkelompok(o.GuruUserID || guruId) + '</select></div>' +
      '<div class="field"><label>Instrumen observasi <span class="wajib">*</span></label><select class="inp" name="instrumenId">' + opsi(ins.map((i) => ({ v: i.InstrumenID, t: i.Nama + ' (' + i._ind.length + ' indikator)' })), o.InstrumenID || (ins[0] && ins[0].InstrumenID)) + '</select></div>' +
      '<div class="grid-3"><div class="field"><label>Tanggal <span class="wajib">*</span></label><input class="inp" type="date" name="tanggal" value="' + esc(o.Tanggal || isoHari(new Date(Date.now() + 864e5))) + '"></div>' +
      '<div class="field"><label>Jam mulai <span class="wajib">*</span></label><input class="inp" type="time" name="jamMulai" value="' + esc(o.JamMulai || '08:00') + '"></div><div class="field"><label>Jam selesai</label><input class="inp" type="time" name="jamSelesai" value="' + esc(o.JamSelesai || '09:30') + '"></div></div>' +
      '<div class="field"><label>Topik / materi</label><input class="inp" name="topik" value="' + esc(o.Topik || '') + '" placeholder="mis. Teks eksplanasi — Bab 3"></div></form>' +
      '<div class="callout">' + ic('bell') + '<span>Guru akan menerima notifikasi jadwal (in-app' + (App.setting('NOTIF_WA_AKTIF') === 'YA' ? ' + WhatsApp' : '') + ') dan bisa mengonfirmasi kesiapannya.</span></div>',
    kaki: (o.ObservasiID ? '<button class="btn btn-danger" id="fj-hapus">' + ic('trash-2') + 'Hapus</button><span class="grow"></span>' : '') + '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-pri" id="fj-ok">' + ic('calendar-check') + 'Simpan Jadwal</button>',
    onBuka: (el, tutup) => {
      el.querySelector('#fj-ok').onclick = (e) => sibuk(e.currentTarget, async () => {
        const d = formData(el.querySelector('#fj')); if (o.ObservasiID) { d.ObservasiID = o.ObservasiID; d.guruId = o.GuruUserID; }
        if (!d.guruId) return toast('Pilih guru.', 'error');
        const r = await api('observasiJadwal', d);
        if (hasilToast(r)) { tutup(); App.upsert('observasi', r.data.observasi, 'ObservasiID'); }
      });
      const h = el.querySelector('#fj-hapus'); if (h) h.onclick = () => { tutup(); hapusObservasi(o.ObservasiID); };
    } });
}

function pilihMulaiObservasi(el, guruId) {
  const jadwal = guruId && App.boot.observasi.find((o) => o.GuruUserID === guruId && (o.Status === 'Terjadwal' || o.Status === 'Draft'));
  if (jadwal) { history.replaceState(null, '', '#/observasi/isi/' + jadwal.ObservasiID); return formObservasi(el, jadwal); }
  formObservasi(el, null, guruId);
}

/** Formulir penilaian observasi (halaman penuh). */
function formObservasi(el, o, guruIdBaru) {
  if (!o && guruIdBaru === undefined && parseHash().param[0] === 'isi') { el.innerHTML = kosong('Observasi tidak ditemukan', '', '<a class="btn btn-pri" href="#/observasi">Kembali</a>'); return; }
  o = o || {};
  const ins0 = App.M.instrumen[o.InstrumenID] || instrumenAktif('Observasi')[0];
  const kunciDraf = uKey('drafObs:' + (o.ObservasiID || 'baru'));
  const draf = Store.get(kunciDraf, null);
  let skor = Object.assign({}, pj(o.Skor, {}), draf ? draf.skor : {}), insId = draf ? draf.instrumenId : (ins0 && ins0.InstrumenID);
  const guruId = o.GuruUserID || guruIdBaru || '';
  el.innerHTML = '<a class="back" href="#/observasi">' + ic('arrow-left') + 'Kembali ke Observasi</a>' +
    '<div class="ph"><div><div class="eyebrow">Instrumen Observasi / <b>' + (o.Status === 'Selesai' ? 'Ubah Penilaian' : 'Input Penilaian') + '</b></div><h1>Penilaian Observasi Kelas</h1><p>Beri skor 0–3 setiap indikator berdasarkan pengamatan langsung. Catatan per indikator bersifat opsional namun sangat membantu refleksi guru.</p></div></div>' +
    '<div class="card"><div class="card-body"><div class="grid-2"><div class="field"><label>Guru yang diobservasi</label><select class="inp" id="fo-guru"' + (o.ObservasiID ? ' disabled' : '') + '>' + opsiGuruBerkelompok(guruId) + '</select></div>' +
    '<div class="field"><label>Instrumen</label><select class="inp" id="fo-ins">' + opsi(instrumenAktif('Observasi').concat(ins0 && ins0.Aktif !== 'YA' ? [ins0] : []).map((i) => ({ v: i.InstrumenID, t: i.Nama })), insId) + '</select></div></div>' +
    '<div class="grid-3"><div class="field"><label>Tanggal</label><input class="inp" type="date" id="fo-tgl" value="' + esc((draf && draf.tanggal) || o.Tanggal || isoHari()) + '"></div><div class="field"><label>Jam</label><div class="row gap-8"><input class="inp" type="time" id="fo-jm" value="' + esc(o.JamMulai || '') + '"><input class="inp" type="time" id="fo-js" value="' + esc(o.JamSelesai || '') + '"></div></div>' +
    '<div class="field"><label>Topik</label><input class="inp" id="fo-topik" value="' + esc((draf && draf.topik) || o.Topik || '') + '"></div></div>' +
    (draf ? '<div class="callout gold">' + ic('history') + '<span>Draf yang belum terkirim dipulihkan dari perangkat ini. <a href="#" id="fo-buangdraf">Buang draf</a></span></div>' : '') + '</div>' +
    '<div class="card-body" style="padding-top:0"><div id="fo-ind"></div><div class="field mt-16"><label>Catatan umum observer</label><textarea class="inp" id="fo-cat" rows="4" placeholder="Kekuatan, hal yang perlu diperbaiki, dan saran tindak lanjut…">' + esc((draf && draf.catatan) || o.CatatanUmum || '') + '</textarea></div></div>' +
    '<div class="sticky-foot"><div class="row gap-16"><div><div class="tiny muted">Nilai sementara</div><div class="row gap-8"><b style="font-size:24px;color:var(--brand-900)" id="fo-nilai">0%</b><span id="fo-pred"></span></div></div><span class="small muted" id="fo-prog"></span></div>' +
    '<div class="row gap-8"><button class="btn btn-out" id="fo-draf">' + ic('save') + 'Simpan Draf</button><button class="btn btn-pri btn-lg" id="fo-kirim">' + ic('send') + 'Simpan + Kirim ke Guru</button></div></div></div>';
  let terkirim = false;
  const simpanLokal = () => { if (terkirim || !$('#fo-tgl')) return; Store.set(kunciDraf, { skor, instrumenId: insId, tanggal: $('#fo-tgl').value, topik: $('#fo-topik').value, catatan: $('#fo-cat').value, t: Date.now() }); };
  const hitung = () => {
    const ind = (App.M.instrumen[insId] || {})._ind || [], n = ind.filter((i) => skor[i.id] && skor[i.id].skor !== undefined && skor[i.id].skor !== '').length;
    const v = HITUNG.nilaiSkor(skor, ind);
    $('#fo-nilai').textContent = v + '%'; $('#fo-pred').innerHTML = badgePred(HITUNG.predikat(v, App.batas())); $('#fo-prog').textContent = n + ' dari ' + ind.length + ' indikator dinilai';
  };
  const renderInd = () => {
    const ins = App.M.instrumen[insId]; if (!ins) { $('#fo-ind').innerHTML = kosong('Belum ada instrumen observasi', 'Buat instrumen di tab Instrumen.', '', 'clipboard-list'); return; }
    let aspek = '', no = 0;
    $('#fo-ind').innerHTML = ins._ind.map((i) => {
      const s = skor[i.id] || {}, head = i.aspek && i.aspek !== aspek ? '<div class="aspek-h">' + esc(i.aspek) + '</div>' : ''; aspek = i.aspek; no++;
      return head + '<div class="ind-row" data-ind="' + i.id + '"><span class="no">' + no + '</span><div><div>' + esc(i.teks) + '</div><input class="inp inp-soft mt-8" style="height:36px;font-size:13px" data-cat="' + i.id + '" placeholder="Catatan (opsional)" value="' + esc(s.catatan || '') + '"></div>' +
        '<div class="skor-seg">' + [0, 1, 2, 3].map((v) => '<button type="button" class="s' + v + (s.skor !== undefined && s.skor !== '' && Number(s.skor) === v ? ' on' : '') + '" data-v="' + v + '" title="' + KET_SKOR[v] + '">' + v + '</button>').join('') + '</div></div>';
    }).join('');
    $$('#fo-ind .skor-seg button').forEach((b) => (b.onclick = () => {
      const id = b.closest('[data-ind]').dataset.ind; skor[id] = Object.assign({}, skor[id], { skor: Number(b.dataset.v) });
      $$('button', b.parentNode).forEach((x) => x.classList.toggle('on', x === b)); hitung(); simpanLokal();
    }));
    $$('#fo-ind [data-cat]').forEach((i) => (i.oninput = debounce(() => { skor[i.dataset.cat] = Object.assign({}, skor[i.dataset.cat], { catatan: i.value }); simpanLokal(); }, 300)));
    hitung();
  };
  $('#fo-ins').onchange = (e) => { insId = e.target.value; renderInd(); simpanLokal(); };
  ['fo-tgl', 'fo-topik', 'fo-cat'].forEach((id) => ($('#' + id).oninput = debounce(simpanLokal, 400)));
  if ($('#fo-buangdraf')) $('#fo-buangdraf').onclick = (e) => { e.preventDefault(); Store.del(kunciDraf); App.segarkanHalaman(); };
  const kirim = (final) => (e) => {
    const guru = $('#fo-guru').value; if (!guru) return toast('Pilih guru yang diobservasi.', 'error');
    sibuk(e.currentTarget, async () => {
      const r = await api('observasiSimpan', { ObservasiID: o.ObservasiID || '', guruId: guru, instrumenId: insId, skor, catatanUmum: $('#fo-cat').value, tanggal: $('#fo-tgl').value, jamMulai: $('#fo-jm').value, jamSelesai: $('#fo-js').value, topik: $('#fo-topik').value, kirim: final });
      if (!hasilToast(r)) return;
      if (final) terkirim = true;
      Store.del(kunciDraf);
      App.upsert('observasi', r.data.observasi, 'ObservasiID', { render: false });
      if (final) go('observasi'); else { history.replaceState(null, '', '#/observasi/isi/' + r.data.observasi.ObservasiID); o = r.data.observasi; }
    });
  };
  $('#fo-draf').onclick = kirim(false);
  $('#fo-kirim').onclick = kirim(true);
  renderInd();
}

function lihatObservasi(id) {
  const o = App.M.observasi[id]; if (!o) return;
  if (App.perluDetail(o.GuruUserID)) return denganDetail(o.GuruUserID, () => lihatObservasi(id));
  const ins = App.M.instrumen[o.InstrumenID] || { _ind: [] }, s = pj(o.Skor, {});
  let aspek = '';
  modal({ judul: 'Hasil Observasi — ' + App.nama(o.GuruUserID), ukuran: 'lebar', sub: fTglPanjang(o.Tanggal) + (o.JamMulai ? ' • ' + esc(o.JamMulai) + (o.JamSelesai ? '–' + esc(o.JamSelesai) : '') : '') + ' • Penilai: ' + esc(App.nama(o.ObserverUserID)),
    isi: '<div class="row row-wrap gap-16 soft"><div>' + donut(o.NilaiTotal, 90, 10) + '</div><div class="grow"><div class="b" style="font-size:18px">' + esc(ins.Nama || 'Instrumen') + '</div><div class="mt-8">' + badgePred(o.Kualitas) + '</div><div class="small muted mt-8">' + esc(o.Topik || '') + '</div></div></div>' +
      '<div class="mt-16">' + ins._ind.map((i, n) => { const x = s[i.id] || {}, h = i.aspek && i.aspek !== aspek ? '<div class="aspek-h">' + esc(i.aspek) + '</div>' : ''; aspek = i.aspek;
        return h + '<div class="ind-row"><span class="no">' + (n + 1) + '</span><div>' + esc(i.teks) + (x.catatan ? '<div class="small muted mt-8">💬 ' + esc(x.catatan) + '</div>' : '') + '</div><span class="badge ' + (['pr-k', 'pr-c', 'pr-b', 'pr-sb'][x.skor] || 'pr-n') + '" title="' + (KET_SKOR[x.skor] || '') + '">' + (x.skor === undefined ? '-' : x.skor) + '</span></div>'; }).join('') + '</div>' +
      (o.CatatanUmum ? '<div class="callout mt-16">' + ic('message-square-text') + '<div><b>Catatan umum</b><br>' + esc(o.CatatanUmum) + '</div></div>' : ''),
    kaki: '<button class="btn btn-out" id="lo-cetak">' + ic('printer') + 'Cetak Lembar</button>' + (App.uid === o.GuruUserID ? '<a class="btn btn-pri" href="#/refleksi" data-tutup>' + ic('pen-line') + 'Isi Refleksi</a>' : '<button class="btn btn-pri" data-tutup>Tutup</button>'),
    onBuka: (el) => { el.querySelector('#lo-cetak').onclick = () => Dok.buat('LEMBAR_OBSERVASI', o.ObservasiID); } });
}

function obsGuru(el) {
  const obs = App.boot.observasi.filter((o) => o.GuruUserID === App.uid);
  const jadwal = obs.filter((o) => o.Status === 'Terjadwal'), hasil = obs.filter((o) => o.Status === 'Selesai').sort((a, b) => b.Tanggal.localeCompare(a.Tanggal));
  el.innerHTML = '<div class="ph"><div><div class="eyebrow">Supervisi / <b>Observasi Saya</b></div><h1>Observasi Kelas</h1><p>Jadwal kunjungan kelas dan hasil penilaian dari kepala sekolah/pengawas. Setelah hasil terbit, lanjutkan dengan refleksi diri.</p></div></div>' +
    '<div class="sec-h" style="margin-top:0"><h2>Jadwal Mendatang</h2></div>' +
    (jadwal.length ? '<div class="cols-2">' + jadwal.map((o) => '<div class="card card-pad"><div class="row gap-12">' + '<span class="av av-sq av-lg" style="background:var(--gold-soft);color:var(--gold-ink)">' + ic('calendar-clock') + '</span><div class="grow"><div class="b" style="font-size:16px">' + fTglPanjang(o.Tanggal) + '</div><div class="small muted">' + esc(o.JamMulai) + (o.JamSelesai ? ' – ' + esc(o.JamSelesai) : '') + ' WIB • Penilai: ' + esc(App.nama(o.ObserverUserID)) + '</div>' + (o.Topik ? '<div class="small mt-8">Topik: ' + esc(o.Topik) + '</div>' : '') + '</div></div>' +
      '<div class="mt-16">' + (o.KonfirmasiGuru === 'YA' ? '<span class="chip chip-mint">' + ic('check') + 'Kesiapan sudah dikonfirmasi</span>' : '<button class="btn btn-dark" data-konfirmasi="' + o.ObservasiID + '">' + ic('hand') + 'Konfirmasi Kesiapan</button>') + '</div></div>').join('') + '</div>'
      : '<div class="card">' + kosong('Belum ada jadwal', 'Kepala sekolah/pengawas akan menjadwalkan observasi kelas Anda.', '', 'calendar') + '</div>') +
    '<div class="sec-h"><h2>Hasil Observasi</h2></div>' +
    (hasil.length ? '<div class="cols-2">' + hasil.map((o) => '<div class="card card-pad"><div class="row gap-16">' + donut(o.NilaiTotal, 84, 9) + '<div class="grow"><div class="row row-between"><b style="font-size:16px">' + fTgl(o.Tanggal) + '</b>' + badgePred(o.Kualitas) + '</div><div class="small muted">Penilai: ' + esc(App.nama(o.ObserverUserID)) + '</div>' +
      (o.CatatanUmum ? '<div class="small mt-8" style="color:var(--ink-2)">"' + esc(o.CatatanUmum.slice(0, 160)) + (o.CatatanUmum.length > 160 ? '…' : '') + '"</div>' : '') + '</div></div><div class="row gap-8 mt-16"><button class="btn btn-out btn-sm" data-lihat="' + o.ObservasiID + '">' + ic('eye') + 'Rincian</button><button class="btn btn-out btn-sm" data-cetak="' + o.ObservasiID + '">' + ic('printer') + 'Cetak</button><a class="btn btn-pri btn-sm" href="#/refleksi">' + ic('pen-line') + 'Refleksi</a></div></div>').join('') + '</div>'
      : '<div class="card">' + kosong('Belum ada hasil', 'Hasil observasi akan tampil setelah penilai mengirimkannya.', '', 'presentation') + '</div>');
  UI.pasangKonfirmasi(el);
  $$('[data-lihat]', el).forEach((b) => (b.onclick = () => lihatObservasi(b.dataset.lihat)));
  $$('[data-cetak]', el).forEach((b) => (b.onclick = () => Dok.buat('LEMBAR_OBSERVASI', b.dataset.cetak)));
}

// ============================================================================ INSTRUMEN
function daftarInstrumen(box) {
  const list = App.boot.instrumen.slice().sort((a, b) => (a.Tipe + a.Nama).localeCompare(b.Tipe + b.Nama));
  box.innerHTML = '<div class="row row-between mb-16"><div class="muted">Instrumen dipakai untuk observasi kelas (penilai) dan refleksi diri (guru). Skala 0–3 per indikator.</div><button class="btn btn-pri" id="in-baru">' + ic('plus') + 'Instrumen Baru</button></div>' +
    '<div class="cols-3">' + list.map((i) => { const milik = i.DibuatOleh === App.uid || App.role === 'SUPERADMIN';
      return '<div class="card card-pad stack gap-12"><div class="row row-between"><span class="badge ' + (i.Tipe === 'Observasi' ? 'st-info' : 'st-wait') + '">' + esc(i.Tipe) + '</span>' + (i.Aktif !== 'YA' ? '<span class="badge st-mute">Nonaktif</span>' : '') + '</div>' +
        '<div><div class="b" style="font-size:16px">' + esc(i.Nama) + '</div><div class="small muted mt-8">' + esc(i.Deskripsi || '') + '</div></div>' +
        '<div class="row row-wrap gap-8 small muted"><span class="chip chip-sm">' + i._ind.length + ' indikator</span><span class="chip chip-sm">' + (i.DibuatOleh === 'SISTEM' ? 'Bawaan sistem' : esc(App.nama(i.DibuatOleh))) + '</span>' + (i.SekolahID ? '<span class="chip chip-sm">' + esc(App.namaSekolah(i.SekolahID)) + '</span>' : '<span class="chip chip-sm">Semua sekolah</span>') + '</div>' +
        '<div class="row gap-8 mt-8"><button class="btn btn-out btn-sm" data-pv="' + i.InstrumenID + '">' + ic('eye') + 'Pratinjau</button>' + (milik ? '<button class="btn btn-out btn-sm" data-ed="' + i.InstrumenID + '">' + ic('pencil') + 'Ubah</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-dup="' + i.InstrumenID + '" title="Duplikat">' + ic('copy') + '</button>' + (milik ? '<button class="btn btn-ghost btn-sm" data-del="' + i.InstrumenID + '" title="Hapus">' + ic('trash-2') + '</button>' : '') + '</div></div>'; }).join('') + '</div>';
  $('#in-baru').onclick = () => formInstrumen();
  $$('[data-pv]', box).forEach((b) => (b.onclick = () => pratinjauInstrumen(App.M.instrumen[b.dataset.pv])));
  $$('[data-ed]', box).forEach((b) => (b.onclick = () => formInstrumen(App.M.instrumen[b.dataset.ed])));
  $$('[data-dup]', box).forEach((b) => (b.onclick = () => { const i = App.M.instrumen[b.dataset.dup]; formInstrumen({ Tipe: i.Tipe, Nama: i.Nama + ' (salinan)', Deskripsi: i.Deskripsi, _ind: i._ind.map((x) => ({ aspek: x.aspek, teks: x.teks })), Dibagikan: 'YA', Aktif: 'YA' }); }));
  $$('[data-del]', box).forEach((b) => (b.onclick = async () => {
    const i = App.M.instrumen[b.dataset.del];
    if (!(await konfirmasi('Hapus instrumen?', '"' + esc(i.Nama) + '" akan dihapus (atau dinonaktifkan bila sudah dipakai).', { bahaya: true, ya: 'Hapus' }))) return;
    const r = await api('instrumenHapus', { InstrumenID: i.InstrumenID });
    if (!hasilToast(r)) return;
    if (r.data.mode === 'hapus') App.buang('instrumen', [i.InstrumenID], 'InstrumenID'); else App.upsert('instrumen', r.data.instrumen, 'InstrumenID');
  }));
}
function pratinjauInstrumen(i) {
  let aspek = '';
  modal({ judul: i.Nama, ukuran: 'lebar', sub: i.Tipe + ' • ' + i._ind.length + ' indikator • skala 0–3', isi: (i.Deskripsi ? '<p class="muted">' + esc(i.Deskripsi) + '</p>' : '') + i._ind.map((x, n) => { const h = x.aspek && x.aspek !== aspek ? '<div class="aspek-h">' + esc(x.aspek) + '</div>' : ''; aspek = x.aspek; return h + '<div class="ind-row"><span class="no">' + (n + 1) + '</span><div>' + esc(x.teks) + '</div><div class="skor-seg">' + [0, 1, 2, 3].map((v) => '<button type="button" disabled>' + v + '</button>').join('') + '</div></div>'; }).join('') +
    '<div class="soft small mt-16">' + KET_SKOR.map((k, v) => '<b>' + v + '</b> = ' + k).join(' • ') + '</div>', kaki: '<button class="btn btn-pri" data-tutup>Tutup</button>' });
}
function formInstrumen(i) {
  i = i || { Tipe: 'Observasi', _ind: [{ aspek: 'Pendahuluan', teks: '' }], Dibagikan: 'YA', Aktif: 'YA' };
  let ind = (i._ind || []).map((x) => Object.assign({}, x));
  modal({ judul: i.InstrumenID ? 'Ubah Instrumen' : 'Instrumen Baru', ukuran: 'xl',
    isi: '<div class="grid-2"><div class="field"><label>Nama instrumen <span class="wajib">*</span></label><input class="inp" id="fi-nama" value="' + esc(i.Nama || '') + '"></div><div class="field"><label>Tipe</label><select class="inp" id="fi-tipe">' + opsi(['Observasi', 'Refleksi'], i.Tipe) + '</select></div></div>' +
      '<div class="field"><label>Deskripsi</label><input class="inp" id="fi-des" value="' + esc(i.Deskripsi || '') + '"></div>' +
      '<div class="row row-between mt-8"><b>Indikator (skala 0–3)</b><button class="btn btn-out btn-sm" id="fi-tambah">' + ic('plus') + 'Tambah indikator</button></div><div id="fi-list" class="mt-12"></div>' +
      '<div class="row row-wrap gap-20 mt-16"><label class="switch"><input type="checkbox" id="fi-bagi"' + (i.Dibagikan !== 'TIDAK' ? ' checked' : '') + '><span class="trk"></span>Bagikan ke penilai lain</label><label class="switch"><input type="checkbox" id="fi-aktif"' + (i.Aktif !== 'TIDAK' ? ' checked' : '') + '><span class="trk"></span>Aktif</label></div>',
    kaki: '<button class="btn btn-out" data-tutup>Batal</button><button class="btn btn-out" id="fi-pv">' + ic('eye') + 'Pratinjau</button><button class="btn btn-pri" id="fi-ok">' + ic('save') + 'Simpan Instrumen</button>',
    onBuka: (el, tutup) => {
      const render = () => {
        el.querySelector('#fi-list').innerHTML = ind.map((x, n) => '<div class="row row-top gap-8 mb-16" data-n="' + n + '"><span class="no" style="width:28px;height:28px;border-radius:8px;background:var(--surface-3);display:grid;place-items:center;font-weight:700;flex:none;margin-top:6px">' + (n + 1) + '</span>' +
          '<input class="inp" style="max-width:180px" data-f="aspek" placeholder="Aspek" value="' + esc(x.aspek || '') + '"><textarea class="inp" style="min-height:44px" rows="1" data-f="teks" placeholder="Bunyi indikator…">' + esc(x.teks || '') + '</textarea>' +
          '<div class="stack"><button class="btn btn-ghost btn-xs" data-up="' + n + '" title="Naik">' + ic('chevron-up') + '</button><button class="btn btn-ghost btn-xs" data-down="' + n + '" title="Turun">' + ic('chevron-down') + '</button></div><button class="btn btn-ghost btn-sm" data-rm="' + n + '" title="Hapus">' + ic('x') + '</button></div>').join('');
        $$('[data-f]', el).forEach((inp) => (inp.oninput = () => { ind[Number(inp.closest('[data-n]').dataset.n)][inp.dataset.f] = inp.value; }));
        $$('[data-rm]', el).forEach((b) => (b.onclick = () => { ind.splice(Number(b.dataset.rm), 1); render(); }));
        $$('[data-up]', el).forEach((b) => (b.onclick = () => { const n = Number(b.dataset.up); if (n > 0) { [ind[n - 1], ind[n]] = [ind[n], ind[n - 1]]; render(); } }));
        $$('[data-down]', el).forEach((b) => (b.onclick = () => { const n = Number(b.dataset.down); if (n < ind.length - 1) { [ind[n + 1], ind[n]] = [ind[n], ind[n + 1]]; render(); } }));
      };
      el.querySelector('#fi-tambah').onclick = () => { ind.push({ aspek: (ind[ind.length - 1] || {}).aspek || '', teks: '' }); render(); const t = $$('[data-f=teks]', el).pop(); if (t) t.focus(); };
      el.querySelector('#fi-pv').onclick = () => pratinjauInstrumen({ Nama: el.querySelector('#fi-nama').value || 'Pratinjau', Tipe: el.querySelector('#fi-tipe').value, Deskripsi: el.querySelector('#fi-des').value, _ind: ind.filter((x) => x.teks) });
      el.querySelector('#fi-ok').onclick = (e) => sibuk(e.currentTarget, async () => {
        const r = await api('instrumenSimpan', { InstrumenID: i.InstrumenID || '', Nama: el.querySelector('#fi-nama').value, Tipe: el.querySelector('#fi-tipe').value, Deskripsi: el.querySelector('#fi-des').value,
          Indikator: ind.filter((x) => String(x.teks || '').trim()), Dibagikan: el.querySelector('#fi-bagi').checked ? 'YA' : 'TIDAK', Aktif: el.querySelector('#fi-aktif').checked ? 'YA' : 'TIDAK' });
        if (hasilToast(r)) { tutup(); App.upsert('instrumen', r.data.instrumen, 'InstrumenID'); }
      });
      render();
    } });
}
