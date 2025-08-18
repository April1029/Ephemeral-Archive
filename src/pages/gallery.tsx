'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './gallery.module.css';
import Header from '../components/Header';

type Memory = {
  id: number;
  originalInput: string;
  aiPoem: string;
  aiImage: string;
  timestamp: string; // ISO string
  mood: string;
};

const MemoryGallery: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);

  // Sample memories with AI-generated content for demonstration
  useEffect(() => {
    const sampleMemories: Memory[] = [
      {
        id: 1,
        originalInput:
          "The way my grandmother's hands looked as she kneaded bread this morning. Flour dusted across her wedding ring, catching the early sunlight streaming through the kitchen window. Her humming—an old song I've never heard before but somehow know by heart. The kitchen smelled like yeast and memories.",
        aiPoem: `Flour-blessed fingers dance and fold,\nWedding band worn smooth, stories untold.\nSunbeams paint the morning air,\nWhile ancient melodies linger there.\n\nYeast and time, both rising slow,\nIn hands that hold what hearts can know.\nThis kitchen holds a thousand days,\nIn grandmother's tender, kneading ways.`,
        aiImage:
          'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
        timestamp: new Date('2025-08-18T09:30:00').toISOString(),
        mood: 'nostalgic',
      },
      {
        id: 2,
        originalInput:
          'Standing in the rain with Sarah outside the coffee shop. We were both soaked, but laughing until our stomachs hurt about something completely ridiculous. The warmth of her friendship cutting through the cold. That moment when you realize some people are home.',
        aiPoem: `Rain-soaked streets become our stage,\nLaughter echoes, age to age.\nCold drops fall but warmth remains,\nIn friendship's joy that breaks all chains.\n\nSome people are not where you go,\nBut who you are when storms blow.\nIn coffee shop light, truth rings clear:\nHome is found when love draws near.`,
        aiImage:
          'https://images.unsplash.com/photo-1515263487990-61b07816b924?w=800&h=600&fit=crop',
        timestamp: new Date('2025-08-17T16:45:00').toISOString(),
        mood: 'joyful',
      },
      {
        id: 3,
        originalInput:
          "Emma said 'mama' for the first time while I was washing dishes. I turned around and she was reaching for me with this look of pure wonder, like she'd discovered magic. My heart stopped and started again. The dish I was holding slipped back into the soapy water.",
        aiPoem: `"Mama" floats across the room,\nFirst word blooms, dispels all gloom.\nTiny hands reach for your face,\nWonder fills this sacred space.\n\nDishes wait, the world can pause,\nFor first words need no other cause.\nIn soapy water, plates may fall,\nBut love's first sound surpasses all.`,
        aiImage:
          'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop',
        timestamp: new Date('2025-08-16T19:20:00').toISOString(),
        mood: 'precious',
      },
      {
        id: 4,
        originalInput:
          "Sunrise from the park bench where Dad and I used to sit. The city was still sleeping, but the sky was painting itself in colors that don't have names. I could almost hear his voice telling me about the birds. The air tasted like possibility.",
        aiPoem: `On this bench where memory dwells,\nDawn breaks with its morning spells.\nColors bleed across the sky,\nWhile sleeping cities dream and sigh.\n\nYour father's voice in birdsong lives,\nThe morning air, permission gives.\nTo taste what's yet to come to pass,\nIn moments meant forever last.`,
        aiImage:
          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
        timestamp: new Date('2025-08-15T06:15:00').toISOString(),
        mood: 'peaceful',
      },
    ];

    const t = setTimeout(() => {
      setMemories(sampleMemories);
      setLoading(false);
    }, 800);

    return () => clearTimeout(t);
  }, []);

  const getMoodColor = (mood: string) => {
    const colors: Record<string, string> = {
      nostalgic: '#f59e0b',
      joyful: '#22c55e',
      precious: '#ec4899',
      peaceful: '#3b82f6',
      euphoric: '#a855f7',
      default: '#94a3b8',
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
        <Header/>
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
                >
                  <div className={styles['image-label']}>AI Generated</div>
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
                    <h4 className={styles['content-label']}>AI Poetry</h4>
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
              className={styles['modal-image']}
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.4)), url(${selectedMemory.aiImage})`,
              }}
            >
              <div className={styles['modal-image-label']}>AI Generated Visual</div>
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
                  AI Poetry
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
    </div>
  );
};

export default MemoryGallery;
