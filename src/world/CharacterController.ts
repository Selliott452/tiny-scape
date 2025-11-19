import Phaser from 'phaser';
import { TILE_SIZE } from './WorldConfig';
import type { CharacterData } from '../models/CharacterData';
import type { TileCoord } from './WorldTypes';

import { createInitialSkills, addSkillXp, SKILL_LABELS } from '../models/Skills';
import type { SkillKey } from '../models/Skills';

import {
    createEmptyInventory,
    addItemToInventory,
    hasCapacityForItem,
    ITEM_DEFINITIONS,
} from '../models/Inventory';
import type { ItemKey } from '../models/Inventory';
import type { GameLogMessage } from '../models/GameLog';


type Character = {
    data: CharacterData;
    sprite: Phaser.GameObjects.Arc;
    path: Phaser.Math.Vector2[];
    pathIndex: number;
    pathGraphics: Phaser.GameObjects.Graphics | null;
};

export class CharacterController {
    private characters: Character[] = [];
    private activeCharacterId: string | null = null;
    private activeHighlight: Phaser.GameObjects.Arc | null = null;

    private moveSpeed = 120; // base pixels/sec at 1x
    private speedMultiplier = 1; // 1x, 3x, 5x

    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Listen for global game speed changes
        this.scene.game.events.on('gameSpeedChanged', this.handleGameSpeedChanged, this);
    }

    private handleGameSpeedChanged(speed: number): void {
        // We trust the UI to only send 1,3,5
        this.speedMultiplier = speed;
    }

    createInitialCharacters(): void {
        const centerTileX = 100;
        const centerTileY = 100;

        const baseDefs: Omit<CharacterData, 'id' | 'skills' | 'inventory'>[] = [
            { name: 'Ari',  color: 0xffcc00, tileX: centerTileX,     tileY: centerTileY },
            { name: 'Bryn', color: 0x4ade80, tileX: centerTileX - 4, tileY: centerTileY - 2 },
            { name: 'Kato', color: 0x60a5fa, tileX: centerTileX + 5, tileY: centerTileY + 3 },
        ];

        this.characters = baseDefs.map((base) => {
            const id = Phaser.Utils.String.UUID();
            const data: CharacterData = {
                id,
                name: base.name,
                color: base.color,
                tileX: base.tileX,
                tileY: base.tileY,
                skills: createInitialSkills(),
                inventory: createEmptyInventory(),
            };

            const worldX = data.tileX * TILE_SIZE + TILE_SIZE / 2;
            const worldY = data.tileY * TILE_SIZE + TILE_SIZE / 2;

            const sprite = this.scene.add.circle(
                worldX,
                worldY,
                TILE_SIZE * 0.5,
                data.color
            );
            sprite.setDepth(3);

            return {
                data,
                sprite,
                path: [],
                pathIndex: 0,
                pathGraphics: null,
            };
        });

        if (this.characters.length > 0) {
            this.activeCharacterId = this.characters[0].data.id;
            this.updateActiveHighlight();
        }
    }

    getCharactersData(): CharacterData[] {
        return this.characters.map((c) => c.data);
    }

    getActiveCharacter(): Character | null {
        if (!this.activeCharacterId) return null;
        return this.characters.find((c) => c.data.id === this.activeCharacterId) ?? null;
    }

    setActiveCharacter(id: string): void {
        const exists = this.characters.some((c) => c.data.id === id);
        if (!exists) return;
        this.activeCharacterId = id;
        this.updateActiveHighlight();
    }

    getActiveCharacterId(): string | null {
        return this.activeCharacterId;
    }

    getCharacters(): Character[] {
        return this.characters;
    }

    getWorldPositionForCharacter(char: Character): Phaser.Math.Vector2 {
        return new Phaser.Math.Vector2(char.sprite.x, char.sprite.y);
    }

    getTileForCharacter(char: Character): TileCoord {
        return {
            x: Math.floor(char.sprite.x / TILE_SIZE),
            y: Math.floor(char.sprite.y / TILE_SIZE),
        };
    }

    setPathForCharacter(char: Character, pathTiles: TileCoord[]): void {
        const worldPath = pathTiles.map((tile) => {
            return new Phaser.Math.Vector2(
                tile.x * TILE_SIZE + TILE_SIZE / 2,
                tile.y * TILE_SIZE + TILE_SIZE / 2
            );
        });

        char.path = worldPath;
        char.pathIndex = 0;
        this.drawPathForCharacter(char);
    }

    updateMovement(delta: number): void {
        const dt = delta / 1000;

        // Apply game speed multiplier here
        const speed = this.moveSpeed * this.speedMultiplier;
        const maxDist = speed * dt;

        for (const char of this.characters) {
            if (char.path.length === 0 || char.pathIndex >= char.path.length) continue;

            const sprite = char.sprite;
            const target = char.path[char.pathIndex];

            const toTarget = new Phaser.Math.Vector2(target.x - sprite.x, target.y - sprite.y);
            const dist = toTarget.length();

            if (dist <= maxDist) {
                sprite.setPosition(target.x, target.y);
                char.pathIndex++;

                const tileX = Math.floor(target.x / TILE_SIZE);
                const tileY = Math.floor(target.y / TILE_SIZE);
                char.data.tileX = tileX;
                char.data.tileY = tileY;

                if (char.data.id === this.activeCharacterId && this.activeHighlight) {
                    this.activeHighlight.setPosition(sprite.x, sprite.y);
                }

                if (char.pathIndex >= char.path.length) {
                    char.path = [];
                    char.pathIndex = 0;
                    if (char.pathGraphics) {
                        char.pathGraphics.destroy();
                        char.pathGraphics = null;
                    }
                } else {
                    this.drawPathForCharacter(char);
                }
            } else {
                toTarget.normalize().scale(maxDist);
                sprite.x += toTarget.x;
                sprite.y += toTarget.y;

                if (char.data.id === this.activeCharacterId && this.activeHighlight) {
                    this.activeHighlight.setPosition(sprite.x, sprite.y);
                }
            }
        }
    }

    // ───────── Gameplay helpers ─────────

    addItemToActiveCharacter(itemKey: ItemKey, quantity: number): number {
        const active = this.getActiveCharacter();
        if (!active) return quantity;

        const leftover = addItemToInventory(active.data.inventory, itemKey, quantity);
        this.emitCharacterDataChanged(active);
        return leftover;
    }


    addSkillXpForActiveCharacter(skillKey: SkillKey, amount: number): void {
        const active = this.getActiveCharacter();
        if (!active) return;

        addSkillXp(active.data.skills, skillKey, amount);
        this.emitCharacterDataChanged(active);
    }

    getCharacterDataAtTile(tileX: number, tileY: number): CharacterData | null {
        const found = this.characters.find(
            (c) => c.data.tileX === tileX && c.data.tileY === tileY
        );
        return found ? found.data : null;
    }

    private emitCharacterDataChanged(char: Character): void {
        this.scene.game.events.emit('characterDataChanged', char.data);
    }

    // ───────── Internal visuals ─────────

    private drawPathForCharacter(char: Character): void {
        if (char.pathGraphics) {
            char.pathGraphics.destroy();
            char.pathGraphics = null;
        }

        const path = char.path;
        if (path.length === 0 || char.pathIndex >= path.length) {
            return;
        }

        const g = this.scene.add.graphics();
        g.setDepth(1.5);
        const lineColor = 0x7dd3fc;
        const lineWidth = 2;

        g.lineStyle(lineWidth, lineColor, 1);

        g.beginPath();
        g.moveTo(char.sprite.x, char.sprite.y);
        for (let i = char.pathIndex; i < path.length; i++) {
            g.lineTo(path[i].x, path[i].y);
        }
        g.strokePath();

        const end = path[path.length - 1];
        const size = 6;
        g.beginPath();
        g.moveTo(end.x - size, end.y - size);
        g.lineTo(end.x + size, end.y + size);
        g.moveTo(end.x - size, end.y + size);
        g.lineTo(end.x + size, end.y - size);
        g.strokePath();

        char.pathGraphics = g;
    }

    private updateActiveHighlight(): void {
        const active = this.getActiveCharacter();

        if (!active) {
            if (this.activeHighlight) {
                this.activeHighlight.setVisible(false);
            }
            return;
        }

        if (!this.activeHighlight) {
            this.activeHighlight = this.scene.add.circle(
                active.sprite.x,
                active.sprite.y,
                TILE_SIZE * 0.7
            );
            this.activeHighlight.setStrokeStyle(2, 0xfacc15);
            this.activeHighlight.setFillStyle(0x000000, 0);
            this.activeHighlight.setDepth(active.sprite.depth + 0.1);
        } else {
            this.activeHighlight.setPosition(active.sprite.x, active.sprite.y);
            this.activeHighlight.setVisible(true);
            this.activeHighlight.setDepth(active.sprite.depth + 0.1);
        }
    }

    private findCharacterById(id: string): Character | null {
        return this.characters.find((c) => c.data.id === id) ?? null;
    }

    addItemToCharacter(characterId: string, itemKey: ItemKey, quantity: number): number {
        const char = this.findCharacterById(characterId);
        if (!char) return quantity;

        const leftover = addItemToInventory(char.data.inventory, itemKey, quantity);
        this.emitCharacterDataChanged(char);

        const added = quantity - leftover;
        if (added > 0) {
            const def = ITEM_DEFINITIONS[itemKey];
            const msg: GameLogMessage = {
                id: Phaser.Utils.String.UUID(),
                timestamp: Date.now(),
                kind: 'item',
                text: `Gained ${added} × ${def.name}.`,
            };
            this.scene.game.events.emit('logMessage', msg);
        }

        return leftover;
    }


    addSkillXpForCharacter(skillKey: SkillKey, characterId: string, amount: number): void {
        const char = this.findCharacterById(characterId);
        if (!char) return;

        addSkillXp(char.data.skills, skillKey, amount);
        this.emitCharacterDataChanged(char);

        const skillName = SKILL_LABELS[skillKey];
        const msg: GameLogMessage = {
            id: Phaser.Utils.String.UUID(),
            timestamp: Date.now(),
            kind: 'xp',
            text: `Gained ${amount} ${skillName} XP.`,
        };
        this.scene.game.events.emit('logMessage', msg);
    }


    getCharacterWorldPositionById(id: string): Phaser.Math.Vector2 | null {
        const char = this.findCharacterById(id);
        if (!char) return null;
        return new Phaser.Math.Vector2(char.sprite.x, char.sprite.y);
    }

    getCharacterTileById(id: string): TileCoord | null {
        const char = this.findCharacterById(id);
        if (!char) return null;
        return {
            x: Math.floor(char.sprite.x / TILE_SIZE),
            y: Math.floor(char.sprite.y / TILE_SIZE),
        };
    }

    canCharacterReceiveItem(characterId: string, itemKey: ItemKey, quantity: number): boolean {
        const char = this.findCharacterById(characterId);
        if (!char) return false;
        return hasCapacityForItem(char.data.inventory, itemKey, quantity);
    }


}
