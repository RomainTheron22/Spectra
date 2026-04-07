"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./Calendrier.module.css";
import Modal from "../../components/ui/Modal";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import frLocale from "@fullcalendar/core/locales/fr";

const BRANCHES = ["Agency", "CreativeGen", "Enterntainement", "SFX"];

const STANDARD_PHASES = [
  { name: "Conception", emoji: "🧠" },
  { name: "Construction atelier", emoji: "🔧" },
  { name: "Tournage", emoji: "🎥" },
  { name: "Livraison", emoji: "🚚" },
  { name: "Autre (personnalisé)", emoji: "✨" },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toYMD(d) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function toDateTimeLocalValue(d) {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(
    x.getHours()
  )}:${pad(x.getMinutes())}`;
}

function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getFrenchHolidays(year) {
  const easter = getEaster(year);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return new Set([
    `${year}-01-01`, // Jour de l'An
    fmt(addDays(easter, 1)),   // Lundi de Pâques
    `${year}-05-01`, // Fête du Travail
    `${year}-05-08`, // Victoire 1945
    fmt(addDays(easter, 39)),  // Ascension
    fmt(addDays(easter, 50)),  // Lundi de Pentecôte
    `${year}-07-14`, // Fête Nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ]);
}

// Pré-calculer pour les 2 prochaines années
const HOLIDAYS = new Set([
  ...getFrenchHolidays(new Date().getFullYear()),
  ...getFrenchHolidays(new Date().getFullYear() + 1),
]);

function getCurrentMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toExclusiveEnd(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Fonction de génération des teintes pour les phases
function hexToHSL(H) {
  let r = 0, g = 0, b = 0;
  if (H.length === 4) {
    r = parseInt(H[1] + H[1], 16);
    g = parseInt(H[2] + H[2], 16);
    b = parseInt(H[3] + H[3], 16);
  } else if (H.length === 7) {
    r = parseInt(H[1] + H[2], 16);
    g = parseInt(H[3] + H[4], 16);
    b = parseInt(H[5] + H[6], 16);
  }
  r /= 255; g /= 255; b /= 255;
  const cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin;
  let h = 0, s = 0, l = 0;
  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h = Math.round(h * 60); if (h < 0) h += 360;
  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1); l = +(l * 100).toFixed(1);
  return { h, s, l };
}

function getPhaseColor(baseHex, index) {
  if (!baseHex) baseHex = "#0ea5e9";
  const { h, s, l } = hexToHSL(baseHex);
  const variations = [
    { dh: 0, ds: 0, dl: 20 },      // Clair
    { dh: 0, ds: 0, dl: 0 },       // Base
    { dh: 15, ds: 5, dl: -15 },    // Foncé/décalé (ex: Bleu foncé / Violet)
    { dh: 0, ds: -40, dl: 15 },    // Grisé/Pâle
    { dh: -15, ds: 15, dl: 5 },    // Sursaturé
  ];
  const v = variations[index % variations.length];
  let newH = (h + v.dh) % 360; if (newH < 0) newH += 360;
  let newS = Math.max(0, Math.min(100, s + v.ds));
  let newL = Math.max(0, Math.min(100, l + v.dl));
  return `hsl(${newH}, ${newS}%, ${newL}%)`;
}

function eventToPlainObject(eventLike) {
  const ext = eventLike?.extendedProps || {};
  return {
    id: eventLike?.id ? String(eventLike.id) : "",
    start: eventLike?.start || null,
    end: eventLike?.end || null,
    allDay: !!eventLike?.allDay,
    branche: ext?.branche || "",
    projet: ext?.projet || "",
    phaseName: ext?.phaseName || "",
    phaseColor: ext?.phaseColor || "#0ea5e9",
    lieu: ext?.lieu || "",
    commentaires: ext?.commentaires || "",
    source: ext?.source || "evenement",
    prestataireNom: ext?.prestataireNom || "",
    tarifTotal: ext?.tarifTotal ?? null,
    missionId: ext?.missionId || "",
    prestataireId: ext?.prestataireId || "",
  };
}

export default function CalendrierPage() {
  const [rows, setRows] = useState([]); // events DB
  const [prestataires, setPrestataires] = useState([]);
  const [projetOptions, setProjetOptions] = useState([]);
  const [projetBranchMap, setProjetBranchMap] = useState({});

  const [filterBranche, setFilterBranche] = useState("");
  const [filterProjet, setFilterProjet] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // === NEW MODAL FOR PROJECT
  const [openProject, setOpenProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    nom: "",
    branche: "Agency",
    color: "#38bdf8",
    phases: []
  });

  // === EDIT (SINGLE PHASE) MODAL
  const [openSingle, setOpenSingle] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [singleForm, setSingleForm] = useState({});

  // === DETAIL MODAL
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);

  // 1. Appels API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (filterBranche) params.set("branche", filterBranche);
        if (filterProjet) params.set("projet", filterProjet);
        if (searchQuery.trim()) params.set("q", searchQuery.trim());

        const url = params.toString() ? `/api/evenements?${params}` : `/api/evenements`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(`${data?.error || "Erreur"}`);
        if (!cancelled) setRows((data.items || []).map((d) => ({ ...d, id: String(d._id) })));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [filterBranche, filterProjet, searchQuery, refreshTrigger]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/contrats", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;
        if (!cancelled) {
          const contracts = data.items || [];
          const names = contracts.map((x) => String(x.nomContrat || "").trim()).filter(Boolean);
          setProjetOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "fr")));
          setProjetBranchMap(
            contracts.reduce((acc, item) => {
              const name = String(item?.nomContrat || "").trim();
              const branche = String(item?.branche || "").trim();
              if (name) acc[name] = branche;
              return acc;
            }, {})
          );
        }
      } catch (e) { console.error(e); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/prestataires", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;
        if (!cancelled) {
          const mapped = (data.items || []).map((d) => ({ ...d, id: String(d._id) }));
          setPrestataires(mapped);
        }
      } catch (e) { console.error(e); }
    })();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  // 2. Préparation des données pour FullCalendar
  const calendarEvents = useMemo(() => {
    const baseEvents = rows.map((e) => ({
      id: e.id,
      title: `${e.phaseName || "Phase"} - ${e.projet || "Sans projet"}`,
      start: e.start ? new Date(e.start).toISOString() : undefined,
      end: e.end ? new Date(e.end).toISOString() : undefined,
      allDay: !!e.allDay,
      backgroundColor: e.phaseColor || "#0ea5e9",
      borderColor: e.phaseColor || "#0ea5e9",
      textColor: "#fff",
      extendedProps: {
        branche: e.branche,
        projet: e.projet,
        phaseName: e.phaseName,
        phaseColor: e.phaseColor,
        lieu: e.lieu,
        commentaires: e.commentaires,
        source: "evenement",
      },
    }));

    const q = searchQuery.trim().toLowerCase();
    const missionEvents = prestataires.flatMap((p) => {
      const prestataireNom = `${String(p?.prenom || "").trim()} ${String(p?.nom || "").trim()}`.trim();
      const missions = Array.isArray(p?.missions) ? p.missions : [];
      return missions.map((mission, idx) => {
        const projet = String(mission?.projet || "").trim();
        const nomMission = String(mission?.nomMission || "").trim();
        const dateDebut = String(mission?.dateDebut || "").trim();
        const dateFin = String(mission?.dateFin || "").trim();
        const branche = projetBranchMap[projet] || "";
        if (!nomMission || !dateDebut || !dateFin) return null;

        const searchBlob = `${prestataireNom} ${projet} ${nomMission} ${branche}`.toLowerCase();
        if (filterBranche && branche !== filterBranche) return null;
        if (filterProjet && projet !== filterProjet) return null;
        if (q && !searchBlob.includes(q)) return null;

        return {
          id: `mission-${p.id}-${mission?.id || idx}`,
          title: `👤 ${nomMission} - ${prestataireNom}`,
          start: `${dateDebut}T00:00:00`,
          end: `${toExclusiveEnd(dateFin)}T00:00:00`,
          allDay: true,
          backgroundColor: "#bae6fd",
          borderColor: "#38bdf8",
          textColor: "#0b1220",
          extendedProps: {
            branche, projet, phaseName: nomMission, phaseColor: "#38bdf8",
            lieu: "", commentaires: "", source: "prestataireMission",
            prestataireNom, tarifTotal: mission?.tarifTotal ?? null,
            missionId: String(mission?.id || ""), prestataireId: String(p?.id || ""),
          },
        };
      }).filter(Boolean);
    });

    return [...baseEvents, ...missionEvents];
  }, [rows, prestataires, projetBranchMap, filterBranche, filterProjet, searchQuery]);

  // 3. Handlers Ajout/Edition
  const openNewProjectModal = (startDate = null) => {
    const defaultDate = startDate ? toYMD(startDate) : toYMD(new Date());
    setProjectForm({
      nom: "",
      branche: "Agency",
      color: "#38bdf8",
      phases: [
        { id: Date.now() + 1, custom: false, type: "Conception", emoji: "🧠", name: "Conception", start: defaultDate, end: defaultDate },
        { id: Date.now() + 2, custom: false, type: "Construction atelier", emoji: "🔧", name: "Construction atelier", start: defaultDate, end: defaultDate },
        { id: Date.now() + 3, custom: false, type: "Tournage", emoji: "🎥", name: "Tournage", start: defaultDate, end: defaultDate },
      ]
    });
    setOpenProject(true);
  };

  const updatePhase = (id, field, value) => {
    setProjectForm(prev => ({
      ...prev,
      phases: prev.phases.map(p => p.id === id ? { ...p, [field]: value } : p)
    }));
  };

  const addPhaseToProject = () => {
    const today = toYMD(new Date());
    setProjectForm(prev => ({
      ...prev,
      phases: [...prev.phases, { id: Date.now(), custom: false, type: "Livraison", emoji: "🚚", name: "Livraison", start: today, end: today }]
    }));
  };

  const removePhase = (id) => {
    setProjectForm(prev => ({
      ...prev,
      phases: prev.phases.filter(p => p.id !== id)
    }));
  };

  const submitProjectFiles = async (e) => {
    e.preventDefault();
    if (!projectForm.nom.trim()) { alert("Veuillez renseigner le nom du projet."); return; }

    const validPhases = projectForm.phases.filter(p => p.name.trim());
    if (validPhases.length === 0) { alert("Ajoutez au moins une phase."); return; }

    try {
      for (let i = 0; i < validPhases.length; i++) {
        const p = validPhases[i];
        const computedColor = getPhaseColor(projectForm.color, i);
        const payload = {
          branche: projectForm.branche,
          projet: projectForm.nom,
          phaseName: p.custom ? `${p.emoji} ${p.name}` : `${p.emoji} ${p.name}`,
          phaseColor: computedColor,
          allDay: true,
          start: p.start,
          end: p.end,
          lieu: "",
          commentaires: ""
        };
        const res = await fetch("/api/evenements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) console.error("Erreur création phase:", await res.text());
      }
      setOpenProject(false);
      setRefreshTrigger(v => v + 1);
    } catch (err) {
      alert("Une erreur est survenue lors de l'enregistrement du projet.");
    }
  };

  // 4. Détails / Édition / Suppression
  const openEventDetail = (eventLike) => {
    const evt = eventToPlainObject(eventLike);
    setSelectedEvent(evt);
    setDetailOpen(true);
  };

  const openEditSingle = (evt) => {
    if (evt.source === "prestataireMission") {
      alert("L'édition des missions prestataires s'effectue directement depuis les fiches prestataires.");
      return;
    }
    setDetailOpen(false);
    setEditingId(evt.id);
    const start = new Date(evt.start);
    const end = evt.end ? new Date(evt.end) : start;
    const endForUI = evt.allDay ? new Date(end.getTime() - 24 * 60 * 60 * 1000) : end; // inclusive

    setSingleForm({
      branche: evt.branche || "Agency",
      projet: evt.projet || "",
      phaseName: evt.phaseName || "",
      phaseColor: evt.phaseColor || "#0ea5e9",
      allDay: !!evt.allDay,
      start: evt.allDay ? toYMD(start) : toDateTimeLocalValue(start),
      end: evt.allDay ? toYMD(endForUI) : toDateTimeLocalValue(end),
      lieu: evt.lieu || "",
      commentaires: evt.commentaires || "",
    });
    setOpenSingle(true);
  };

  const submitSingle = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/evenements/${encodeURIComponent(String(editingId))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singleForm),
      });
      if (!res.ok) { alert("Erreur de modification"); return; }
      setOpenSingle(false);
      setRefreshTrigger(v => v + 1);
    } catch (err) { console.error(err); }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Supprimer cette phase ? Cette action est irréversible.")) return;
    try {
      const res = await fetch(`/api/evenements/${encodeURIComponent(String(id))}`, { method: "DELETE" });
      if (!res.ok) alert("Erreur suppression");
      setDetailOpen(false);
      setRefreshTrigger(v => v + 1);
    } catch (e) { console.error(e); }
  };

  const formatEventRange = (evt) => {
    if (!evt?.start) return "-";
    const start = new Date(evt.start);
    const end = evt?.end ? new Date(evt.end) : null;
    if (Number.isNaN(start.getTime())) return "-";

    if (evt?.allDay) {
      const endInclusive = end ? new Date(end.getTime() - 24 * 60 * 60 * 1000) : start;
      return `${toYMD(start)} - ${toYMD(endInclusive)}`;
    }
    const startStr = toDateTimeLocalValue(start).replace("T", " ");
    const endStr = end && !Number.isNaN(end.getTime()) ? toDateTimeLocalValue(end).replace("T", " ") : startStr;
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className={styles.page}>
      {/* ── HEADER ET FILTRES ── */}
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Calendrier Projets</h1>

        <div className={styles.headerFilters}>
          <button className={styles.submitBtn} onClick={() => openNewProjectModal()} style={{ marginRight: '16px' }}>
            + Ajouter un projet
          </button>

          <select className={styles.filterSelect} value={filterBranche} onChange={(e) => setFilterBranche(e.target.value)}>
            <option value="">Toutes les branches</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select className={styles.filterSelect} value={filterProjet} onChange={(e) => setFilterProjet(e.target.value)}>
            <option value="">Tous les projets</option>
            {projetOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <input className={styles.searchInput} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher (projet, phase, lieu...)" />
        </div>
      </div>

      {/* ── FULLCALENDAR ── */}
      <div className={styles.calendarCard}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={frLocale}
          firstDay={1}
          buttonText={{
            today: "Aujourd'hui",
            month: "Mois",
            week: "Semaine",
            day: "Jour",
          }}
          initialView="dayGridFourWeeks"
          initialDate={getCurrentMonday()}
          views={{
            dayGridFourWeeks: {
              type: "dayGrid",
              duration: { weeks: 4 },
              buttonText: "Mois",
            },
          }}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridFourWeeks,timeGridWeek,timeGridDay",
          }}
          height="auto"
          nowIndicator
          selectable
          dayMaxEvents
          dayCellClassNames={(arg) => {
            const ymd = toYMD(arg.date);
            if (HOLIDAYS.has(ymd)) return ["dayHoliday"];
            const dow = arg.date.getDay();
            if (dow === 0 || dow === 6) return ["dayWeekend"];
            return [];
          }}
          events={calendarEvents}
          eventOrder={(a, b) => {
            const aMission = a.extendedProps?.source === "prestataireMission";
            const bMission = b.extendedProps?.source === "prestataireMission";
            if (aMission !== bMission) return aMission ? 1 : -1;
            return 0;
          }}
          eventClassNames={(arg) => {
            const classes = [];
            if (String(arg.event.id) === String(selectedEventId)) classes.push("eventSelected");
            if (arg.event.extendedProps?.source === "prestataireMission") classes.push("eventMissionInline");
            return classes;
          }}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            info.jsEvent.stopPropagation();
            setSelectedEventId(String(info.event.id));
          }}
          dateClick={() => { }}
          eventDidMount={(info) => {
            info.el.addEventListener("dblclick", (e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedEventId(String(info.event.id));
              openEventDetail(info.event);
            });
          }}
          dayCellContent={(arg) => {
            return (
              <div className={styles.dayCell}>
                <div className={styles.dayTop}>
                  <span className={styles.dayNumber}>
                    {String(arg.dayNumberText || "").replace("áµ‰Ê³", "")}
                  </span>

                  <button
                    type="button"
                    className={styles.dayAddBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openNewProjectModal(arg.date);
                    }}
                    aria-label="Ajouter un projet"
                    title="Ajouter un projet"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          }}
        />
      </div>

      {/* ── MODALS ── */}
      {/* 1. Modal Ajout de Projet (Nouveau) */}
      <Modal open={openProject} title="Ajouter un projet au planning" onClose={() => setOpenProject(false)} size="md">
        <form onSubmit={submitProjectFiles} className={styles.form}>
          <div className={styles.grid}>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Nom du projet *</label>
              <select className={styles.select} required value={projectForm.nom} onChange={e => {
                const newNom = e.target.value;
                setProjectForm(prev => ({
                  ...prev,
                  nom: newNom,
                  branche: projetBranchMap[newNom] || prev.branche
                }));
              }}>
                <option value="">Sélectionner un projet...</option>
                {projetOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Branche *</label>
              <select className={styles.select} value={projectForm.branche} onChange={e => setProjectForm(prev => ({ ...prev, branche: e.target.value }))}>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className={styles.field} style={{ flexDirection: "column", gap: "6px" }}>
              <label className={styles.label}>Couleur Principale</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" className={styles.colorInput} value={projectForm.color} onChange={e => setProjectForm(prev => ({ ...prev, color: e.target.value }))} />
                <span className={styles.muted} style={{ fontSize: '11px' }}>Les nuances seront générées pour chaque phase.</span>
              </div>
            </div>
          </div>

          <div className={styles.phaseSection}>
            <div className={styles.phaseHeader}>
              <div className={styles.label}>Phases du projet</div>
              <button type="button" className={styles.linkBtn} onClick={addPhaseToProject}>+ Ajouter phase</button>
            </div>

            {projectForm.phases.map((p, idx) => (
              <div key={p.id} className={styles.phaseLineInput}>

                {/* Select/Type de phase */}
                <div className={styles.phaseFieldCol} style={{ flex: 1.5 }}>
                  <select className={styles.input} value={p.custom ? "Autre (personnalisé)" : p.type} onChange={e => {
                    if (e.target.value === "Autre (personnalisé)") updatePhase(p.id, "custom", true);
                    else {
                      const f = STANDARD_PHASES.find(x => x.name === e.target.value);
                      updatePhase(p.id, "custom", false);
                      updatePhase(p.id, "type", f.name);
                      updatePhase(p.id, "name", f.name);
                      updatePhase(p.id, "emoji", f.emoji);
                    }
                  }}>
                    {STANDARD_PHASES.map(sp => <option key={sp.name} value={sp.name}>{sp.emoji} {sp.name}</option>)}
                  </select>

                  {/* Custom Inputs apparents si Autre est sélectionné */}
                  {p.custom && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input className={styles.input} type="text" placeholder="Emoji 🎨" style={{ width: '60px' }} value={p.emoji} onChange={e => updatePhase(p.id, "emoji", e.target.value)} />
                      <input className={styles.input} type="text" placeholder="Nom de phase" value={p.name} onChange={e => updatePhase(p.id, "name", e.target.value)} />
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className={styles.phaseFieldCol} style={{ flex: 1 }}>
                  <input className={styles.input} type="date" required value={p.start} onChange={e => { updatePhase(p.id, "start", e.target.value); if (p.end < e.target.value) updatePhase(p.id, "end", e.target.value); }} />
                </div>
                <div className={styles.phaseFieldCol} style={{ flex: 1 }}>
                  <input className={styles.input} type="date" required value={p.end} min={p.start} onChange={e => updatePhase(p.id, "end", e.target.value)} />
                </div>

                {/* Actions */}
                <div className={styles.phaseActionsCol} style={{ marginTop: '4px' }}>
                  <button type="button" className={styles.deleteButton} onClick={() => removePhase(p.id)} title="Supprimer">✖</button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpenProject(false)}>Annuler</button>
            <button type="submit" className={styles.submitBtn}>Créer le projet</button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal Detail Evénement Unique */}
      <Modal open={detailOpen} title="Informations phase" onClose={() => setDetailOpen(false)} size="sm">
        {selectedEvent ? (
          <div className={styles.detailWrap}>
            <div className={styles.detailActions}>
              {selectedEvent.source !== "prestataireMission" && (
                <button type="button" className={styles.iconButton} onClick={() => openEditSingle(selectedEvent)} title="Modifier la phase">{"\u270F"}</button>
              )}
              {selectedEvent.source !== "prestataireMission" && (
                <button type="button" className={styles.deleteButton} onClick={() => deleteEvent(selectedEvent.id)} title="Supprimer">{"\u2716"}</button>
              )}
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoRow}><div className={styles.k}>Projet</div><div className={styles.v}>{selectedEvent.projet || "-"}</div></div>
              <div className={styles.infoRow}><div className={styles.k}>Phase</div><div className={styles.v}>{selectedEvent.phaseName || "-"}</div></div>
              <div className={styles.infoRow}><div className={styles.k}>Période</div><div className={styles.v}>{formatEventRange(selectedEvent)}</div></div>
              <div className={styles.infoRow}><div className={styles.k}>Lieu</div><div className={styles.v}>{selectedEvent.lieu || "-"}</div></div>
              <div className={styles.infoRow}><div className={styles.k}>Commentaires</div><div className={styles.v}>{selectedEvent.commentaires || "-"}</div></div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 3. Modal Edit Single Phase */}
      <Modal open={openSingle} title="Modifier la phase" onClose={() => setOpenSingle(false)}>
        <form className={styles.form} onSubmit={submitSingle}>
          <div className={styles.grid}>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Nom de la phase (inclut l&apos;emoji)</label>
              <input className={styles.input} type="text" value={singleForm.phaseName || ""} onChange={e => setSingleForm(p => ({ ...p, phaseName: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Début</label>
              <input className={styles.input} type={singleForm.allDay ? "date" : "datetime-local"} value={singleForm.start} onChange={e => setSingleForm(p => ({ ...p, start: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Fin</label>
              <input className={styles.input} type={singleForm.allDay ? "date" : "datetime-local"} value={singleForm.end} onChange={e => setSingleForm(p => ({ ...p, end: e.target.value }))} />
            </div>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Couleur de la phase</label>
              <input type="color" className={styles.colorInput} value={singleForm.phaseColor || "#ffffff"} onChange={e => setSingleForm(p => ({ ...p, phaseColor: e.target.value }))} />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpenSingle(false)}>Annuler</button>
            <button type="submit" className={styles.submitBtn}>Mettre à jour</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
