import React, { useEffect } from "react";
import styles from "./Modal.module.css";

export default function Modal({ open, title, children, onClose, size = "md" }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKeyDown);
    // lock scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title || "Modal"}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={`${styles.modal} ${styles[size] || ""}`}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
