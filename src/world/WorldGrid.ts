import Phaser from 'phaser';
import { TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from './WorldConfig';

export class WorldGrid {
    // walkable[y][x]
    public walkable: boolean[][] = [];

    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createBaseTiles(): void {
        this.walkable = [];
        for (let ty = 0; ty < WORLD_TILES_Y; ty++) {
            this.walkable[ty] = [];
            for (let tx = 0; tx < WORLD_TILES_X; tx++) {
                const tileX = tx * TILE_SIZE;
                const tileY = ty * TILE_SIZE;
                const color = (tx + ty) % 2 === 0 ? 0x152238 : 0x1b2a41;

                this.scene.add
                    .rectangle(tileX, tileY, TILE_SIZE, TILE_SIZE, color)
                    .setOrigin(0, 0)
                    .setDepth(0); // ground layer

                this.walkable[ty][tx] = true;
            }
        }
    }

    createObstacles(): void {
        // vertical wall with gaps
        const wallX = Math.floor(WORLD_TILES_X / 2) + 10;
        for (let y = 40; y < WORLD_TILES_Y - 40; y++) {
            if (y === 80 || y === 120 || y === 160) continue;

            this.markBlocked(wallX, y, 0x111827);
        }

        // cluster
        const clusterOriginX = Math.floor(WORLD_TILES_X / 2) - 20;
        const clusterOriginY = Math.floor(WORLD_TILES_Y / 2) + 10;

        const clusterOffsets = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 },
            { x: 2, y: 0 },
        ];

        for (const off of clusterOffsets) {
            const tx = clusterOriginX + off.x;
            const ty = clusterOriginY + off.y;
            this.markBlocked(tx, ty, 0x1f2937);
        }
    }

    private markBlocked(tx: number, ty: number, color: number): void {
        const within =
            tx >= 0 && tx < WORLD_TILES_X && ty >= 0 && ty < WORLD_TILES_Y;
        if (!within) return;

        this.walkable[ty][tx] = false;

        const worldX = tx * TILE_SIZE;
        const worldY = ty * TILE_SIZE;

        this.scene.add
            .rectangle(worldX, worldY, TILE_SIZE, TILE_SIZE, color)
            .setOrigin(0, 0)
            .setDepth(0.7)
            .setStrokeStyle(1, 0x000000);
    }
}
