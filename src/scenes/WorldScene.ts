import Phaser from 'phaser';
import { TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from '../world/WorldConfig';
import type { WorldArea, TileCoord } from '../world/WorldTypes';
import { WorldGrid } from '../world/WorldGrid';
import { Pathfinder } from '../world/Pathfinder';
import { CharacterController } from '../world/CharacterController';
import type { ItemKey } from '../models/Inventory';
import type { SkillKey } from '../models/Skills';
import { WorldInteractables } from '../world/WorldInteractables';
import type { Interactable } from '../world/WorldInteractables';
import type { InspectTarget } from '../models/InspectTarget';
import type { CharacterData } from '../models/CharacterData';
import { TaskController } from '../world/TaskController';
import type { UITaskSummary } from '../models/Tasks';
import type { GameLogMessage } from '../models/GameLog';



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
    private currentInspectTarget: InspectTarget = { type: 'none' };

    private interactables!: WorldInteractables;

    private tasks!: TaskController;

    private pendingChopActions = new Map<
        string,
        { treeTileX: number; treeTileY: number; destTileX: number; destTileY: number }
    >();

    private pendingWalkActions = new Map<
        string,
        { destTileX: number; destTileY: number }
    >();



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

        // Characters
        this.characters = new CharacterController(this);
        this.characters.createInitialCharacters();

        const { x: viewX, y: viewY, width: viewWidth, height: viewHeight } = worldArea;
        const worldPixelWidth = WORLD_TILES_X * TILE_SIZE;
        const worldPixelHeight = WORLD_TILES_Y * TILE_SIZE;

        // World grid
        this.grid = new WorldGrid(this);
        this.grid.createBaseTiles();
        this.grid.createObstacles();

        // Pathfinder
        this.pathfinder = new Pathfinder(this.grid.walkable);

        // Interactables (objects on top of the grid)
        this.interactables = new WorldInteractables(this);
        this.interactables.createInitialObjects();

        this.tasks = new TaskController(this, this.characters);

        // Hover tile highlight
        this.hoverTileRect = this.add
            .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x93c5fd)
            .setDepth(2);
        this.hoverTileRect.setVisible(false);

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
        this.game.events.on('chopTaskStarted', this.handleChopTaskStarted, this);
        this.game.events.on('chopTaskEnded', this.handleChopTaskEnded, this);

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

        this.updateInspectTargetForTile(tileX, tileY);
    }

    private handlePointerUp(pointer: Phaser.Input.Pointer): void {
        if (!pointer.leftButtonReleased()) return;

        const active = this.characters.getActiveCharacter();
        if (!active) return;

        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        const targetTile: TileCoord = {
            x: Phaser.Math.Clamp(Math.floor(worldPoint.x / TILE_SIZE), 0, WORLD_TILES_X - 1),
            y: Phaser.Math.Clamp(Math.floor(worldPoint.y / TILE_SIZE), 0, WORLD_TILES_Y - 1),
        };

        // First, check for interactables (tree, etc.)
        const interactable = this.interactables.getInteractableAt(
            targetTile.x,
            targetTile.y
        );

        const startTile: TileCoord = this.characters.getTileForCharacter(active);

        if (interactable && interactable.kind === 'tree') {
            this.handleTreeClick(startTile, interactable);
            return;
        }

        // Otherwise, just walk to the clicked tile if it's walkable
        if (!this.grid.walkable[targetTile.y][targetTile.x]) {
            console.log('Target tile is blocked');
            return;
        }

        const pathTiles = this.pathfinder.findPath(startTile, targetTile);
        if (pathTiles.length === 0) {
            console.log('No path found to target tile.');
            return;
        }

        this.characters.setPathForCharacter(active, pathTiles);

        // Generic walk: clear any tree-related actions and stop chopping
        this.pendingChopActions.delete(active.data.id);
        this.tasks.cancelTaskForCharacter(active.data.id);

        this.pendingWalkActions.set(active.data.id, {
            destTileX: targetTile.x,
            destTileY: targetTile.y,
        });

        this.emitTaskQueueUpdate(active.data.id);
        this.log(
            `Walking to (${targetTile.x}, ${targetTile.y}).`,
            'task'
        );

    }


    update(_time: number, delta: number): void {
        if (!this.cursors) return;

        // Update all character movement
        this.characters.updateMovement(delta);
        this.processPendingWalkActions();
        this.processPendingChopActions();
        this.tasks.update(delta);

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

    private handleTreeClick(startTile: TileCoord, tree: Interactable): void {
        const active = this.characters.getActiveCharacter();
        if (!active) return;

        const dist =
            Math.abs(startTile.x - tree.tileX) + Math.abs(startTile.y - tree.tileY);

        // If already adjacent → immediately try to start the chop task
        if (dist === 1) {
            // Clear any pending walk/chop for this character and start
            this.pendingWalkActions.delete(active.data.id);
            this.pendingChopActions.delete(active.data.id);
            this.tryStartChopTreeTask(active.data.id, tree.tileX, tree.tileY);
            this.emitTaskQueueUpdate(active.data.id);
            return;
        }

        // Otherwise, walk to a neighboring tile
        const neighbors: TileCoord[] = [
            { x: tree.tileX + 1, y: tree.tileY },
            { x: tree.tileX - 1, y: tree.tileY },
            { x: tree.tileX,     y: tree.tileY + 1 },
            { x: tree.tileX,     y: tree.tileY - 1 },
        ];

        const validNeighbors = neighbors.filter((t) =>
            t.x >= 0 && t.x < WORLD_TILES_X &&
            t.y >= 0 && t.y < WORLD_TILES_Y &&
            this.grid.walkable[t.y][t.x]
        );

        if (validNeighbors.length === 0) {
            console.log('No accessible tile next to the tree.');
            return;
        }

        // Choose closest neighbor
        validNeighbors.sort((a, b) => {
            const da = Math.abs(a.x - startTile.x) + Math.abs(a.y - startTile.y);
            const db = Math.abs(b.x - startTile.x) + Math.abs(b.y - startTile.y);
            return da - db;
        });

        const dest = validNeighbors[0];

        const pathTiles = this.pathfinder.findPath(startTile, dest);
        if (pathTiles.length === 0) {
            console.log('No path found to tree.');
            return;
        }

        this.characters.setPathForCharacter(active, pathTiles);

        // For tree interaction, we use pendingChopActions (not generic walk)
        this.pendingWalkActions.delete(active.data.id);
        this.pendingChopActions.set(active.data.id, {
            treeTileX: tree.tileX,
            treeTileY: tree.tileY,
            destTileX: dest.x,
            destTileY: dest.y,
        });

        this.log('Walking to tree.', 'task');

        // 🔥 Immediately show "Walk to tree" + "Chop tree (queued)"
        this.emitTaskQueueUpdate(active.data.id);
    }



    private updateInspectTargetForTile(tileX: number, tileY: number): void {
        // Look for a character on this tile
        const charData: CharacterData | null =
            this.characters.getCharacterDataAtTile(tileX, tileY);

        // Look for an interactable on this tile
        const interactable = this.interactables.getInteractableAt(tileX, tileY);

        let next: InspectTarget;

        if (charData) {
            next = { type: 'character', character: charData };
        } else if (interactable) {
            // For now we only have trees; later you can branch here
            next = {
                type: 'interactable',
                id: interactable.id,
                kind: interactable.kind,
                name: interactable.kind === 'tree' ? 'Tree' : 'Object',
            };
        } else {
            next = { type: 'none' };
        }

        const prev = this.currentInspectTarget;

        // Avoid spamming events if nothing meaningfully changed
        let changed = prev.type !== next.type;
        if (!changed && next.type === 'character' && prev.type === 'character') {
            changed = prev.character.id !== next.character.id;
        }
        if (!changed && next.type === 'interactable' && prev.type === 'interactable') {
            changed = prev.id !== next.id;
        }
        if (!changed) return;

        this.currentInspectTarget = next;
        this.game.events.emit('inspectTargetChanged', next);
    }

    private tryStartChopTreeTask(characterId: string, treeTileX: number, treeTileY: number): void {
        const canReceive = this.characters.canCharacterReceiveItem(
            characterId,
            'logs',
            1
        );

        if (!canReceive) {
            this.log('Cannot start woodcutting: inventory is full.', 'system');
            return;
        }

        this.tasks.startChopTreeTask(characterId, treeTileX, treeTileY);
    }

    private processPendingChopActions(): void {
        if (this.pendingChopActions.size === 0) return;

        for (const [characterId, pending] of Array.from(this.pendingChopActions.entries())) {
            const tile = this.characters.getCharacterTileById(characterId);
            if (!tile) {
                this.pendingChopActions.delete(characterId);
                this.emitTaskQueueUpdate(characterId);
                continue;
            }

            // Has the character reached the desired adjacent tile?
            if (tile.x === pending.destTileX && tile.y === pending.destTileY) {
                this.pendingChopActions.delete(characterId);
                this.tryStartChopTreeTask(characterId, pending.treeTileX, pending.treeTileY);
                this.emitTaskQueueUpdate(characterId);
            }
        }
    }

    private processPendingWalkActions(): void {
        if (this.pendingWalkActions.size === 0) return;

        for (const [characterId, pending] of Array.from(this.pendingWalkActions.entries())) {
            const tile = this.characters.getCharacterTileById(characterId);
            if (!tile) {
                this.pendingWalkActions.delete(characterId);
                this.emitTaskQueueUpdate(characterId);
                continue;
            }

            if (tile.x === pending.destTileX && tile.y === pending.destTileY) {
                this.pendingWalkActions.delete(characterId);
                this.log(
                    `Arrived at (${pending.destTileX}, ${pending.destTileY}).`,
                    'task'
                );
                this.emitTaskQueueUpdate(characterId);
            }

        }
    }


    private handleChopTaskStarted = (characterId: string): void => {
        this.emitTaskQueueUpdate(characterId);
    };

    private handleChopTaskEnded = (characterId: string): void => {
        this.emitTaskQueueUpdate(characterId);
    };

    private emitTaskQueueUpdate(characterId: string): void {
        const summaries: UITaskSummary[] = [];

        const pendingWalk = this.pendingWalkActions.get(characterId);
        const pendingChop = this.pendingChopActions.get(characterId);
        const chopping = this.tasks.hasActiveTaskForCharacter(characterId);

        // 1) Generic walk (clicking on ground)
        // Only show if we're not also in a tree-walk/chop flow
        if (pendingWalk && !pendingChop && !chopping) {
            summaries.push({
                id: `walk_${characterId}`,
                type: 'walk',
                label: `Walk to (${pendingWalk.destTileX}, ${pendingWalk.destTileY})`,
                status: 'in_progress',
            });
        }

        // 2) Tree interaction: Walk to tree + Chop tree
        if (pendingChop) {
            summaries.push({
                id: `walk_to_tree_${characterId}`,
                type: 'walk_to_tree',
                label: 'Walk to tree',
                status: 'in_progress',
            });

            summaries.push({
                id: `chop_tree_${characterId}`,
                type: 'chop_tree',
                label: 'Chop tree',
                status: chopping ? 'in_progress' : 'queued',
            });
        } else if (chopping) {
            summaries.push({
                id: `chop_tree_${characterId}`,
                type: 'chop_tree',
                label: 'Chop tree',
                status: 'in_progress',
            });
        }

        this.game.events.emit('characterTaskQueueUpdated', characterId, summaries);
    }

    private log(text: string, kind: GameLogMessage['kind'] = 'system'): void {
        const msg: GameLogMessage = {
            id: Phaser.Utils.String.UUID(),
            timestamp: Date.now(),
            kind,
            text,
        };
        this.game.events.emit('logMessage', msg);
    }


}
