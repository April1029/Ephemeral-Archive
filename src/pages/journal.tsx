import React, { useState, useRef, useEffect } from 'react';
import styles from './journal.module.css';
import Header from '../components/Header';

const CaptureMemory = () => {
  const [memory, setMemory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMemories, setSavedMemories] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (!memory.trim()) return;
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 1500));

    const newMemory = {
      id: Date.now(),
      content: memory,
      timestamp: new Date().toISOString(),
    };

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
              onClick={handleSave}
              disabled={!memory.trim() || isSaving}
              className={styles['save-button']}
            >
              {isSaving ? (
                <span className={styles['loading-content']}>
                  <span className={styles['loading-spinner']}></span>
                  Preserving...
                </span>
              ) : (
                'Save Memory'
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
                    {mem.content.substring(0, 200)}
                    {mem.content.length > 200 && '...'}
                  </p>
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
