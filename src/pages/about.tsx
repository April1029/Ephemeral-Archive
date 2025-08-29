import { useEffect } from "react";
import Link from "next/link";
// Reuse the same styles so you don't duplicate CSS
import styles from "./index.module.css";
import Header from "../components/Header";

export default function Process() {
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
        <section className={styles.section}>
          <div className={styles.container}>
            <h2 className={styles["section-title"]}>From Film to Project</h2>
            <p className={styles["problem-note"]}>
              Before there was a project, there was a film. <em className={styles.gold}>Ephemeral Archive</em> was our first attempt
              to capture the fleeting nature of existence, life expressed as movement, rhythm, and breath.
              <br />It reminded us that we are not defined by milestones, but by the flow between them.
            </p>
            <div className={styles.videoWrapper}>
              <iframe
                width="1200"
                height="780"
                src="https://www.youtube.com/embed/Lcq8qS0EGMk?si=Zqg-5GJuFIDYtBIA"
                title="YouTube video player"
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <p className={styles["problem-note"]}>
              The exploration sparked a question: <br /><strong className={styles.gold}>what if everyone could preserve their own invisible rhythms?</strong><br />
              Not just through photos, videos, but through words, feelings, and moments. This project is the answer, an
              evolving archive where each memory becomes both poetry and image, a dance that never fades.
            </p>
          </div>
        </section>

        <div className={styles.container}>
          <div className={styles["problem-section"]}>
            <h2 className={styles["section-title"]}>The Invisible Moments</h2>
            <p className={styles["problem-note"]}>
              Every day, countless moments vanish, not because the phone wasn't in hand, but because
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
                The rustle of leaves during a walk that somehow felt like a conversation...
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
                and those with memory conditions, keeping precious moments vivid forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.testimonial}>
            <p className={styles.quote}>
              "I saved the memory of my cat trying to squeeze into a shoebox.
              <br/>I still laugh every time I picture her determined little face."
            </p>
            <p className={styles["quote-author"]}>— Jingjing, 29, Proud Cat Mom <em className={styles.gold}>: )</em></p>
          </div>
        </div>
      </section>

      <section className={styles["final-cta"]}>
        <div className={styles.container}>
          <h2 className={styles["final-cta-title"]}>Your Memories Deserve More</h2>
          <p className={styles["final-message"]}>
            Some moments are too precious to let fade. <br />Too beautiful to remain invisible.
            <br />Too important to trust to failing memory alone.
          </p>

          <div className={styles["button-group"]}>
            <Link href="/journal" className={styles["cta-button"]} style={{ marginRight: "1rem" }}>
              Start Your Memory Collection
            </Link>
            <Link href="/" className={styles["cta-button"]} >
              Back to Home
            </Link>
          </div>

          <p className={styles.fineprint}>
            <em className={styles.gold}>Because the heart sees what the camera never could.</em>
          </p>
        </div>
      </section>
    </>
  );
}
