import Phaser from 'phaser';
import { computeUiLayout } from '../ui/UiLayout';
import { CharacterListView } from '../ui/CharacterListView';
import { RightPanelView } from '../ui/RightPanelView';
import type { CharacterData } from '../models/CharacterData';
import type { InspectTarget } from '../models/InspectTarget';
import type { UITaskSummary } from '../models/Tasks';
import type { GameLogMessage } from '../models/GameLog';
import { LogPanelView } from '../ui/LogPanelView';




export class UIScene extends Phaser.Scene {
    private characterList!: CharacterListView;
    private rightPanel!: RightPanelView;
    private logPanel!: LogPanelView;


    private charactersById = new Map<string, CharacterData>();
    private selectedCharacterId: string | null = null;

    private inspectTarget: InspectTarget = { type: 'none' };

    private tasksByCharacter = new Map<string, UITaskSummary[]>();


    constructor() {
        super({ key: 'UIScene' });
    }

    create(): void {
        const totalWidth = this.scale.width;
        const totalHeight = this.scale.height;

        const layout = computeUiLayout(totalWidth, totalHeight);

        // Top bar
        this.add
            .rectangle(0, 0, totalWidth, layout.topBarHeight, 0x111827)
            .setOrigin(0, 0)
            .setDepth(10);

        this.add
            .text(10, 8, 'TinyScape', {
                fontFamily: 'sans-serif',
                fontSize: '14px',
                color: '#ffffff',
            })
            .setDepth(11);

        // Camera toggle
        let follow = true;
        const buttonWidth = 180;
        const buttonHeight = 24;
        const buttonX = totalWidth - buttonWidth - 10;
        const buttonY = (layout.topBarHeight - buttonHeight) / 2;

        const camButtonBg = this.add
            .rectangle(buttonX, buttonY, buttonWidth, buttonHeight, 0x374151)
            .setOrigin(0, 0)
            .setDepth(11)
            .setInteractive({ useHandCursor: true });

        const camButtonText = this.add
            .text(
                buttonX + buttonWidth / 2,
                buttonY + buttonHeight / 2,
                'Camera: Follow',
                {
                    fontFamily: 'sans-serif',
                    fontSize: '12px',
                    color: '#ffffff',
                }
            )
            .setOrigin(0.5)
            .setDepth(12);

        camButtonBg.on('pointerover', () => camButtonBg.setFillStyle(0x4b5563));
        camButtonBg.on('pointerout', () => camButtonBg.setFillStyle(0x374151));
        camButtonBg.on('pointerup', () => {
            follow = !follow;
            const mode: 'follow' | 'free' = follow ? 'follow' : 'free';
            camButtonText.setText(follow ? 'Camera: Follow' : 'Camera: Free');
            this.game.events.emit('cameraModeChanged', mode);
        });

        // Left panel
        this.add
            .rectangle(
                0,
                layout.topBarHeight,
                layout.leftWidth,
                totalHeight - layout.topBarHeight,
                0x1f2933
            )
            .setOrigin(0, 0)
            .setDepth(5);

        this.add
            .text(layout.leftWidth / 2, layout.topBarHeight + 8, 'Characters', {
                fontFamily: 'sans-serif',
                fontSize: '14px',
                color: '#ffffff',
            })
            .setOrigin(0.5, 0)
            .setDepth(6);

        this.characterList = new CharacterListView(this);

        // Right panel
        const rightX = totalWidth - layout.rightWidth;

        this.add
            .rectangle(
                rightX,
                layout.topBarHeight,
                layout.rightWidth,
                totalHeight - layout.topBarHeight,
                0x111827
            )
            .setOrigin(0, 0)
            .setDepth(5);

        this.rightPanel = new RightPanelView(
            this,
            rightX,
            layout.topBarHeight,
            layout.rightWidth,
            totalHeight - layout.topBarHeight
        );
        this.rightPanel.init();

        // Bottom log under world - scrollable log panel
        this.logPanel = new LogPanelView(
            this,
            layout.bottomLog.x,
            layout.bottomLog.y,
            layout.bottomLog.width,
            layout.bottomLog.height
        );
        this.logPanel.init();

        // Share world area with WorldScene
        this.registry.set('worldArea', layout.worldArea);

        // Launch world scene
        this.scene.launch('WorldScene');
        this.scene.bringToTop();

        // Events from world scene
        this.game.events.on('charactersUpdated', this.handleCharactersUpdated, this);
        this.game.events.on('activeCharacterChanged', this.handleActiveCharacterChanged, this);
        this.game.events.on('characterDataChanged', this.handleCharacterDataChanged, this);
        this.game.events.on('inspectTargetChanged', this.handleInspectTargetChanged, this);
        this.game.events.on('characterTaskQueueUpdated', this.handleCharacterTaskQueueUpdated, this);
        this.game.events.on('logMessage', this.handleLogMessage, this);


        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off('charactersUpdated', this.handleCharactersUpdated, this);
            this.game.events.off('activeCharacterChanged', this.handleActiveCharacterChanged, this);
            this.game.events.off('characterDataChanged', this.handleCharacterDataChanged, this);
            this.game.events.off('inspectTargetChanged', this.handleInspectTargetChanged, this);
            this.game.events.off('characterTaskQueueUpdated', this.handleCharacterTaskQueueUpdated, this);
            this.game.events.off('logMessage', this.handleLogMessage, this);

        });
    }

    private handleCharactersUpdated = (characters: CharacterData[]): void => {
        this.charactersById.clear();
        for (const ch of characters) {
            this.charactersById.set(ch.id, ch);
        }

        this.characterList.updateCharacters(characters);

        // If we already had a selected character, re-bind the latest data to the right panel
        if (this.selectedCharacterId) {
            const selected = this.charactersById.get(this.selectedCharacterId) ?? null;
            this.rightPanel.setSelectedCharacter(selected);
        }
    };

    private handleActiveCharacterChanged = (id: string): void => {
        this.selectedCharacterId = id;

        this.characterList.setSelectedCharacter(id);
        const ch = this.charactersById.get(id) ?? null;
        this.rightPanel.setSelectedCharacter(ch);

        const tasks = this.tasksByCharacter.get(id) ?? [];
        this.rightPanel.setTasks(tasks);
    };


    private handleCharacterDataChanged = (updated: CharacterData): void => {
        // Update our local cache
        this.charactersById.set(updated.id, updated);

        // If this is the currently selected character, refresh the right panel
        if (this.selectedCharacterId === updated.id) {
            this.rightPanel.setSelectedCharacter(updated);
        }
    };

    private handleInspectTargetChanged = (target: InspectTarget): void => {
        this.inspectTarget = target;
        this.rightPanel.setInspectTarget(target);
    };

    private handleCharacterTaskQueueUpdated = (
        characterId: string,
        tasks: UITaskSummary[]
    ): void => {
        this.tasksByCharacter.set(characterId, tasks);

        if (this.selectedCharacterId === characterId) {
            this.rightPanel.setTasks(tasks);
        }
    };

    private handleLogMessage = (msg: GameLogMessage): void => {
        if (!this.logPanel) return;
        this.logPanel.addMessage(msg);
    };

}
