import { auth } from "../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

// ── Meteoblue pictocode → emoji + label ──
const PICTO = {
  1:  { emoji: "☀️",  label: "Ensoleillé" },
  2:  { emoji: "🌤️", label: "Peu nuageux" },
  3:  { emoji: "⛅",  label: "Partiellement nuageux" },
  4:  { emoji: "☁️",  label: "Couvert" },
  5:  { emoji: "🌫️", label: "Brouillard" },
  6:  { emoji: "🌧️", label: "Pluvieux" },
  7:  { emoji: "🌦️", label: "Averses" },
  8:  { emoji: "🌨️", label: "Neigeux" },
  9:  { emoji: "🌨️", label: "Averses de neige" },
  10: { emoji: "⛈️", label: "Orageux" },
  11: { emoji: "⛈️", label: "Orage avec grêle" },
  12: { emoji: "🌧️", label: "Pluie verglaçante" },
  13: { emoji: "🌦️", label: "Pluie légère" },
  14: { emoji: "🌦️", label: "Bruine" },
  15: { emoji: "🌧️", label: "Pluie verglaçante forte" },
  16: { emoji: "🌨️", label: "Pluie et neige" },
  17: { emoji: "🌨️", label: "Grêle" },
  18: { emoji: "⛈️", label: "Orage violent" },
};

function pictoGradient(code) {
  if (code <= 2) return "linear-gradient(135deg, #f59e0b, #f97316)";       // sunny
  if (code <= 4) return "linear-gradient(135deg, #64748b, #475569)";       // cloudy
  if (code === 5) return "linear-gradient(135deg, #94a3b8, #64748b)";      // fog
  if (code <= 7 || (code >= 13 && code <= 14)) return "linear-gradient(135deg, #0284c7, #0ea5e9)"; // rain
  if (code <= 9 || code === 16 || code === 17) return "linear-gradient(135deg, #bfdbfe, #93c5fd)"; // snow
  return "linear-gradient(135deg, #1e293b, #334155)";                      // thunder
}

// ── 1-hour in-memory weather cache ──
let _weatherCache = { data: null, fetchedAt: 0 };

async function fetchMeteoblue() {
  const apiKey = process.env.METEOBLUE_API_KEY;
  if (!apiKey) return null;

  const now = Date.now();
  if (_weatherCache.data && now - _weatherCache.fetchedAt < 3_600_000) {
    return _weatherCache.data;
  }

  const url =
    `https://my.meteoblue.com/packages/basic-1h` +
    `?apikey=${apiKey}&lat=48.8267707824707&lon=2.35418963432312&asl=35&format=json&tz=Europe%2FParis`;

  const raw = await fetch(url, { cache: "no-store" }).then((r) => r.json());
  const d = raw?.data_1h;
  if (!d) return null;
  console.log("[meteoblue] data_1h fields:", Object.keys(d));

  const todayStr = new Date().toLocaleDateString("fr-CA"); // "YYYY-MM-DD" local
  const currentHour = new Date().getHours();

  // Filter to today's hours only
  const todayHours = d.time
    .map((t, i) => {
      const dateStr = t.slice(0, 10); // "YYYY-MM-DD"
      const hour = parseInt(t.slice(11, 13), 10);
      return { dateStr, hour, i };
    })
    .filter(({ dateStr }) => dateStr === todayStr);

  if (!todayHours.length) return null;

  // Current hour slot (or closest future)
  const currentSlot =
    todayHours.find(({ hour }) => hour >= currentHour) || todayHours[todayHours.length - 1];
  const ci = currentSlot.i;

  // meteoblue field names vary by package; try all known variants
  const tempArr = d.temperature ?? d.temp2m ?? d.temperature_mean ?? [];
  const humArr  = d.relativehumidity ?? d.humidity ?? d.relativehumidity_mean ?? [];
  const windArr = d.windspeed ?? d.windspeed_mean ?? d.wind_speed_10m ?? [];

  const code = d.pictocode?.[ci] ?? 1;
  const current = {
    temp: Math.round(tempArr[ci] ?? null),
    humidity: Math.round(humArr[ci] ?? 0),
    wind: Math.round(windArr[ci] ?? 0),
    pictocode: code,
    emoji: PICTO[code]?.emoji ?? "🌡️",
    label: PICTO[code]?.label ?? "",
    gradient: pictoGradient(code),
  };

  // Hourly strip: keep hours >= now, every 2h, max 7 slots
  const hourly = todayHours
    .filter(({ hour }) => hour >= currentHour)
    .filter((_, idx) => idx % 2 === 0)
    .slice(0, 7)
    .map(({ hour, i }) => {
      const c = d.pictocode?.[i] ?? 1;
      return {
        hour,
        temp: Math.round(tempArr[i] ?? null),
        emoji: PICTO[c]?.emoji ?? "🌡️",
        rain: d.rainspot?.[i] ?? 0,
      };
    });

  const result = { current, hourly };
  _weatherCache = { data: result, fetchedAt: now };
  return result;
}

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { weekStart: monday, weekEnd: sunday };
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const todayIso   = todayStart.toISOString().slice(0, 10); // "YYYY-MM-DD"

    const { weekStart, weekEnd } = getWeekRange();
    const wStartIso = weekStart.toISOString().slice(0, 10);
    const wEndIso   = weekEnd.toISOString().slice(0, 10);

    const db = await getDb();

    const [absences, employees, evenements, newContrats] = await Promise.all([
      db.collection("absences").find({
        startDate: { $lte: wEndIso },
        endDate:   { $gte: wStartIso },
      }).toArray(),

      db.collection("employees").find({}).toArray(),

      // Projets: today only
      db.collection("evenements").find({
        start: { $lte: todayEnd },
        end:   { $gte: todayStart },
      }).toArray(),

      db.collection("contrats").find({
        sourceBriefId: { $exists: true, $nin: [null, ""] },
        createdAt: { $gte: weekStart, $lte: weekEnd },
      }).toArray(),
    ]);

    const employeeMap = {};
    for (const emp of employees) employeeMap[String(emp._id)] = emp;

    // ── Vacances (semaine entière) ──
    const vacances = absences.map((a) => {
      const emp = employeeMap[String(a.employeeId)] || {};
      return {
        id: String(a._id),
        name: [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "Inconnu",
        startDate: a.startDate,
        endDate: a.endDate,
        type: a.type || "Absence",
      };
    });

    // ── Arrivants (semaine entière) ──
    const arrivants = employees
      .filter((emp) => {
        if (!emp.startDate) return false;
        const d = new Date(emp.startDate);
        return !isNaN(d.getTime()) && d >= weekStart && d <= weekEnd;
      })
      .map((emp) => ({
        id: String(emp._id),
        name: [emp.firstName, emp.lastName].filter(Boolean).join(" "),
        role: emp.role || emp.pole || "",
        startDate: emp.startDate,
      }));

    // ── Projets du jour: group by project, prefer ongoing phase ──
    const projetMap = {};
    for (const ev of evenements) {
      const key = ev.projet || "Sans nom";
      const evStart = new Date(ev.start);
      const evEnd   = new Date(ev.end);
      const isOngoing = evStart <= now && evEnd >= now;
      if (!projetMap[key] || isOngoing) projetMap[key] = ev;
    }
    const projets = Object.values(projetMap).map((ev) => ({
      projet: ev.projet || "Sans nom",
      phase: ev.phaseName || "En cours",
      phaseColor: ev.phaseColor || "#0ea5e9",
    }));

    // ── Briefs convertis cette semaine ──
    let briefsConvertis = [];
    if (newContrats.length > 0) {
      const briefObjectIds = newContrats
        .map((c) => { try { return new ObjectId(String(c.sourceBriefId)); } catch { return null; } })
        .filter(Boolean);
      const briefs = briefObjectIds.length > 0
        ? await db.collection("briefs").find({ _id: { $in: briefObjectIds } }).toArray()
        : [];
      const briefMap = {};
      for (const b of briefs) briefMap[String(b._id)] = b;
      briefsConvertis = newContrats.map((c) => {
        const brief = briefMap[String(c.sourceBriefId)] || {};
        return { id: String(c._id), briefName: brief.nomBrief || c.nomContrat || "Brief" };
      });
    }

    // ── External APIs in parallel ──
    const [weather, citationRaw] = await Promise.all([
      fetchMeteoblue().catch(() => null),
      fetch("https://zenquotes.io/api/today", {
        headers: { "User-Agent": "Spectra/1.0" },
        cache: "no-store",
      }).then((r) => r.json()).catch(() => null),
    ]);

    const citation = Array.isArray(citationRaw) && citationRaw.length > 0
      ? { quote: citationRaw[0].q, author: citationRaw[0].a }
      : null;

    return Response.json({
      vacances,
      arrivants,
      projets,
      briefsConvertis,
      weather,
      citation,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });
  } catch (error) {
    console.error("meteo-du-jour error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
