import Link from "next/link";
import styles from "./ForbiddenView.module.css";

export default function ForbiddenView({
  title = "403 - Acces refuse",
  message = "Vous n'avez pas la permission necessaire pour acceder a cette page.",
  showBack = true,
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>
        {showBack ? (
          <Link href="/" className={styles.backLink}>
            Retour au tableau de bord
          </Link>
        ) : null}
      </div>
    </div>
  );
}
