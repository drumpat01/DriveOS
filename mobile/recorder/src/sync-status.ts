export type SyncStage = 'idle' | 'saving' | 'syncing' | 'synced' | 'retry';

export type SyncPresentation = {
  title: string;
  detail: string;
  color: string;
  spinning: boolean;
};

const presentations: Record<Exclude<SyncStage, 'idle'>, SyncPresentation> = {
  saving: {
    title: 'Saving on this iPhone',
    detail: 'Stopping GPS and securing the final point.',
    color: '#c2b3ff',
    spinning: true,
  },
  syncing: {
    title: 'Saved on this iPhone',
    detail: 'Syncing the journey to JourneyDeck…',
    color: '#c2b3ff',
    spinning: true,
  },
  synced: {
    title: 'Synced to JourneyDeck',
    detail: 'The journey is saved and available in your timeline.',
    color: '#43e6ae',
    spinning: false,
  },
  retry: {
    title: 'Saved on this iPhone',
    detail: 'JourneyDeck could not finish syncing. Your points are safe; use the retry button when ready.',
    color: '#ffb45c',
    spinning: false,
  },
};

export function syncPresentation(stage: Exclude<SyncStage, 'idle'>) {
  return presentations[stage];
}
