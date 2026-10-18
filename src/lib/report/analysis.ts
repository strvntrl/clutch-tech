import type {
  ChartPoint,
  ReportAnalysis,
  ReportKpi,
  ReportRow,
  TextSegment,
} from "@/types/report";

const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

export function emptyKpi(): ReportKpi {
  return { total_iot: 0, total_actual: 0, total_ng: 0, total_target: 0, achievement: 0 };
}

export function buildKpi(rows: ReportRow[]): ReportKpi {
  const k = emptyKpi();
  for (const r of rows) {
    k.total_iot += r.iot;
    k.total_actual += r.actual;
    k.total_ng += r.ng;
    k.total_target += r.target;
  }
  k.achievement = k.total_target > 0 ? round((k.total_actual / k.total_target) * 100, 1) : 0;
  return k;
}

/** Regresi linear y = a + b*x atas pasangan (x, y). */
function linearRegression(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const a = (sumY - b * sumX) / n;
  return { a, b };
}

/** Titik (indeks periode, pencapaian) yang punya data IOT. */
function validPoints(chart: ChartPoint[]): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  chart.forEach((p, i) => {
    if (p.ach !== null) {
      xs.push(i);
      ys.push(p.ach);
    }
  });
  return { xs, ys };
}

/**
 * Agregat per periode, URUTAN KRONOLOGIS (lama -> baru).
 * (Versi PHP memakai urutan terbaru-dulu sehingga arah tren terbalik.)
 */
export function buildChart(rows: ReportRow[]): ChartPoint[] {
  const byPeriode = new Map<string, { iot: number; actual: number; ng: number }>();
  for (const r of rows) {
    const d = byPeriode.get(r.periode) ?? { iot: 0, actual: 0, ng: 0 };
    d.iot += r.iot;
    d.actual += r.actual;
    d.ng += r.ng;
    byPeriode.set(r.periode, d);
  }

  const points: ChartPoint[] = [...byPeriode.keys()].sort().map((periode) => {
    const d = byPeriode.get(periode)!;
    return {
      periode,
      iot: d.iot,
      actual: d.actual,
      ng: d.ng,
      ngRate: d.actual > 0 ? round((d.ng / d.actual) * 100, 2) : 0,
      // periode tanpa data IOT: pencapaian tidak terdefinisi (bukan 0%), jangan ikut rata-rata & regresi
      ach: d.iot > 0 ? round((d.actual / d.iot) * 100, 1) : null,
      regresi: null,
    };
  });

  const { xs, ys } = validPoints(points);
  if (xs.length >= 2) {
    const { a, b } = linearRegression(xs, ys);
    points.forEach((p, i) => (p.regresi = round(a + b * i, 2)));
  } else {
    points.forEach((p) => (p.regresi = p.ach));
  }
  return points;
}

export function buildAnalysis(chart: ChartPoint[], kpi: ReportKpi): ReportAnalysis {
  const n = chart.length;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);

  const { xs, ys } = validPoints(chart);
  const hasAch = ys.length > 0;

  const avgAch = hasAch ? round(avg(ys), 1) : 0;
  const slope = xs.length >= 2 ? linearRegression(xs, ys).b : 0;
  const trend = slope > 0.3 ? "Meningkat" : slope < -0.3 ? "Menurun" : "Stabil";

  const ngRate = kpi.total_actual > 0 ? round((kpi.total_ng / kpi.total_actual) * 100, 2) : 0;

  const achStatus = !hasAch ? "tidak tersedia" : avgAch >= 100 ? "tercapai" : avgAch >= 90 ? "evaluasi" : "di bawah target";
  const achTone = !hasAch ? "blue" : avgAch >= 100 ? "green" : avgAch >= 90 ? "yellow" : "red";

  const trendSentence: TextSegment[] = !hasAch
    ? [{ text: "belum dapat dianalisis trennya karena tidak ada data IOT pada periode ini." }]
    : trend === "Meningkat"
      ? [
          { text: "menunjukkan tren " },
          { text: "meningkat", tone: "green" },
          { text: ", mengindikasikan perbaikan kinerja yang konsisten." },
        ]
      : trend === "Menurun"
      ? [
          { text: "menunjukkan tren " },
          { text: "menurun", tone: "red" },
          { text: ", yang memerlukan tindakan korektif segera." },
        ]
      : [
          { text: "menunjukkan tren " },
          { text: "stabil", tone: "blue" },
          { text: " tanpa perubahan signifikan." },
        ];

  let ngLevel: ReportAnalysis["ngLevel"];
  let ngSentence: TextSegment[];
  if (ngRate > 10) {
    ngLevel = "tinggi";
    ngSentence = [
      { text: "NG rate sebesar " },
      { text: `${ngRate}%`, tone: "red" },
      { text: " tergolong " },
      { text: "tinggi", bold: true },
      { text: " dan memerlukan investigasi mendalam." },
    ];
  } else if (ngRate > 5) {
    ngLevel = "sedang";
    ngSentence = [
      { text: "NG rate sebesar " },
      { text: `${ngRate}%`, tone: "yellow" },
      { text: " tergolong " },
      { text: "sedang", bold: true },
      { text: ", perlu pemantauan lebih ketat." },
    ];
  } else if (ngRate > 0) {
    ngLevel = "rendah";
    ngSentence = [
      { text: "NG rate sebesar " },
      { text: `${ngRate}%`, tone: "green" },
      { text: " tergolong " },
      { text: "rendah", bold: true },
      { text: " dan masih dalam batas toleransi." },
    ];
  } else {
    ngLevel = "tidak ada";
    ngSentence = [{ text: "tidak terdapat data NG yang tercatat pada periode ini." }];
  }

  const lowAch = hasAch && avgAch < 90;
  let recommendation: string;
  if (!hasAch) {
    recommendation =
      ngRate > 10
        ? "Data IOT belum tersedia sehingga pencapaian tidak dapat dinilai, namun tingkat NG tergolong tinggi. Prioritaskan investigasi penyebab NG dan pastikan pengumpulan data IoT berjalan."
        : "Data IOT belum tersedia pada periode ini. Pastikan pengumpulan data IoT berjalan agar pencapaian dan tren dapat dianalisis.";
  } else if (lowAch && ngRate > 10) {
    recommendation =
      "Lakukan investigasi menyeluruh terhadap penyebab rendahnya pencapaian dan tingginya NG. Prioritaskan analisis 5-Why pada mesin dan operator dengan frekuensi masalah tertinggi.";
  } else if (lowAch) {
    recommendation =
      "Evaluasi kapasitas mesin, jadwal perawatan, dan kecukupan tenaga operator. Pastikan target IOT sudah realistis berdasarkan kondisi aktual lantai produksi.";
  } else if (ngRate > 10) {
    recommendation =
      "Meskipun pencapaian produksi baik, tingkat NG yang tinggi menggerus kualitas output. Tingkatkan inspeksi awal shift dan review parameter proses secara berkala.";
  } else if (trend === "Menurun") {
    recommendation =
      "Pencapaian masih dalam batas, namun tren menurun perlu diwaspadai. Lakukan review mingguan dan identifikasi potensi bottleneck sejak dini.";
  } else {
    recommendation =
      "Pertahankan performa yang sudah baik. Dokumentasikan best practice yang berjalan dan jadikan acuan untuk area lain.";
  }

  return {
    hasAch,
    avgAch,
    trend,
    slope,
    ngRate,
    achStatus,
    achTone,
    ngLevel,
    trendSentence,
    ngSentence,
    recommendation,
    avgIot: n > 0 ? Math.round(avg(chart.map((p) => p.iot))) : 0,
    avgActual: n > 0 ? Math.round(avg(chart.map((p) => p.actual))) : 0,
  };
}

/** Teks polos dari potongan kalimat (untuk ekspor). */
export const segmentsToText = (segs: TextSegment[]) => segs.map((s) => s.text).join("");