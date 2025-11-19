import Phaser from 'phaser';
import { TILE_SIZE } from './WorldConfig';

export type InteractableKind = 'tree';

export interface Interactable {
    id: string;
    kind: InteractableKind;
    tileX: number;
    tileY: number;
    sprite: Phaser.GameObjects.Container;
}

export class WorldInteractables {
    private scene: Phaser.Scene;
    private objects: Interactable[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createInitialObjects(): void {
        // For now: single tree a bit offset from center
        const tileX = 105;
        const tileY = 98;
        this.addTree(tileX, tileY);
    }

    private addTree(tileX: number, tileY: number): void {
        const worldX = tileX * TILE_SIZE;
        const worldY = tileY * TILE_SIZE;
        const id = Phaser.Utils.String.UUID();

        const container = this.scene.add.container(worldX, worldY);
        container.setDepth(1.2); // above base tiles, below characters

        // Trunk
        const trunk = this.scene.add
            .rectangle(
                TILE_SIZE * 0.5,
                TILE_SIZE * 0.8,
                TILE_SIZE * 0.2,
                TILE_SIZE * 0.4,
                0x78350f
            )
            .setOrigin(0.5, 1);

        // Foliage
        const foliage = this.scene.add
            .circle(
                TILE_SIZE * 0.5,
                TILE_SIZE * 0.3,
                TILE_SIZE * 0.35,
                0x166534
            )
            .setStrokeStyle(2, 0x22c55e);

        container.add([trunk, foliage]);

        this.objects.push({
            id,
            kind: 'tree',
            tileX,
            tileY,
            sprite: container,
        });
    }

    getInteractableAt(tileX: number, tileY: number): Interactable | null {
        return this.objects.find((o) => o.tileX === tileX && o.tileY === tileY) ?? null;
    }
}
