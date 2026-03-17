import { auth } from "../../../lib/auth";
import { headers } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
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

    const { weekStart, weekEnd } = getWeekRange();
    const wStartIso = weekStart.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const wEndIso = weekEnd.toISOString().slice(0, 10);

    const db = await getDb();

    const [absences, employees, evenements, newContrats] = await Promise.all([
      // Absences overlapping this week (stored as "YYYY-MM-DD" strings)
      db.collection("absences").find({
        startDate: { $lte: wEndIso },
        endDate:   { $gte: wStartIso },
      }).toArray(),

      // All employees (to join names + detect arrivants)
      db.collection("employees").find({}).toArray(),

      // Calendar events overlapping this week (stored as Date objects)
      db.collection("evenements").find({
        start: { $lte: weekEnd },
        end:   { $gte: weekStart },
      }).toArray(),

      // Contrats created this week that come from a brief
      db.collection("contrats").find({
        sourceBriefId: { $exists: true, $nin: [null, ""] },
        createdAt: { $gte: weekStart, $lte: weekEnd },
      }).toArray(),
    ]);

    // Employee lookup map
    const employeeMap = {};
    for (const emp of employees) employeeMap[String(emp._id)] = emp;

    // ── Vacances ──
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

    // ── Arrivants: employees whose startDate is this week ──
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

    // ── Projets en cours: group by project, keep current/latest phase ──
    const projetMap = {};
    const now = new Date();
    for (const ev of evenements) {
      const key = ev.projet || "Sans nom";
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
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
        return {
          id: String(c._id),
          briefName: brief.nomBrief || c.nomContrat || "Brief",
          createdAt: c.createdAt,
        };
      });
    }

    // ── External APIs (in parallel) ──
    const weatherApiKey = process.env.OPENWEATHERMAP_API_KEY;
    let weather = null;
    let citation = null;

    await Promise.all([
      weatherApiKey
        ? fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=48.8276&lon=2.3619&appid=${weatherApiKey}&units=metric&lang=fr`,
            { cache: "no-store" }
          )
            .then((r) => r.json())
            .then((d) => { weather = d; })
            .catch(() => {})
        : Promise.resolve(),

      fetch("https://zenquotes.io/api/today", {
        headers: { "User-Agent": "Spectra/1.0" },
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d) && d.length > 0) citation = { quote: d[0].q, author: d[0].a };
        })
        .catch(() => {}),
    ]);

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
