"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import frLocale from "@fullcalendar/core/locales/fr";
import styles from "./PlanningPerso.module.css";
import Modal from "../../components/ui/Modal";
import { authClient } from "../../lib/auth-client";

/* ─── helpers ─── */

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateTimeLocalValue(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function nowPlusMinutes(minutes) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  d.setSeconds(0, 0);
  return d;
}

function defaultForm() {
  const start = nowPlusMinutes(30);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    title: "",
    start: toDateTimeLocalValue(start),
    end: toDateTimeLocalValue(end),
    inviteeIds: [],
  };
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR");
}

// Palette de couleurs pour les utilisateurs selectionnés dans la sidebar
const USER_COLORS = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a" },   // bleu
  { bg: "#fce7f3", border: "#ec4899", text: "#831843" },   // rose
  { bg: "#fef3c7", border: "#f59e0b", text: "#78350f" },   // ambre
  { bg: "#d1fae5", border: "#10b981", text: "#064e3b" },   // emeraude
  { bg: "#ede9fe", border: "#8b5cf6", text: "#4c1d95" },   // violet
  { bg: "#ffedd5", border: "#f97316", text: "#7c2d12" },   // orange
  { bg: "#cffafe", border: "#06b6d4", text: "#164e63" },   // cyan
  { bg: "#fde2e2", border: "#ef4444", text: "#7f1d1d" },   // rouge
];

function getUserColor(index) {
  return USER_COLORS[index % USER_COLORS.length];
}

/* ─── composant principal ─── */

export default function PlanningPersoPage() {
  const { data: session } = authClient.useSession();
  const currentUserId = String(session?.user?.id || "");

  const [users, setUsers] = useState([]);
  const [weekRange, setWeekRange] = useState({ from: null, to: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sidebar: utilisateurs cochés (toujours inclure soi-même)
  const [checkedUserIds, setCheckedUserIds] = useState(new Set());
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarRoleFilter, setSidebarRoleFilter] = useState("");

  // Taches par utilisateur { userId: [...tasks] }
  const [tasksByUser, setTasksByUser] = useState({});

  // Modal de creation/edition
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [availability, setAvailability] = useState({ busyUserIds: [] });
  const [inviteRoleFilter, setInviteRoleFilter] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");

  // Google Calendar
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEvents, setGcalEvents] = useState([]);
  const [gcalPickerOpen, setGcalPickerOpen] = useState(false);
  const [gcalCalendars, setGcalCalendars] = useState([]);
  const [gcalSelectedId, setGcalSelectedId] = useState(null);

  /* ─── derived ─── */

  const roleOptions = useMemo(() => {
    const map = new Map();
    for (const user of users) {
      const roleName = String(user.role || "").trim();
      if (!roleName) continue;
      const roleLabel = String(user.roleLabel || roleName).trim() || roleName;
      map.set(roleName, roleLabel);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [users]);

  // Utilisateurs filtres par la sidebar
  const sidebarUsers = useMemo(() => {
    const search = sidebarSearch.trim().toLowerCase();
    return users.filter((user) => {
      // Ne pas montrer soi-meme dans la sidebar (toujours affiché séparément)
      if (String(user.id) === currentUserId) return false;
      if (sidebarRoleFilter && String(user.role || "").trim() !== sidebarRoleFilter) return false;
      if (!search) return true;
      const blob = `${user.name || ""} ${user.email || ""} ${user.roleLabel || ""}`.toLowerCase();
      return blob.includes(search);
    });
  }, [users, sidebarSearch, sidebarRoleFilter, currentUserId]);

  // Liste ordonnée des users cochés (pour attribuer les couleurs de maniere stable)
  const checkedUsersOrdered = useMemo(() => {
    return users.filter((u) => checkedUserIds.has(u.id) && String(u.id) !== currentUserId);
  }, [users, checkedUserIds, currentUserId]);

  // Map userId -> couleur
  const userColorMap = useMemo(() => {
    const map = {};
    checkedUsersOrdered.forEach((u, i) => {
      map[u.id] = getUserColor(i);
    });
    return map;
  }, [checkedUsersOrdered]);

  const inviteCandidates = useMemo(
    () => users.filter((u) => String(u.id) !== String(currentUserId)),
    [users, currentUserId]
  );

  const filteredInviteCandidates = useMemo(() => {
    const search = inviteSearch.trim().toLowerCase();
    return inviteCandidates.filter((user) => {
      if (inviteRoleFilter && String(user.role || "").trim() !== inviteRoleFilter) return false;
      if (!search) return true;
      const blob = `${user.name || ""} ${user.email || ""} ${user.roleLabel || ""}`.toLowerCase();
      return blob.includes(search);
    });
  }, [inviteCandidates, inviteRoleFilter, inviteSearch]);

  const selectedInviteUsers = useMemo(() => {
    const selected = new Set(form.inviteeIds || []);
    return inviteCandidates.filter((user) => selected.has(user.id));
  }, [inviteCandidates, form.inviteeIds]);

  /* ─── fetch ─── */

  const fetchUsers = async () => {
    const res = await fetch("/api/planning/users", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Erreur chargement utilisateurs.");
    setUsers(Array.isArray(data.items) ? data.items : []);
  };

  const fetchTasksForUser = async (from, to, userId) => {
    if (!from || !to) return [];
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      userId: String(userId || ""),
    });
    const res = await fetch(`/api/planning/tasks?${params.toString()}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    return Array.isArray(data.items) ? data.items : [];
  };

  const fetchGcalCalendars = useCallback(async () => {
    try {
      const res = await fetch("/api/planning/google-calendar/calendars", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setGcalCalendars(Array.isArray(data.calendars) ? data.calendars : []);
      setGcalSelectedId(data.selectedCalendarId || null);
      // Premier accès : pas encore de calendrier choisi → ouvrir le picker
      if (!data.selectedCalendarId) setGcalPickerOpen(true);
    } catch {
      // silencieux
    }
  }, []);

  const saveGcalCalendar = useCallback(async (calendarId) => {
    await fetch("/api/planning/google-calendar/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId }),
    });
    setGcalSelectedId(calendarId);
    setGcalPickerOpen(false);
    // Recharger les events avec le nouveau calendrier
    setWeekRange((prev) => ({ ...prev }));
  }, []);

  const fetchGcalEvents = useCallback(async (from, to) => {
    if (!from || !to) return;
    try {
      const params = new URLSearchParams({
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      });
      const res = await fetch(`/api/planning/google-calendar?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (data.connected === false) {
        setGcalConnected(false);
        setGcalEvents([]);
        return;
      }
      setGcalConnected(true);
      setGcalEvents(Array.isArray(data.items) ? data.items : []);
    } catch {
      setGcalConnected(false);
      setGcalEvents([]);
    }
  }, []);

  /* ─── effects ─── */

  // Charger les utilisateurs au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await fetchUsers();
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Charger les taches pour tous les users cochés + soi-même
  useEffect(() => {
    let cancelled = false;
    if (!weekRange.from || !weekRange.to || !currentUserId) return;

    const allUserIds = [currentUserId, ...Array.from(checkedUserIds)];
    const uniqueIds = [...new Set(allUserIds)];

    (async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch en parallele pour chaque utilisateur
        const results = await Promise.all(
          uniqueIds.map(async (uid) => {
            const tasks = await fetchTasksForUser(weekRange.from, weekRange.to, uid);
            return { uid, tasks };
          })
        );

        if (!cancelled) {
          const map = {};
          for (const { uid, tasks } of results) {
            map[uid] = tasks;
          }
          setTasksByUser(map);
        }

        // Google Calendar
        await fetchGcalEvents(weekRange.from, weekRange.to);
        await fetchGcalCalendars();
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekRange.from, weekRange.to, currentUserId, checkedUserIds, fetchGcalCalendars]);

  // Availability check pour le modal
  useEffect(() => {
    let cancelled = false;
    if (!open) return;
    if (!form.start || !form.end) return;
    const start = new Date(form.start);
    const end = new Date(form.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return;

    const userIds = [currentUserId, ...(form.inviteeIds || [])].filter(Boolean);
    if (userIds.length === 0) return;

    (async () => {
      try {
        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
          userIds: userIds.join(","),
        });
        if (editingTask?.id) {
          params.set("excludeTaskId", String(editingTask.id));
        }
        const res = await fetch(`/api/planning/availability?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (!cancelled) {
          setAvailability({
            busyUserIds: Array.isArray(data.busyUserIds) ? data.busyUserIds : [],
          });
        }
      } catch {
        // no-op
      }
    })();

    return () => { cancelled = true; };
  }, [open, form.start, form.end, form.inviteeIds, currentUserId, editingTask?.id]);

  /* ─── calendar events ─── */

  const calendarEvents = useMemo(() => {
    const all = [];

    // Mes taches (bleu principal)
    const myTasks = tasksByUser[currentUserId] || [];
    for (const task of myTasks) {
      all.push({
        id: `me_${task.id}`,
        title: task.title || "Occupe",
        start: task.start,
        end: task.end,
        allDay: false,
        backgroundColor: task.isOwner ? "#0ea5e9" : "#38bdf8",
        borderColor: task.isOwner ? "#0284c7" : "#0ea5e9",
        textColor: "#ffffff",
        resourceId: currentUserId,
        extendedProps: {
          userId: currentUserId,
          isOwner: Boolean(task.isOwner),
          isPrivate: Boolean(task.isPrivate),
          isGoogleCalendar: false,
          taskId: task.id,
          participantIds: task.participantIds || [],
        },
      });
    }

    // Taches des utilisateurs cochés (avec couleurs distinctes)
    for (const user of checkedUsersOrdered) {
      const color = userColorMap[user.id];
      const userTasks = tasksByUser[user.id] || [];
      for (const task of userTasks) {
        all.push({
          id: `${user.id}_${task.id}`,
          title: task.isPrivate ? `${user.name} — Occupé` : `${user.name} — ${task.title || "Occupé"}`,
          start: task.start,
          end: task.end,
          allDay: false,
          backgroundColor: color.bg,
          borderColor: color.border,
          textColor: color.text,
          resourceId: user.id,
          extendedProps: {
            userId: user.id,
            userName: user.name,
            isOwner: false,
            isPrivate: Boolean(task.isPrivate),
            isGoogleCalendar: false,
            taskId: task.id,
          },
        });
      }
    }

    // Google Calendar events
    if (gcalConnected) {
      for (const gcalEvent of gcalEvents) {
        const isDuplicate = Object.values(tasksByUser).flat().some(
          task => task.title === gcalEvent.title &&
            new Date(task.start).getTime() === new Date(gcalEvent.start).getTime()
        );
        if (isDuplicate) continue;

        all.push({
          id: gcalEvent.id,
          title: gcalEvent.title,
          start: gcalEvent.start,
          end: gcalEvent.end,
          allDay: false,
          backgroundColor: "#0ea5e9",
          borderColor: "#0284c7",
          textColor: "#ffffff",
          resourceId: currentUserId,
          extendedProps: {
            isOwner: false,
            isPrivate: false,
            isGoogleCalendar: true,
            htmlLink: gcalEvent.htmlLink,
          },
        });
      }
    }

    return all;
  }, [tasksByUser, currentUserId, checkedUsersOrdered, userColorMap, gcalConnected, gcalEvents]);

  const calendarResources = useMemo(() => {
    const res = [
      { id: currentUserId, title: "Moi" }
    ];
    for (const user of checkedUsersOrdered) {
      const firstName = (user.name || "").split(" ")[0];
      res.push({ id: user.id, title: firstName });
    }
    return res;
  }, [currentUserId, checkedUsersOrdered]);

  /* ─── actions ─── */

  const toggleUser = (userId) => {
    setCheckedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm(defaultForm());
    setAvailability({ busyUserIds: [] });
    setInviteRoleFilter("");
    setInviteSearch("");
    setOpen(true);
  };

  const openEdit = (eventApi) => {
    if (eventApi.extendedProps?.isGoogleCalendar) {
      const link = eventApi.extendedProps?.htmlLink;
      if (link) window.open(link, "_blank");
      return;
    }

    if (eventApi.extendedProps?.userId !== currentUserId) return;
    if (!eventApi.extendedProps?.isOwner) return;

    const taskId = eventApi.extendedProps?.taskId;
    const myTasks = tasksByUser[currentUserId] || [];
    const item = myTasks.find((t) => String(t.id) === String(taskId));
    if (!item) return;

    setEditingTask(item);
    setForm({
      title: item.title || "",
      start: toDateTimeLocalValue(item.start),
      end: toDateTimeLocalValue(item.end),
      inviteeIds: Array.isArray(item.participantIds) ? item.participantIds : [],
    });
    setAvailability({ busyUserIds: [] });
    setInviteRoleFilter("");
    setInviteSearch("");
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingTask(null);
    setInviteRoleFilter("");
    setInviteSearch("");
  };

  const submitTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        start: new Date(form.start).toISOString(),
        end: new Date(form.end).toISOString(),
        inviteeIds: form.inviteeIds,
      };
      const url = editingTask
        ? `/api/planning/tasks/${encodeURIComponent(String(editingTask.id))}`
        : "/api/planning/tasks";
      const method = editingTask ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setAvailability({
            busyUserIds: Array.isArray(data.busyUserIds) ? data.busyUserIds : [],
          });
        }
        throw new Error(data?.error || "Erreur enregistrement tache.");
      }

      // Sync automatique vers Google Calendar
      if (!editingTask) {
        try {
          await fetch("/api/planning/google-calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: form.title,
              start: payload.start,
              end: payload.end,
            }),
          });
        } catch {
          // Silencieux
        }
      }

      // Re-fetch — trigger via weekRange
      setWeekRange((prev) => ({ ...prev }));
      closeModal();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    if (!editingTask?.id) return;
    const ok = window.confirm("Supprimer cette tache ?");
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/planning/tasks/${encodeURIComponent(String(editingTask.id))}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur suppression tache.");
      setWeekRange((prev) => ({ ...prev }));
      closeModal();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  /* ─── rendu ─── */

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <h1 className={styles.pageTitle}>Planning Perso</h1>
          {checkedUsersOrdered.length > 0 ? (
            <div className={styles.pageSubtitle}>
              {checkedUsersOrdered.length} personne{checkedUsersOrdered.length > 1 ? "s" : ""} affichée{checkedUsersOrdered.length > 1 ? "s" : ""}
            </div>
          ) : null}
        </div>
        <div className={styles.actions}>
          {gcalConnected ? (
            <button
              type="button"
              className={styles.gcalConnected}
              onClick={() => setGcalPickerOpen(true)}
              title="Changer d'agenda Google"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {gcalSelectedId && gcalCalendars.find((c) => c.id === gcalSelectedId)?.summary
                ? gcalCalendars.find((c) => c.id === gcalSelectedId).summary
                : "Google Agenda"}
            </button>
          ) : null}
          <button type="button" className={styles.primaryBtn} onClick={openCreate}>
            Ajouter une tache
          </button>
        </div>
      </div>

      {error ? <div className={styles.errorBox}>{error}</div> : null}

      <div className={styles.layoutRow}>
        {/* ─── Sidebar gauche ─── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>Personnes</div>

          {/* Moi — toujours coché */}
          <div className={styles.sidebarSelf}>
            <span className={styles.sidebarSelfDot} />
            <span>Moi</span>
          </div>

          {/* Filtres */}
          <div className={styles.sidebarFilters}>
            <select
              className={styles.sidebarSelect}
              value={sidebarRoleFilter}
              onChange={(e) => setSidebarRoleFilter(e.target.value)}
            >
              <option value="">Tous les roles</option>
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <input
              className={styles.sidebarSearchInput}
              type="search"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Rechercher..."
            />
          </div>

          {/* Liste des utilisateurs */}
          <div className={styles.sidebarList}>
            {sidebarUsers.length === 0 ? (
              <div className={styles.sidebarEmpty}>Aucune personne</div>
            ) : null}
            {sidebarUsers.map((user) => {
              const checked = checkedUserIds.has(user.id);
              const color = checked ? userColorMap[user.id] : null;
              return (
                <label key={user.id} className={styles.sidebarUser}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUser(user.id)}
                    className={styles.sidebarCheckbox}
                  />
                  {color ? (
                    <span
                      className={styles.sidebarDot}
                      style={{ background: color.border }}
                    />
                  ) : null}
                  <span className={styles.sidebarName}>{user.name}</span>
                  {user.roleLabel ? (
                    <span className={styles.sidebarRole}>{user.roleLabel}</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </aside>

        {/* ─── Calendrier ─── */}
        <div className={styles.calendarCard}>
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin, resourceTimeGridPlugin]}
            locale={frLocale}
            schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
            initialView="resourceTimeGridWeek"
            firstDay={1}
            allDaySlot={false}
            nowIndicator
            datesAboveResources={true}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            height="auto"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "resourceTimeGridWeek,resourceTimeGridDay",
            }}
            buttonText={{
              today: "Aujourd'hui",
              week: "Semaine",
              day: "Jour",
            }}
            resources={calendarResources}
            events={calendarEvents}
            datesSet={(arg) => {
              setWeekRange({ from: arg.start, to: arg.end });
            }}
            eventClick={(info) => {
              if (info.event.extendedProps?.isGoogleCalendar) {
                const link = info.event.extendedProps?.htmlLink;
                if (link) window.open(link, "_blank");
                return;
              }
              if (info.event.extendedProps?.userId !== currentUserId) return;
              if (!info.event.extendedProps?.isOwner) return;
              openEdit(info.event);
            }}
          />
        </div>
      </div>

      {/* ─── Modal creation / edition ─── */}
      <Modal
        open={open}
        title={editingTask ? "Modifier une tache" : "Nouvelle tache"}
        onClose={closeModal}
        size="sm"
      >
        <form className={styles.form} onSubmit={submitTask}>
          <div className={styles.field}>
            <label className={styles.label}>Nom de la tache</label>
            <input
              className={styles.input}
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>De</label>
              <input
                className={styles.input}
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm((prev) => ({ ...prev, start: e.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>A</label>
              <input
                className={styles.input}
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm((prev) => ({ ...prev, end: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Personnes a inviter</label>
            <details className={styles.inviteDropdown}>
              <summary className={styles.inviteSummary}>
                {selectedInviteUsers.length > 0
                  ? `${selectedInviteUsers.length} personne(s) selectionnee(s)`
                  : "Choisir des personnes a inviter"}
              </summary>

              <div className={styles.invitePanel}>
                <div className={styles.inviteControls}>
                  <select
                    className={styles.select}
                    value={inviteRoleFilter}
                    onChange={(e) => setInviteRoleFilter(e.target.value)}
                  >
                    <option value="">Tous les roles</option>
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  <input
                    className={styles.inviteSearch}
                    type="search"
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    placeholder="Rechercher une personne..."
                  />
                </div>

                <div className={styles.inviteList}>
                  {filteredInviteCandidates.length === 0 ? (
                    <div className={styles.emptyInvite}>Aucune personne sur ce filtre.</div>
                  ) : null}

                  {filteredInviteCandidates.map((user) => {
                    const checked = form.inviteeIds.includes(user.id);
                    const isBusy = availability.busyUserIds.includes(user.id);
                    return (
                      <label key={user.id} className={styles.inviteRow}>
                        <span className={styles.inviteLeft}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setForm((prev) => {
                                const set = new Set(prev.inviteeIds || []);
                                if (e.target.checked) set.add(user.id);
                                else set.delete(user.id);
                                return { ...prev, inviteeIds: Array.from(set) };
                              });
                            }}
                          />
                          <span>{user.name}</span>
                        </span>
                        {checked ? (
                          <span className={isBusy ? styles.busyTag : styles.freeTag}>
                            {isBusy ? "Occupe" : "Libre"}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={closeModal}>
              Annuler
            </button>
            {editingTask ? (
              <button type="button" className={styles.deleteBtn} onClick={deleteTask} disabled={saving}>
                Supprimer
              </button>
            ) : null}
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? "Enregistrement..." : editingTask ? "Enregistrer" : "Creer"}
            </button>
          </div>

          {editingTask ? (
            <div className={styles.meta}>
              Derniere mise a jour: {formatDateTime(editingTask.updatedAt || editingTask.createdAt)}
            </div>
          ) : null}
        </form>
      </Modal>

      {loading ? <div className={styles.loading}>Chargement...</div> : null}

      {/* ─── Modal choix agenda Google ─── */}
      <Modal
        open={gcalPickerOpen}
        title="Choisir un agenda Google"
        onClose={() => gcalSelectedId && setGcalPickerOpen(false)}
        size="sm"
      >
        <div className={styles.gcalPickerBody}>
          <p className={styles.gcalPickerHint}>
            Sélectionne l'agenda Google Calendar à synchroniser avec Spectra.
          </p>
          <div className={styles.gcalCalendarList}>
            {gcalCalendars.map((cal) => (
              <button
                key={cal.id}
                type="button"
                className={`${styles.gcalCalendarItem} ${gcalSelectedId === cal.id ? styles.gcalCalendarItemSelected : ""}`}
                onClick={() => saveGcalCalendar(cal.id)}
              >
                <span
                  className={styles.gcalCalendarDot}
                  style={{ background: cal.backgroundColor || "#0ea5e9" }}
                />
                <span className={styles.gcalCalendarName}>{cal.summary}</span>
                {cal.primary && <span className={styles.gcalPrimaryBadge}>Principal</span>}
                {gcalSelectedId === cal.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: "auto", flexShrink: 0 }}>
                    <path d="M20 6L9 17l-5-5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
            {gcalCalendars.length === 0 && (
              <div className={styles.gcalPickerEmpty}>Chargement des agendas…</div>
            )}
          </div>
          {gcalSelectedId && (
            <div className={styles.gcalPickerFooter}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setGcalPickerOpen(false)}>
                Annuler
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
