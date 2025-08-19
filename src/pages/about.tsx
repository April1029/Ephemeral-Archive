import { useEffect } from "react";
import Link from "next/link";
// Reuse the same styles so you don't duplicate CSS
import styles from "./index.module.css";
import Header from "../components/Header";

export default function Process() {
  /*   useEffect(() => {
    const selector = `.${styles["moment-card"]}, .${styles["feature-card"]}, .${styles.section} > .${styles.container}, .${styles.testimonial}, .${styles["final-cta"]} > .${styles.container}`;
  
    // 1) add initial reveal class to all targets
    document.querySelectorAll(selector).forEach((el) => {
      el.classList.add(styles.reveal);
    });
  
    // 2) observe and swap to visible on entry
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealVisible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
  
    document.querySelectorAll(selector).forEach((el) => observer.observe(el));
  
    return () => observer.disconnect();
  }, []); */

  useEffect(() => {
    // Intersection observer reveal animations for cards/sections
    const animateTargetsSelector = `.${styles["moment-card"]}, .${styles["feature-card"]}, .${styles.section}, .${styles.testimonial}, .${styles["final-cta"]}`;

    const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).style.opacity = "1";
          (entry.target as HTMLElement).style.transform = "translateY(0)";
        }
      });
    }, observerOptions);

    document.querySelectorAll(animateTargetsSelector).forEach((el) => {
      // optional: set initial state if your CSS doesn't already
      (el as HTMLElement).style.opacity = (el as HTMLElement).style.opacity || "0";
      (el as HTMLElement).style.transform = (el as HTMLElement).style.transform || "translateY(16px)";
      observer.observe(el);
    });

    // Smooth scroll for in-page anchors on this page
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const href = (this as HTMLAnchorElement).getAttribute("href") || "";
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Header />
      <section id="learn-more" className={styles.section}>
        <div className={styles.container}>
          <div className={styles["problem-section"]}>
            <h2 className={styles["section-title"]}>The Invisible Moments</h2>
            <p className={styles["problem-note"]}>
              Every day, countless moments vanish—not because the phone wasn't in hand, but because
              what mattered most wasn't visible. Photos miss the feeling. Journals lack the imagery.{" "}
              <br /><strong className={styles.gold}>What if you could record both?</strong>
            </p>


            <div className={styles["moment-card"]}>
              <p className={styles["moment-text"]}>
                The warmth of a friend's voice cutting through the rain...
              </p>
            </div>


            <div className={styles["moment-card"]}>
              <p className={styles["moment-text"]}>
                A quiet sunrise that made your soul feel infinite...
              </p>
            </div>
            <div className={styles["moment-card"]}>
              <p className={styles["moment-text"]}>
                A child's first words, heard but never seen...
              </p>
            </div>
            <div className={styles["moment-card"]}>
              <p className={styles["moment-text"]}>
                The exact way light fell across your grandmother's hands as she told you her stories...
              </p>
            </div>
          </div>
        </div>

      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles["section-title"]}>More Than Memory</h2>

          <div className={styles["features-grid"]}>
            <div className={styles["feature-card"]}>
              <span className={styles["feature-icon"]}>🎨</span>
              <h3 className={styles["feature-title"]}>Art Tool</h3>
              <p className={styles["feature-description"]}>
                Transform fleeting moments into visual poetry. Your memories become living artwork
                that captures not just what happened, but how it felt.
              </p>
            </div>

            <div className={styles["feature-card"]}>
              <span className={styles["feature-icon"]}>🌱</span>
              <h3 className={styles["feature-title"]}>Therapy Aid</h3>
              <p className={styles["feature-description"]}>
                Process emotions through creative expression. Turn overwhelming feelings into
                beautiful, tangible forms you can revisit and understand.
              </p>
            </div>

            <div className={styles["feature-card"]}>
              <span className={styles["feature-icon"]}>📖</span>
              <h3 className={styles["feature-title"]}>Personal Historian</h3>
              <p className={styles["feature-description"]}>
                Preserve what matters most for decades to come. Especially powerful for elderly users
                and those with memory conditions—keeping precious moments vivid forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.testimonial}>
            <p className={styles.quote}>
              "I captured the exact feeling of my father's laugh three days before he passed. Now,
              whenever I read that memory-poem, I can feel him in the room with me again."
            </p>
            <p className={styles["quote-author"]}>— Sarah, 34, Daughter & Caregiver</p>
          </div>
        </div>
      </section>

      <section className={styles["final-cta"]}>
        <div className={styles.container}>
          <h2 className={styles["final-cta-title"]}>Your Memories Deserve More</h2>
          <p className={styles["final-message"]}>
            Some moments are too precious to let fade. Too beautiful to remain invisible. Too
            important to trust to failing memory alone.
          </p>

          <div className={styles["button-group"]}>
            <Link href="/journal" className={`${styles["cta-button"]} ${styles["cta-button--large"]}`}>
              Start Your Memory Collection
            </Link>
            <Link href="/" className={styles["cta-button"]}>
              Back to Home
            </Link>
          </div>

          <p className={styles.fineprint}>
            Because the heart sees what the camera never could.
          </p>
        </div>
      </section>
    </>
  );
}
