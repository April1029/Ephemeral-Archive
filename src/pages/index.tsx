import { useEffect } from "react";
import Link from "next/link";
import styles from "./index.module.css";

export default function Home() {
  useEffect(() => {
    // --- Selectors that work with CSS Modules (hashed class names) ---
    const floatingParticlesSelector = `.${styles["floating-particles"]}`;
    const particleSelector = `.${styles.particle}`;
    const animateTargetsSelector = `.${styles["moment-card"]}, .${styles["feature-card"]}`;

    // Floating particles
    function createParticles() {
      const container = document.querySelector(floatingParticlesSelector);
      if (!container) return;
      const particleCount = 50;

      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div");
        // ⬇️ apply the *hashed* class from the module:
        particle.className = styles.particle;
        (particle as HTMLElement).style.left = Math.random() * 100 + "%";
        (particle as HTMLElement).style.top = Math.random() * 100 + "%";
        (particle as HTMLElement).style.animationDelay = Math.random() * 6 + "s";
        (particle as HTMLElement).style.animationDuration = Math.random() * 3 + 4 + "s";
        container.appendChild(particle);
      }
    }

    createParticles();

    // Smooth scrolling for in-page anchors
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const href = (this as HTMLAnchorElement).getAttribute("href") || "";
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // Intersection observer animations
    const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).style.opacity = "1";
          (entry.target as HTMLElement).style.transform = "translateY(0)";
        }
      });
    }, observerOptions);

    document.querySelectorAll(animateTargetsSelector).forEach((el) => observer.observe(el));

    // Parallax scroll effect
    const onScroll = () => {
      const scrolled = window.pageYOffset;
      document.querySelectorAll(particleSelector).forEach((particle, index) => {
        const speed = ((index % 3) + 1) * 0.5;
        (particle as HTMLElement).style.transform = `translateY(${scrolled * speed}px)`;
      });
    };
    window.addEventListener("scroll", onScroll);

    // Cleanup listeners/observer on unmount
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles["floating-particles"]}></div>

        <h1 className={styles.title}>Now & Ever Ephemeral</h1>
        <h2 className={styles.subtitle}>A Memory Camera for the Moments We Can't Photograph</h2>
        <p className={styles.tagline}>
          "Capture what the heart sees when the camera isn't there."
        </p>

        <a href="#learn-more" className={styles["cta-button"]}>
          Begin Capturing
        </a>

        <div className={styles["scroll-indicator"]}>↓</div>
      </section>

      <section id="learn-more" className={styles.section}>
        <div className={styles["problem-section"]}>
          <h2 className={styles["section-title"]}>The Invisible Moments</h2>

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

          <p className={styles["problem-note"]}>
            Every day, countless moments vanish—not because the phone wasn't in hand, but because
            what mattered most wasn't visible. Photos miss the feeling. Journals lack the imagery.{" "}
            <strong className={styles.gold}>What if you could record both?</strong>
          </p>
        </div>
      </section>

      <section className={styles.section}>
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
      </section>

      <section className={styles.section}>
        <div className={styles.testimonial}>
          <p className={styles.quote}>
            "I captured the exact feeling of my father's laugh three days before he passed. Now,
            whenever I read that memory-poem, I can feel him in the room with me again."
          </p>
          <p className={styles["quote-author"]}>— Sarah, 34, Daughter & Caregiver</p>
        </div>
      </section>

      <section className={styles["final-cta"]}>
        <h2 className={styles["final-cta-title"]}>Your Memories Deserve More</h2>
        <p className={styles["final-message"]}>
          Some moments are too precious to let fade. Too beautiful to remain invisible. Too
          important to trust to failing memory alone.
        </p>

        <Link href="/journal" className={`${styles["cta-button"]} ${styles["cta-button--large"]}`}>
          Start Your Memory Collection
        </Link>

        <p className={styles.fineprint}>
          Because the heart sees what the camera never could.
        </p>
      </section>
    </>
  );
}
