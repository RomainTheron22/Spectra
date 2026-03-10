import React, { useMemo, useState } from "react";
import styles from "./SelectWithAdd.module.css";

export default function SelectWithAdd({
  label,
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
  addLabel = "Ajouter…",
  onAddOption,
  allowAdd = true,
  name,
  required,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState("");

  const normalized = useMemo(() => {
    const uniq = Array.from(new Set((options || []).map((x) => String(x).trim()).filter(Boolean)));
    uniq.sort((a, b) => a.localeCompare(b, "fr"));
    return uniq;
  }, [options]);

  const handleSelect = (e) => {
    const v = e.target.value;
    if (allowAdd && v === "__add__") {
      setIsAdding(true);
      setNewValue("");
      return;
    }
    setIsAdding(false);
    onChange?.(v);
  };

  const commitAdd = () => {
    const v = String(newValue).trim();
    if (!v) return;
    onAddOption?.(v);
    onChange?.(v);
    setIsAdding(false);
    setNewValue("");
  };

  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label} {required ? <span className={styles.req}>*</span> : null}
      </label>

      <select
        className={styles.select}
        value={isAdding ? "__add__" : (value || "")}
        onChange={handleSelect}
        name={name}
        required={required && !isAdding}
      >
        <option value="">{placeholder}</option>
        {normalized.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        {allowAdd ? <option value="__add__">{addLabel}</option> : null}
      </select>

      {allowAdd && isAdding ? (
        <div className={styles.addRow}>
          <input
            className={styles.input}
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Saisir puis valider"
          />
          <button type="button" className={styles.addBtn} onClick={commitAdd}>
            Ajouter
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => {
              setIsAdding(false);
              setNewValue("");
            }}
          >
            Annuler
          </button>
        </div>
      ) : null}
    </div>
  );
}
