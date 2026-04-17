'use client';
export const runtime = "nodejs";
import React, { useState, useRef, useEffect } from 'react';
import styles from './journal.module.css';
import Header from '../components/Header';



type MemoryItem = {
  id: number;
  content: string;
  timestamp: string;
  ai?: string;
  imageUrl?: string;
  _imagePrompt?: string;
};

const DRAFT_KEY = 'journal_draft';

// shared helper so render + save use same rule
function extractTitleFromKeepsake(ai?: string) {
  if (!ai?.trim()) return 'Untitled';
  const [first] = ai.trim().split(/\r?\n/);
  return first.replace(/^(\s*title\s*[:\-]\s*)/i, '').trim() || 'Untitled';
}

const CaptureMemory = () => {
  const [memory, setMemory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMemories, setSavedMemories] = useState<MemoryItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [keepText, setKeepText] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<number>>(new Set());
  const [feedbackById, setFeedbackById] = useState<Record<number, string>>({});


  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setMemory(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (memory.trim()) {
        localStorage.setItem(DRAFT_KEY, memory);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {}
  }, [memory]);

  const renderKeepsake = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const [firstLine, ...rest] = trimmed.split(/\r?\n/);
    const title = firstLine.replace(/^(\s*title\s*[:\-]\s*)/i, '').trim();
    const body = rest.join('\n').trim();

    return (
      <div className={styles['ai-content']}>
        <div className={styles['ai-header']}>
          <strong>Ephemeral Lines</strong>
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
    let imagePrompt = `Create a collage featuring the elements from ${memory}, incorporate the following artistic qualities: mixed-media collage, paper texture, torn edges, halftone, tape shadows, slight misregistration, and a matte finish. 
    Add evocative subjects, setting, lighting, and mood`;

    // 1) Get keepsake + image prompt from text model
    try {
      const textRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory: memory.trim() }),
      });

      const gen = await textRes.json().catch(() => null);

      if (!textRes.ok || !gen?.ok) {
        aiOutput = `(Service unavailable) ${gen?.error || 'Unknown error'}`;
      } else {
        aiOutput = gen.keepsake || '(AI returned empty content)';
        if (gen.image_prompt) imagePrompt = gen.image_prompt;
      }
    } catch (err) {
      aiOutput = '(Service request failed. Saved your original memory input.)';
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

    // 3) Add to in-memory list
    const newMemory: MemoryItem = {
      id: Date.now(),
      content: memory,
      timestamp: new Date().toISOString(),
      ai: aiOutput,
      imageUrl,
      _imagePrompt: imagePrompt,
    };

    setSavedMemories((prev) => [newMemory, ...prev]);
    if (!keepText) setMemory('');
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setIsSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleRegenerateKeepsake = async (mem: MemoryItem, feedback: string) => {
    setRegeneratingIds(prev => new Set(prev).add(mem.id));
    try {
      const textRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory: mem.content, feedback }),
      });

      const gen = await textRes.json().catch(() => null);

      if (!textRes.ok || !gen?.ok) {
        alert('Regeneration failed. ' + (gen?.error || 'The model did not respond properly.'));
        return;
      }

      const { keepsake, image_prompt } = gen;
      if (!keepsake) {
        alert('Model response was missing "keepsake". Try again or tweak feedback.');
        return;
      }

      setSavedMemories(prev =>
        prev.map(m =>
          m.id === mem.id ? { ...m, ai: keepsake, _imagePrompt: image_prompt || m._imagePrompt } : m
        )
      );
    } catch (err) {
      console.error('Keepsake regeneration failed:', err);
      alert('Regeneration crashed. Check console for details.');
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(mem.id);
        return next;
      });
    }
  };

  const handleRegenerateImage = async (mem: MemoryItem, feedback: string) => {
    if (!mem._imagePrompt) return;
    try {
      setRegeneratingIds(prev => new Set(prev).add(mem.id));
      const imageRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${mem._imagePrompt}\n\nUser feedback for regeneration: ${feedback}`, }),
      });

      if (imageRes.ok) {
        const img = await imageRes.json();
        if (img?.imageUrl) {
          setSavedMemories(prev => prev.map(m => m.id === mem.id ? { ...m, imageUrl: img.imageUrl } : m));
        }
      }
    } catch (err) {
      console.error('Image regeneration failed:', err);
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(mem.id);
        return next;
      });
    }
  };

  const handlePersist = async (mem: MemoryItem) => {
    try {
      setSavingIds(prev => new Set(prev).add(mem.id));
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: extractTitleFromKeepsake(mem.ai),
          body: mem.content,
          keepsake: mem.ai ?? null,
          image_prompt: mem._imagePrompt ?? null,
          image_url: mem.imageUrl ?? null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to save');
      }
      alert('Saved to Gallery ✅');
    } catch (e: any) {
      console.error(e);
      alert(`Save failed: ${e?.message || e}`);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(mem.id);
        return next;
      });
    }
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

                    {mem.ai && (
                      <button
                        className={styles['feedback-button']}
                        onClick={() => handleRegenerateKeepsake(mem, feedbackById[mem.id] ?? '')}
                        disabled={regeneratingIds.has(mem.id)}
                        title="Optionally type feedback below, then click to regenerate keepsake"
                      >
                        {regeneratingIds.has(mem.id) ? 'Regenerating…' : 'Regenerate Keepsake'}
                      </button>
                    )}

                    {mem.imageUrl && (
                      <button
                        className={styles['feedback-button']}
                        onClick={() => handleRegenerateImage(mem, feedbackById[mem.id] ?? '')}
                        disabled={regeneratingIds.has(mem.id)}
                        title="Optionally type feedback below, then click to regenerate image"
                      >
                        {regeneratingIds.has(mem.id) ? 'Regenerating…' : 'Regenerate Image'}
                      </button>
                    )}


                    <button
                      className={styles['save-button']}
                      onClick={() => handlePersist(mem)}
                      disabled={savingIds.has(mem.id)}
                      title="Save this memory to your SQLite database"
                    >
                      {savingIds.has(mem.id) ? 'Saving…' : 'Save to Gallery'}
                    </button>

                  </div>
                  <div className={styles['feedback-area']}>
                    <label className={styles['feedback-label']} htmlFor={`fb-${mem.id}`}>
                      (Optional) Feedback for regeneration
                    </label>
                    <textarea
                      id={`fb-${mem.id}`}
                      className={styles['feedback-textarea']}
                      placeholder={`e.g., make the tone warmer; emphasize the sunlight; fewer torn edges...
You could continue without text input, simply try regeneration : )`}
                      value={feedbackById[mem.id] ?? ''}
                      onChange={(e) =>
                        setFeedbackById((prev) => ({ ...prev, [mem.id]: e.target.value }))
                      }
                      disabled={regeneratingIds.has(mem.id)}
                      rows={3}
                    />
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
