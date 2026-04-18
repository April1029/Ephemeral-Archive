'use client';
export const runtime = "nodejs";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './gallery.module.css';
import Header from '../components/Header';


type Memory = {
  id: number;
  originalInput: string; // maps from DB: body
  aiPoem: string;        // maps from DB: keepsake
  timestamp: string;     // maps from DB: created_at (ISO string)
  mood: string;          // derived locally
};

// Shape returned by /api/memories list (no image_url — fetched per card)
type DbRow = {
  id: number;
  title: string;
  body: string;
  keepsake?: string | null;
  created_at: string;
  updated_at: string;
};

// very simple mood guesser (module-level so MemoryCard can reference getMoodColor via prop)
function deriveMood(text: string): string {
  const t = text.toLowerCase();
  if (/(laugh|giggle|joy|delight|smile)/.test(t)) return 'joyful';
  if (/(quiet|calm|peace|still|dawn|sunrise|sunset)/.test(t)) return 'peaceful';
  if (/(memory|remember|grandma|grandfather|old|yesterday)/.test(t)) return 'nostalgic';
  if (/(first|baby|mama|wonder|awe|precious)/.test(t)) return 'precious';
  if (/(euphoric|ecstatic|thrill)/.test(t)) return 'euphoric';
  return 'default';
}

const MOOD_COLORS: Record<string, string> = {
  nostalgic: '#B5737A',
  joyful:    '#C4915A',
  precious:  '#C47B5A',
  peaceful:  '#7A9A6A',
  euphoric:  '#8B6B7A',
  default:   '#A89888',
};

function getMoodColor(mood: string): string {
  return MOOD_COLORS[mood] || MOOD_COLORS.default;
}

function parseKeepsake(raw: string): { title: string; body: string } {
  const trimmed = raw.trim();
  const [firstLine, ...rest] = trimmed.split(/\r?\n/);
  const title = firstLine.replace(/^(\s*title\s*[:\-]\s*)/i, '').trim();
  const body = rest.join('\n').trim();
  return { title, body };
}

// ─── Per-card component ────────────────────────────────────────────────────────
type MemoryCardProps = {
  memory: Memory;
  loadedImage: string | undefined;
  onImageLoaded: (id: number, url: string) => void;
  formatDate: (ts: string) => string;
  onClick: () => void;
};

const MemoryCard: React.FC<MemoryCardProps> = ({
  memory, loadedImage, onImageLoaded, formatDate, onClick,
}) => {
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/memories/${memory.id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(row => {
        if (!cancelled) {
          const url = (row.image_url ?? '').trim();
          if (url) onImageLoaded(memory.id, url);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [memory.id, onImageLoaded]);

  const color = getMoodColor(memory.mood);

  return (
    <div
      onClick={onClick}
      className={styles['memory-card']}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      {/* Mood indicator */}
      <div className={styles['mood-indicator']} style={{ background: color }} />

      {/* Card image — gradient until individual fetch resolves */}
      <div
        className={styles['memory-image']}
        style={loadedImage ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.3)), url(${loadedImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {
          background: `linear-gradient(135deg, ${color}33, ${color}99)`,
        }}
      >
        <div className={styles['image-label']}>Memory Sketch</div>
      </div>

      {/* Content */}
      <div className={styles['memory-content']}>
        <div className={styles['content-section']}>
          <h4 className={styles['content-label']}>Original Memory</h4>
          <p className={styles['original-text']}>{memory.originalInput}</p>
        </div>
        <div className={styles['content-section']}>
          <h4 className={styles['content-label']}>Ephemeral Lines</h4>
          {(() => {
            const { title, body } = parseKeepsake(memory.aiPoem);
            return (
              <>
                {title && <p className={styles['poem-title']}>{title}</p>}
                <p className={styles['poem-text']}>{body || title}</p>
              </>
            );
          })()}
        </div>
        <div className={styles['memory-footer']}>
          <span>{formatDate(memory.timestamp)}</span>
          <span className={styles['view-hint']}>Click to view full</span>
        </div>
      </div>
    </div>
  );
};

// ─── Gallery ──────────────────────────────────────────────────────────────────
const MemoryGallery: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<{ url: string; alt?: string } | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 20;

  const handleImageLoaded = useCallback((id: number, url: string) => {
    setLoadedImages(prev => ({ ...prev, [id]: url }));
  }, []);

  const transformRow = (row: DbRow): Memory => {
    const originalInput = row.body ?? '';
    const aiPoem = (row.keepsake ?? '').trim();
    const timestamp = row.created_at || new Date().toISOString();
    return {
      id: row.id,
      originalInput,
      aiPoem,
      timestamp,
      mood: deriveMood(`${originalInput}\n${aiPoem}`),
    };
  };

  const fetchPage = async (pageOffset: number, append: boolean, signal?: AbortSignal) => {
    const res = await fetch(`/api/memories?limit=${PAGE_SIZE}&offset=${pageOffset}`, { signal });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Failed to load memories (${res.status})`);
    }
    const rows: DbRow[] = await res.json();
    const mapped = (rows || []).map(transformRow);
    setMemories(prev => append ? [...prev, ...mapped] : mapped);
    setOffset(pageOffset + mapped.length);
    setHasMore(mapped.length === PAGE_SIZE);
  };

  // Load first page on mount
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        await fetchPage(0, false, ac.signal);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error(e);
          setLoadError(e?.message || 'Failed to load memories');
          setMemories([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchPage(offset, true);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

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

  const formatDate = useCallback((timestamp: string) => {
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
  }, []);

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

      {/* Error state */}
      {loadError && (
        <div className={styles['error-state']}>
          <p className={styles['error-text']}>{loadError}</p>
          <button
            className={styles['retry-button']}
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              fetchPage(0, false)
                .catch((e: any) => setLoadError(e?.message || 'Failed to load memories'))
                .finally(() => setLoading(false));
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
              <MemoryCard
                key={memory.id}
                memory={memory}
                loadedImage={loadedImages[memory.id]}
                onImageLoaded={handleImageLoaded}
                formatDate={formatDate}
                onClick={() => setSelectedMemory(memory)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {hasMore && !searchTerm && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <button
              className={styles['retry-button']}
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {/* Full Memory Modal */}
      {selectedMemory && (() => {
        const modalImage = loadedImages[selectedMemory.id];
        const color = getMoodColor(selectedMemory.mood);
        return (
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
                className={`${styles['modal-image']} ${modalImage ? styles['modal-image--clickable'] : ''}`}
                style={modalImage ? {
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.4)), url(${modalImage})`,
                } : {
                  backgroundImage: `linear-gradient(135deg, ${color}33, ${color}99)`,
                }}
                role={modalImage ? 'button' : undefined}
                tabIndex={modalImage ? 0 : undefined}
                aria-label={modalImage ? 'Open image full screen' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (modalImage) setImageViewer({ url: modalImage, alt: 'AI generated memory sketch' });
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && modalImage) {
                    e.stopPropagation();
                    setImageViewer({ url: modalImage, alt: 'AI generated memory sketch' });
                  }
                }}
              >
                <div className={styles['modal-image-label']}>
                  {modalImage ? 'Memory Sketch • Click to expand' : 'No sketch available'}
                </div>
              </div>

              {/* Content */}
              <div className={styles['modal-body']}>
                <div className={styles['modal-section']}>
                  <h3 className={styles['modal-section-title']} style={{ color }}>
                    Original Memory
                  </h3>
                  <p className={styles['modal-original-text']}>
                    {selectedMemory.originalInput}
                  </p>
                </div>

                <div className={styles['modal-section']}>
                  <h3 className={styles['modal-section-title']} style={{ color }}>
                    Ephemeral Lines
                  </h3>
                  {(() => {
                    const { title, body } = parseKeepsake(selectedMemory.aiPoem);
                    return (
                      <div className={styles['modal-poem-text']}>
                        {title && <p className={styles['modal-poem-title']}>{title}</p>}
                        {(body || title).split(/\n+/).map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className={styles['modal-timestamp']}>
                  Captured on {formatFullDate(selectedMemory.timestamp)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
