'use client';
export const runtime = "nodejs";
import React, { useEffect, useMemo, useState } from 'react';
import styles from './gallery.module.css';
import Header from '../components/Header';


type Memory = {
  id: number;
  originalInput: string; // maps from DB: body
  aiPoem: string;        // maps from DB: keepsake
  aiImage: string;       // maps from DB: image_url
  timestamp: string;     // maps from DB: created_at (ISO string)
  mood: string;          // derived locally
};

// Shape returned by /api/memories (from DB schema)
type DbRow = {
  id: number;
  title: string;
  body: string;
  keepsake?: string | null;
  image_prompt?: string | null;
  image_url?: string | null;
  created_at: string;   // ISO-ish string
  updated_at: string;   // ISO-ish string
};

const MemoryGallery: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<{ url: string; alt?: string } | null>(null);

  // very simple mood guesser
  const deriveMood = (text: string): string => {
    const t = text.toLowerCase();
    if (/(laugh|giggle|joy|delight|smile)/.test(t)) return 'joyful';
    if (/(quiet|calm|peace|still|dawn|sunrise|sunset)/.test(t)) return 'peaceful';
    if (/(memory|remember|grandma|grandfather|old|yesterday)/.test(t)) return 'nostalgic';
    if (/(first|baby|mama|wonder|awe|precious)/.test(t)) return 'precious';
    if (/(euphoric|ecstatic|thrill)/.test(t)) return 'euphoric';
    return 'default';
  };

  const transformRow = (row: DbRow): Memory => {
    // Fallbacks to keep UI robust if some fields are missing
    const originalInput = row.body ?? '';
    const aiPoem = (row.keepsake ?? '').trim();
    const aiImage = (row.image_url ?? '').trim();
    const timestamp = row.created_at || new Date().toISOString();

    return {
      id: row.id,
      originalInput,
      aiPoem,
      aiImage,
      timestamp,
      mood: deriveMood(`${originalInput}\n${aiPoem}`),
    };
  };

  // Load from your library (SQLite via GET /api/memories) on first visit
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await fetch('/api/memories', { signal: ac.signal });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `Failed to load memories (${res.status})`);
        }
        const rows: DbRow[] = await res.json();
        const mapped = (rows || []).map(transformRow);
        setMemories(mapped);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error(e);
          setLoadError(e?.message || 'Failed to load memories');
          setMemories([]); // ensure a clean empty state
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImageViewer(null);
        setSelectedMemory(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const getMoodColor = (mood: string) => {
    const colors: Record<string, string> = {
      nostalgic: '#d946ef', // bright magenta
      joyful: '#f472b6',  // soft pink-magenta
      precious: '#ec4899',  // vivid pink
      peaceful: '#c026d3',  // rich purple-magenta
      euphoric: '#a21caf',  // deep magenta
      default: '#e879f9',  // pastel magenta fallback
    };
    return colors[mood] || colors.default;
  };

  const filteredAndSortedMemories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? memories.filter(
        (m) =>
          m.originalInput.toLowerCase().includes(term) ||
          m.aiPoem.toLowerCase().includes(term)
      )
      : memories.slice();

    filtered.sort((a, b) => {
      const da = new Date(a.timestamp).getTime();
      const db = new Date(b.timestamp).getTime();
      return sortBy === 'newest' ? db - da : da - db;
    });

    return filtered;
  }, [memories, searchTerm, sortBy]);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatFullDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className={`${styles['gallery-container']} ${styles['loading-container']}`}>
        <div className={styles['loading-content']}>
          <div className={styles['loading-spinner']} />
          <p>Loading your memory collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['gallery-container']}>
      <Header />
      <div className={styles['gallery-header']}>
        <h1 className={styles['gallery-title']}>Memory Gallery</h1>
        <p className={styles['gallery-subtitle']}>
          Your invisible moments, transformed into art and poetry
        </p>
      </div>

      {/* Controls */}
      <div className={styles['gallery-controls']}>
        <div className={styles['search-container']}>
          <input
            type="text"
            placeholder="Search your memories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles['search-input']}
            aria-label="Search memories"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
          className={styles['sort-select']}
          aria-label="Sort memories"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        <div className={styles['memory-count']}>
          {filteredAndSortedMemories.length} memories
        </div>
      </div>

      {/* Error state (if load failed) */}
      {loadError && (
        <div className={styles['error-state']}>
          <p className={styles['error-text']}>{loadError}</p>
          <button
            className={styles['retry-button']}
            onClick={() => {
              // quick manual retry without remount
              setLoading(true);
              setLoadError(null);
              (async () => {
                try {
                  const res = await fetch('/api/memories');
                  if (!res.ok) throw new Error(`Failed (${res.status})`);
                  const rows: DbRow[] = await res.json();
                  setMemories((rows || []).map(transformRow));
                } catch (e: any) {
                  setLoadError(e?.message || 'Failed to load memories');
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Memory Grid */}
      <div className={styles['gallery-content']}>
        {filteredAndSortedMemories.length === 0 ? (
          <div className={styles['empty-state']}>
            <p className={styles['empty-title']}>
              {searchTerm ? 'No memories match your search' : 'No memories captured yet'}
            </p>
            <p className={styles['empty-subtitle']}>
              {searchTerm ? 'Try a different search term' : 'Your first captured moment will appear here'}
            </p>
          </div>
        ) : (
          <div className={styles['memory-grid']}>
            {filteredAndSortedMemories.map((memory) => (
              <div
                key={memory.id}
                onClick={() => setSelectedMemory(memory)}
                className={styles['memory-card']}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedMemory(memory);
                }}
              >
                {/* Mood indicator */}
                <div
                  className={styles['mood-indicator']}
                  style={{ background: getMoodColor(memory.mood) }}
                />

                {/* AI Generated Image */}
                <div
                  className={styles['memory-image']}
                  style={{
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${memory.aiImage})`,
                  }}
                  role="button"
                  aria-label="Open image full screen"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (memory.aiImage) setImageViewer({ url: memory.aiImage, alt: 'AI generated memory sketch' });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === '') {
                      e.stopPropagation();
                      if (memory.aiImage) setImageViewer({ url: memory.aiImage, alt: 'AI generated memory sketch' });
                    }
                  }}
                >
                  <div className={styles['image-label']}>Memory Sketch</div>
                </div>

                {/* Content */}
                <div className={styles['memory-content']}>
                  {/* Original Input Preview */}
                  <div className={styles['content-section']}>
                    <h4 className={styles['content-label']}>Original Memory</h4>
                    <p className={styles['original-text']}>{memory.originalInput}</p>
                  </div>

                  {/* AI Poem Preview */}
                  <div className={styles['content-section']}>
                    <h4 className={styles['content-label']}>Ephemeral Lines</h4>
                    <p className={styles['poem-text']}>{memory.aiPoem}</p>
                  </div>

                  {/* Timestamp */}
                  <div className={styles['memory-footer']}>
                    <span>{formatDate(memory.timestamp)}</span>
                    <span className={styles['view-hint']}>Click to view full</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Memory Modal */}
      {selectedMemory && (
        <div
          className={styles['modal-overlay']}
          onClick={() => setSelectedMemory(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles['modal-content']}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedMemory(null)}
              className={styles['modal-close']}
              aria-label="Close"
            >
              ×
            </button>

            {/* Full AI Image */}
            <div
              className={`${styles['modal-image']} ${styles['modal-image--clickable']}`}
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.4)), url(${selectedMemory.aiImage})`,
              }}
              role="button"
              tabIndex={0}
              area-lable="Open image full screen"
              onClick={(e) => {
                e.stopPropagation();
                if (selectedMemory.aiImage) {
                  setImageViewer({
                    url: selectedMemory.aiImage,
                    alt: 'AI generated memory sketch',
                  });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  if (selectedMemory.aiImage) {
                    setImageViewer({
                      url: selectedMemory.aiImage,
                      alt: 'AI generated memory sketch',
                    });
                  }
                }
              }}
            >
              <div className={styles['modal-image-label']}>Memory Sketch • Click to expand</div>
            </div>

            {/* Content */}
            <div className={styles['modal-body']}>
              {/* Original Input */}
              <div className={styles['modal-section']}>
                <h3
                  className={styles['modal-section-title']}
                  style={{ color: getMoodColor(selectedMemory.mood) }}
                >
                  Original Memory
                </h3>
                <p className={styles['modal-original-text']}>
                  {selectedMemory.originalInput}
                </p>
              </div>

              {/* AI Poem */}
              <div className={styles['modal-section']}>
                <h3
                  className={styles['modal-section-title']}
                  style={{ color: getMoodColor(selectedMemory.mood) }}
                >
                  Ephemeral Lines
                </h3>
                <div className={styles['modal-poem-text']}>
                  {selectedMemory.aiPoem}
                </div>
              </div>

              {/* Timestamp */}
              <div className={styles['modal-timestamp']}>
                Captured on {formatFullDate(selectedMemory.timestamp)}
              </div>
            </div>
          </div>
        </div>
      )}

      {imageViewer && (
        <div
          className={styles['image-viewer-overlay']}
          onClick={() => setImageViewer(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles['image-viewer-content']}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles['image-viewer-close']}
              aria-label="Close image viewer"
              onClick={() => setImageViewer(null)}
            >
              ×
            </button>

            <img
              className={styles['image-viewer-img']}
              src={imageViewer.url}
              alt={imageViewer.alt || 'AI generated memory sketch'}
            />
          </div>
        </div>
      )}


    </div>
  );
};

export default MemoryGallery;
