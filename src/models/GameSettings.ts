export type GameSpeed = 1 | 3 | 5;

export interface GameSettings {
    gameSpeed: GameSpeed;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
    gameSpeed: 1,
};
