import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrowDiaryPanel } from './GrowDiaryPanel';
import { calculateDaysBetween, calculateFlowerDays } from '../hooks/useGrowDiary';
import type { EnvironmentMetrics } from '../types';

describe('Grow Diary calculation helpers', () => {
  it('correctly calculates total day numbers', () => {
    expect(calculateDaysBetween('2026-09-01', '2026-09-01')).toBe(1);
    expect(calculateDaysBetween('2026-09-01', '2026-09-10')).toBe(10);
    expect(calculateDaysBetween('2026-08-01', '2026-09-01')).toBe(32);
  });

  it('correctly calculates flower day numbers', () => {
    expect(calculateFlowerDays(null)).toBeNull();
    expect(calculateFlowerDays(undefined)).toBeNull();
    expect(calculateFlowerDays('2026-09-15', '2026-09-15')).toBe(1);
    expect(calculateFlowerDays('2026-09-15', '2026-09-25')).toBe(11);
  });
});

describe('GrowDiaryPanel Component', () => {
  const mockMetrics: EnvironmentMetrics = {
    canopy: { temp: '25.5', humidity: '58', vpd: '1.20' },
    pot: { temp: '22.0', humidity: '65', vpd: '0.90', moisture: '62' },
    ambient: { temp: '21.0', humidity: '55', vpd: '1.10' },
  };

  const mockControls = {
    fanSpeed: '45',
  };

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/grow_diary/photo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, url: '/local/grow_wardrobe/photos/mock_photo.jpg' }),
          });
        }
        if (url.includes('/api/grow_diary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ runs: [], activeRunId: null, entries: [] }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      })
    );
  });

  it('renders welcome screen when diary is empty and allows loading sample data', async () => {
    const user = userEvent.setup();
    render(<GrowDiaryPanel environmentMetrics={mockMetrics} controls={mockControls} />);

    expect(screen.getByText(/Welcome to Grow Wardrobe Diary/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start First Grow Run/i })).toBeInTheDocument();

    const sampleBtn = screen.getByRole('button', { name: /Load Sample Diary/i });
    expect(sampleBtn).toBeInTheDocument();

    // Click sample data button
    await user.click(sampleBtn);

    // Should now show the active strain hero card
    await waitFor(() => {
      expect(screen.getByText('Mimosa x Orange Punch')).toBeInTheDocument();
      expect(screen.getByText("Barney's Farm")).toBeInTheDocument();
    });

    // Sample entries should be visible in timeline
    expect(screen.getByText(/First Pistils & Rapid Stretch/i)).toBeInTheDocument();
    expect(screen.getByText(/Flipped to 12\/12 Photoperiod/i)).toBeInTheDocument();
    expect(screen.getByText(/Topped at Node 5 & Light Defoliation/i)).toBeInTheDocument();
  });

  it('allows filtering entries by tags and search queries', async () => {
    const user = userEvent.setup();
    render(<GrowDiaryPanel environmentMetrics={mockMetrics} controls={mockControls} />);

    // Load sample data first
    const sampleBtn = screen.getByRole('button', { name: /Load Sample Diary/i });
    await user.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText('Mimosa x Orange Punch')).toBeInTheDocument();
    });

    // Filter by training
    const trainingFilterBtn = screen.getByRole('button', { name: /Training \/ LST/i });
    await user.click(trainingFilterBtn);

    // Entries with training tag should be displayed
    expect(screen.getByText(/Flipped to 12\/12 Photoperiod/i)).toBeInTheDocument();
    expect(screen.getByText(/Topped at Node 5 & Light Defoliation/i)).toBeInTheDocument();

    // Search query filter
    const searchInput = screen.getByPlaceholderText(/Search notes or titles/i);
    await user.type(searchInput, 'Pistils');

    // Reset tag filter to all to test search
    const allFilterBtn = screen.getByRole('button', { name: /All/i });
    await user.click(allFilterBtn);

    expect(screen.getByText(/First Pistils & Rapid Stretch/i)).toBeInTheDocument();
    expect(screen.queryByText(/Topped at Node 5/i)).not.toBeInTheDocument();
  });

  it('opens new entry modal, fills form and adds a diary entry', async () => {
    const user = userEvent.setup();
    render(<GrowDiaryPanel environmentMetrics={mockMetrics} controls={mockControls} />);

    // Load sample data so there is an active run
    const sampleBtn = screen.getByRole('button', { name: /Load Sample Diary/i });
    await user.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Log Entry/i })).toBeInTheDocument();
    });

    // Click Log Entry
    const logEntryBtn = screen.getByRole('button', { name: /Log Entry/i });
    await user.click(logEntryBtn);

    expect(screen.getByText('Log New Diary Entry')).toBeInTheDocument();

    // Fill Title
    const titleInput = screen.getByPlaceholderText(/e\.g\. Nutrient Feed/i);
    await user.type(titleInput, 'Heavy Foliar Spray & CalMag');

    // Fill Notes
    const notesInput = screen.getByPlaceholderText(/Canopy smell, root development/i);
    await user.type(notesInput, 'Canopy is glowing and lush. Zero signs of deficiencies.');

    // Save
    const saveBtn = screen.getByRole('button', { name: /Save Entry/i });
    await user.click(saveBtn);

    // The new entry should appear in the timeline
    await waitFor(() => {
      expect(screen.getByText('Heavy Foliar Spray & CalMag')).toBeInTheDocument();
      expect(screen.getByText(/Canopy is glowing and lush/i)).toBeInTheDocument();
    });
  });
});
