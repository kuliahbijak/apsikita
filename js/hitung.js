/**
 * Hitung.gs — rumus rekap supervisi (perencanaan, observasi, refleksi, tindak lanjut).
 * File ini DIPAKAI BERSAMA backend & frontend: salinan identik ada di frontend/js/hitung.js
 * sehingga angka di dashboard (dihitung di browser, instan) = angka di laporan PDF (server).
 * Tanpa ketergantungan layanan Google — JavaScript murni.
 */
var HITUNG = (function () {
  function angka(x) { x = Number(x); return isNaN(x) ? 0 : x; }
  function rata(a) {
    var b = (a || []).map(angka);
    return b.length ? b.reduce(function (s, x) { return s + x; }, 0) / b.length : 0;
  }
  function bulat(x) { return Math.round(angka(x)); }
  function predikat(n, b) {
    b = b || { sb: 86, b: 71, c: 56 };
    n = angka(n);
    if (n >= b.sb) return 'Sangat Baik';
    if (n >= b.b) return 'Baik';
    if (n >= b.c) return 'Cukup';
    return 'Kurang';
  }
  /** skor = {indikatorId:{skor:0..3, catatan}} → persen 0..100 terhadap daftar indikator. */
  function nilaiSkor(skor, indikator) {
    skor = skor || {};
    var ids = (indikator && indikator.length) ? indikator.map(function (i) { return i.id; }) : Object.keys(skor);
    if (!ids.length) return 0;
    var total = 0;
    ids.forEach(function (id) { var s = skor[id]; total += angka(s && typeof s === 'object' ? s.skor : s); });
    return bulat(total / (3 * ids.length) * 100);
  }
  /** Kelompokkan data periode per guru agar rekap ratusan guru tetap cepat. */
  function kelompok(d) {
    var idx = {};
    function k(id) { return idx[id] || (idx[id] = { perangkat: [], observasi: [], refleksi: [], tindakLanjut: [] }); }
    (d.perangkat || []).forEach(function (r) { k(r.GuruUserID).perangkat.push(r); });
    (d.observasi || []).forEach(function (r) { k(r.GuruUserID).observasi.push(r); });
    (d.refleksi || []).forEach(function (r) { k(r.GuruUserID).refleksi.push(r); });
    (d.tindakLanjut || []).forEach(function (r) { k(r.GuruUserID).tindakLanjut.push(r); });
    return idx;
  }
  function terbaru(a, kolom) {
    return a.slice().sort(function (x, y) { return String(y[kolom] || '').localeCompare(String(x[kolom] || '')); })[0];
  }

  /** Rekap satu guru. idx = hasil kelompok(d). */
  function guru(g, idx, b) {
    var x = idx[g.UserID] || { perangkat: [], observasi: [], refleksi: [], tindakLanjut: [] };
    var dianalisis = x.perangkat.filter(function (p) { return p.StatusAnalisis === 'Selesai'; });
    var obsSelesai = x.observasi.filter(function (o) { return o.Status === 'Selesai'; });
    var refKirim = x.refleksi.filter(function (r) { return r.Status === 'Dikirim' || r.Status === 'Dikunci'; });
    var tlAktif = x.tindakLanjut.filter(function (t) { return t.Status === 'Assigned' || t.Status === 'Selesai' || t.Status === 'Closed'; });
    var tlDraft = x.tindakLanjut.filter(function (t) { return t.Status === 'AI-Draft' || t.Status === 'Draft'; });

    var per = bulat(rata(dianalisis.map(function (p) { return p.SkorAI; })));
    var obs = bulat(rata(obsSelesai.map(function (o) { return o.NilaiTotal; })));
    var ref = bulat(rata(refKirim.map(function (r) { return r.NilaiTotal; })));
    var tl = bulat(rata(tlAktif.map(function (t) { return (t.Status === 'Selesai' || t.Status === 'Closed') ? 100 : t.Progress; })));
    var nilai = bulat((per + obs + ref + tl) / 4);

    // --- status 4 tahapan (timeline guru) ---
    var t1, t2, t3, t4;
    var appr = x.perangkat.filter(function (p) { return p.StatusApproval === 'Approved'; });
    var pTerbaru = terbaru(x.perangkat, 'TanggalUpload');
    if (!x.perangkat.length) t1 = { status: 'belum', label: 'Belum Unggah' };
    else if (appr.length) t1 = { status: 'selesai', label: 'Selesai • ' + per + '% ' + predikat(per, b), tanggal: terbaru(appr, 'ReviewedAt').ReviewedAt };
    else if (pTerbaru.StatusApproval === 'Rejected') t1 = { status: 'revisi', label: 'Perlu Revisi', tanggal: pTerbaru.ReviewedAt };
    else if (pTerbaru.StatusAnalisis !== 'Selesai') t1 = { status: 'proses', label: 'Dianalisis AI', tanggal: pTerbaru.TanggalUpload };
    else t1 = { status: 'proses', label: 'Menunggu Review', tanggal: pTerbaru.TanggalUpload };
    t1.skor = per;

    var jadwal = x.observasi.filter(function (o) { return o.Status === 'Terjadwal'; });
    if (obsSelesai.length) t2 = { status: 'selesai', label: 'Selesai • ' + obs + '% ' + predikat(obs, b), tanggal: terbaru(obsSelesai, 'Tanggal').Tanggal };
    else if (x.observasi.some(function (o) { return o.Status === 'Draft'; })) t2 = { status: 'proses', label: 'Penilaian Berlangsung' };
    else if (jadwal.length) t2 = { status: 'terjadwal', label: 'Terjadwal', tanggal: terbaru(jadwal, 'Tanggal').Tanggal, observasiId: terbaru(jadwal, 'Tanggal').ObservasiID };
    else t2 = { status: 'belum', label: 'Menunggu Jadwal' };
    t2.skor = obs;

    if (refKirim.length) t3 = { status: 'selesai', label: 'Terkirim • ' + ref + '%', tanggal: terbaru(refKirim, 'DiperbaruiPada').DiperbaruiPada };
    else if (x.refleksi.length) t3 = { status: 'proses', label: 'Draf Tersimpan' };
    else t3 = { status: obsSelesai.length ? 'siap' : 'terkunci', label: obsSelesai.length ? 'Siap Diisi' : 'Belum Dimulai' };
    t3.skor = ref;

    var tlBeres = tlAktif.filter(function (t) { return t.Status === 'Selesai' || t.Status === 'Closed'; });
    if (tlAktif.length && tlBeres.length === tlAktif.length) t4 = { status: 'selesai', label: 'Tuntas • ' + tlAktif.length + ' rencana' };
    else if (tlAktif.length) t4 = { status: 'proses', label: tlBeres.length + '/' + tlAktif.length + ' tuntas • ' + tl + '%' };
    else if (tlDraft.length) t4 = { status: 'menunggu', label: 'Menunggu Penetapan' };
    else t4 = { status: refKirim.length ? 'siap' : 'terkunci', label: 'Belum Dimulai' };
    t4.skor = tl;

    var tahap = [t1, t2, t3, t4];
    var selesai = tahap.filter(function (t) { return t.status === 'selesai'; }).length;
    var sebagian = tahap.filter(function (t) { return t.status === 'proses' || t.status === 'terjadwal' || t.status === 'menunggu' || t.status === 'revisi'; }).length;
    var mulai = !!(x.perangkat.length || x.observasi.length || x.refleksi.length || x.tindakLanjut.length);
    return {
      perencanaan: per, observasi: obs, refleksi: ref, tindakLanjut: tl, nilai: nilai,
      predikat: mulai ? predikat(nilai, b) : 'Belum Mulai', mulai: mulai,
      tahap: tahap, tahapSelesai: selesai, persenTahap: bulat((selesai + sebagian * 0.5) / 4 * 100),
      jumlah: { perangkat: x.perangkat.length, observasi: obsSelesai.length, refleksi: refKirim.length, tlAktif: tlAktif.length, tlDraft: tlDraft.length }
    };
  }

  /** Rekap satu sekolah dari rekap guru-gurunya. */
  function sekolah(s, daftarRekapGuru, b) {
    var r = daftarRekapGuru || [];
    var hitung = { 'Sangat Baik': 0, 'Baik': 0, 'Cukup': 0, 'Kurang': 0, 'Belum Mulai': 0 };
    r.forEach(function (x) { hitung[x.predikat] = (hitung[x.predikat] || 0) + 1; });
    var per = bulat(rata(r.map(function (x) { return x.perencanaan; })));
    var obs = bulat(rata(r.map(function (x) { return x.observasi; })));
    var ref = bulat(rata(r.map(function (x) { return x.refleksi; })));
    var tl = bulat(rata(r.map(function (x) { return x.tindakLanjut; })));
    var nilai = bulat((per + obs + ref + tl) / 4);
    var mulai = r.some(function (x) { return x.mulai; });
    return {
      jumlahGuru: r.length, perencanaan: per, observasi: obs, refleksi: ref, tindakLanjut: tl, nilai: nilai,
      predikat: mulai ? predikat(nilai, b) : 'Belum Mulai', mulai: mulai, sebaran: hitung,
      guruDiobservasi: r.filter(function (x) { return x.jumlah.observasi > 0; }).length,
      tlAktif: r.reduce(function (s2, x) { return s2 + x.jumlah.tlAktif; }, 0)
    };
  }

  return { angka: angka, rata: rata, bulat: bulat, predikat: predikat, nilaiSkor: nilaiSkor, kelompok: kelompok, guru: guru, sekolah: sekolah };
})();
