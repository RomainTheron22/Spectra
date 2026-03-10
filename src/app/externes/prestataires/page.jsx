// src/app/externes/prestataires/page.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./Prestataires.module.css";
import Modal from "../../../components/ui/Modal";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import frLocale from "@fullcalendar/core/locales/fr";

const TAGS = [
  "Son",
  "Lumière",
  "Vidéo",
  "Scène",
  "Production",
  "Electronique",
  "Peinture",
  "Soudure",
];

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toFixed(2);
}

function makeMissionRateRow(item = {}) {
  return {
    id: item?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    missionType: String(item?.missionType || ""),
    tarifJour: item?.tarifJour === null || item?.tarifJour === undefined ? "" : String(item.tarifJour),
  };
}

function normalizeMissionRates(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const missionType = String(row?.missionType || "").trim();
      const parsedTarif = row?.tarifJour === "" || row?.tarifJour === null || row?.tarifJour === undefined
        ? null
        : Number(row.tarifJour);

      return {
        missionType,
        tarifJour: Number.isFinite(parsedTarif) ? parsedTarif : null,
      };
    })
    .filter((row) => row.missionType || row.tarifJour !== null);
}

function makeAssignedMission(item = {}) {
  return {
    id: item?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    projet: String(item?.projet || ""),
    nomMission: String(item?.nomMission || ""),
    dateDebut: String(item?.dateDebut || ""),
    dateFin: String(item?.dateFin || ""),
    tarifTotal:
      item?.tarifTotal === null || item?.tarifTotal === undefined
        ? ""
        : String(item.tarifTotal),
  };
}

function normalizeAssignedMissions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const projet = String(row?.projet || "").trim();
      const nomMission = String(row?.nomMission || "").trim();
      const dateDebut = String(row?.dateDebut || "").trim();
      const dateFin = String(row?.dateFin || "").trim();
      const parsedTarif =
        row?.tarifTotal === "" || row?.tarifTotal === null || row?.tarifTotal === undefined
          ? null
          : Number(row.tarifTotal);

      return {
        id: String(row?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
        projet,
        nomMission,
        dateDebut,
        dateFin,
        tarifTotal: Number.isFinite(parsedTarif) ? parsedTarif : null,
      };
    })
    .filter((row) => row.nomMission && row.dateDebut && row.dateFin);
}

function addOneDay(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PrestatairesPage() {
  const [items, setItems] = useState([]);
  const [projetOptions, setProjetOptions] = useState([]);

  // add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState("infos"); // infos | tarifs

  // detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("infos"); // infos | tarifs | planning
  const [assignMissionOpen, setAssignMissionOpen] = useState(false);
  const [missionForm, setMissionForm] = useState(() => makeAssignedMission());
  const [missionDetailOpen, setMissionDetailOpen] = useState(false);
  const [missionEditing, setMissionEditing] = useState(false);
  const [missionDetail, setMissionDetail] = useState(null);

  // search
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    tags: [],
    statut: "Disponible", // Disponible | Occupé | En congé
    typeTarif: "Sur facture", // Sur facture | Intermittent
    tarifJour: "",
    missionTarifs: [makeMissionRateRow()],
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const updateMissionForm = (k, v) => setMissionForm((p) => ({ ...p, [k]: v }));

  const resetForm = () => {
    setForm({
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      tags: [],
      statut: "Disponible",
      typeTarif: "Sur facture",
      tarifJour: "",
      missionTarifs: [makeMissionRateRow()],
    });
  };

  const hydrateFormFrom = (p) => {
    setForm({
      prenom: p?.prenom || "",
      nom: p?.nom || "",
      email: p?.email || "",
      telephone: p?.telephone || "",
      tags: Array.isArray(p?.tags) ? p.tags : [],
      statut: p?.statut || "Disponible",
      typeTarif: p?.typeTarif || "Sur facture",
      tarifJour: p?.tarifJour ?? "",
      missionTarifs:
        Array.isArray(p?.missionTarifs) && p.missionTarifs.length
          ? p.missionTarifs.map((m) => makeMissionRateRow(m))
          : [makeMissionRateRow()],
    });
  };

  const canSubmit = useMemo(() => {
    return String(form.prenom).trim() && String(form.nom).trim();
  }, [form.prenom, form.nom]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/prestataires", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Erreur chargement prestataires");

        if (!cancelled) {
          const mapped = (data.items || []).map((d) => ({ ...d, id: String(d._id) }));
          setItems(mapped);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/contrats", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return;

        if (!cancelled) {
          const names = (data.items || [])
            .map((x) => String(x.nomContrat || "").trim())
            .filter(Boolean);
          setProjetOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "fr")));
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((p) => {
      const full = `${p?.prenom || ""} ${p?.nom || ""}`.toLowerCase();
      const email = (p?.email || "").toLowerCase();
      const tel = (p?.telephone || "").toLowerCase();
      const tags = Array.isArray(p?.tags) ? p.tags.join(" ").toLowerCase() : "";
      return full.includes(q) || email.includes(q) || tel.includes(q) || tags.includes(q);
    });
  }, [items, search]);

  const openAdd = () => {
    resetForm();
    setAddTab("infos");
    setAddOpen(true);
  };

  const openDetail = (p) => {
    setSelected(p);
    setIsEditing(false);
    setActiveTab("infos");
    hydrateFormFrom(p);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelected(null);
    setIsEditing(false);
    setActiveTab("infos");
    setAssignMissionOpen(false);
    setMissionDetailOpen(false);
    setMissionEditing(false);
    setMissionDetail(null);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      alert("Prénom et nom sont obligatoires.");
      return;
    }

    const res = await fetch("/api/prestataires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tarifJour: form.tarifJour === "" ? null : Number(form.tarifJour),
        missionTarifs: normalizeMissionRates(form.missionTarifs),
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`${data?.error || "Erreur ajout prestataire"}${data?.details ? " — " + data.details : ""}`);
      return;
    }

    const saved = { ...data.item, id: String(data.item._id) };
    setItems((prev) => [saved, ...prev]);
    setAddOpen(false);
  };

  const saveEdit = async () => {
    if (!selected?.id) return;
    if (!canSubmit) {
      alert("Prénom et nom sont obligatoires.");
      return;
    }

    const res = await fetch(`/api/prestataires/${encodeURIComponent(String(selected.id))}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tarifJour: form.tarifJour === "" ? null : Number(form.tarifJour),
        missionTarifs: normalizeMissionRates(form.missionTarifs),
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`${data?.error || "Erreur modification"}${data?.details ? " — " + data.details : ""}`);
      return;
    }

    const updated = { ...data.item, id: String(data.item._id) };
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setSelected(updated);
    setIsEditing(false);
    hydrateFormFrom(updated);
  };

  const deletePrestataire = async () => {
    if (!selected?.id) return;
    const ok = window.confirm("Supprimer ce prestataire ? Cette action est irréversible.");
    if (!ok) return;

    const res = await fetch(`/api/prestataires/${encodeURIComponent(String(selected.id))}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`${data?.error || "Erreur suppression"}${data?.details ? " — " + data.details : ""}`);
      return;
    }

    setItems((prev) => prev.filter((x) => x.id !== String(selected.id)));
    closeDetail();
  };

  const toggleTag = (tag) => {
    setForm((prev) => {
      const set = new Set(prev.tags || []);
      if (set.has(tag)) set.delete(tag);
      else set.add(tag);
      return { ...prev, tags: Array.from(set) };
    });
  };

  const addMissionRateRow = () => {
    setForm((prev) => ({
      ...prev,
      missionTarifs: [...(Array.isArray(prev.missionTarifs) ? prev.missionTarifs : []), makeMissionRateRow()],
    }));
  };

  const removeMissionRateRow = (rowId) => {
    setForm((prev) => {
      const next = (Array.isArray(prev.missionTarifs) ? prev.missionTarifs : []).filter((row) => row.id !== rowId);
      return {
        ...prev,
        missionTarifs: next.length ? next : [makeMissionRateRow()],
      };
    });
  };

  const updateMissionRateRow = (rowId, key, value) => {
    setForm((prev) => ({
      ...prev,
      missionTarifs: (Array.isArray(prev.missionTarifs) ? prev.missionTarifs : []).map((row) =>
        row.id === rowId ? { ...row, [key]: value } : row
      ),
    }));
  };

  const openAssignMission = () => {
    setMissionForm(makeAssignedMission());
    setAssignMissionOpen(true);
  };

  const closeAssignMission = () => {
    setAssignMissionOpen(false);
    setMissionForm(makeAssignedMission());
  };

  const openMissionDetail = (missionId) => {
    const found = selectedMissions.find((m) => String(m.id) === String(missionId));
    if (!found) return;
    setMissionDetail({ ...found });
    setMissionEditing(false);
    setMissionDetailOpen(true);
  };

  const closeMissionDetail = () => {
    setMissionDetailOpen(false);
    setMissionEditing(false);
    setMissionDetail(null);
  };

  const persistSelectedMissions = async (nextMissions) => {
    if (!selected?.id) return null;
    const res = await fetch(`/api/prestataires/${encodeURIComponent(String(selected.id))}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missions: nextMissions }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(`${data?.error || "Erreur mise a jour mission"}${data?.details ? " - " + data.details : ""}`);
      return null;
    }
    const updated = { ...data.item, id: String(data.item._id) };
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setSelected(updated);
    return updated;
  };

  const saveAssignedMission = async (e) => {
    e.preventDefault();
    if (!selected?.id) return;

    const payloadMission = normalizeAssignedMissions([missionForm])[0];
    if (!payloadMission) {
      alert("Merci de renseigner nom de mission, date de debut et date de fin.");
      return;
    }
    if (payloadMission.dateFin < payloadMission.dateDebut) {
      alert("La date de fin doit etre superieure ou egale a la date de debut.");
      return;
    }

    const existing = normalizeAssignedMissions(selected?.missions || []);
    const nextMissions = [...existing, payloadMission];
    const updated = await persistSelectedMissions(nextMissions);
    if (!updated) return;
    closeAssignMission();
  };

  const saveMissionDetail = async () => {
    if (!missionDetail?.id) return;
    const normalized = normalizeAssignedMissions([missionDetail])[0];
    if (!normalized) {
      alert("Nom mission, date de debut et date de fin sont obligatoires.");
      return;
    }
    if (normalized.dateFin < normalized.dateDebut) {
      alert("La date de fin doit etre superieure ou egale a la date de debut.");
      return;
    }

    const existing = normalizeAssignedMissions(selected?.missions || []);
    const nextMissions = existing.map((mission) =>
      String(mission.id) === String(normalized.id) ? normalized : mission
    );
    const updated = await persistSelectedMissions(nextMissions);
    if (!updated) return;
    setMissionDetail(normalized);
    setMissionEditing(false);
  };

  const deleteMissionDetail = async () => {
    if (!missionDetail?.id) return;
    const ok = window.confirm("Supprimer cette mission ? Cette action est irreversible.");
    if (!ok) return;

    const existing = normalizeAssignedMissions(selected?.missions || []);
    const nextMissions = existing.filter((mission) => String(mission.id) !== String(missionDetail.id));
    const updated = await persistSelectedMissions(nextMissions);
    if (!updated) return;
    closeMissionDetail();
  };

  const statusClass = (statut) => {
    if (statut === "Disponible") return styles.statusGreen;
    if (statut === "Occupé") return styles.statusYellow;
    return styles.statusRed;
  };

  const bandClass = (statut) => {
    if (statut === "Disponible") return styles.bandGreen;
    if (statut === "Occupé") return styles.bandYellow;
    return styles.bandRed;
  };

  const contactName = selected
    ? `${(selected.prenom || "").trim()} ${(selected.nom || "").trim()}`
    : "";
  const selectedMissionTarifs = Array.isArray(selected?.missionTarifs) ? selected.missionTarifs : [];
  const selectedMissions = useMemo(
    () => normalizeAssignedMissions(selected?.missions || []),
    [selected?.missions]
  );
  const planningEvents = useMemo(() => {
    return selectedMissions.map((mission) => ({
      id: mission.id,
      title: mission.projet ? `${mission.nomMission} - ${mission.projet}` : mission.nomMission,
      start: `${mission.dateDebut}T00:00:00`,
      end: `${addOneDay(mission.dateFin)}T00:00:00`,
      allDay: true,
      backgroundColor: "#bae6fd",
      borderColor: "#38bdf8",
      textColor: "#0f172a",
    }));
  }, [selectedMissions]);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Prestataires</h1>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email, téléphone ou tag…"
        />
      </div>

      <div className={styles.grid}>
        <button type="button" className={styles.addCard} onClick={openAdd}>
          <div className={styles.plus}>+</div>
          <div className={styles.addLabel}>Ajouter un prestataire</div>
        </button>

        {filteredItems.map((p) => (
          <button key={p.id} type="button" className={styles.cardButton} onClick={() => openDetail(p)}>
            <div className={`${styles.card} ${styles.cardHover}`}>
              <div className={`${styles.band} ${bandClass(p.statut)}`} />

              <div className={styles.cardTopRow}>
                <div className={styles.name}>
                  {(p.prenom || "").trim()} {(p.nom || "").trim()}
                </div>

                <div className={`${styles.statusPill} ${statusClass(p.statut)}`}>
                  {p.statut || "Disponible"}
                </div>
              </div>

              <div className={styles.email}>{p.email || "—"}</div>

              <div className={styles.tagsRow}>
                {(p.tags || []).slice(0, 6).map((t) => (
                  <span key={t} className={styles.tag}>
                    {t}
                  </span>
                ))}
              </div>

              <div className={styles.tarifBlock}>
                <div className={styles.tarifType}>{p.typeTarif || "Sur facture"}</div>
                <div className={styles.tarifValue}>
                  {p.tarifJour === null || p.tarifJour === undefined || p.tarifJour === ""
                    ? "—"
                    : `${formatMoney(p.tarifJour)} € / jour`}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modal Ajout */}
      <Modal open={addOpen} title="Ajouter un prestataire" onClose={() => setAddOpen(false)} size="sm">
        <form className={styles.form} onSubmit={submitAdd}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={addTab === "infos" ? styles.tabActive : styles.tab}
              onClick={() => setAddTab("infos")}
            >
              Informations
            </button>
            <button
              type="button"
              className={addTab === "tarifs" ? styles.tabActive : styles.tab}
              onClick={() => setAddTab("tarifs")}
            >
              Tarif / Mission
            </button>
          </div>

          {addTab === "infos" ? (
            <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Prénom *</label>
              <input className={styles.input} value={form.prenom} onChange={(e) => update("prenom", e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Nom *</label>
              <input className={styles.input} value={form.nom} onChange={(e) => update("nom", e.target.value)} />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Téléphone</label>
              <input
                className={styles.input}
                type="tel"
                value={form.telephone}
                onChange={(e) => update("telephone", e.target.value)}
                placeholder="Ex: 06 12 34 56 78"
              />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Tags</label>
              <div className={styles.tagsPicker}>
                {TAGS.map((t) => {
                  const active = (form.tags || []).includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={active ? styles.tagPickActive : styles.tagPick}
                      onClick={() => toggleTag(t)}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Statut</label>
              <select className={styles.input} value={form.statut} onChange={(e) => update("statut", e.target.value)}>
                <option value="Disponible">Disponible</option>
                <option value="Occupé">Occupé</option>
                <option value="En congé">En congé</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <select className={styles.input} value={form.typeTarif} onChange={(e) => update("typeTarif", e.target.value)}>
                <option value="Sur facture">Sur facture</option>
                <option value="Intermittent">Intermittent</option>
              </select>
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Tarif &euro; / jour</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={form.tarifJour}
                onChange={(e) => update("tarifJour", e.target.value)}
                placeholder="Ex: 350"
              />
            </div>
            </div>
          ) : (
            <>
          <div className={styles.missionHeaderRow}>
            <div className={styles.missionTitle}>Tarif par mission</div>
            <button type="button" className={styles.secondaryBtn} onClick={addMissionRateRow}>
              Ajouter un type de mission
            </button>
          </div>

          <div className={styles.missionRows}>
            {(form.missionTarifs || []).map((row) => (
              <div key={row.id} className={styles.missionCard}>
                <button
                  type="button"
                  className={styles.missionRemoveBtn}
                  onClick={() => removeMissionRateRow(row.id)}
                  title="Supprimer ce type de mission"
                >
                  x
                </button>

                <div className={styles.missionGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>Type de mission</label>
                    <input
                      className={styles.input}
                      value={row.missionType}
                      onChange={(e) => updateMissionRateRow(row.id, "missionType", e.target.value)}
                      placeholder="Ex: Regie son"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Tarif &euro; / jour</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.tarifJour}
                      onChange={(e) => updateMissionRateRow(row.id, "tarifJour", e.target.value)}
                      placeholder="Ex: 350"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
            </>
          )}

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setAddOpen(false)}>
              Annuler
            </button>
            <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
              Ajouter
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Détail */}
      <Modal open={detailOpen} title={selected ? contactName : "Prestataire"} onClose={closeDetail} size="sm">
        {selected ? (
          <div className={styles.detailWrap}>
            {/* Tabs */}
            <div className={styles.tabs}>
              <button
                type="button"
                className={activeTab === "infos" ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab("infos")}
              >
                Informations
              </button>
              <button
                type="button"
                className={activeTab === "tarifs" ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab("tarifs")}
              >
                Tarif / Mission
              </button>
              <button
                type="button"
                className={activeTab === "planning" ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab("planning")}
              >
                Planning
              </button>
            </div>

            {/* Actions visibles hors onglet Planning */}
            {activeTab !== "planning" ? (
              <div className={styles.detailActionsRow}>
                <button type="button" className={styles.iconButton} onClick={() => setIsEditing((v) => !v)} title="Modifier">
                  ✏️
                </button>
                <button type="button" className={styles.deleteButton} onClick={deletePrestataire} title="Supprimer">
                  ✖
                </button>
              </div>
            ) : null}

            {activeTab === "planning" ? (
              <div className={styles.planningTab}>
                <div className={styles.planningHeader}>
                  <button type="button" className={styles.submitBtn} onClick={openAssignMission}>
                    Assigner une mission
                  </button>
                </div>

                <div className={styles.planningCalendarCard}>
                  <FullCalendar
                    plugins={[dayGridPlugin]}
                    locale={frLocale}
                    firstDay={1}
                    initialView="dayGridMonth"
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "",
                    }}
                    buttonText={{
                      today: "Aujourd'hui",
                    }}
                    height="auto"
                    events={planningEvents}
                    dayMaxEvents
                    eventDidMount={(info) => {
                      info.el.addEventListener("dblclick", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openMissionDetail(info.event.id);
                      });
                    }}
                  />
                </div>
              </div>
            ) : activeTab === "tarifs" ? (
              isEditing ? (
                <>
                  <div className={styles.missionHeaderRow}>
                    <div className={styles.missionTitle}>Tarif par mission</div>
                    <button type="button" className={styles.secondaryBtn} onClick={addMissionRateRow}>
                      Ajouter un type de mission
                    </button>
                  </div>

                  <div className={styles.missionRows}>
                    {(form.missionTarifs || []).map((row) => (
                      <div key={row.id} className={styles.missionCard}>
                        <button
                          type="button"
                          className={styles.missionRemoveBtn}
                          onClick={() => removeMissionRateRow(row.id)}
                          title="Supprimer ce type de mission"
                        >
                          x
                        </button>

                        <div className={styles.missionGrid}>
                          <div className={styles.field}>
                            <label className={styles.label}>Type de mission</label>
                            <input
                              className={styles.input}
                              value={row.missionType}
                              onChange={(e) => updateMissionRateRow(row.id, "missionType", e.target.value)}
                              placeholder="Ex: Regie son"
                            />
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label}>Tarif &euro; / jour</label>
                            <input
                              className={styles.input}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.tarifJour}
                              onChange={(e) => updateMissionRateRow(row.id, "tarifJour", e.target.value)}
                              placeholder="Ex: 350"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.footer}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => {
                        setIsEditing(false);
                        hydrateFormFrom(selected);
                      }}
                    >
                      Annuler
                    </button>
                    <button type="button" className={styles.submitBtn} onClick={saveEdit} disabled={!canSubmit}>
                      Enregistrer
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.contactCard}>
                  <div className={styles.missionRows}>
                    {selectedMissionTarifs.length ? (
                      selectedMissionTarifs.map((row, idx) => (
                        <div key={`${row.missionType || "mission"}-${idx}`} className={styles.missionCard}>
                          <div className={styles.missionGrid}>
                            <div className={styles.field}>
                              <label className={styles.label}>Type de mission</label>
                              <div className={styles.readonlyValue}>{row.missionType || "-"}</div>
                            </div>
                            <div className={styles.field}>
                              <label className={styles.label}>Tarif &euro; / jour</label>
                              <div className={styles.readonlyValue}>{row.tarifJour === null || row.tarifJour === undefined || row.tarifJour === "" ? "-" : `${formatMoney(row.tarifJour)} \u20AC / jour`}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className={styles.muted}>Aucun tarif mission renseigne.</span>
                    )}
                  </div>
                </div>
              )
            ) : isEditing ? (
              <>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>Prénom *</label>
                    <input className={styles.input} value={form.prenom} onChange={(e) => update("prenom", e.target.value)} />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Nom *</label>
                    <input className={styles.input} value={form.nom} onChange={(e) => update("nom", e.target.value)} />
                  </div>

                  <div className={styles.fieldWide}>
                    <label className={styles.label}>Email</label>
                    <input className={styles.input} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </div>

                  <div className={styles.fieldWide}>
                    <label className={styles.label}>Téléphone</label>
                    <input className={styles.input} type="tel" value={form.telephone} onChange={(e) => update("telephone", e.target.value)} />
                  </div>

                  <div className={styles.fieldWide}>
                    <label className={styles.label}>Tags</label>
                    <div className={styles.tagsPicker}>
                      {TAGS.map((t) => {
                        const active = (form.tags || []).includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            className={active ? styles.tagPickActive : styles.tagPick}
                            onClick={() => toggleTag(t)}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Statut</label>
                    <select className={styles.input} value={form.statut} onChange={(e) => update("statut", e.target.value)}>
                      <option value="Disponible">Disponible</option>
                      <option value="Occupé">Occupé</option>
                      <option value="En congé">En congé</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Type</label>
                    <select className={styles.input} value={form.typeTarif} onChange={(e) => update("typeTarif", e.target.value)}>
                      <option value="Sur facture">Sur facture</option>
                      <option value="Intermittent">Intermittent</option>
                    </select>
                  </div>

                  <div className={styles.fieldWide}>
                    <label className={styles.label}>Tarif &euro; / jour</label>
                    <input className={styles.input} type="number" min="0" step="0.01" value={form.tarifJour} onChange={(e) => update("tarifJour", e.target.value)} />
                  </div>
                </div>

                <div className={styles.footer}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setIsEditing(false);
                      hydrateFormFrom(selected);
                    }}
                  >
                    Annuler
                  </button>
                  <button type="button" className={styles.submitBtn} onClick={saveEdit} disabled={!canSubmit}>
                    Enregistrer
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.contactCard}>
                <div className={styles.centerBlock}>
                  <div className={styles.contactName}>{contactName}</div>

                  <div className={`${styles.statusPill} ${statusClass(selected.statut)}`}>
                    {selected.statut || "Disponible"}
                  </div>

                  <div className={styles.centerTags}>
                    {(selected.tags || []).length ? (
                      (selected.tags || []).map((t) => (
                        <span key={t} className={styles.tag}>
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className={styles.muted}>Aucun tag</span>
                    )}
                  </div>
                </div>

                <div className={styles.leftInfos}>
                  <div className={styles.infoLine}>
                    <div className={styles.infoIcon}>✉️</div>
                    <div className={styles.infoText}>{selected.email || "—"}</div>
                  </div>

                  <div className={styles.infoLine}>
                    <div className={styles.infoIcon}>📞</div>
                    <div className={styles.infoText}>{selected.telephone || "—"}</div>
                  </div>

                  <div className={styles.infoLine}>
                    <div className={styles.infoIcon}>📄</div>
                    <div className={styles.infoText}>
                      {(selected.typeTarif || "—")}{" "}
                      {selected.tarifJour === null || selected.tarifJour === undefined || selected.tarifJour === ""
                        ? ""
                        : `- ${formatMoney(selected.tarifJour)}€ / jour`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal open={assignMissionOpen} title="Assigner une mission" onClose={closeAssignMission} size="sm">
        <form className={styles.form} onSubmit={saveAssignedMission}>
          <div className={styles.formGrid}>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Projet (optionnel)</label>
              <select
                className={styles.input}
                value={missionForm.projet}
                onChange={(e) => updateMissionForm("projet", e.target.value)}
              >
                <option value="">Aucun projet</option>
                {projetOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Nom de la mission</label>
              <input
                className={styles.input}
                value={missionForm.nomMission}
                onChange={(e) => updateMissionForm("nomMission", e.target.value)}
                placeholder="Ex: Regie principale"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Date debut</label>
              <input
                className={styles.input}
                type="date"
                value={missionForm.dateDebut}
                onChange={(e) => updateMissionForm("dateDebut", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Date fin</label>
              <input
                className={styles.input}
                type="date"
                value={missionForm.dateFin}
                onChange={(e) => updateMissionForm("dateFin", e.target.value)}
              />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Tarif total mission (&euro;)</label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={missionForm.tarifTotal}
                onChange={(e) => updateMissionForm("tarifTotal", e.target.value)}
                placeholder="Ex: 1500"
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={closeAssignMission}>
              Annuler
            </button>
            <button type="submit" className={styles.submitBtn}>
              Valider
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={missionDetailOpen} title="Mission prestataire" onClose={closeMissionDetail} size="sm">
        {missionDetail ? (
          <div className={styles.detailWrap}>
            <div className={styles.detailActionsRow}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setMissionEditing((v) => !v)}
                title="Modifier"
              >
                {"\u270F"}
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={deleteMissionDetail}
                title="Supprimer"
              >
                {"\u2716"}
              </button>
            </div>

            {missionEditing ? (
              <>
                <div className={styles.formGrid}>
                  <div className={styles.fieldWide}>
                    <label className={styles.label}>Projet (optionnel)</label>
                    <select
                      className={styles.input}
                      value={missionDetail.projet}
                      onChange={(e) => setMissionDetail((prev) => ({ ...prev, projet: e.target.value }))}
                    >
                      <option value="">Aucun projet</option>
                      {projetOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.fieldWide}>
                    <label className={styles.label}>Nom de la mission</label>
                    <input
                      className={styles.input}
                      value={missionDetail.nomMission}
                      onChange={(e) => setMissionDetail((prev) => ({ ...prev, nomMission: e.target.value }))}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Date debut</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={missionDetail.dateDebut}
                      onChange={(e) => setMissionDetail((prev) => ({ ...prev, dateDebut: e.target.value }))}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Date fin</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={missionDetail.dateFin}
                      onChange={(e) => setMissionDetail((prev) => ({ ...prev, dateFin: e.target.value }))}
                    />
                  </div>

                  <div className={styles.fieldWide}>
                    <label className={styles.label}>Tarif total mission (&euro;)</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      step="0.01"
                      value={missionDetail.tarifTotal ?? ""}
                      onChange={(e) => setMissionDetail((prev) => ({ ...prev, tarifTotal: e.target.value }))}
                    />
                  </div>
                </div>

                <div className={styles.footer}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => setMissionEditing(false)}>
                    Annuler
                  </button>
                  <button type="button" className={styles.submitBtn} onClick={saveMissionDetail}>
                    Enregistrer
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.contactCard}>
                <div className={styles.infoLine}>
                  <div className={styles.infoText}>
                    <strong>Mission:</strong> {missionDetail.nomMission || "-"}
                  </div>
                </div>
                <div className={styles.infoLine}>
                  <div className={styles.infoText}>
                    <strong>Projet:</strong> {missionDetail.projet || "-"}
                  </div>
                </div>
                <div className={styles.infoLine}>
                  <div className={styles.infoText}>
                    <strong>Periode:</strong> {missionDetail.dateDebut || "-"} - {missionDetail.dateFin || "-"}
                  </div>
                </div>
                <div className={styles.infoLine}>
                  <div className={styles.infoText}>
                    <strong>Tarif mission:</strong>{" "}
                    {missionDetail.tarifTotal === null || missionDetail.tarifTotal === undefined || missionDetail.tarifTotal === ""
                      ? "-"
                      : `${formatMoney(missionDetail.tarifTotal)} €`}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}


