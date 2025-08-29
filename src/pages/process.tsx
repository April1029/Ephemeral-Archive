import React, { useState, useEffect } from 'react';
import styles from './process.module.css';
import Header from '../components/Header';
import Link from 'next/link';
import { useRouter } from "next/router";

const HowItWorks = () => {
    const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
    const router = useRouter();

    useEffect(() => {
        // Animate steps appearing one by one
        const timer = setTimeout(() => {
            setVisibleSteps([0]);
            setTimeout(() => setVisibleSteps([0, 1]), 800);
            setTimeout(() => setVisibleSteps([0, 1, 2]), 1600);
            setTimeout(() => setVisibleSteps([0, 1, 2, 3]), 2400);
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    const steps = [
        {
            number: "01",
            title: "Capture Your Words",
            description: "Type in your thoughts, feelings, or memories. Let the words flow naturally, capture what's in your heart right now.",
            icon: "✍️",
            demo: "The afternoon light filters through...",
            color: "#ca00caff"
        },
        {
            number: "02",
            title: "Magic Happens Between Poetry & Art",
            description: "Our AI transforms your words into a unique poem and generates a complementary image that captures the essence of your moment.",
            icon: "✨",
            demo: "Golden threads of sunlight weave / Through memories we can't retrieve...",
            color: "#ff00ff"
        },
        
        {
            number: "03",
            title: "Save to Memory",
            description: "Continue the conversation until your feel the essence has been captured. Your poem and image are preserved in your personal archive, creating a journal gallery of all the fleeting moment.",
            icon: "💾",
            demo: "Memory preserved • Feb 14, 2025",
            color: "#ffb3ff"
        },
        {
            number: "04",
            title: "Revisit Anytime",
            description: "Return to your saved memories whenever you wish. Each one is a portal back to a moment that might otherwise be lost to time.",
            icon: "🌙",
            demo: "47 memories captured this month",
            color: "#f8f8ff"
        }
    ];

    return (
        <div className={styles["how-it-works"]}>
            <Header />
            <div className={styles.container}>

                {/* Hero Section */}
                <div className={styles.hero}>
                    <h1 className={styles["main-title"]}>
                        How It Works
                    </h1>
                    <p className={styles.subtitle}>
                        Transform fleeting moments into lasting poetry
                    </p>
                    <div className={styles["subtitle-accent"]}>
                        Four simple steps to preserve what matters
                    </div>
                </div>

                {/* Steps */}
                <div className={styles["steps-container"]}>
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className={`${styles.step} ${visibleSteps.includes(index) ? styles.visible : ''}`}
                            style={{ '--step-color': step.color } as React.CSSProperties}
                        >
                            <div className={styles["step-content"]}>
                                <div className={styles["step-header"]}>
                                    <div className={styles["step-number"]}>{step.number}</div>
                                    <div className={styles["step-icon"]}>{step.icon}</div>
                                </div>

                                <div className={styles["step-body"]}>
                                    <h3 className={styles["step-title"]}>{step.title}</h3>
                                    <p className={styles["step-description"]}>{step.description}</p>

                                    <div className={styles["step-demo"]}>
                                        <div className={styles["demo-content"]}>
                                            {step.demo}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Connecting line */}
                            {index < steps.length - 1 && (
                                <div className={styles["connecting-line"]}></div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Call to Action */}
                <div className={styles["cta-section"]}>
                    <div className={styles["cta-card"]}>
                        <h2 className={styles["cta-title"]}>Ready to Begin?</h2>
                        <p className={styles["cta-description"]}>
                            Start capturing the moments that make life beautiful
                        </p>
                        <button
                            onClick={() => router.push("/journal")}
                            className={styles["cta-button"]}
                        >
                            Create Your First Memory
                        </button>
                    </div>
                </div>

                {/* Philosophy Section */}
                <div className={styles.philosophy}>
                    <blockquote className={styles.quote}>
                        "In a world of endless digital noise, we create space for the whispers of meaning—
                        the small moments that, when preserved as poetry, become eternal."
                    </blockquote>
                    <div className={styles["quote-attribution"]}>— The Ephemeral Archive</div>
                </div>

            </div>
        </div>
    );
};

export default HowItWorks;