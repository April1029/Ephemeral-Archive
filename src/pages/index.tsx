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
        <Link href="/journal" className={styles["cta-button"]}>
          Begin Journey
        </Link>
        <Link href="/process" className={styles['cta-button']}>
          How it Works
        </Link>
      </section>
    </>
  );
}
