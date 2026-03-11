"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./AdminPage.module.css";
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  ROLE_NAMES,
  isActionSupportedForResource,
  getResourceFields,
} from "../../lib/rbac";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR");
}

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");

  // expandedFields: Set de "roleId-resourceKey"
  const [expandedFields, setExpandedFields] = useState(new Set());

  const toggleExpanded = (roleId, resourceKey) => {
    const key = `${roleId}-${resourceKey}`;
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isExpanded = (roleId, resourceKey) =>
    expandedFields.has(`${roleId}-${resourceKey}`);

  const loadData = async () => {
    setError("");
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/roles", { cache: "no-store" }),
      ]);

      const usersPayload = await usersRes.json().catch(() => ({}));
      if (!usersRes.ok) {
        throw new Error(usersPayload?.error || "Erreur chargement utilisateurs.");
      }

      const rolesPayload = await rolesRes.json().catch(() => ({}));
      if (!rolesRes.ok) {
        throw new Error(rolesPayload?.error || "Erreur chargement roles.");
      }

      setUsers(Array.isArray(usersPayload.items) ? usersPayload.items : []);
      setRoles(Array.isArray(rolesPayload.items) ? rolesPayload.items : []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return users.filter((user) => {
      const bySearch =
        !q ||
        `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(q);
      const byRole = filterRole === "all" || user.role === filterRole;
      const byActive =
        filterActive === "all" ||
        (filterActive === "active" ? user.isActive : !user.isActive);
      return bySearch && byRole && byActive;
    });
  }, [users, search, filterRole, filterActive]);

  const updateUser = async (userId, payload) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur mise a jour utilisateur.");
      setUsers((prev) => prev.map((item) => (item.id === userId ? data.item : item)));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userId) => {
    const ok = window.confirm("Supprimer cet utilisateur ? Cette action est irreversible.");
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur suppression utilisateur.");
      setUsers((prev) => prev.filter((item) => item.id !== userId));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const createRole = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName,
          label: newRoleLabel || newRoleName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur creation role.");

      setRoles((prev) => [
        ...prev,
        {
          ...data.item,
          id: data.item.id || data.item._id,
        },
      ]);
      setNewRoleName("");
      setNewRoleLabel("");
      await loadData();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (roleId, payload) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(roleId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur mise a jour role.");
      setRoles((prev) =>
        prev.map((role) => (role.id === roleId ? { ...role, ...data.item } : role))
      );
      if ("name" in payload) {
        await loadData();
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId) => {
    const ok = window.confirm("Supprimer ce role ?");
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(roleId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur suppression role.");
      setRoles((prev) => prev.filter((role) => role.id !== roleId));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = async (role, resourceKey, action, checked) => {
    const nextPermissions = {
      ...(role.permissions || {}),
      [resourceKey]: {
        ...(role.permissions?.[resourceKey] || {}),
        [action]: checked,
      },
    };

    setRoles((prev) =>
      prev.map((item) =>
        item.id === role.id ? { ...item, permissions: nextPermissions } : item
      )
    );

    await updateRole(role.id, { permissions: nextPermissions });
  };

  const toggleFieldPermission = async (role, resourceKey, fieldKey, checked) => {
    const nextPermissions = {
      ...(role.permissions || {}),
      [resourceKey]: {
        ...(role.permissions?.[resourceKey] || {}),
        fields: {
          ...(role.permissions?.[resourceKey]?.fields || {}),
          [fieldKey]: checked,
        },
      },
    };

    setRoles((prev) =>
      prev.map((item) =>
        item.id === role.id ? { ...item, permissions: nextPermissions } : item
      )
    );

    await updateRole(role.id, { permissions: nextPermissions });
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.pageTitle}>Admin</h1>
      </div>

      {error ? <div className={styles.errorBox}>{error}</div> : null}

      {/* ── Utilisateurs ── */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Gestion des utilisateurs</h2>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.input}
            type="text"
            placeholder="Rechercher nom / email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={styles.select}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Tous les roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.label}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="disabled">Desactives</option>
          </select>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Role</th>
                <th>Derniere connexion</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    Chargement...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    Aucun utilisateur.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name || "-"}</td>
                    <td>{user.email || "-"}</td>
                    <td>
                      <select
                        className={styles.inlineSelect}
                        value={user.role || ROLE_NAMES.INVITE}
                        disabled={saving}
                        onChange={(e) => updateUser(user.id, { role: e.target.value })}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDateTime(user.lastLoginAt)}</td>
                    <td>
                      <span className={user.isActive ? styles.badgeActive : styles.badgeDisabled}>
                        {user.isActive ? "Actif" : "Desactive"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          disabled={saving}
                          onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                        >
                          {user.isActive ? "Desactiver" : "Activer"}
                        </button>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          disabled={saving}
                          onClick={() => deleteUser(user.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Rôles & permissions ── */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Gestion des roles</h2>
        </div>

        <form className={styles.roleForm} onSubmit={createRole}>
          <input
            className={styles.input}
            type="text"
            placeholder="Nom technique (ex: manager)"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            required
          />
          <input
            className={styles.input}
            type="text"
            placeholder="Label (ex: Manager)"
            value={newRoleLabel}
            onChange={(e) => setNewRoleLabel(e.target.value)}
          />
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            Creer le role
          </button>
        </form>

        <div className={styles.rolesGrid}>
          {roles.map((role) => {
            const lockPermissions = role.name === ROLE_NAMES.ADMIN;
            return (
              <article key={role.id} className={styles.roleCard}>
                <div className={styles.roleHeader}>
                  <div>
                    <div className={styles.roleName}>
                      {role.label} <span className={styles.roleCode}>({role.name})</span>
                    </div>
                    {role.isSystem ? <div className={styles.systemHint}>Role systeme</div> : null}
                  </div>
                  <div className={styles.rowActions}>
                    {!role.isSystem ? (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        disabled={saving}
                        onClick={() => deleteRole(role.id)}
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={styles.permissionsWrap}>
                  <table className={styles.permissionsTable}>
                    <thead>
                      <tr>
                        <th>Module</th>
                        {PERMISSION_ACTIONS.map((action) => (
                          <th key={`${role.id}-${action}`}>{action}</th>
                        ))}
                        <th>Champs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const GROUP_LABELS = {
                          general:  "Général",
                          projets:  "Projets",
                          materiel: "Stock & Matériel",
                          externes: "Externes",
                          rh:       "RH",
                          finances: "Finances",
                          admin:    "Admin",
                        };
                        let lastGroup = null;
                        return PERMISSION_RESOURCES.flatMap((resource) => {
                        const fields = getResourceFields(resource.key);
                        const hasFields = fields.length > 0;
                        const expanded = isExpanded(role.id, resource.key);
                        const rows = [];

                        if (resource.group !== lastGroup) {
                          lastGroup = resource.group;
                          rows.push(
                            <tr key={`group-${role.id}-${resource.group}`} className={styles.groupHeaderRow}>
                              <td colSpan={PERMISSION_ACTIONS.length + 2}>
                                {GROUP_LABELS[resource.group] || resource.group}
                              </td>
                            </tr>
                          );
                        }

                        rows.push(
                          <>
                            <tr key={`${role.id}-${resource.key}`}>
                              <td className={styles.resourceLabel}>{resource.label}</td>
                              {PERMISSION_ACTIONS.map((action) => {
                                const isSupported = isActionSupportedForResource(resource.key, action);
                                const checked =
                                  isSupported &&
                                  Boolean(role.permissions?.[resource.key]?.[action]);
                                return (
                                  <td key={`${role.id}-${resource.key}-${action}`}>
                                    {isSupported ? (
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={saving || lockPermissions}
                                        onChange={(e) =>
                                          togglePermission(role, resource.key, action, e.target.checked)
                                        }
                                      />
                                    ) : (
                                      <span className={styles.notAvailable}>-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td>
                                {hasFields ? (
                                  <button
                                    type="button"
                                    className={styles.fieldsToggleBtn}
                                    onClick={() => toggleExpanded(role.id, resource.key)}
                                    disabled={lockPermissions}
                                  >
                                    {expanded ? "▲" : "▼"} {fields.length}
                                  </button>
                                ) : (
                                  <span className={styles.notAvailable}>-</span>
                                )}
                              </td>
                            </tr>

                            {hasFields && expanded && (
                              <tr
                                key={`${role.id}-${resource.key}-fields`}
                                className={styles.fieldsRow}
                              >
                                <td colSpan={PERMISSION_ACTIONS.length + 2}>
                                  <div className={styles.fieldsPanel}>
                                    <p className={styles.fieldsPanelTitle}>
                                      Champs visibles — {resource.label}
                                    </p>
                                    <div className={styles.fieldsGrid}>
                                      {fields.map((field) => {
                                        const stored =
                                          role.permissions?.[resource.key]?.fields?.[field.key];
                                        const checked = stored === undefined ? true : Boolean(stored);
                                        return (
                                          <label
                                            key={field.key}
                                            className={styles.fieldLabel}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              disabled={saving || lockPermissions}
                                              onChange={(e) =>
                                                toggleFieldPermission(
                                                  role,
                                                  resource.key,
                                                  field.key,
                                                  e.target.checked
                                                )
                                              }
                                            />
                                            {field.label}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );

                        return rows;
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
