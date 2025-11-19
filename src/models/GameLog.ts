export type LogKind = 'task' | 'item' | 'xp' | 'system';

export interface GameLogMessage {
    id: string;
    timestamp: number; // ms since epoch
    text: string;
    kind: LogKind;
}
