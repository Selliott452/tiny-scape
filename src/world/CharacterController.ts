import Phaser from 'phaser';
import { TILE_SIZE } from './WorldConfig';
import type { CharacterData } from '../models/CharacterData';
import type { TileCoord } from './WorldTypes';

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

    private moveSpeed = 120; // pixels/sec

    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }
    createInitialCharacters(): void {
        const centerTileX = 100;
        const centerTileY = 100;

        const baseDefs: Omit<CharacterData, 'id'>[] = [
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
        const maxDist = this.moveSpeed * dt;

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
}
