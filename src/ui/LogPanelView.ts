import Phaser from 'phaser';
import type { GameLogMessage } from '../models/GameLog';

export class LogPanelView {
    private scene: Phaser.Scene;

    private x: number;
    private y: number;
    private width: number;
    private height: number;

    private background!: Phaser.GameObjects.Rectangle;
    private contentContainer!: Phaser.GameObjects.Container;

    private messages: GameLogMessage[] = [];
    private lineTexts: Phaser.GameObjects.Text[] = [];

    private readonly maxMessages = 200; // how many we keep in memory
    private readonly lineHeight = 14;
    private readonly padding = 6;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        height: number
    ) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    init(): void {
        // Background: dark navy with a border
        this.background = this.scene.add
            .rectangle(this.x, this.y, this.width, this.height, 0x020617)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x4b5563)
            .setDepth(10);

        // Container that will hold the text lines
        this.contentContainer = this.scene.add
            .container(this.x + this.padding, this.y + this.padding)
            .setDepth(11);
    }

    addMessage(msg: GameLogMessage): void {
        this.messages.push(msg);

        // Keep a bounded history
        if (this.messages.length > this.maxMessages) {
            this.messages.splice(0, this.messages.length - this.maxMessages);
        }

        this.layoutMessages();
    }

    private layoutMessages(): void {
        // Clear existing line texts
        this.lineTexts.forEach((t) => t.destroy());
        this.lineTexts = [];

        const visibleHeight = this.height - this.padding * 2;
        const maxVisibleLines = Math.max(1, Math.floor(visibleHeight / this.lineHeight));

        // Only render the last N messages that can fit
        const startIndex = Math.max(0, this.messages.length - maxVisibleLines);
        const visibleMessages = this.messages.slice(startIndex);

        visibleMessages.forEach((msg, index) => {
            const y = index * this.lineHeight;

            const color = this.colorForKind(msg.kind);
            const line = this.scene.add.text(
                0,
                y,
                msg.text,
                {
                    fontFamily: 'sans-serif',
                    fontSize: '11px',
                    color,
                }
            );
            line.setDepth(11);

            this.contentContainer.add(line);
            this.lineTexts.push(line);
        });
    }

    private colorForKind(kind: GameLogMessage['kind']): string {
        switch (kind) {
            case 'task':
                return '#f97316'; // amber-ish
            case 'item':
                return '#22c55e'; // green
            case 'xp':
                return '#38bdf8'; // blue
            case 'system':
            default:
                return '#e5e7eb'; // light gray
        }
    }
}
