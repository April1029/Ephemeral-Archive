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
  const [keepText, setKeepText] = useState(true);

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

    // Default image prompt fallback (in case parsing fails)
    let imagePrompt = `An evocative, warm, cinematic illustration of this moment: ${memory}`;

    // 1) Get keepsake + image prompt from text model first
    try {
      const textRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:
            `You are a gentle and poetic memory distiller AND a prompt writer for text-to-image models.
            Return ONLY a single JSON object with two keys: "keepsake" and "image_prompt".
            - "keepsake": first line = short evocative TITLE (no prefix). Then 1–3 vivid poetic lines (≤280 chars total), each separated by \n.
            - "image_prompt": concise visual prompt (≤220 chars) describing subject(s), setting, lighting, mood, + 3–6 style keywords.
            Tone: gentle, sensory. No meta, no markdown, no extra fields.
        
        User moment:
        ${memory}
        `,
          max_new_tokens: 1024,
          temperature: 0.6,
        }),
      });

      const gen = await textRes.json().catch(() => null);

      if (!textRes.ok || !gen) {
        const msg = (gen && (gen.error || JSON.stringify(gen).slice(0, 200))) || 'Unknown error';
        aiOutput = `(AI unavailable) ${msg}`;
      } else {
        // NEW: prefer server's shape { ok, keepsake, image_prompt }
        let k = (gen?.keepsake ?? '').toString().trim();
        let ip = (gen?.image_prompt ?? '').toString().trim();

        // Backward-compat fallbacks if your server ever returns prose or {text}
        if (!k && typeof gen?.text === 'string' && gen.text.trim()) {
          try {
            const parsed = JSON.parse(gen.text);
            k = (parsed?.keepsake ?? '').toString().trim();
            ip = (parsed?.image_prompt ?? '').toString().trim() || ip;
          } catch {
            // Try to extract first {...} if provider wrapped with prose
            const s = gen.text;
            const start = s.indexOf('{');
            const end = s.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
              try {
                const parsed = JSON.parse(s.slice(start, end + 1));
                k = (parsed?.keepsake ?? '').toString().trim() || k;
                ip = (parsed?.image_prompt ?? '').toString().trim() || ip;
              } catch { }
            }
          }
        }

        aiOutput = k || '(AI returned empty content)';
        if (ip) imagePrompt = ip;
      }
    } catch (err) {
      aiOutput = '(AI request failed. Saved your memory without AI.)';
    }

    // 2) Generate image using the enhanced imagePrompt
    try {
      const imageRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt }),
      });

      if (imageRes.ok) {
        const img = await imageRes.json();
        if (img?.imageUrl) {
          imageUrl = img.imageUrl;
        } else {
          console.error('Image response missing imageUrl:', img);
        }
      } else {
        const errBody = await imageRes.json().catch(() => ({}));
        console.error('Image generation failed:', errBody);
      }
    } catch (err) {
      console.error('Image request failed:', err);
    }

    // 3) Save the memory (text + image)
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
    if (!keepText) setMemory('');
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

            <label className={styles['keep-toggle']}>
              <input
                type="checkbox"
                checked={keepText}
                onChange={(e) => setKeepText(e.target.checked)}
              />
              Keep text after creating
            </label>
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
