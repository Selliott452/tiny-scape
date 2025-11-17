import Phaser from 'phaser';
import { TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from '../world/WorldConfig';
import type { WorldArea, TileCoord } from '../world/WorldTypes';
import { WorldGrid } from '../world/WorldGrid';
import { Pathfinder } from '../world/Pathfinder';
import { CharacterController } from '../world/CharacterController';

type CameraMode = 'follow' | 'free';

export class WorldScene extends Phaser.Scene {
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private cameraSpeed = 300;

    private cameraMode: CameraMode = 'follow';

    private minZoom = 0.5;
    private maxZoom = 3;
    private zoomStep = 0.001;

    private grid!: WorldGrid;
    private pathfinder!: Pathfinder;
    private characters!: CharacterController;

    private hoverTileRect?: Phaser.GameObjects.Rectangle;

    constructor() {
        super({ key: 'WorldScene' });
    }

    create(): void {
        const worldArea = this.registry.get('worldArea') as WorldArea | undefined;
        if (!worldArea) {
            const { width, height } = this.scale;
            this.add.rectangle(0, 0, width, height, 0x0f172a).setOrigin(0, 0);
            this.add.text(width / 2, height / 2, 'World Area (WorldScene)', {
                fontFamily: 'sans-serif',
                fontSize: '24px',
                color: '#ffffff',
            }).setOrigin(0.5);
            return;
        }

        const { x: viewX, y: viewY, width: viewWidth, height: viewHeight } = worldArea;
        const worldPixelWidth = WORLD_TILES_X * TILE_SIZE;
        const worldPixelHeight = WORLD_TILES_Y * TILE_SIZE;

        // World grid
        this.grid = new WorldGrid(this);
        this.grid.createBaseTiles();
        this.grid.createObstacles();

        // Pathfinder
        this.pathfinder = new Pathfinder(this.grid.walkable);

        // Hover tile highlight
        this.hoverTileRect = this.add
            .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x93c5fd)
            .setDepth(2);
        this.hoverTileRect.setVisible(false);

        // Characters
        this.characters = new CharacterController(this);
        this.characters.createInitialCharacters();

        // Emit characters to UI
        this.game.events.emit('charactersUpdated', this.characters.getCharactersData());
        const activeId = this.characters.getActiveCharacterId();
        if (activeId) {
            this.game.events.emit('activeCharacterChanged', activeId);
        }

        // Camera
        const cam = this.cameras.main;
        cam.setViewport(viewX, viewY, viewWidth, viewHeight);
        cam.setBounds(0, 0, worldPixelWidth, worldPixelHeight);

        const active = this.characters.getActiveCharacter();
        if (active) {
            cam.centerOn(active.sprite.x, active.sprite.y);
        } else {
            cam.centerOn(worldPixelWidth / 2, worldPixelHeight / 2);
        }

        // Input
        this.cursors = this.input.keyboard!.createCursorKeys();

        this.input.on(
            'wheel',
            (
                _pointer: Phaser.Input.Pointer,
                _objects: unknown[],
                _dx: number,
                dy: number
            ) => {
                let newZoom = cam.zoom - dy * this.zoomStep;
                newZoom = Phaser.Math.Clamp(newZoom, this.minZoom, this.maxZoom);
                cam.setZoom(newZoom);
            }
        );

        this.input.on('pointerup', this.handlePointerUp, this);
        this.input.on('pointermove', this.handlePointerMove, this);

        this.setCameraMode('follow');

        // Events from UI
        this.game.events.on('cameraModeChanged', this.handleCameraModeChanged, this);
        this.game.events.on('selectCharacter', this.handleSelectCharacter, this);

        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off('cameraModeChanged', this.handleCameraModeChanged, this);
            this.game.events.off('selectCharacter', this.handleSelectCharacter, this);
            this.input.off('pointerup', this.handlePointerUp, this);
            this.input.off('pointermove', this.handlePointerMove, this);
        });
    }

    private setCameraMode(mode: CameraMode): void {
        this.cameraMode = mode;

        const cam = this.cameras.main;
        const active = this.characters.getActiveCharacter();

        if (mode === 'follow' && active) {
            cam.startFollow(active.sprite, true);
        } else {
            cam.stopFollow();
        }
    }

    private handleCameraModeChanged = (mode: CameraMode): void => {
        this.setCameraMode(mode);
    };

    private handleSelectCharacter = (id: string): void => {
        this.characters.setActiveCharacter(id);
        const active = this.characters.getActiveCharacter();
        const cam = this.cameras.main;

        if (active && this.cameraMode === 'follow') {
            cam.startFollow(active.sprite, true);
        }

        this.game.events.emit('activeCharacterChanged', id);
    };

    private handlePointerMove(pointer: Phaser.Input.Pointer): void {
        const worldArea = this.registry.get('worldArea') as WorldArea | undefined;
        if (!worldArea) return;

        const overWorld =
            pointer.x >= worldArea.x &&
            pointer.x <= worldArea.x + worldArea.width &&
            pointer.y >= worldArea.y &&
            pointer.y <= worldArea.y + worldArea.height;

        if (!overWorld) {
            this.hoverTileRect?.setVisible(false);
            return;
        }

        const cam = this.cameras.main;
        const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);

        const tileX = Phaser.Math.Clamp(
            Math.floor(worldPoint.x / TILE_SIZE),
            0,
            WORLD_TILES_X - 1
        );
        const tileY = Phaser.Math.Clamp(
            Math.floor(worldPoint.y / TILE_SIZE),
            0,
            WORLD_TILES_Y - 1
        );

        this.hoverTileRect?.setPosition(tileX * TILE_SIZE, tileY * TILE_SIZE);
        this.hoverTileRect?.setVisible(true);
    }

    private handlePointerUp(pointer: Phaser.Input.Pointer): void {
        const worldArea = this.registry.get('worldArea') as WorldArea | undefined;
        if (!worldArea) return;

        const overWorld =
            pointer.x >= worldArea.x &&
            pointer.x <= worldArea.x + worldArea.width &&
            pointer.y >= worldArea.y &&
            pointer.y <= worldArea.y + worldArea.height;

        if (!overWorld) return;

        const active = this.characters.getActiveCharacter();
        if (!active) return;

        const cam = this.cameras.main;
        const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);

        const startTile: TileCoord = this.characters.getTileForCharacter(active);

        const targetTile: TileCoord = {
            x: Phaser.Math.Clamp(Math.floor(worldPoint.x / TILE_SIZE), 0, WORLD_TILES_X - 1),
            y: Phaser.Math.Clamp(Math.floor(worldPoint.y / TILE_SIZE), 0, WORLD_TILES_Y - 1),
        };

        if (!this.grid.walkable[targetTile.y][targetTile.x]) {
            console.log('Target tile is blocked');
            return;
        }

        if (startTile.x === targetTile.x && startTile.y === targetTile.y) return;

        const pathTiles = this.pathfinder.findPath(startTile, targetTile);
        if (pathTiles.length === 0) {
            console.log('No path found');
            return;
        }

        this.characters.setPathForCharacter(active, pathTiles);
    }

    update(_time: number, delta: number): void {
        if (!this.cursors) return;

        // Update all character movement
        this.characters.updateMovement(delta);

        // Keep hover highlight in sync with camera
        const pointer = this.input.activePointer as Phaser.Input.Pointer;
        this.handlePointerMove(pointer);

        if (this.cameraMode !== 'free') return;

        const cam = this.cameras.main;
        const speed = (this.cameraSpeed * delta) / 1000;

        if (this.cursors.left?.isDown) {
            cam.scrollX -= speed;
        } else if (this.cursors.right?.isDown) {
            cam.scrollX += speed;
        }

        if (this.cursors.up?.isDown) {
            cam.scrollY -= speed;
        } else if (this.cursors.down?.isDown) {
            cam.scrollY += speed;
        }
    }
}
