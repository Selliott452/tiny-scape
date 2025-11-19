import Phaser from 'phaser';
import type { CharacterTask } from '../models/Tasks';
import { CharacterController } from './CharacterController';
import { TILE_SIZE } from './WorldConfig';
import type { GameLogMessage } from '../models/GameLog';


type ActiveTask = CharacterTask & {
    elapsed: number; // seconds since last tick
    progressBar: Phaser.GameObjects.Graphics | null;
};

export class TaskController {
    private scene: Phaser.Scene;
    private characters: CharacterController;

    // one active task per character for now
    private tasks = new Map<string, ActiveTask>();

    private speedMultiplier = 1; // affected by game speed (1,3,5)

    constructor(scene: Phaser.Scene, characters: CharacterController) {
        this.scene = scene;
        this.characters = characters;

        this.scene.game.events.on('gameSpeedChanged', this.handleGameSpeedChanged, this);
    }

    private handleGameSpeedChanged(speed: number): void {
        this.speedMultiplier = speed;
    }

    // For UI: does this character currently have an active chop task?
    hasActiveTaskForCharacter(characterId: string): boolean {
        return this.tasks.has(characterId);
    }

    startChopTreeTask(characterId: string, treeTileX: number, treeTileY: number): void {
        // Replace any existing task for this character
        const existing = this.tasks.get(characterId);
        if (existing) {
            this.destroyTask(characterId, existing);
            this.tasks.delete(characterId);
        }

        const base: CharacterTask = {
            id: Phaser.Utils.String.UUID(),
            characterId,
            type: 'chop_tree',
            treeTileX,
            treeTileY,
            interval: 2.0, // 2 seconds per chop at 1x
        };

        const active: ActiveTask = {
            ...base,
            elapsed: 0,
            progressBar: this.createProgressBar(),
        };

        this.tasks.set(characterId, active);

        // Notify the world/UI that a chop task started
        this.scene.game.events.emit('chopTaskStarted', characterId);

        // Log: task started
        const msg: GameLogMessage = {
            id: Phaser.Utils.String.UUID(),
            timestamp: Date.now(),
            kind: 'task',
            text: 'Started chopping tree.',
        };
        this.scene.game.events.emit('logMessage', msg);

    }

    update(deltaMs: number): void {
        if (this.tasks.size === 0) return;

        const dtSeconds = (deltaMs / 1000) * this.speedMultiplier;

        for (const [characterId, task] of Array.from(this.tasks.entries())) {
            // Check if character still exists and is adjacent to the target tile
            const tile = this.characters.getCharacterTileById(characterId);
            if (!tile) {
                this.destroyTask(characterId, task);
                this.tasks.delete(characterId);
                continue;
            }

            const dist =
                Math.abs(tile.x - task.treeTileX) + Math.abs(tile.y - task.treeTileY);
            if (dist !== 1) {
                // walked away or was never adjacent → cancel
                this.destroyTask(characterId, task);
                this.tasks.delete(characterId);
                continue;
            }

            // Update timer
            task.elapsed += dtSeconds;

            const fraction = Phaser.Math.Clamp(task.elapsed / task.interval, 0, 1);
            this.updateProgressBar(task, fraction, characterId);

            // Handle one or more completed ticks
            while (task.elapsed >= task.interval) {
                task.elapsed -= task.interval;

                // Reward: 1 log + 10 Woodcutting XP
                const leftover = this.characters.addItemToCharacter(
                    characterId,
                    'logs',
                    1
                );
                this.characters.addSkillXpForCharacter('woodcutting', characterId, 10);

                if (leftover > 0) {
                    // Inventory full - cancel the task
                    this.destroyTask(characterId, task);
                    this.tasks.delete(characterId);
                    break;
                }
            }
        }
    }

    private createProgressBar(): Phaser.GameObjects.Graphics {
        const g = this.scene.add.graphics();
        g.setDepth(5); // above characters
        return g;
    }

    private updateProgressBar(
        task: ActiveTask,
        fraction: number,
        characterId: string
    ): void {
        if (!task.progressBar) return;

        const pos = this.characters.getCharacterWorldPositionById(characterId);
        if (!pos) return;

        const width = TILE_SIZE;
        const height = 6;
        const x = pos.x - width / 2;
        const y = pos.y - TILE_SIZE * 0.8;

        const g = task.progressBar;
        g.clear();

        // background
        g.fillStyle(0x111827, 0.8);
        g.fillRect(x, y, width, height);

        // border
        g.lineStyle(1, 0x4b5563, 1);
        g.strokeRect(x, y, width, height);

        // fill
        const fillWidth = width * fraction;
        g.fillStyle(0x22c55e, 1);
        g.fillRect(x + 1, y + 1, Math.max(0, fillWidth - 2), height - 2);
    }

    private destroyTask(characterId: string, task: ActiveTask): void {
        if (task.progressBar) {
            task.progressBar.destroy();
            task.progressBar = null;
        }

        // Notify that this character no longer has this chop task
        this.scene.game.events.emit('chopTaskEnded', characterId);

        // Log: task ended
        const msg: GameLogMessage = {
            id: Phaser.Utils.String.UUID(),
            timestamp: Date.now(),
            kind: 'task',
            text: 'Stopped chopping tree.',
        };
        this.scene.game.events.emit('logMessage', msg);

    }

    cancelTaskForCharacter(characterId: string): void {
        const task = this.tasks.get(characterId);
        if (!task) return;

        this.destroyTask(characterId, task);
        this.tasks.delete(characterId);
    }

}
