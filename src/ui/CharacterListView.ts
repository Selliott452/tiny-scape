import Phaser from 'phaser';
import type { CharacterData } from '../models/CharacterData';
import { TOP_BAR_HEIGHT, LEFT_PANEL_RATIO } from './UiLayout';

type CharacterListItem = {
    id: string;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    avatar: Phaser.GameObjects.Arc;
};

export class CharacterListView {
    private items: CharacterListItem[] = [];
    private selectedCharacterId: string | null = null;

    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }
    updateCharacters(characters: CharacterData[]): void {
        this.clear();

        if (!characters || characters.length === 0) {
            this.selectedCharacterId = null;
            return;
        }

        const totalWidth = this.scene.scale.width;
        const leftWidth = totalWidth * LEFT_PANEL_RATIO;

        const horizontalMargin = 4;
        const itemWidth = leftWidth - horizontalMargin * 2;
        const itemHeight = 36;

        const startX = horizontalMargin;
        const startY = TOP_BAR_HEIGHT + 36;
        const spacing = 8;

        characters.forEach((ch, index) => {
            const itemY = startY + index * (itemHeight + spacing);

            const bg = this.scene.add
                .rectangle(startX, itemY, itemWidth, itemHeight, 0x111827)
                .setOrigin(0, 0)
                .setDepth(11);

            bg.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, itemWidth, itemHeight),
                Phaser.Geom.Rectangle.Contains
            );
            bg.setData('characterId', ch.id);

            const avatar = this.scene.add
                .circle(startX + 14, itemY + itemHeight / 2, 8, ch.color)
                .setDepth(12);

            const label = this.scene.add
                .text(startX + 30, itemY + itemHeight / 2 - 8, ch.name, {
                    fontFamily: 'sans-serif',
                    fontSize: '13px',
                    color: '#e5e7eb',
                })
                .setDepth(12);

            bg.on('pointerover', () => {
                if (this.selectedCharacterId !== ch.id) {
                    bg.setFillStyle(0x1f2937);
                    label.setColor('#ffffff');
                }
            });

            bg.on('pointerout', () => {
                if (this.selectedCharacterId !== ch.id) {
                    bg.setFillStyle(0x111827);
                    label.setColor('#e5e7eb');
                }
            });

            bg.on('pointerup', () => {
                this.scene.game.events.emit('selectCharacter', ch.id);
            });

            this.items.push({ id: ch.id, bg, label, avatar });
        });

        if (!this.selectedCharacterId) {
            this.selectedCharacterId = characters[0].id;
        }

        this.updateHighlight();
    }

    setSelectedCharacter(id: string): void {
        this.selectedCharacterId = id;
        this.updateHighlight();
    }

    clear(): void {
        this.items.forEach((item) => {
            item.bg.destroy();
            item.label.destroy();
            item.avatar.destroy();
        });
        this.items = [];
    }

    private updateHighlight(): void {
        this.items.forEach((item) => {
            if (item.id === this.selectedCharacterId) {
                item.bg.setFillStyle(0x374151);
                item.label.setColor('#facc15');
                item.label.setFontStyle('bold');
            } else {
                item.bg.setFillStyle(0x111827);
                item.label.setColor('#e5e7eb');
                item.label.setFontStyle('normal');
            }
        });
    }
}
