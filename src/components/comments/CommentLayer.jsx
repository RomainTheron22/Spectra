"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./CommentLayer.module.css";

function timeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("fr-FR");
}

export default function CommentLayer() {
  const pathname = usePathname();

  const [comments, setComments] = useState([]);
  const [scrollY, setScrollY] = useState(0);
  const [showResolved, setShowResolved] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [focusId, setFocusId] = useState(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState(null);

  // New comment form
  const [form, setForm] = useState(null);
  const [formText, setFormText] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Per-comment reply state
  const [replyTexts, setReplyTexts] = useState({});
  const [replySavingId, setReplySavingId] = useState(null);

  const formRef = useRef(null);
  const panelRef = useRef(null);
  const ctxMenuDataRef = useRef(null);

  // ── Load comments ──
  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?page=${encodeURIComponent(pathname)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setComments(Array.isArray(data.items) ? data.items : []);
    } catch {}
  }, [pathname]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // ── Scroll tracking ──
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    setScrollY(window.scrollY);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Right-click interception ──
  useEffect(() => {
    const onContextMenu = (e) => {
      e.preventDefault();
      const xVw = (e.clientX / window.innerWidth) * 100;
      const docY = e.clientY + window.scrollY;
      const data = { x: e.clientX, y: e.clientY, xVw, docY };
      ctxMenuDataRef.current = data;
      setCtxMenu(data);
      setForm(null);
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  // ── Scroll to focused comment in panel ──
  useEffect(() => {
    if (!focusId || !panelRef.current) return;
    const el = panelRef.current.querySelector(`[data-comment-id="${focusId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusId]);

  // ── Open new comment form ──
  const startComment = () => {
    const data = ctxMenuDataRef.current;
    if (!data) return;
    setForm(data);
    setFormText("");
    setCtxMenu(null);
    ctxMenuDataRef.current = null;
  };

  // ── Save comment ──
  const saveComment = async (e) => {
    e.preventDefault();
    if (!formText.trim() || !form) return;
    setFormSaving(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: pathname,
          xVw: form.xVw,
          docY: form.docY,
          content: formText.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [data.item, ...prev]);
        setShowPanel(true);
        setFocusId(data.item.id);
      }
    } finally {
      setFormSaving(false);
      setForm(null);
      setFormText("");
    }
  };

  // ── Reply ──
  const saveReply = async (e, commentId) => {
    e.preventDefault();
    const text = (replyTexts[commentId] || "").trim();
    if (!text) return;
    setReplySavingId(commentId);
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, replies: [...c.replies, data.reply] } : c
          )
        );
        setReplyTexts((prev) => ({ ...prev, [commentId]: "" }));
      }
    } finally {
      setReplySavingId(null);
    }
  };

  // ── Resolve ──
  const toggleResolved = async (id, current) => {
    const res = await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !current }),
    });
    if (res.ok) {
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, resolved: !current } : c))
      );
    }
  };

  // ── Delete ──
  const deleteComment = async (id) => {
    if (!confirm("Supprimer ce commentaire ?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      if (focusId === id) setFocusId(null);
    }
  };

  const activeComments = comments.filter((c) => !c.resolved);
  const visibleComments = showResolved ? comments : activeComments;

  // ── Pin position ──
  const pinStyle = (c) => {
    const top = c.docY - scrollY;
    const left = (c.xVw / 100) * window.innerWidth;
    return { top, left };
  };

  return (
    <>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${showPanel ? styles.toolbarBtnActive : ""}`}
          onClick={() => setShowPanel((v) => !v)}
          title={showPanel ? "Fermer les commentaires" : "Voir les commentaires"}
        >
          💬 {comments.filter((c) => !c.resolved).length}
          {comments.filter((c) => c.resolved).length > 0
            ? ` (+${comments.filter((c) => c.resolved).length} résolus)`
            : ""}
        </button>
      </div>

      {/* ── Pins (unresolved only) ── */}
      {activeComments.map((c) => {
        const { top, left } = pinStyle(c);
        if (top < -20 || top > window.innerHeight + 20) return null;
        return (
          <button
            key={c.id}
            data-pin="true"
            type="button"
            className={`${styles.pin} ${focusId === c.id ? styles.pinActive : ""}`}
            style={{ top, left }}
            onClick={() => {
              setShowPanel(true);
              setFocusId(c.id);
            }}
            title={c.content}
          >
            <span className={styles.pinIcon}>💬</span>
            {c.replies.length > 0 && (
              <span className={styles.pinBadge}>{c.replies.length}</span>
            )}
          </button>
        );
      })}

      {/* ── Context menu ── */}
      {ctxMenu && (
        <>
          <div className={styles.backdrop} onClick={() => setCtxMenu(null)} />
          <div
            className={styles.ctxMenu}
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            <button type="button" className={styles.ctxItem} onClick={startComment}>
              💬 Ajouter un commentaire
            </button>
          </div>
        </>
      )}

      {/* ── New comment form ── */}
      {form && (
        <>
          <div className={styles.backdrop} onClick={() => setForm(null)} />
          <div
            ref={formRef}
            className={styles.commentForm}
            style={{
              top: form.y + 10,
              left: Math.min(form.x, window.innerWidth - 320),
            }}
          >
            <p className={styles.formTitle}>Nouveau commentaire</p>
            <form onSubmit={saveComment}>
              <textarea
                className={styles.textarea}
                placeholder="Décris le problème ou la suggestion..."
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                autoFocus
                rows={3}
              />
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setForm(null)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={!formText.trim() || formSaving}
                >
                  {formSaving ? "..." : "Envoyer"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Comments panel ── */}
      {showPanel && (
        <div ref={panelRef} className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Commentaires</span>
            <div className={styles.panelHeaderActions}>
              <button
                type="button"
                className={`${styles.toggleResolvedBtn} ${showResolved ? styles.toggleResolvedBtnActive : ""}`}
                onClick={() => setShowResolved((v) => !v)}
                title={showResolved ? "Masquer les résolus" : "Afficher les résolus"}
              >
                {showResolved ? "Masquer résolus" : "Afficher résolus"}
              </button>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowPanel(false)}
              >
                ✕
              </button>
            </div>
          </div>

          <div className={styles.panelBody}>
            {visibleComments.length === 0 && (
              <p className={styles.emptyText}>Aucun commentaire sur cette page.</p>
            )}
            {visibleComments.map((c) => (
              <div
                key={c.id}
                data-comment-id={c.id}
                className={`${styles.commentCard} ${c.resolved ? styles.commentCardResolved : ""} ${focusId === c.id ? styles.commentCardFocused : ""}`}
              >
                {/* Comment header */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardMeta}>
                    <span className={styles.msgAuthor}>{c.authorName}</span>
                    <span className={styles.msgTime}>{timeAgo(c.createdAt)}</span>
                    {c.resolved && <span className={styles.resolvedBadge}>Résolu</span>}
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={c.resolved ? styles.unresolveBtn : styles.resolveBtn}
                      onClick={() => toggleResolved(c.id, c.resolved)}
                    >
                      {c.resolved ? "Réouvrir" : "Résoudre ✓"}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => deleteComment(c.id)}
                      title="Supprimer"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {/* Content */}
                <p className={styles.msgContent}>{c.content}</p>

                {/* Replies */}
                {c.replies.map((r, i) => (
                  <div key={i} className={styles.replyItem}>
                    <div className={styles.msgMeta}>
                      <span className={styles.msgAuthor}>{r.authorName}</span>
                      <span className={styles.msgTime}>{timeAgo(r.createdAt)}</span>
                    </div>
                    <p className={styles.msgContent}>{r.content}</p>
                  </div>
                ))}

                {/* Reply form */}
                {!c.resolved && (
                  <form
                    className={styles.replyForm}
                    onSubmit={(e) => saveReply(e, c.id)}
                  >
                    <textarea
                      className={styles.textarea}
                      placeholder="Répondre..."
                      value={replyTexts[c.id] || ""}
                      onChange={(e) =>
                        setReplyTexts((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      rows={2}
                    />
                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={!(replyTexts[c.id] || "").trim() || replySavingId === c.id}
                    >
                      {replySavingId === c.id ? "..." : "Répondre"}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
