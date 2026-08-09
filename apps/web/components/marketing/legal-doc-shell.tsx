import type { ReactNode } from "react";
import styles from "./legal-doc-shell.module.css";

export type LegalDocNavItem = {
  href: string;
  label: string;
};

type Props = {
  title: string;
  /** Small uppercase label above the title (e.g. "Legal", "SMS Consent"). */
  eyebrow?: string;
  /** Short hero summary under the title. */
  description?: string;
  /** Date of the last review. A review that changed nothing still counts. */
  lastReviewed: string;
  /** Optional in-page section anchors (sms-consent style). */
  navItems?: readonly LegalDocNavItem[];
  /** Extra note under the body (carrier / compliance footer line). */
  complianceNote?: string;
  children: ReactNode;
};

/**
 * Public marketing legal pages: hero + optional section nav matching the SMS
 * consent disclosure layout. Page `<h1>` keeps the marketing-site scrolling
 * title gradient (do not set a solid text color on the title).
 */
export function LegalDocShell({
  title,
  eyebrow = "Legal",
  description,
  lastReviewed,
  navItems,
  complianceNote,
  children,
}: Props) {
  return (
    <article className={styles.doc}>
      {navItems && navItems.length > 0 ? (
        <nav className={styles.pageNav} aria-label="Page sections">
          <div className={styles.pageNavInner}>
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      <div className={styles.hero}>
        <div className={styles.heroEyebrow}>{eyebrow}</div>
        <h1 className={styles.heroTitle}>{title}</h1>
        {description ? <p className={styles.heroSub}>{description}</p> : null}
        <p className={styles.heroMeta}>Last reviewed {lastReviewed}</p>
      </div>

      <div className={styles.body}>{children}</div>

      {complianceNote ? <p className={styles.complianceNote}>{complianceNote}</p> : null}
    </article>
  );
}
