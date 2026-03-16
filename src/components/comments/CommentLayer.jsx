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

  // Context menu
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, xVw, docY }

  // New comment form
  const [form, setForm] = useState(null); // { x, y, xVw, docY }
  const [formText, setFormText] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Open thread
  const [openId, setOpenId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);

  const formRef = useRef(null);
  const threadRef = useRef(null);
  const ctxMenuDataRef = useRef(null); // garde la position même après setCtxMenu(null)

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
      setOpenId(null);
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  // ── Close menus on outside click ──
  useEffect(() => {
    const onClick = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) setForm(null);
      if (threadRef.current && !threadRef.current.contains(e.target)) {
        // only close if not clicking a pin
        if (!e.target.closest("[data-pin]")) setOpenId(null);
      }
      setCtxMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
        setOpenId(data.item.id);
      }
    } finally {
      setFormSaving(false);
      setForm(null);
      setFormText("");
    }
  };

  // ── Reply ──
  const saveReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !openId) return;
    setReplySaving(true);
    try {
      const res = await fetch(`/api/comments/${openId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === openId ? { ...c, replies: [...c.replies, data.reply] } : c
          )
        );
        setReplyText("");
      }
    } finally {
      setReplySaving(false);
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
      if (!current) setOpenId(null);
    }
  };

  // ── Delete ──
  const deleteComment = async (id) => {
    if (!confirm("Supprimer ce commentaire ?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      setOpenId(null);
    }
  };

  const visibleComments = comments.filter((c) => showResolved || !c.resolved);
  const openComment = comments.find((c) => c.id === openId) || null;

  // ── Pin position ──
  const pinStyle = (c) => {
    const top = c.docY - scrollY;
    const left = (c.xVw / 100) * window.innerWidth;
    return { top, left };
  };

  return (
    <>
      {/* ── Toggle show-resolved button ── */}
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => setShowResolved((v) => !v)}
          title={showResolved ? "Masquer les résolus" : "Afficher les résolus"}
        >
          💬 {comments.filter((c) => !c.resolved).length}
          {showResolved && comments.filter((c) => c.resolved).length > 0
            ? ` (+${comments.filter((c) => c.resolved).length} résolus)`
            : ""}
        </button>
      </div>

      {/* ── Pins ── */}
      {visibleComments.map((c) => {
        const { top, left } = pinStyle(c);
        if (top < -20 || top > window.innerHeight + 20) return null;
        return (
          <button
            key={c.id}
            data-pin="true"
            type="button"
            className={`${styles.pin} ${c.resolved ? styles.pinResolved : ""} ${openId === c.id ? styles.pinActive : ""}`}
            style={{ top, left }}
            onClick={() => setOpenId(openId === c.id ? null : c.id)}
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
        <div
          className={styles.ctxMenu}
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button type="button" className={styles.ctxItem} onClick={startComment}>
            💬 Ajouter un commentaire
          </button>
        </div>
      )}

      {/* ── New comment form ── */}
      {form && (
        <div
          ref={formRef}
          className={styles.commentForm}
          style={{
            top: form.y + 10,
            left: Math.min(form.x, window.innerWidth - 320),
          }}
          onMouseDown={(e) => e.stopPropagation()}
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
      )}

      {/* ── Thread panel ── */}
      {openComment && (
        <div ref={threadRef} className={styles.thread}>
          <div className={styles.threadHeader}>
            <span className={styles.threadTitle}>Discussion</span>
            <div className={styles.threadHeaderActions}>
              <button
                type="button"
                className={openComment.resolved ? styles.unresolveBtn : styles.resolveBtn}
                onClick={() => toggleResolved(openComment.id, openComment.resolved)}
              >
                {openComment.resolved ? "Réouvrir" : "Résoudre ✓"}
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => deleteComment(openComment.id)}
              >
                🗑
              </button>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpenId(null)}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Original comment */}
          <div className={styles.message}>
            <div className={styles.msgMeta}>
              <span className={styles.msgAuthor}>{openComment.authorName}</span>
              <span className={styles.msgTime}>{timeAgo(openComment.createdAt)}</span>
            </div>
            <p className={styles.msgContent}>{openComment.content}</p>
          </div>

          {/* Replies */}
          {openComment.replies.map((r, i) => (
            <div key={i} className={`${styles.message} ${styles.reply}`}>
              <div className={styles.msgMeta}>
                <span className={styles.msgAuthor}>{r.authorName}</span>
                <span className={styles.msgTime}>{timeAgo(r.createdAt)}</span>
              </div>
              <p className={styles.msgContent}>{r.content}</p>
            </div>
          ))}

          {/* Reply form */}
          {!openComment.resolved && (
            <form className={styles.replyForm} onSubmit={saveReply}>
              <textarea
                className={styles.textarea}
                placeholder="Répondre..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
              />
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!replyText.trim() || replySaving}
              >
                {replySaving ? "..." : "Répondre"}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
