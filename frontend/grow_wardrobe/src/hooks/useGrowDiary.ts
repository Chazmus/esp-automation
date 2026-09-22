import { useState, useEffect, useCallback, useMemo } from 'react';
import type { GrowDiaryStore, GrowRun, DiaryEntry } from '../types';
import { getStoredHaConfig } from '../ha';

const LOCAL_STORAGE_CACHE_KEY = 'grow_wardrobe_diary_cache';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.port === '8123' || window.location.pathname.startsWith('/local/')) {
      return '';
    }
  }
  const { url } = getStoredHaConfig();
  return url ? url.replace(/\/+$/, '') : '';
}

export function calculateDaysBetween(startDateStr: string, targetDateStrOrObj: string | Date = new Date()): number {
  if (!startDateStr) return 1;
  const start = new Date(startDateStr);
  const target = typeof targetDateStrOrObj === 'string' ? new Date(targetDateStrOrObj) : targetDateStrOrObj;

  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

export function calculateFlowerDays(flipDateStr?: string | null, targetDateStrOrObj: string | Date = new Date()): number | null {
  if (!flipDateStr) return null;
  const flip = new Date(flipDateStr);
  const target = typeof targetDateStrOrObj === 'string' ? new Date(targetDateStrOrObj) : targetDateStrOrObj;

  flip.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - flip.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return days >= 1 ? days : null;
}

const DEFAULT_STORE: GrowDiaryStore = {
  runs: [],
  activeRunId: null,
  entries: [],
};

export function useGrowDiary() {
  const [store, setStore] = useState<GrowDiaryStore>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch {
        // fallback to default
      }
    }
    return DEFAULT_STORE;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active run selector
  const activeRun = useMemo<GrowRun | null>(() => {
    if (!store.activeRunId) {
      return store.runs.find((r) => r.isActive) || store.runs[0] || null;
    }
    return store.runs.find((r) => r.id === store.activeRunId) || null;
  }, [store.runs, store.activeRunId]);

  // Entries filtered to current active run (or all if no active run)
  const activeEntries = useMemo<DiaryEntry[]>(() => {
    if (!activeRun) return [];
    return store.entries
      .filter((e) => e.runId === activeRun.id)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [store.entries, activeRun]);

  // Load from Home Assistant
  const loadDiary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/grow_diary`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const data: GrowDiaryStore = await res.json();
      if (data && Array.isArray(data.runs)) {
        setStore(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(data));
        }
      }
    } catch (err: any) {
      console.warn('Could not load diary from HA endpoint, using cached/local store:', err);
      setError(err?.message || 'Failed to connect to grow diary API');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save full store to Home Assistant
  const saveStore = useCallback(async (newStore: GrowDiaryStore): Promise<boolean> => {
    setStore(newStore);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(newStore));
    }

    setIsSaving(true);
    setError(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/grow_diary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStore),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      return true;
    } catch (err: any) {
      console.error('Failed to save grow diary to HA:', err);
      setError(err?.message || 'Failed to save to Home Assistant');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Upload photo file
  const uploadPhoto = useCallback(async (file: File): Promise<{ success: boolean; url?: string; error?: string }> => {
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/api/grow_diary/photo`;

    try {
      // 1. Try Multipart upload
      const formData = new FormData();
      formData.append('photo', file, file.name);

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.url) {
          return { success: true, url: json.url };
        }
      }
    } catch (multipartErr) {
      console.warn('Multipart upload failed, attempting base64 fallback:', multipartErr);
    }

    // 2. Base64 fallback if multipart fails
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.jpg';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, ext }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { success: Boolean(json.success), url: json.url };
    } catch (err: any) {
      console.error('Photo upload failed completely:', err);
      return { success: false, error: err?.message || 'Upload failed' };
    }
  }, []);

  // Run actions
  const createRun = useCallback(
    async (runData: Omit<GrowRun, 'id' | 'isActive'>) => {
      const id = `run_${Date.now()}`;
      const newRun: GrowRun = {
        ...runData,
        id,
        isActive: true,
      };

      const updatedRuns = store.runs.map((r) => ({ ...r, isActive: false })).concat(newRun);
      const newStore: GrowDiaryStore = {
        ...store,
        runs: updatedRuns,
        activeRunId: id,
      };

      await saveStore(newStore);
      return newRun;
    },
    [store, saveStore]
  );

  const updateRun = useCallback(
    async (runId: string, runData: Partial<GrowRun>) => {
      const updatedRuns = store.runs.map((r) => {
        if (r.id === runId) {
          return { ...r, ...runData };
        }
        return r;
      });

      const newStore: GrowDiaryStore = {
        ...store,
        runs: updatedRuns,
      };

      await saveStore(newStore);
    },
    [store, saveStore]
  );

  const setActiveRun = useCallback(
    async (runId: string) => {
      const updatedRuns = store.runs.map((r) => ({
        ...r,
        isActive: r.id === runId,
      }));

      const newStore: GrowDiaryStore = {
        ...store,
        runs: updatedRuns,
        activeRunId: runId,
      };

      await saveStore(newStore);
    },
    [store, saveStore]
  );

  const deleteRun = useCallback(
    async (runId: string) => {
      const remainingRuns = store.runs.filter((r) => r.id !== runId);
      const remainingEntries = store.entries.filter((e) => e.runId !== runId);
      const newActiveId = remainingRuns.length > 0 ? remainingRuns[0].id : null;

      const newStore: GrowDiaryStore = {
        runs: remainingRuns.map((r) => ({ ...r, isActive: r.id === newActiveId })),
        activeRunId: newActiveId,
        entries: remainingEntries,
      };

      await saveStore(newStore);
    },
    [store, saveStore]
  );

  const clearDiary = useCallback(async () => {
    const emptyStore: GrowDiaryStore = {
      runs: [],
      activeRunId: null,
      entries: [],
    };
    await saveStore(emptyStore);
  }, [saveStore]);

  // Entry actions
  const addEntry = useCallback(
    async (
      entryData: Omit<DiaryEntry, 'id' | 'timestamp' | 'dayNumber' | 'flowerDayNumber'> & {
        dayNumber?: number;
        flowerDayNumber?: number | null;
      }
    ) => {
      if (!activeRun) return null;

      const id = `entry_${Date.now()}`;
      const timestamp = Date.now();
      const dayNumber = entryData.dayNumber ?? calculateDaysBetween(activeRun.startDate, entryData.dateStr);
      const flowerDayNumber =
        entryData.flowerDayNumber !== undefined
          ? entryData.flowerDayNumber
          : calculateFlowerDays(activeRun.flipDate, entryData.dateStr);

      const newEntry: DiaryEntry = {
        ...entryData,
        id,
        timestamp,
        dayNumber,
        flowerDayNumber,
      };

      const newStore: GrowDiaryStore = {
        ...store,
        entries: [newEntry, ...store.entries],
      };

      await saveStore(newStore);
      return newEntry;
    },
    [store, activeRun, saveStore]
  );

  const updateEntry = useCallback(
    async (entryId: string, entryData: Partial<DiaryEntry>) => {
      const updatedEntries = store.entries.map((e) => {
        if (e.id === entryId) {
          return { ...e, ...entryData };
        }
        return e;
      });

      const newStore: GrowDiaryStore = {
        ...store,
        entries: updatedEntries,
      };

      await saveStore(newStore);
    },
    [store, saveStore]
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      const newStore: GrowDiaryStore = {
        ...store,
        entries: store.entries.filter((e) => e.id !== entryId),
      };

      await saveStore(newStore);
    },
    [store, saveStore]
  );

  // Helper to seed sample data for a great first-time experience
  const seedSampleData = useCallback(async () => {
    const today = new Date();
    const startDate = new Date(today.getTime() - 38 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const flipDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sampleRunId = `run_${Date.now()}`;
    const sampleRun: GrowRun = {
      id: sampleRunId,
      name: 'Run 1 - Mimosa x Orange Punch',
      strain: 'Mimosa x Orange Punch',
      breeder: "Barney's Farm",
      medium: 'coco',
      startDate,
      flipDate,
      targetFlowerDays: 63,
      potSizeLiters: 11,
      notes: '70/30 Coco Perlite blend, high frequency fertigation with Canna Coco A+B.',
      isActive: true,
    };

    const sampleEntries: DiaryEntry[] = [
      {
        id: `entry_${Date.now() - 3000}`,
        runId: sampleRunId,
        timestamp: today.getTime() - 2 * 60 * 60 * 1000,
        dateStr: today.toISOString().split('T')[0],
        dayNumber: 38,
        flowerDayNumber: 14,
        phase: 'flowering',
        title: 'First Pistils & Rapid Stretch',
        note: 'Pistil clusters forming rapidly across all top nodes. Canopy is exceptionally even after SCROG tucking. Increased EC to 1.9 mS/cm. VPD is locked around 1.15 kPa.',
        tags: ['nutrients', 'milestone'],
        nutrientEc: 1.9,
        nutrientPh: 5.9,
        runoffEc: 2.0,
        runoffPh: 6.2,
        waterAmountLiters: 2.5,
        telemetry: {
          canopyTemp: '25.4',
          canopyHumidity: '58',
          canopyVpd: '1.18',
          potTemp: '22.8',
          potHumidity: '66',
          soilMoisture: '64',
          fanSpeed: '42',
        },
      },
      {
        id: `entry_${Date.now() - 2000}`,
        runId: sampleRunId,
        timestamp: new Date(flipDate).getTime() + 10 * 3600 * 1000,
        dateStr: flipDate,
        dayNumber: 24,
        flowerDayNumber: 1,
        phase: 'flowering',
        title: 'Flipped to 12/12 Photoperiod',
        note: 'Switched schedule to 12 hours light / 12 hours dark. Plants are healthy, vigorous, and filling 75% of the wardrobe footprint. Lowered daytime humidity target slightly.',
        tags: ['flipto1212', 'training'],
        nutrientEc: 1.7,
        nutrientPh: 6.0,
        waterAmountLiters: 2.0,
        telemetry: {
          canopyTemp: '24.8',
          canopyHumidity: '62',
          canopyVpd: '0.98',
          potTemp: '22.1',
          potHumidity: '70',
          soilMoisture: '68',
          fanSpeed: '36',
        },
      },
      {
        id: `entry_${Date.now() - 1000}`,
        runId: sampleRunId,
        timestamp: new Date(today.getTime() - 24 * 24 * 60 * 60 * 1000).getTime(),
        dateStr: new Date(today.getTime() - 24 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dayNumber: 14,
        flowerDayNumber: null,
        phase: 'vegetative',
        title: 'Topped at Node 5 & Light Defoliation',
        note: 'Topped the main cola above node 5 to encourage 4 primary mains. Tidied bottom growth shoots. Lateral branches are responding vigorously to gentle LST.',
        tags: ['training', 'defoliation'],
        nutrientEc: 1.4,
        nutrientPh: 5.8,
        waterAmountLiters: 1.5,
      },
      {
        id: `entry_${Date.now()}`,
        runId: sampleRunId,
        timestamp: new Date(startDate).getTime(),
        dateStr: startDate,
        dayNumber: 1,
        flowerDayNumber: null,
        phase: 'seedling',
        title: 'Sprout Emerged from Medium',
        note: 'Taproot successfully rooted into the coco coir plug. Cotyledons unfolded cleanly under 200 PPFD gentle LED.',
        tags: ['milestone', 'watering'],
        nutrientEc: 0.8,
        nutrientPh: 5.8,
      },
    ];

    const newStore: GrowDiaryStore = {
      runs: [sampleRun],
      activeRunId: sampleRunId,
      entries: sampleEntries,
    };

    await saveStore(newStore);
  }, [saveStore]);

  // Initial load
  useEffect(() => {
    loadDiary();
  }, [loadDiary]);

  return {
    store,
    activeRun,
    activeEntries,
    isLoading,
    isSaving,
    error,
    loadDiary,
    createRun,
    updateRun,
    setActiveRun,
    deleteRun,
    addEntry,
    updateEntry,
    deleteEntry,
    uploadPhoto,
    seedSampleData,
    clearDiary,
  };
}
