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
  _imagePrompt?: string;
};

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
    let imagePrompt = `Create a collage featuring the elements from ${memory}, incorporate the following artistic qualities: mixed-media collage, paper texture, torn edges, halftone, tape shadows, slight misregistration, and a matte finish. 
    Add evocative subjects, setting, lighting, and mood`;

    // 1) Get keepsake + image prompt from text model first
    try {
      const textRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:
            `You are a minimalist poet and a visual prompt writer. You are a direct content generator. Do not use any tools or functions.
            Return ONLY a single JSON object. The JSON should have two keys: "keepsake" and "image_prompt".
            - "keepsake": A single string. You are a minimalist poet. Write a short, poignant poem about the user's memory. The poem must have a brief title as the first line, followed by exactly three lines of verse. Each verse line must be 4–7 words long, imagistic, and concrete. Focus on sensory details, crisp nouns, and luminous verbs. Use the present tense. Do not use rhyme, clichés, or abstract concepts. Use newline characters (\\n) to separate the title and each verse line.
            - "image_prompt": A single string. You are a visual prompt writer for a mixed-media collage image. Write a detailed, evocative prompt for image generation that captures the mood and elements of the user's memory. The collage should feature 3–5 distinct fragments, subjects, and a setting. The prompt must include the following style keywords: mixed-media collage, paper texture, torn edges, halftone, tape/glue shadows, slight misregistration, matte finish.
            Example of the exact JSON format to return:
            {
            "keepsake": "Title: Quiet Afternoon\\nPaper cranes rest on the sill\\nSunlight casts long shadows\\nSoft hum of the refrigerator",
            "image_prompt": "mixed-media collage featuring paper cranes on a windowsill with sunlight casting long shadows; incorporate a serene mood and the feel of a soft hum; paper texture, torn edges, halftone, tape/glue shadows, slight misregistration, matte finish"
            }
            Do NOT return any other text, explanations, or markdown outside of the JSON object. Do NOT wrap the JSON in markdown code blocks.

            User moment:
            ${memory}
            `,
          max_new_tokens: 1024,
          temperature: 0.9,
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
      _imagePrompt: imagePrompt,
    };

    console.log('AI output:', aiOutput);
    console.log('savedMemories (after save):', [newMemory, ...savedMemories]);

    setSavedMemories((prev) => [newMemory, ...prev]);
    if (!keepText) setMemory('');
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
      body: JSON.stringify({
        prompt:
`You are a minimalist poet and a visual prompt writer. Return ONLY a single JSON object with keys "keepsake" and "image_prompt".
- "keepsake": A single string. Minimalist poem with a short title line, then exactly 3 lines of 4–7 words, sensory, concrete, present tense. Use \\n to separate lines.
- "image_prompt": A single string for a mixed-media collage with 3–5 fragments, subjects, and a setting. MUST include: mixed-media collage, paper texture, torn edges, halftone, tape/glue shadows, slight misregistration, matte finish.

User moment:
${mem.content}

User feedback for regeneration (may be empty):
${feedback}

Example:
{
  "keepsake": "Title: Quiet Afternoon\\nPaper cranes rest on the sill\\nSunlight casts long shadows\\nSoft hum of the refrigerator",
  "image_prompt": "mixed-media collage featuring paper cranes on a windowsill ... paper texture, torn edges, halftone, tape/glue shadows, slight misregistration, matte finish"
}
Do NOT return any text outside the JSON. Do NOT wrap in markdown.`,
        max_new_tokens: 1024,
        temperature: 0.9,
      }),
    });

    const gen = await textRes.json().catch(() => null);

    // gracefully handle non-200 and weird shapes
    if (!textRes.ok || !gen) {
      console.error('Regenerate response not ok:', gen);
      alert('Regeneration failed. The model did not respond properly.');
      return;
    }

    // Prefer server shape { keepsake, image_prompt }, with fallbacks
    let keepsake = (gen?.keepsake ?? '').toString().trim();
    let image_prompt = (gen?.image_prompt ?? '').toString().trim();

    if (!keepsake && typeof gen?.text === 'string' && gen.text.trim()) {
      try {
        const parsed = JSON.parse(gen.text);
        keepsake = (parsed?.keepsake ?? '').toString().trim() || keepsake;
        image_prompt = (parsed?.image_prompt ?? '').toString().trim() || image_prompt;
      } catch {
        const s = gen.text;
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            const parsed = JSON.parse(s.slice(start, end + 1));
            keepsake = (parsed?.keepsake ?? '').toString().trim() || keepsake;
            image_prompt = (parsed?.image_prompt ?? '').toString().trim() || image_prompt;
          } catch {}
        }
      }
    }

    if (!keepsake) {
      console.error('Model JSON missing keepsake/image_prompt:', gen);
      alert('Model response was not valid JSON with "keepsake". Try again or tweak feedback.');
      return;
    }
    // update keepsake; (optional) refresh stored prompt too
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
      alert('Saved to SQLite ✅');
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
                      {savingIds.has(mem.id) ? 'Saving…' : 'Save to SQLite'}
                    </button>

                  </div>
                  <div className={styles['feedback-area']}>
                    <label className={styles['feedback-label']} htmlFor={`fb-${mem.id}`}>
                      (Optional) Feedback for regeneration
                    </label>
                    <textarea
                      id={`fb-${mem.id}`}
                      className={styles['feedback-textarea']}
                      placeholder="e.g., make the tone warmer; emphasize the sunlight; fewer torn edges; add a cat silhouette…"
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
