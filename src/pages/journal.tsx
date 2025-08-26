'use client';
import React, { useState, useRef, useEffect } from 'react';
import styles from './journal.module.css';
import Header from '../components/Header';


type MemoryItem = {
  id: number;
  content: string;
  timestamp: string;
  ai?: string;
  imageUrl?: string;
};

const CaptureMemory = () => {
  const [memory, setMemory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMemories, setSavedMemories] = useState<MemoryItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const renderKeepsake = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const [firstLine, ...rest] = trimmed.split(/\r?\n/);
    const title = firstLine.replace(/^(\s*title\s*[:\-]\s*)/i, '').trim();
    const body = rest.join('\n').trim();

    return (
      <div className={styles['ai-content']}>
        <div className={styles['ai-header']}>
          <strong>AI Keepsake</strong>
        </div>
        {title && <h4 className={styles['ai-title']}>{title}</h4>}
        {body ? (
          body.split(/\n+/).map((para, i) => (
            <p key={i} className={styles['ai-paragraph']}>{para}</p>
          ))
        ) : (
          // Fallback if model returned single-line
          <p className={styles['ai-paragraph']}>{title}</p>
        )}
      </div>
    );
  };

  const handleCreate = async () => {
    if (!memory.trim()) return;
    setIsSaving(true);

    let aiOutput = '';
    let imageUrl: string | undefined;

    try {
      const textReq = fetch('/api/generate', {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:
            `You are a gentle and poetic memory distiller. Given the user's moment below, produce a short keepsake with a title and 2–3 vivid sentences. Avoid repeating the text verbatim.\n\n` +
            `Moment:\n${memory}`,
          max_new_tokens: 160,
          temperature: 0.7,
        }),
      });

      const imageReq = fetch('/api/generate-image', {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `An evocative, warm, cinematic illustration of this moment: ${memory}`,
        }),
      });

      // Wait for both to settle (so one failing doesn't block the other)
      const [textRes, imageRes] = await Promise.allSettled([textReq, imageReq]);

      // Text Result
      if (textRes.status === 'fulfilled') {
        const data = await textRes.value.json();
        aiOutput = textRes.value.ok ? (data?.output?.trim?.() ?? '') : `(AI unavailable) ${data?.error ?? ''}`;
      } else {
        aiOutput = '(AI request failed. Saved your memory without AI.)';
      }

      // Image Result
      if (imageRes.status === 'fulfilled') {
        try {
          if (!imageRes.value.ok) {
            // Try to read server error to console
            const errBody = await imageRes.value.json().catch(() => ({}));
            console.error('Image generation failed:', errBody);
          } else {
            const img = await imageRes.value.json();
            if (img?.imageUrl) {
              imageUrl = img.imageUrl; // data URL ready to render
            } else {
              console.error('Image response missing imageUrl:', img);
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse image response:', parseErr);
        }
      } else {
        console.error('Image request itself failed:', imageRes.reason);
      }
    } catch (err) {
      console.error(err);
      aiOutput ||= '(AI request failed. Saved your memory without AI.)';
    }

    const newMemory: MemoryItem = {
      id: Date.now(),
      content: memory,
      timestamp: new Date().toISOString(),
      ai: aiOutput,
      imageUrl,
    };

    console.log('AI output:', aiOutput);
    console.log('savedMemories (after save):', [newMemory, ...savedMemories]);

    setSavedMemories((prev) => [newMemory, ...prev]);
    setMemory('');
    setIsSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const wordCount =
    memory.trim().length === 0
      ? 0
      : memory.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className={styles['capture-memory']}>
      {/* Global Header */}
      <Header />
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles['main-title']}>Capture This Moment</h1>
          <p className={styles.subtitle}>
            What is happening right now that you never want to forget?
          </p>
        </div>

        {/* Main Capture Area */}
        <div className={styles['main-capture-area']}>
          {/* Optional Prompts */}
          <div className={styles.prompts}>
            <p className={styles['prompt-text']}>
              Consider: What do you see? What do you hear? What do you feel?
            </p>
          </div>

          {/* Text Input Area */}
          <div className={styles['text-input-area']}>
            <textarea
              ref={textareaRef}
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              placeholder="Begin writing about this moment... What happened? How did it feel? What made it special?"
              className={styles['memory-textarea']}
            />
            {memory.length > 0 && (
              <div className={styles['word-count']}>{wordCount} words</div>
            )}
          </div>

          {/* Action Button */}
          <div className={styles['action-section']}>
            <button
              onClick={handleCreate}
              disabled={!memory.trim() || isSaving}
              className={styles['save-button']}
            >
              {isSaving ? (
                <span className={styles['loading-content']}>
                  <span className={styles['loading-spinner']}></span>
                  Preserving...
                </span>
              ) : (
                'Create Memory'
              )}
            </button>
          </div>
        </div>

        {/* Success Animation */}
        {showSuccess && (
          <div className={styles['success-overlay']}>
            <div className={styles['success-card']}>
              <div className={styles['success-icon']}>✨</div>
              <p className={styles['success-title']}>Memory Captured</p>
              <p className={styles['success-subtitle']}>
                Your moment is now eternal
              </p>
            </div>
          </div>
        )}

        {/* Recent Memories Preview */}
        {savedMemories.length > 0 && (
          <div className={styles['recent-memories']}>
            <h3 className={styles['recent-title']}>Recent Captures</h3>
            <div className={styles['memories-grid']}>
              {savedMemories.slice(0, 3).map((mem) => (
                <div key={mem.id} className={styles['memory-card']}>
                  <p className={styles['memory-content']}>
                    {mem.content}
                  </p>

                  {/* AI keepsake rendering */}
                  {mem.ai && renderKeepsake(mem.ai)}

                  {/* AI keepsake rendering */}
                  {mem.imageUrl && (
                    <img
                      src={mem.imageUrl}
                      alt="AI generated memory"
                      className={styles['memory-image']}
                      loading="lazy"
                    />
                  )}

                  <div className={styles['memory-footer']}>
                    <span className={styles['memory-timestamp']}>
                      {new Date(mem.timestamp).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Floating hint */}
        <div className={styles['floating-hint']}>
          💡 Capture the feeling, not just the facts
        </div>
      </div>
    </div>
  );
};

export default CaptureMemory;
