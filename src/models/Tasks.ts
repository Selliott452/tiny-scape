export type TaskType = 'chop_tree';

export interface ChopTreeTask {
    id: string;
    characterId: string;
    type: 'chop_tree';
    treeTileX: number;
    treeTileY: number;
    interval: number; // seconds per chop
}

export type CharacterTask = ChopTreeTask;

// ───────── UI-facing task summary ─────────

export type TaskStatus = 'queued' | 'in_progress';

export interface UITaskSummary {
    id: string;
    type: 'walk' | 'walk_to_tree' | 'chop_tree';
    label: string;
    status: TaskStatus;
}
