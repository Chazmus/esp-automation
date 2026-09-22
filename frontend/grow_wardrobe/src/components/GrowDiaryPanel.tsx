import React, { useState, useId } from 'react';
import type { EnvironmentMetrics, DiaryEntry, DiaryEntryTag, GrowPhase, GrowRun, LightPreset } from '../types';
import { useGrowDiary, calculateDaysBetween, calculateFlowerDays } from '../hooks/useGrowDiary';
import {
  BookOpen,
  Plus,
  Calendar,
  Camera,
  Droplets,
  FlaskConical,
  Scissors,
  Leaf,
  Flower2,
  Sparkles,
  Thermometer,
  Wind,
  Trash2,
  Edit2,
  X,
  Image as ImageIcon,
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Layers,
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  FolderOpen,
  Scale,
  Star,
} from 'lucide-react';

interface GrowDiaryPanelProps {
  environmentMetrics: EnvironmentMetrics;
  controls: {
    fanSpeed: string | number;
  };
  lightPreset?: LightPreset;
}

const PHASE_CONFIG: Record<GrowPhase, { label: string; color: string; badgeBg: string; badgeBorder: string }> = {
  germination: { label: 'Germination', color: 'text-amber-400', badgeBg: 'bg-amber-950/40', badgeBorder: 'border-amber-800/60' },
  seedling: { label: 'Seedling', color: 'text-cyan-400', badgeBg: 'bg-cyan-950/40', badgeBorder: 'border-cyan-800/60' },
  vegetative: { label: 'Vegetative', color: 'text-emerald-400', badgeBg: 'bg-emerald-950/40', badgeBorder: 'border-emerald-800/60' },
  transition: { label: 'Transition', color: 'text-teal-400', badgeBg: 'bg-teal-950/40', badgeBorder: 'border-teal-800/60' },
  flowering: { label: 'Flowering', color: 'text-purple-400', badgeBg: 'bg-purple-950/40', badgeBorder: 'border-purple-800/60' },
  flush: { label: 'Flush', color: 'text-amber-300', badgeBg: 'bg-amber-950/40', badgeBorder: 'border-amber-700/60' },
  harvest: { label: 'Harvested', color: 'text-rose-400', badgeBg: 'bg-rose-950/40', badgeBorder: 'border-rose-800/60' },
  curing: { label: 'Curing', color: 'text-indigo-400', badgeBg: 'bg-indigo-950/40', badgeBorder: 'border-indigo-800/60' },
};

const TAG_CONFIG: Record<DiaryEntryTag, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  watering: { label: 'Watering', icon: <Droplets className="w-3 h-3" />, color: 'text-sky-300', bg: 'bg-sky-950/50 border-sky-800/60' },
  nutrients: { label: 'Nutrients', icon: <FlaskConical className="w-3 h-3" />, color: 'text-teal-300', bg: 'bg-teal-950/50 border-teal-800/60' },
  training: { label: 'Training / LST', icon: <Scissors className="w-3 h-3" />, color: 'text-amber-300', bg: 'bg-amber-950/50 border-amber-800/60' },
  defoliation: { label: 'Defoliation', icon: <Leaf className="w-3 h-3" />, color: 'text-emerald-300', bg: 'bg-emerald-950/50 border-emerald-800/60' },
  flipto1212: { label: '12/12 Flip', icon: <Flower2 className="w-3 h-3" />, color: 'text-purple-300', bg: 'bg-purple-950/50 border-purple-800/60' },
  flush: { label: 'Flush', icon: <Droplets className="w-3 h-3" />, color: 'text-blue-300', bg: 'bg-blue-950/50 border-blue-800/60' },
  trichomes: { label: 'Trichomes', icon: <Sparkles className="w-3 h-3" />, color: 'text-yellow-300', bg: 'bg-yellow-950/50 border-yellow-800/60' },
  pest_check: { label: 'IPM / Pest Check', icon: <AlertCircle className="w-3 h-3" />, color: 'text-rose-300', bg: 'bg-rose-950/50 border-rose-800/60' },
  milestone: { label: 'Milestone', icon: <TrendingUp className="w-3 h-3" />, color: 'text-fuchsia-300', bg: 'bg-fuchsia-950/50 border-fuchsia-800/60' },
  general: { label: 'General', icon: <BookOpen className="w-3 h-3" />, color: 'text-slate-300', bg: 'bg-slate-800/50 border-slate-700/60' },
};

const SUGGESTED_TITLES = [
  'Regular Fertigation Feed',
  'Watered to 20% Runoff',
  'Topped 5th Node & LST Applied',
  'Heavy Defoliation & Tuck Under Scrog',
  'Switched to 12/12 Photoperiod',
  'First Pistils Visible',
  'Trichome Inspection',
  'Flushing with Plain RO Water',
];

export function GrowDiaryPanel({ environmentMetrics, controls }: GrowDiaryPanelProps) {
  const {
    store,
    activeRun,
    activeEntries,
    isSaving,
    createRun,
    updateRun,
    setActiveRun,
    selectRun,
    archiveRun,
    unarchiveRun,
    deleteRun,
    addEntry,
    updateEntry,
    deleteEntry,
    uploadPhoto,
    seedSampleData,
    clearDiary,
  } = useGrowDiary();

  // Modals state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [editingRun, setEditingRun] = useState<GrowRun | null>(null);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [harvestRunTarget, setHarvestRunTarget] = useState<GrowRun | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string; day?: number } | null>(null);

  // Filters & search
  const [selectedTagFilter, setSelectedTagFilter] = useState<DiaryEntryTag | 'all' | 'photos'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Entry Form state
  const todayStr = new Date().toISOString().split('T')[0];
  const [entryDate, setEntryDate] = useState(todayStr);
  const [entryPhase, setEntryPhase] = useState<GrowPhase>('vegetative');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryTags, setEntryTags] = useState<DiaryEntryTag[]>(['general']);
  const [entryPhotoUrl, setEntryPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [includeTelemetry, setIncludeTelemetry] = useState(true);

  // Feeding & Trichome optional details
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [entryEc, setEntryEc] = useState<string>('');
  const [entryPh, setEntryPh] = useState<string>('');
  const [entryRunoffEc, setEntryRunoffEc] = useState<string>('');
  const [entryRunoffPh, setEntryRunoffPh] = useState<string>('');
  const [entryWaterAmount, setEntryWaterAmount] = useState<string>('');
  const [entryClearPct, setEntryClearPct] = useState<string>('');
  const [entryCloudyPct, setEntryCloudyPct] = useState<string>('');
  const [entryAmberPct, setEntryAmberPct] = useState<string>('');

  // Run Form state
  const [runName, setRunName] = useState('');
  const [runStrain, setRunStrain] = useState('');
  const [runBreeder, setRunBreeder] = useState('');
  const [runMedium, setRunMedium] = useState<'coco' | 'soil'>('coco');
  const [runStartDate, setRunStartDate] = useState(todayStr);
  const [runFlipDate, setRunFlipDate] = useState('');
  const [runTargetFlowerDays, setRunTargetFlowerDays] = useState('63');
  const [runPotSize, setRunPotSize] = useState('11');
  const [runNotes, setRunNotes] = useState('');

  // Generate unique IDs for form labels
  const filterSearchInputId = useId();
  const entryDateInputId = useId();
  const entryPhaseSelectId = useId();
  const entryTitleInputId = useId();
  const entryNotesTextareaId = useId();
  const entryPhotoFileInputId = useId();
  const entryWaterInputId = useId();
  const entryNutrientEcInputId = useId();
  const entryNutrientPhInputId = useId();
  const entryRunoffEcInputId = useId();
  const entryRunoffPhInputId = useId();
  const entryClearTrichomeInputId = useId();
  const entryCloudyTrichomeInputId = useId();
  const entryAmberTrichomeInputId = useId();
  const runNameInputId = useId();
  const runStrainInputId = useId();
  const runBreederInputId = useId();
  const runMediumSelectId = useId();
  const runStartDateInputId = useId();
  const runFlipDateInputId = useId();
  const runTargetFlowerDaysInputId = useId();
  const runPotSizeInputId = useId();
  const runNotesTextareaId = useId();

  // Harvest Form state
  const [harvestDate, setHarvestDate] = useState(todayStr);
  const [harvestYieldGrams, setHarvestYieldGrams] = useState('');
  const [harvestRating, setHarvestRating] = useState<number>(5);
  const [harvestNotes, setHarvestNotes] = useState('');
  const harvestDateInputId = useId();
  const harvestYieldInputId = useId();
  const harvestNotesInputId = useId();

  const handleOpenHarvestModal = (run: GrowRun) => {
    setHarvestRunTarget(run);
    setHarvestDate(run.harvestDate || todayStr);
    setHarvestYieldGrams(run.yieldGrams ? String(run.yieldGrams) : '');
    setHarvestRating(run.rating || 5);
    setHarvestNotes('');
    setShowHarvestModal(true);
  };

  const handleSaveHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!harvestRunTarget) return;

    const yieldNum = harvestYieldGrams ? parseFloat(harvestYieldGrams) : null;
    await archiveRun(harvestRunTarget.id, {
      harvestDate,
      yieldGrams: yieldNum,
      rating: harvestRating,
      notes: harvestNotes.trim() || undefined,
    });

    // Auto-create a milestone entry for harvest day!
    await addEntry({
      runId: harvestRunTarget.id,
      dateStr: harvestDate,
      phase: 'harvest',
      title: 'Harvest Day Chop & Hang',
      note: harvestNotes.trim()
        ? `Plant harvested and hung to dry. ${harvestNotes.trim()}${yieldNum ? ` Dry yield: ${yieldNum}g.` : ''}`
        : `Plant harvested and hung to dry.${yieldNum ? ` Dry yield: ${yieldNum}g.` : ''}`,
      tags: ['milestone'],
      telemetry: {
        canopyTemp: environmentMetrics.canopy.temp,
        canopyHumidity: environmentMetrics.canopy.humidity,
        canopyVpd: environmentMetrics.canopy.vpd,
        potTemp: environmentMetrics.pot.temp,
        potHumidity: environmentMetrics.pot.humidity,
        soilMoisture: environmentMetrics.pot.moisture,
        fanSpeed: controls.fanSpeed.toString(),
      },
    });

    setShowHarvestModal(false);
  };

  // Open modal for new entry
  const handleOpenNewEntry = () => {
    setEditingEntry(null);
    setEntryDate(new Date().toISOString().split('T')[0]);

    // Guess phase based on active run
    if (activeRun) {
      if (activeRun.flipDate) {
        setEntryPhase('flowering');
      } else {
        const days = calculateDaysBetween(activeRun.startDate);
        setEntryPhase(days <= 14 ? 'seedling' : 'vegetative');
      }
    } else {
      setEntryPhase('vegetative');
    }

    setEntryTitle('');
    setEntryNote('');
    setEntryTags(['general']);
    setEntryPhotoUrl(null);
    setIncludeTelemetry(true);
    setEntryEc('');
    setEntryPh('');
    setEntryRunoffEc('');
    setEntryRunoffPh('');
    setEntryWaterAmount('');
    setEntryClearPct('');
    setEntryCloudyPct('');
    setEntryAmberPct('');
    setShowAdvancedDetails(false);
    setShowEntryModal(true);
  };

  // Open modal for editing existing entry
  const handleOpenEditEntry = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setEntryDate(entry.dateStr);
    setEntryPhase(entry.phase);
    setEntryTitle(entry.title);
    setEntryNote(entry.note);
    setEntryTags(entry.tags);
    setEntryPhotoUrl(entry.photoUrl || null);
    setIncludeTelemetry(false); // Don't overwrite existing historical telemetry
    setEntryEc(entry.nutrientEc != null ? String(entry.nutrientEc) : '');
    setEntryPh(entry.nutrientPh != null ? String(entry.nutrientPh) : '');
    setEntryRunoffEc(entry.runoffEc != null ? String(entry.runoffEc) : '');
    setEntryRunoffPh(entry.runoffPh != null ? String(entry.runoffPh) : '');
    setEntryWaterAmount(entry.waterAmountLiters != null ? String(entry.waterAmountLiters) : '');
    setEntryClearPct(entry.trichomeClearPct != null ? String(entry.trichomeClearPct) : '');
    setEntryCloudyPct(entry.trichomeCloudyPct != null ? String(entry.trichomeCloudyPct) : '');
    setEntryAmberPct(entry.trichomeAmberPct != null ? String(entry.trichomeAmberPct) : '');
    setShowAdvancedDetails(
      entry.nutrientEc != null ||
        entry.runoffEc != null ||
        entry.waterAmountLiters != null ||
        entry.trichomeClearPct != null
    );
    setShowEntryModal(true);
  };

  // Handle saving entry
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun || !entryTitle.trim()) return;

    let telemetryData = editingEntry?.telemetry;
    if (includeTelemetry && !editingEntry) {
      telemetryData = {
        canopyTemp: environmentMetrics.canopy.temp,
        canopyHumidity: environmentMetrics.canopy.humidity,
        canopyVpd: environmentMetrics.canopy.vpd,
        potTemp: environmentMetrics.pot.temp,
        potHumidity: environmentMetrics.pot.humidity,
        soilMoisture: environmentMetrics.pot.moisture,
        fanSpeed: controls.fanSpeed.toString(),
      };
    }

    const payload = {
      runId: activeRun.id,
      dateStr: entryDate,
      phase: entryPhase,
      title: entryTitle.trim(),
      note: entryNote.trim(),
      tags: entryTags.length > 0 ? entryTags : (['general'] as DiaryEntryTag[]),
      photoUrl: entryPhotoUrl,
      nutrientEc: entryEc ? parseFloat(entryEc) : null,
      nutrientPh: entryPh ? parseFloat(entryPh) : null,
      runoffEc: entryRunoffEc ? parseFloat(entryRunoffEc) : null,
      runoffPh: entryRunoffPh ? parseFloat(entryRunoffPh) : null,
      waterAmountLiters: entryWaterAmount ? parseFloat(entryWaterAmount) : null,
      trichomeClearPct: entryClearPct ? parseInt(entryClearPct, 10) : null,
      trichomeCloudyPct: entryCloudyPct ? parseInt(entryCloudyPct, 10) : null,
      trichomeAmberPct: entryAmberPct ? parseInt(entryAmberPct, 10) : null,
      telemetry: telemetryData,
    };

    if (editingEntry) {
      await updateEntry(editingEntry.id, payload);
    } else {
      await addEntry(payload);
    }

    setShowEntryModal(false);
  };

  // Handle Photo File selection and upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const res = await uploadPhoto(file);
    setIsUploadingPhoto(false);

    if (res.success && res.url) {
      setEntryPhotoUrl(res.url);
    } else {
      alert(`Photo upload failed: ${res.error || 'Server error'}`);
    }
  };

  // Toggle tag in entry form
  const toggleTag = (tag: DiaryEntryTag) => {
    if (entryTags.includes(tag)) {
      if (entryTags.length > 1) {
        setEntryTags(entryTags.filter((t) => t !== tag));
      }
    } else {
      setEntryTags([...entryTags, tag]);
    }
  };

  // Open modal for new or edit run
  const handleOpenRunModal = (run?: GrowRun) => {
    if (run) {
      setEditingRun(run);
      setRunName(run.name);
      setRunStrain(run.strain);
      setRunBreeder(run.breeder || '');
      setRunMedium(run.medium);
      setRunStartDate(run.startDate);
      setRunFlipDate(run.flipDate || '');
      setRunTargetFlowerDays(run.targetFlowerDays ? String(run.targetFlowerDays) : '63');
      setRunPotSize(run.potSizeLiters ? String(run.potSizeLiters) : '11');
      setRunNotes(run.notes || '');
    } else {
      setEditingRun(null);
      setRunName(`Run ${store.runs.length + 1}`);
      setRunStrain('');
      setRunBreeder('');
      setRunMedium('coco');
      setRunStartDate(todayStr);
      setRunFlipDate('');
      setRunTargetFlowerDays('63');
      setRunPotSize('11');
      setRunNotes('');
    }
    setShowRunModal(true);
  };

  // Save run
  const handleSaveRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runStrain.trim()) return;

    const payload = {
      name: runName.trim() || `Run ${store.runs.length + 1}`,
      strain: runStrain.trim(),
      breeder: runBreeder.trim() || undefined,
      medium: runMedium,
      startDate: runStartDate,
      flipDate: runFlipDate ? runFlipDate : null,
      targetFlowerDays: runTargetFlowerDays ? parseInt(runTargetFlowerDays, 10) : 63,
      potSizeLiters: runPotSize ? parseFloat(runPotSize) : 11,
      notes: runNotes.trim() || undefined,
    };

    if (editingRun) {
      await updateRun(editingRun.id, payload);
    } else {
      await createRun(payload);
    }

    setShowRunModal(false);
  };

  // Quick 12/12 Flip action
  const handleQuickFlip = async () => {
    if (!activeRun) return;
    const confirmFlip = window.confirm(
      `Flip ${activeRun.strain} to 12/12 photoperiod today (${todayStr})? This will start the flower day counter.`
    );
    if (!confirmFlip) return;

    await updateRun(activeRun.id, { flipDate: todayStr });
    // Also create a milestone entry automatically!
    await addEntry({
      runId: activeRun.id,
      dateStr: todayStr,
      phase: 'flowering',
      title: 'Flipped to 12/12 Photoperiod',
      note: 'Switched schedule to 12 hours light / 12 hours dark. Beginning the flowering stretch!',
      tags: ['flipto1212', 'milestone'],
      telemetry: {
        canopyTemp: environmentMetrics.canopy.temp,
        canopyHumidity: environmentMetrics.canopy.humidity,
        canopyVpd: environmentMetrics.canopy.vpd,
        potTemp: environmentMetrics.pot.temp,
        potHumidity: environmentMetrics.pot.humidity,
        soilMoisture: environmentMetrics.pot.moisture,
        fanSpeed: controls.fanSpeed.toString(),
      },
    });
  };

  // Filtering entries
  const filteredEntries = activeEntries.filter((entry) => {
    if (selectedTagFilter === 'photos') {
      if (!entry.photoUrl) return false;
    } else if (selectedTagFilter !== 'all') {
      if (!entry.tags.includes(selectedTagFilter)) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = entry.title.toLowerCase().includes(q);
      const matchNote = entry.note.toLowerCase().includes(q);
      const matchTags = entry.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchNote && !matchTags) return false;
    }

    return true;
  });

  // Calculate day metrics for active run
  const totalDays = activeRun ? calculateDaysBetween(activeRun.startDate) : 0;
  const flowerDays = activeRun?.flipDate ? calculateFlowerDays(activeRun.flipDate) : null;
  const targetFlowerDays = activeRun?.targetFlowerDays || 63;
  const flowerProgressPct = flowerDays ? Math.min(100, Math.round((flowerDays / targetFlowerDays) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Run Overview */}
      {activeRun ? (
        <div className="bg-theme-card border border-theme-border rounded-3xl p-6 shadow-sm relative overflow-hidden backdrop-blur-md">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            {/* Left: Strain & Run Meta */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectRun(null)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl bg-theme-surface hover:bg-theme-elevated border border-theme-border-subtle text-theme-text-muted hover:text-theme-text transition cursor-pointer"
                  title="View all grow cycles and archive hub"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Grows</span>
                </button>

                <span className="text-xs px-2.5 py-1 rounded-full bg-theme-elevated border border-theme-border-elevated text-theme-text-muted font-mono">
                  {activeRun.name}
                </span>

                {/* Medium badge */}
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-800/60 text-amber-300 font-medium capitalize">
                  {activeRun.medium === 'coco' ? '🥥 Coco Coir' : '🪴 Living Soil'} ({activeRun.potSizeLiters || 11}L)
                </span>

                {/* Phase badge */}
                {(() => {
                  const currentPhase: GrowPhase = activeRun.isArchived
                    ? 'harvest'
                    : flowerDays
                    ? 'flowering'
                    : totalDays <= 14
                    ? 'seedling'
                    : 'vegetative';
                  const phaseInfo = PHASE_CONFIG[currentPhase];
                  return (
                    <span
                      className={`text-xs px-3 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${phaseInfo.badgeBg} ${phaseInfo.badgeBorder} ${phaseInfo.color}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {activeRun.isArchived ? 'Archived' : phaseInfo.label}
                    </span>
                  );
                })()}

                {/* Sample Data clear badge */}
                {activeRun.strain.includes('Mimosa x Orange Punch') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear sample test data and return to a clean empty diary?')) {
                        clearDiary();
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-700/80 text-amber-300 hover:bg-rose-950/60 hover:border-rose-700 hover:text-rose-200 transition font-medium cursor-pointer"
                    title="Clear sample test data"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Sample Data Active</span>
                    <span className="text-[10px] underline ml-1 text-amber-200">Clear Data</span>
                  </button>
                )}

                {/* Multi-run switcher */}
                {store.runs.length > 0 && (
                  <select
                    value={activeRun.id}
                    onChange={(e) => {
                      if (e.target.value === '__all__') {
                        selectRun(null);
                      } else if (e.target.value === '__new__') {
                        handleOpenRunModal();
                      } else {
                        selectRun(e.target.value);
                      }
                    }}
                    aria-label="Select active grow run"
                    className="text-xs bg-theme-elevated border border-theme-border-elevated text-theme-text rounded-lg px-2 py-1 outline-hidden cursor-pointer"
                  >
                    <optgroup label="Switch Grow Run">
                      {store.runs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.isArchived ? '📦 ' : r.isActive ? '🟢 ' : '🪴 '} {r.strain} ({r.name})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Navigation & Actions">
                      <option value="__all__">📁 View All Grows & Archive Hub</option>
                      <option value="__new__">+ Start New Grow Run...</option>
                    </optgroup>
                  </select>
                )}
              </div>

              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-theme-text flex items-center gap-3">
                  <span>{activeRun.strain}</span>
                  {activeRun.breeder && (
                    <span className="text-sm font-normal text-theme-text-muted px-2.5 py-0.5 rounded-md bg-theme-surface border border-theme-border-subtle">
                      {activeRun.breeder}
                    </span>
                  )}
                </h2>
                {activeRun.notes && (
                  <p className="text-xs text-theme-text-muted mt-1 max-w-2xl line-clamp-1">{activeRun.notes}</p>
                )}
              </div>
            </div>

            {/* Right: Day Counters & Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Day Badges */}
              <div className="flex items-center gap-2 bg-theme-surface/70 border border-theme-border-subtle p-2 rounded-2xl">
                <div className="text-center px-3 py-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-theme-text-muted">Total Time</div>
                  <div className="text-xl font-bold text-emerald-400">Day {totalDays}</div>
                </div>

                {flowerDays !== null ? (
                  <>
                    <div className="h-8 w-px bg-theme-border" />
                    <div className="text-center px-3 py-1">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-theme-text-muted">Flower</div>
                      <div className="text-xl font-bold text-purple-400">Day {flowerDays}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-8 w-px bg-theme-border" />
                    <button
                      onClick={handleQuickFlip}
                      title="Flip light schedule to 12/12 photoperiod"
                      className="text-center px-3 py-1 hover:bg-theme-elevated rounded-xl transition text-purple-300 hover:text-purple-200 cursor-pointer"
                    >
                      <div className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-purple-400">
                        <Flower2 className="w-3 h-3" /> Flip 12/12
                      </div>
                      <div className="text-xs font-semibold underline mt-0.5">Start Bloom</div>
                    </button>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              {activeRun.isArchived ? (
                <button
                  onClick={() => unarchiveRun(activeRun.id)}
                  title="Reactivate this grow run"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-950/60 border border-purple-800 text-purple-300 hover:bg-purple-900/60 transition cursor-pointer"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  <span>Reactivate</span>
                </button>
              ) : (
                <button
                  onClick={() => handleOpenHarvestModal(activeRun)}
                  title="Harvest and archive this grow run"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-950/60 border border-purple-800 text-purple-300 hover:bg-purple-900/60 transition cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Harvest & Archive</span>
                </button>
              )}

              <button
                onClick={() => handleOpenRunModal(activeRun)}
                title="Edit Run details"
                className="p-2.5 rounded-xl bg-theme-surface hover:bg-theme-elevated border border-theme-border-subtle text-theme-text-muted hover:text-theme-text transition cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleOpenRunModal()}
                title="Create another Run"
                className="p-2.5 rounded-xl bg-theme-surface hover:bg-theme-elevated border border-theme-border-subtle text-theme-text-muted hover:text-theme-text transition cursor-pointer"
              >
                <Layers className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  const isSample = activeRun.strain.includes('Mimosa x Orange Punch');
                  const msg = isSample
                    ? 'Remove the sample grow data and reset to a clean empty diary?'
                    : `Delete "${activeRun.strain}" and all logged entries?${
                        store.runs.length === 1 ? ' (This will reset the diary to empty so you can start fresh.)' : ''
                      }`;
                  if (window.confirm(msg)) {
                    deleteRun(activeRun.id);
                  }
                }}
                title="Delete this grow run"
                className="p-2.5 rounded-xl bg-theme-surface hover:bg-rose-950/40 border border-theme-border-subtle text-theme-text-muted hover:text-rose-400 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={handleOpenNewEntry}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Log Entry</span>
              </button>
            </div>
          </div>

          {/* Archived Grow Banner (if viewing an archived run) */}
          {activeRun.isArchived && (
            <div className="mt-4 pt-3 border-t border-theme-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs text-purple-300 bg-purple-950/20 p-3 rounded-2xl border border-purple-800/40">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-purple-400" />
                <span>
                  <strong>Archived Grow Run</strong> • Harvested on {activeRun.harvestDate || 'Complete'}
                  {activeRun.yieldGrams ? ` • Final Yield: ${activeRun.yieldGrams}g dry` : ''}
                  {activeRun.rating ? ` • Rating: ${'★'.repeat(activeRun.rating)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectRun(null)}
                  className="text-xs text-purple-300 hover:text-white underline cursor-pointer"
                >
                  View Archive Hub
                </button>
                <button
                  type="button"
                  onClick={() => unarchiveRun(activeRun.id)}
                  className="px-2.5 py-1 rounded-lg bg-purple-800/80 hover:bg-purple-700 text-white font-medium cursor-pointer"
                >
                  Reactivate Grow
                </button>
              </div>
            </div>
          )}

          {/* Flowering Progress Bar (if in bloom) */}
          {flowerDays !== null && !activeRun.isArchived && (
            <div className="mt-5 pt-4 border-t border-theme-border-subtle">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-theme-text-muted flex items-center gap-1.5">
                  <Flower2 className="w-3.5 h-3.5 text-purple-400" />
                  Flowering Progress: Day {flowerDays} of {targetFlowerDays}
                </span>
                <span className="font-semibold text-purple-300">{flowerProgressPct}%</span>
              </div>
              <div className="w-full h-2 bg-theme-surface rounded-full overflow-hidden border border-theme-border-subtle">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, flowerProgressPct)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : store.runs.length > 0 ? (
        /* Archive & All Grows Hub */
        <div className="space-y-6">
          <div className="bg-theme-card border border-theme-border rounded-3xl p-6 shadow-sm backdrop-blur-md relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-theme-surface border border-theme-border-subtle text-emerald-400">
                    <FolderOpen className="w-5 h-5" />
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-theme-text">Grow Cycles & Archive</h2>
                </div>
                <p className="text-xs text-theme-text-muted">
                  {store.runs.length} grow cycle{store.runs.length > 1 ? 's' : ''} tracked. Open any grow to inspect its diary timeline, climate telemetry, and photos.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {store.runs.some((r) => r.isActive && !r.isArchived) && (
                  <button
                    onClick={() => {
                      const active = store.runs.find((r) => r.isActive && !r.isArchived);
                      if (active) selectRun(active.id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
                  >
                    <span>Resume Active Grow</span>
                  </button>
                )}

                <button
                  onClick={() => handleOpenRunModal()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-theme-elevated hover:bg-theme-hover border border-theme-border text-theme-text transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>New Grow Run</span>
                </button>
              </div>
            </div>
          </div>

          {/* Grid of Runs & Archives */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {store.runs.map((run) => {
              const runEntries = store.entries.filter((e) => e.runId === run.id);
              const photoCount = runEntries.filter((e) => e.photoUrl).length;
              const daysTotal = calculateDaysBetween(run.startDate, run.harvestDate || undefined);
              const isCurrentActive = run.isActive && !run.isArchived;

              return (
                <div
                  key={run.id}
                  className={`bg-theme-card border rounded-3xl p-5 shadow-xs transition hover:border-theme-border-elevated flex flex-col justify-between space-y-4 ${
                    isCurrentActive ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-theme-border'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      {isCurrentActive ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-700/80 text-emerald-300 font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active Tent Grow
                        </span>
                      ) : run.isArchived || run.harvestDate ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950/40 border border-purple-800/60 text-purple-300 font-medium flex items-center gap-1">
                          <Archive className="w-3 h-3" />
                          Harvested & Archived
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-theme-elevated text-theme-text-muted font-medium">
                          Standby
                        </span>
                      )}

                      <span className="text-[11px] font-mono text-theme-text-dim">
                        {run.name}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-theme-text tracking-tight flex items-center gap-2">
                        {run.strain}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-theme-text-muted">
                        {run.breeder && <span>{run.breeder} • </span>}
                        <span className="capitalize">{run.medium === 'coco' ? '🥥 Coco' : '🪴 Soil'}</span>
                        <span>• {daysTotal} days</span>
                      </div>
                    </div>

                    {run.notes && (
                      <p className="text-xs text-theme-text-muted line-clamp-2 bg-theme-surface/40 p-2.5 rounded-xl border border-theme-border-subtle">
                        {run.notes}
                      </p>
                    )}

                    {/* Stats pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-theme-text-dim pt-1">
                      <span className="px-2 py-1 rounded-lg bg-theme-surface border border-theme-border-subtle">
                        📝 {runEntries.length} entries
                      </span>
                      {photoCount > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-theme-surface border border-theme-border-subtle">
                          📸 {photoCount} photos
                        </span>
                      )}
                      {run.yieldGrams && (
                        <span className="px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 font-semibold flex items-center gap-1">
                          <Scale className="w-3 h-3" /> {run.yieldGrams}g dry
                        </span>
                      )}
                      {run.rating && (
                        <span className="px-2 py-1 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 font-semibold flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {run.rating}/5
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-theme-border-subtle flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenRunModal(run)}
                        title="Edit Run details"
                        className="p-1.5 rounded-lg hover:bg-theme-elevated text-theme-text-muted hover:text-theme-text transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(`Permanently delete ${run.strain} and all its entries?`)) {
                            deleteRun(run.id);
                          }
                        }}
                        title="Delete Run"
                        className="p-1.5 rounded-lg hover:bg-rose-950/40 text-theme-text-muted hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCurrentActive && (
                        <button
                          onClick={() => setActiveRun(run.id)}
                          title="Set as active tent grow"
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-theme-surface hover:bg-theme-elevated border border-theme-border text-theme-text-muted hover:text-theme-text transition cursor-pointer"
                        >
                          Set Active
                        </button>
                      )}

                      <button
                        onClick={() => selectRun(run.id)}
                        className="flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
                      >
                        <span>Open Diary</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State / Welcome Screen */
        <div className="bg-theme-card border border-theme-border rounded-3xl p-8 text-center space-y-4 backdrop-blur-md">
          <div className="w-16 h-16 rounded-3xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-xl font-bold text-theme-text">Welcome to Grow Wardrobe Diary</h3>
            <p className="text-sm text-theme-text-muted">
              Track your plants from germination to harvest. Log daily notes, upload photos straight from your phone,
              record fertigation EC/pH, and capture real-time tent climate snapshots.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleOpenRunModal()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Start First Grow Run</span>
            </button>
            <button
              onClick={seedSampleData}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-theme-elevated hover:bg-theme-hover border border-theme-border text-theme-text transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Load Sample Diary</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      {activeRun && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-theme-card/60 border border-theme-border p-3 rounded-2xl backdrop-blur-xs">
          {/* Tag filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedTagFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                selectedTagFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-surface'
              }`}
            >
              All ({activeEntries.length})
            </button>

            <button
              onClick={() => setSelectedTagFilter('photos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                selectedTagFilter === 'photos'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-surface'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Photos ({activeEntries.filter((e) => e.photoUrl).length})</span>
            </button>

            {(['watering', 'nutrients', 'training', 'defoliation', 'trichomes', 'milestone'] as DiaryEntryTag[]).map(
              (tag) => {
                const conf = TAG_CONFIG[tag];
                const count = activeEntries.filter((e) => e.tags.includes(tag)).length;
                if (count === 0 && selectedTagFilter !== tag) return null;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTagFilter(tag)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                      selectedTagFilter === tag
                        ? 'bg-theme-elevated text-theme-text border border-theme-border-elevated shadow-xs'
                        : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-surface'
                    }`}
                  >
                    <span>{conf.icon}</span>
                    <span>{conf.label}</span>
                    <span className="text-[10px] px-1 rounded-full bg-theme-surface text-theme-text-dim">
                      {count}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {/* Search box */}
          <div className="relative min-w-[200px]">
            <label htmlFor={filterSearchInputId} className="sr-only">Search notes or titles</label>
            <Search className="w-3.5 h-3.5 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id={filterSearchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes or titles..."
              className="w-full bg-theme-surface border border-theme-border-subtle rounded-xl pl-8 pr-3 py-1.5 text-xs text-theme-text placeholder:text-theme-text-dim focus:outline-hidden focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline Stream */}
      {activeRun && (
        <div className="space-y-4">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 bg-theme-card/30 border border-theme-border rounded-2xl p-6">
              <p className="text-sm text-theme-text-muted">No diary entries found matching this filter.</p>
              <button
                onClick={handleOpenNewEntry}
                className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 font-medium underline"
              >
                Create an entry now
              </button>
            </div>
          ) : (
            <div className="relative pl-6 md:pl-8 space-y-6 before:absolute before:left-[11px] md:before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:bg-theme-border">
              {filteredEntries.map((entry) => {
                const phaseInfo = PHASE_CONFIG[entry.phase] || PHASE_CONFIG.vegetative;
                return (
                  <div key={entry.id} className="relative group">
                    {/* Node circle on timeline */}
                    <div
                      className={`absolute -left-6 md:-left-8 top-4 w-6 h-6 rounded-full border-2 bg-theme-base flex items-center justify-center text-[10px] font-bold shadow-xs ${phaseInfo.badgeBorder || 'border-emerald-500'} ${phaseInfo.color}`}
                    >
                      {entry.dayNumber}
                    </div>

                    {/* Entry Card */}
                    <div className="bg-theme-card border border-theme-border rounded-2xl p-5 shadow-xs transition hover:border-theme-border-elevated space-y-4">
                      {/* Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Phase & Day */}
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${phaseInfo.badgeBg} ${phaseInfo.badgeBorder} ${phaseInfo.color}`}
                          >
                            {phaseInfo.label}
                          </span>

                          <span className="text-xs px-2 py-0.5 rounded-md bg-theme-elevated text-theme-text font-mono font-medium">
                            Day {entry.dayNumber}
                          </span>

                          {entry.flowerDayNumber != null && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-purple-950/40 border border-purple-800/60 text-purple-300 font-mono font-medium flex items-center gap-1">
                              <Flower2 className="w-3 h-3" />
                              Flower Day {entry.flowerDayNumber}
                            </span>
                          )}

                          <span className="text-xs text-theme-text-dim flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {entry.dateStr}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleOpenEditEntry(entry)}
                            title="Edit entry"
                            className="p-1.5 rounded-lg hover:bg-theme-elevated text-theme-text-muted hover:text-theme-text transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this diary entry?')) {
                                deleteEntry(entry.id);
                              }
                            }}
                            title="Delete entry"
                            className="p-1.5 rounded-lg hover:bg-rose-950/50 text-theme-text-muted hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Tags */}
                      <div className="space-y-1.5">
                        <h4 className="text-lg font-bold text-theme-text tracking-tight">{entry.title}</h4>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {entry.tags.map((tag) => {
                            const conf = TAG_CONFIG[tag] || TAG_CONFIG.general;
                            return (
                              <span
                                key={tag}
                                className={`text-[11px] px-2 py-0.5 rounded-md border font-medium flex items-center gap-1 ${conf.bg} ${conf.color}`}
                              >
                                {conf.icon}
                                {conf.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Photo Display (if attached) */}
                      {entry.photoUrl && (
                        <div className="relative group/photo overflow-hidden rounded-xl border border-theme-border-subtle max-w-xl">
                          <img
                            src={entry.photoUrl}
                            alt={entry.title}
                            className="w-full max-h-96 object-cover cursor-pointer transition duration-300 hover:scale-[1.02]"
                            onClick={() =>
                              setLightboxPhoto({
                                url: entry.photoUrl!,
                                title: entry.title,
                                day: entry.dayNumber,
                              })
                            }
                          />
                          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1 pointer-events-none">
                            <Camera className="w-3 h-3" />
                            <span>Click to expand</span>
                          </div>
                        </div>
                      )}

                      {/* Notes Content */}
                      {entry.note && (
                        <p className="text-sm text-theme-text leading-relaxed whitespace-pre-line bg-theme-surface/40 p-3.5 rounded-xl border border-theme-border-subtle">
                          {entry.note}
                        </p>
                      )}

                      {/* Nutrition & Runoff Stats Strip (if logged) */}
                      {(entry.nutrientEc != null ||
                        entry.runoffEc != null ||
                        entry.waterAmountLiters != null ||
                        entry.nutrientPh != null) && (
                        <div className="flex flex-wrap items-center gap-3 text-xs bg-theme-surface/60 p-2.5 rounded-xl border border-theme-border-subtle">
                          {entry.waterAmountLiters != null && (
                            <div className="flex items-center gap-1.5 text-sky-400 font-medium">
                              <Droplets className="w-3.5 h-3.5" />
                              <span>Water: {entry.waterAmountLiters}L</span>
                            </div>
                          )}

                          {entry.nutrientEc != null && (
                            <div className="flex items-center gap-1 text-teal-400 font-medium">
                              <FlaskConical className="w-3.5 h-3.5" />
                              <span>Feed: {entry.nutrientEc} mS/cm</span>
                              {entry.nutrientPh != null && (
                                <span className="text-theme-text-muted">(@ {entry.nutrientPh} pH)</span>
                              )}
                            </div>
                          )}

                          {entry.runoffEc != null && (
                            <div className="flex items-center gap-1 text-amber-400 font-medium border-l border-theme-border pl-3">
                              <span>Runoff: {entry.runoffEc} mS/cm</span>
                              {entry.runoffPh != null && (
                                <span className="text-theme-text-muted">(@ {entry.runoffPh} pH)</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Trichome Observation Segment (if logged) */}
                      {(entry.trichomeClearPct != null ||
                        entry.trichomeCloudyPct != null ||
                        entry.trichomeAmberPct != null) && (
                        <div className="bg-theme-surface/60 p-3 rounded-xl border border-theme-border-subtle space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-yellow-400 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" /> Trichome Ratio
                            </span>
                            <div className="flex items-center gap-3 text-[11px] text-theme-text-muted">
                              <span>Clear: {entry.trichomeClearPct ?? 0}%</span>
                              <span>Cloudy: {entry.trichomeCloudyPct ?? 0}%</span>
                              <span>Amber: {entry.trichomeAmberPct ?? 0}%</span>
                            </div>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden flex bg-theme-surface border border-theme-border-subtle">
                            <div
                              style={{ width: `${entry.trichomeClearPct ?? 0}%` }}
                              className="bg-sky-400 h-full"
                              title="Clear"
                            />
                            <div
                              style={{ width: `${entry.trichomeCloudyPct ?? 0}%` }}
                              className="bg-slate-200 h-full"
                              title="Cloudy"
                            />
                            <div
                              style={{ width: `${entry.trichomeAmberPct ?? 0}%` }}
                              className="bg-amber-500 h-full"
                              title="Amber"
                            />
                          </div>
                        </div>
                      )}

                      {/* Environmental Telemetry Snapshot (if captured) */}
                      {entry.telemetry && (
                        <div className="bg-theme-surface/40 p-2.5 rounded-xl border border-theme-border-subtle flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-theme-text-muted">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-theme-text-dim flex items-center gap-1">
                            <Thermometer className="w-3 h-3 text-emerald-400" /> Climate Snapshot
                          </span>

                          {entry.telemetry.canopyTemp && (
                            <span className="text-theme-text font-medium">
                              {entry.telemetry.canopyTemp}°C
                            </span>
                          )}

                          {entry.telemetry.canopyHumidity && (
                            <span className="text-theme-text font-medium">
                              {entry.telemetry.canopyHumidity}% RH
                            </span>
                          )}

                          {entry.telemetry.canopyVpd && (
                            <span className="text-emerald-400 font-semibold">
                              {entry.telemetry.canopyVpd} kPa
                            </span>
                          )}

                          {entry.telemetry.fanSpeed && (
                            <span className="flex items-center gap-1 text-indigo-300">
                              <Wind className="w-3 h-3" /> {entry.telemetry.fanSpeed}% Fan
                            </span>
                          )}

                          {entry.telemetry.soilMoisture && (
                            <span className="flex items-center gap-1 text-sky-300">
                              <Droplets className="w-3 h-3" /> {entry.telemetry.soilMoisture}% Moisture
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Entry Create / Edit Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5 my-8 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-theme-border-subtle pb-4">
              <h3 className="text-lg font-bold text-theme-text flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                {editingEntry ? 'Edit Diary Entry' : 'Log New Diary Entry'}
              </h3>
              <button
                onClick={() => setShowEntryModal(false)}
                className="p-1 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              {/* Date & Phase Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={entryDateInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">Date</label>
                  <input
                    id={entryDateInputId}
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor={entryPhaseSelectId} className="block text-xs font-semibold text-theme-text-muted mb-1">Grow Phase</label>
                  <select
                    id={entryPhaseSelectId}
                    value={entryPhase}
                    onChange={(e) => setEntryPhase(e.target.value as GrowPhase)}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  >
                    {Object.entries(PHASE_CONFIG).map(([phaseKey, conf]) => (
                      <option key={phaseKey} value={phaseKey}>
                        {conf.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title & Suggestions */}
              <div className="space-y-1.5">
                <label htmlFor={entryTitleInputId} className="block text-xs font-semibold text-theme-text-muted">Title / Action</label>
                <input
                  id={entryTitleInputId}
                  type="text"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  placeholder="e.g. Nutrient Feed 1.9 EC, Topped 5th Node"
                  required
                  className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                />

                {/* Quick suggestion chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-none">
                  {SUGGESTED_TITLES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEntryTitle(st)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-theme-surface hover:bg-theme-elevated text-theme-text-muted hover:text-theme-text border border-theme-border-subtle whitespace-nowrap transition cursor-pointer"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-theme-text-muted">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TAG_CONFIG) as DiaryEntryTag[]).map((tag) => {
                    const conf = TAG_CONFIG[tag];
                    const isSelected = entryTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-2.5 py-1 rounded-xl border font-medium flex items-center gap-1 transition cursor-pointer ${
                          isSelected
                            ? `${conf.bg} ${conf.color} ring-1 ring-emerald-500/50`
                            : 'bg-theme-surface/50 border-theme-border-subtle text-theme-text-muted hover:text-theme-text'
                        }`}
                      >
                        {conf.icon}
                        <span>{conf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note Textarea */}
              <div className="space-y-1">
                <label htmlFor={entryNotesTextareaId} className="block text-xs font-semibold text-theme-text-muted">Observation Notes</label>
                <textarea
                  id={entryNotesTextareaId}
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  rows={3}
                  placeholder="Canopy smell, root development, trichome density, adjustments made..."
                  className="w-full bg-theme-surface border border-theme-border rounded-xl p-3 text-sm text-theme-text outline-hidden focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Photo Upload Section */}
              <div className="space-y-2 bg-theme-surface/40 p-3.5 rounded-2xl border border-theme-border-subtle">
                <div className="flex items-center justify-between">
                  <label htmlFor={entryPhotoFileInputId} className="text-xs font-semibold text-theme-text flex items-center gap-1.5 cursor-pointer">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Upload Plant Photo</span>
                  </label>
                  {isUploadingPhoto && (
                    <span className="text-xs text-amber-400 animate-pulse">Uploading to HA...</span>
                  )}
                </div>

                {entryPhotoUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-theme-border-subtle group">
                    <img src={entryPhotoUrl} alt="Preview" className="w-full max-h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => setEntryPhotoUrl(null)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-rose-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label htmlFor={entryPhotoFileInputId} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-theme-border hover:border-emerald-500/60 bg-theme-surface cursor-pointer text-xs text-theme-text-muted hover:text-theme-text transition">
                      <ImageIcon className="w-4 h-4 text-theme-text-dim" />
                      <span>Take Photo or Choose File from Phone/Gallery</span>
                      <input
                        id={entryPhotoFileInputId}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Telemetry Snapshot Toggle */}
              {!editingEntry && (
                <div className="flex items-center justify-between bg-theme-surface/40 p-3 rounded-xl border border-theme-border-subtle">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-theme-text flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Snapshot Live Climate Telemetry</span>
                    </div>
                    <div className="text-[11px] text-theme-text-dim">
                      Canopy: {environmentMetrics.canopy.temp}°C / {environmentMetrics.canopy.humidity}% RH /{' '}
                      {environmentMetrics.canopy.vpd} kPa | Fan: {controls.fanSpeed}%
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeTelemetry}
                    onChange={(e) => setIncludeTelemetry(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              )}

              {/* Advanced / Optional Fertigation & Trichomes Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-theme-text-muted hover:text-theme-text py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-teal-400" />
                    <span>Feeding & Trichomes Metrics (Optional)</span>
                  </span>
                  {showAdvancedDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedDetails && (
                  <div className="pt-2 space-y-3">
                    {/* Feeding & Runoff */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <label htmlFor={entryWaterInputId} className="block text-[10px] text-theme-text-muted mb-1">Water (L)</label>
                        <input
                          id={entryWaterInputId}
                          type="number"
                          step="0.1"
                          placeholder="2.5"
                          value={entryWaterAmount}
                          onChange={(e) => setEntryWaterAmount(e.target.value)}
                          className="w-full bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text"
                        />
                      </div>
                      <div>
                        <label htmlFor={entryNutrientEcInputId} className="block text-[10px] text-teal-400 mb-1">Feed EC</label>
                        <input
                          id={entryNutrientEcInputId}
                          type="number"
                          step="0.05"
                          placeholder="1.8"
                          value={entryEc}
                          onChange={(e) => setEntryEc(e.target.value)}
                          className="w-full bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text"
                        />
                      </div>
                      <div>
                        <label htmlFor={entryNutrientPhInputId} className="block text-[10px] text-teal-400 mb-1">Feed pH</label>
                        <input
                          id={entryNutrientPhInputId}
                          type="number"
                          step="0.1"
                          placeholder="6.0"
                          value={entryPh}
                          onChange={(e) => setEntryPh(e.target.value)}
                          className="w-full bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text"
                        />
                      </div>
                      <div>
                        <label htmlFor={entryRunoffEcInputId} className="block text-[10px] text-amber-400 mb-1">Runoff EC</label>
                        <input
                          id={entryRunoffEcInputId}
                          type="number"
                          step="0.05"
                          placeholder="2.0"
                          value={entryRunoffEc}
                          onChange={(e) => setEntryRunoffEc(e.target.value)}
                          className="w-full bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text"
                        />
                      </div>
                      <div>
                        <label htmlFor={entryRunoffPhInputId} className="block text-[10px] text-amber-400 mb-1">Runoff pH</label>
                        <input
                          id={entryRunoffPhInputId}
                          type="number"
                          step="0.1"
                          placeholder="6.2"
                          value={entryRunoffPh}
                          onChange={(e) => setEntryRunoffPh(e.target.value)}
                          className="w-full bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text"
                        />
                      </div>
                    </div>

                    {/* Trichomes */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor={entryClearTrichomeInputId} className="block text-[10px] text-sky-400 mb-1">% Clear</label>
                        <input
                          id={entryClearTrichomeInputId}
                          type="number"
                          min="0"
                          max="100"
                          placeholder="20"
                          value={entryClearPct}
                          onChange={(e) => setEntryClearPct(e.target.value)}
                          className="w-full bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text"
                        />
                      </div>
                      <div>
                        <label htmlFor={entryCloudyTrichomeInputId} className="block text-[10px] text-slate-300 mb-1">% Cloudy</label>
                        <input
                          id={entryCloudyTrichomeInputId}
                          type="number"
                          min="0"
                          max="100"
                          placeholder="70"
                          value={entryCloudyPct}
                          onChange={(e) => setEntryCloudyPct(e.target.value)}
                          className="w-full bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text"
                        />
                      </div>
                      <div>
                        <label htmlFor={entryAmberTrichomeInputId} className="block text-[10px] text-amber-400 mb-1">% Amber</label>
                        <input
                          id={entryAmberTrichomeInputId}
                          type="number"
                          min="0"
                          max="100"
                          placeholder="10"
                          value={entryAmberPct}
                          onChange={(e) => setEntryAmberPct(e.target.value)}
                          className="w-full bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-text-muted hover:text-theme-text hover:bg-theme-surface transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingEntry ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grow Run Setup / Edit Modal */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 my-8 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-theme-border-subtle pb-4">
              <h3 className="text-lg font-bold text-theme-text flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                {editingRun ? 'Edit Grow Run' : 'Start New Grow Run'}
              </h3>
              <button
                onClick={() => setShowRunModal(false)}
                className="p-1 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRun} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={runNameInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">Run Name</label>
                  <input
                    id={runNameInputId}
                    type="text"
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                    placeholder="e.g. Run 1"
                    required
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor={runStrainInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">Strain Name</label>
                  <input
                    id={runStrainInputId}
                    type="text"
                    value={runStrain}
                    onChange={(e) => setRunStrain(e.target.value)}
                    placeholder="e.g. Mimosa x Orange Punch"
                    required
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={runBreederInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">Breeder (Optional)</label>
                  <input
                    id={runBreederInputId}
                    type="text"
                    value={runBreeder}
                    onChange={(e) => setRunBreeder(e.target.value)}
                    placeholder="e.g. Barney's Farm"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor={runMediumSelectId} className="block text-xs font-semibold text-theme-text-muted mb-1">Medium</label>
                  <select
                    id={runMediumSelectId}
                    value={runMedium}
                    onChange={(e) => setRunMedium(e.target.value as 'coco' | 'soil')}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  >
                    <option value="coco">Coco Coir / Perlite</option>
                    <option value="soil">Living Soil / Organic</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={runStartDateInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">Start / Sprout Date</label>
                  <input
                    id={runStartDateInputId}
                    type="date"
                    value={runStartDate}
                    onChange={(e) => setRunStartDate(e.target.value)}
                    required
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor={runFlipDateInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">
                    12/12 Flip Date (Optional)
                  </label>
                  <input
                    id={runFlipDateInputId}
                    type="date"
                    value={runFlipDate}
                    onChange={(e) => setRunFlipDate(e.target.value)}
                    placeholder="Leave empty if in Veg"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={runTargetFlowerDaysInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">
                    Target Flower Days
                  </label>
                  <input
                    id={runTargetFlowerDaysInputId}
                    type="number"
                    value={runTargetFlowerDays}
                    onChange={(e) => setRunTargetFlowerDays(e.target.value)}
                    placeholder="63"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor={runPotSizeInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">Pot Size (Liters)</label>
                  <input
                    id={runPotSizeInputId}
                    type="number"
                    step="0.5"
                    value={runPotSize}
                    onChange={(e) => setRunPotSize(e.target.value)}
                    placeholder="11"
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor={runNotesTextareaId} className="block text-xs font-semibold text-theme-text-muted">Notes / Nutrients Line</label>
                <textarea
                  id={runNotesTextareaId}
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Canna Coco A+B, Rhizotonic, Cannazym, PK 13/14..."
                  className="w-full bg-theme-surface border border-theme-border rounded-xl p-3 text-sm text-theme-text outline-hidden focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-theme-border-subtle">
                {editingRun ? (
                  <button
                    type="button"
                    onClick={() => {
                      const isOnly = store.runs.length === 1;
                      const msg = isOnly
                        ? `Delete "${editingRun.strain}"? This will reset the diary to a clean empty state so you can start fresh.`
                        : `Delete "${editingRun.strain}"? All associated log entries will be removed.`;
                      if (window.confirm(msg)) {
                        deleteRun(editingRun.id);
                        setShowRunModal(false);
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                  >
                    {store.runs.length === 1 ? 'Delete Run & Reset to Empty' : 'Delete Run'}
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRunModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-text-muted hover:text-theme-text hover:bg-theme-surface transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 transition cursor-pointer"
                  >
                    {editingRun ? 'Update Run' : 'Start Run'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Harvest & Archive Modal */}
      {showHarvestModal && harvestRunTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 my-8 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-theme-border-subtle pb-4">
              <h3 className="text-lg font-bold text-theme-text flex items-center gap-2">
                <Archive className="w-5 h-5 text-purple-400" />
                Harvest & Archive: {harvestRunTarget.strain}
              </h3>
              <button
                onClick={() => setShowHarvestModal(false)}
                className="p-1 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHarvest} className="space-y-4">
              <div className="bg-purple-950/30 border border-purple-800/40 rounded-2xl p-3.5 text-xs text-purple-200">
                Congratulations on finishing your grow cycle! Archiving marks this plant as harvested and moves it to your permanent grow archive while keeping all photos, notes, and climate history accessible anytime.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={harvestDateInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">
                    Harvest Date
                  </label>
                  <input
                    id={harvestDateInputId}
                    type="date"
                    value={harvestDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    required
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-purple-500"
                  />
                </div>

                <div>
                  <label htmlFor={harvestYieldInputId} className="block text-xs font-semibold text-theme-text-muted mb-1">
                    Final Yield (Dry Grams, Optional)
                  </label>
                  <input
                    id={harvestYieldInputId}
                    type="number"
                    step="0.1"
                    placeholder="e.g. 145"
                    value={harvestYieldGrams}
                    onChange={(e) => setHarvestYieldGrams(e.target.value)}
                    className="w-full bg-theme-surface border border-theme-border rounded-xl px-3 py-2 text-sm text-theme-text outline-hidden focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Quality Rating */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-theme-text-muted">
                  Overall Harvest Rating / Smoke Quality
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setHarvestRating(star)}
                      className="p-1 transition hover:scale-110 cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= harvestRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-theme-border-elevated'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-theme-text-muted ml-2 font-medium">
                    {harvestRating} of 5 Stars
                  </span>
                </div>
              </div>

              {/* Harvest / Curing Notes */}
              <div className="space-y-1">
                <label htmlFor={harvestNotesInputId} className="block text-xs font-semibold text-theme-text-muted">
                  Harvest Notes / Terpene Profile / Curing Details
                </label>
                <textarea
                  id={harvestNotesInputId}
                  value={harvestNotes}
                  onChange={(e) => setHarvestNotes(e.target.value)}
                  rows={3}
                  placeholder="Aroma description, bud density, drying conditions (temp/RH), curing jar notes..."
                  className="w-full bg-theme-surface border border-theme-border rounded-xl p-3 text-sm text-theme-text outline-hidden focus:border-purple-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowHarvestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-text-muted hover:text-theme-text hover:bg-theme-surface transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/40 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Archive className="w-4 h-4" />
                  <span>Save & Archive Grow</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] space-y-2">
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1 text-xs"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl"
            />
            <div className="text-center text-xs text-white/80 font-medium">
              {lightboxPhoto.day && <span className="font-bold text-emerald-400">Day {lightboxPhoto.day} • </span>}
              {lightboxPhoto.title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
