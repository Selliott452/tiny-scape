import Phaser from 'phaser';
import { computeUiLayout } from '../ui/UiLayout';
import { CharacterListView } from '../ui/CharacterListView';
import type { CharacterData } from '../models/CharacterData';

export class UIScene extends Phaser.Scene {
    private characterList!: CharacterListView;

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
            .rectangle(0, layout.topBarHeight, layout.leftWidth, totalHeight - layout.topBarHeight, 0x1f2933)
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
            .rectangle(rightX, layout.topBarHeight, layout.rightWidth, totalHeight - layout.topBarHeight, 0x111827)
            .setOrigin(0, 0)
            .setDepth(5);

        this.add
            .text(rightX + layout.rightWidth / 2, layout.topBarHeight + 8, 'Info Panel', {
                fontFamily: 'sans-serif',
                fontSize: '14px',
                color: '#ffffff',
            })
            .setOrigin(0.5, 0)
            .setDepth(6);

        // Bottom log under world
        this.add
            .rectangle(
                layout.bottomLog.x,
                layout.bottomLog.y,
                layout.bottomLog.width,
                layout.bottomLog.height,
                0x4b5563
            )
            .setOrigin(0, 0)
            .setDepth(5);

        this.add
            .text(
                layout.bottomLog.x + layout.bottomLog.width / 2,
                layout.bottomLog.y + 8,
                'Log / Messages',
                {
                    fontFamily: 'sans-serif',
                    fontSize: '14px',
                    color: '#ffffff',
                }
            )
            .setOrigin(0.5, 0)
            .setDepth(6);

        // World area outline
        this.add
            .rectangle(
                layout.worldArea.x,
                layout.worldArea.y,
                layout.worldArea.width,
                layout.worldArea.height
            )
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0xffffff)
            .setDepth(4);

        this.add
            .text(
                layout.worldArea.x + layout.worldArea.width / 2,
                layout.worldArea.y + layout.worldArea.height / 2,
                'World Area',
                {
                    fontFamily: 'sans-serif',
                    fontSize: '16px',
                    color: '#ffffff',
                }
            )
            .setOrigin(0.5)
            .setDepth(4);

        // Share worldArea with WorldScene
        this.registry.set('worldArea', layout.worldArea);

        // Launch world scene
        this.scene.launch('WorldScene');
        this.scene.bringToTop();

        // Events from world scene
        this.game.events.on('charactersUpdated', this.handleCharactersUpdated, this);
        this.game.events.on('activeCharacterChanged', this.handleActiveCharacterChanged, this);

        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off('charactersUpdated', this.handleCharactersUpdated, this);
            this.game.events.off('activeCharacterChanged', this.handleActiveCharacterChanged, this);
        });
    }

    private handleCharactersUpdated = (characters: CharacterData[]): void => {
        this.characterList.updateCharacters(characters);
    };

    private handleActiveCharacterChanged = (id: string): void => {
        this.characterList.setSelectedCharacter(id);
    };
}
