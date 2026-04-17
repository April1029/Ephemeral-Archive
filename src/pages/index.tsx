import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./index.module.css";

type PreviewMemory = {
  id: number;
  keepsake: string;
  image_url: string;
};

export default function Home() {
  const [previews, setPreviews] = useState<PreviewMemory[]>([]);

  useEffect(() => {
    // Floating particles
    const container = document.querySelector(`.${styles["floating-particles"]}`);
    if (container) {
      for (let i = 0; i < 40; i++) {
        const p = document.createElement("div");
        p.className = styles.particle;
        (p as HTMLElement).style.left = Math.random() * 100 + "%";
        (p as HTMLElement).style.top = Math.random() * 100 + "%";
        (p as HTMLElement).style.animationDelay = Math.random() * 6 + "s";
        (p as HTMLElement).style.animationDuration = Math.random() * 3 + 4 + "s";
        container.appendChild(p);
      }
    }

    // Fetch recent memories with images for the visual anchor
    fetch("/api/memories?limit=6")
      .then((r) => r.json())
      .then((rows) => {
        const withImages = (rows as any[])
          .filter((r) => r.image_url && r.keepsake)
          .slice(0, 3);
        setPreviews(withImages.map((r) => ({
          id: r.id,
          keepsake: r.keepsake,
          image_url: r.image_url,
        })));
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles["floating-particles"]}></div>
        <h1 className={styles.title}>Now & Ever</h1>
        <p className={styles.tagline}>
          Capture what the heart sees when the camera isn't there.
        </p>
        <div className={styles["button-group"]}>
          <Link href="/journal" className={styles["cta-button"]}>
            Begin
          </Link>
          <Link href="/process" className={styles["cta-button-ghost"]}>
            How it Works
          </Link>
        </div>

        {previews.length > 0 && (
          <div className={styles["scroll-indicator"]} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M10 16l-4-4M10 16l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </section>

      {/* Visual anchor — archive preview */}
      {previews.length > 0 && (
        <section className={styles["preview-section"]}>
          <p className={styles["preview-label"]}>From the Archive</p>
          <div className={styles["preview-grid"]}>
            {previews.map((mem) => {
              const lines = mem.keepsake.trim().split(/\r?\n/).filter(Boolean);
              const title = lines[0].replace(/^title:\s*/i, "").trim();
              const verses = lines.slice(1);
              return (
                <div key={mem.id} className={styles["preview-card"]}>
                  <div
                    className={styles["preview-image"]}
                    style={{ backgroundImage: `url(${mem.image_url})` }}
                  />
                  <div className={styles["preview-poem"]}>
                    <p className={styles["preview-title"]}>{title}</p>
                    {verses.map((v, i) => (
                      <p key={i} className={styles["preview-verse"]}>{v}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/gallery" className={styles["preview-link"]}>
            View all memories →
          </Link>
        </section>
      )}
    </>
  );
}
