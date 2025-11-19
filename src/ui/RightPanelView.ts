import Phaser from 'phaser';
import type { CharacterData } from '../models/CharacterData';
import { ALL_SKILLS, SKILL_LABELS } from '../models/Skills';
import { ITEM_DEFINITIONS } from '../models/Inventory';
import type { InspectTarget } from '../models/InspectTarget';
import type { GameSpeed } from '../models/GameSettings';
import type { UITaskSummary } from '../models/Tasks';


type ParentTabKey = 'inspect' | 'character' | 'settings';
type ChildTabKey = 'inventory' | 'skills' | 'tasks';

type ParentTabConfig = {
    key: ParentTabKey;
    label: string;
};

type ChildTabConfig = {
    key: ChildTabKey;
    label: string;
};

type ParentTabVisual = {
    key: ParentTabKey;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
};

type ChildTabVisual = {
    key: ChildTabKey;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
};

type SpeedButton = {
    speed: GameSpeed;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
};

export class RightPanelView {
    private scene: Phaser.Scene;

    private panelX: number;
    private panelY: number;
    private panelWidth: number;
    private panelHeight: number;

    private parentTabs: ParentTabConfig[] = [
        { key: 'inspect',   label: 'Inspect' },
        { key: 'character', label: 'Character' },
        { key: 'settings',  label: 'Settings' },
    ];

    private childTabsForCharacter: ChildTabConfig[] = [
        { key: 'inventory', label: 'Inventory' },
        { key: 'skills',    label: 'Skills' },
        { key: 'tasks',     label: 'Tasks' },
    ];

    private parentTabVisuals: ParentTabVisual[] = [];
    private childTabVisuals: ChildTabVisual[] = [];

    private activeParent: ParentTabKey = 'character';
    private activeChild: ChildTabKey = 'inventory';

    private selectedCharacter: CharacterData | null = null;
    private inspectTarget: InspectTarget = { type: 'none' };

    private contentText?: Phaser.GameObjects.Text;

    private contentX = 0;
    private contentY = 0;
    private contentWidth = 0;
    private contentHeight = 0;

    private skillRows: Phaser.GameObjects.Container[] = [];
    private inventorySlots: Phaser.GameObjects.Container[] = [];
    private inspectObjects: Phaser.GameObjects.Container[] = [];

    // Settings UI: game speed
    private currentGameSpeed: GameSpeed = 1;
    private gameSpeedButtons: SpeedButton[] = [];

    private currentTasks: UITaskSummary[] = [];
    private taskCards: Phaser.GameObjects.Container[] = [];


    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        height: number
    ) {
        this.scene = scene;
        this.panelX = x;
        this.panelY = y;
        this.panelWidth = width;
        this.panelHeight = height;
    }

    init(): void {
        const parentTabHeight = 24;
        const childTabHeight = 24;
        const margin = 4;

        // Parent tabs (top)
        const parentTabsY = this.panelY + 32;
        const parentTabsX = this.panelX + margin;
        const parentTabWidth =
            (this.panelWidth - margin * 2) / this.parentTabs.length;

        this.parentTabs.forEach((tab, index) => {
            const x = parentTabsX + index * parentTabWidth;
            const y = parentTabsY;

            const bg = this.scene.add
                .rectangle(x, y, parentTabWidth, parentTabHeight, 0x1f2937)
                .setOrigin(0, 0)
                .setDepth(11);

            bg.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, parentTabWidth, parentTabHeight),
                Phaser.Geom.Rectangle.Contains
            );

            const label = this.scene.add
                .text(
                    x + parentTabWidth / 2,
                    y + parentTabHeight / 2,
                    tab.label,
                    {
                        fontFamily: 'sans-serif',
                        fontSize: '12px',
                        color: '#e5e7eb',
                    }
                )
                .setOrigin(0.5)
                .setDepth(12);

            bg.on('pointerover', () => {
                if (this.activeParent !== tab.key) {
                    bg.setFillStyle(0x374151);
                }
            });

            bg.on('pointerout', () => {
                if (this.activeParent !== tab.key) {
                    bg.setFillStyle(0x1f2937);
                }
            });

            bg.on('pointerup', () => {
                this.setActiveParent(tab.key);
            });

            this.parentTabVisuals.push({ key: tab.key, bg, label });
        });

        // Child tabs (bottom) for Character mode
        const childTabsY =
            this.panelY + this.panelHeight - childTabHeight - margin;
        const childTabsX = this.panelX + margin;
        const childTabWidth =
            (this.panelWidth - margin * 2) / this.childTabsForCharacter.length;

        this.childTabsForCharacter.forEach((tab, index) => {
            const x = childTabsX + index * childTabWidth;
            const y = childTabsY;

            const bg = this.scene.add
                .rectangle(x, y, childTabWidth, childTabHeight, 0x1f2937)
                .setOrigin(0, 0)
                .setDepth(11);

            bg.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, childTabWidth, childTabHeight),
                Phaser.Geom.Rectangle.Contains
            );

            const label = this.scene.add
                .text(
                    x + childTabWidth / 2,
                    y + childTabHeight / 2,
                    tab.label,
                    {
                        fontFamily: 'sans-serif',
                        fontSize: '12px',
                        color: '#e5e7eb',
                    }
                )
                .setOrigin(0.5)
                .setDepth(12);

            bg.on('pointerover', () => {
                if (this.activeChild !== tab.key) {
                    bg.setFillStyle(0x374151);
                }
            });

            bg.on('pointerout', () => {
                if (this.activeChild !== tab.key) {
                    bg.setFillStyle(0x1f2937);
                }
            });

            bg.on('pointerup', () => {
                this.setActiveChild(tab.key);
            });

            this.childTabVisuals.push({ key: tab.key, bg, label });
        });

        // Content area
        const parentTabsYBottom = parentTabsY + parentTabHeight;
        const childTabsYTop = childTabsY;
        const contentTop = parentTabsYBottom + 8;
        const contentBottom = childTabsYTop - 8;
        const contentHeight = contentBottom - contentTop;
        const contentX = this.panelX + 8;
        const contentWidth = this.panelWidth - 16;

        this.contentX = contentX;
        this.contentY = contentTop;
        this.contentWidth = contentWidth;
        this.contentHeight = contentHeight;

        this.scene.add
            .rectangle(
                contentX,
                contentTop,
                contentWidth,
                contentHeight,
                0x020617
            )
            .setOrigin(0, 0)
            .setDepth(10);

        this.contentText = this.scene.add
            .text(
                contentX + 4,
                contentTop + 4,
                '',
                {
                    fontFamily: 'sans-serif',
                    fontSize: '12px',
                    color: '#e5e7eb',
                    wordWrap: { width: contentWidth - 8 },
                }
            )
            .setDepth(11);

        // Settings UI (game speed buttons)
        this.createSettingsUi();

        this.refreshParentTabStyles();
        this.refreshChildTabStyles();
        this.updateSettingsVisibility(this.activeParent === 'settings');
        this.refreshContent();
    }

    setSelectedCharacter(character: CharacterData | null): void {
        this.selectedCharacter = character;
        this.refreshContent();
    }

    setInspectTarget(target: InspectTarget): void {
        this.inspectTarget = target;
        if (this.activeParent === 'inspect') {
            this.refreshContent();
        }
    }

    // ───────── Parent tabs ─────────

    private setActiveParent(parent: ParentTabKey): void {
        if (this.activeParent === parent) return;
        this.activeParent = parent;

        this.refreshParentTabStyles();
        this.refreshChildTabStyles();
        this.updateSettingsVisibility(this.activeParent === 'settings');
        this.refreshContent();
    }

    private refreshParentTabStyles(): void {
        this.parentTabVisuals.forEach((tabVis) => {
            if (tabVis.key === this.activeParent) {
                tabVis.bg.setFillStyle(0x4b5563);
                tabVis.label.setColor('#facc15');
                tabVis.label.setFontStyle('bold');
            } else {
                tabVis.bg.setFillStyle(0x1f2937);
                tabVis.label.setColor('#e5e7eb');
                tabVis.label.setFontStyle('normal');
            }
        });
    }

    // ───────── Child tabs ─────────

    private setActiveChild(child: ChildTabKey): void {
        if (this.activeChild === child) return;
        this.activeChild = child;
        this.refreshChildTabStyles();
        this.refreshContent();
    }

    private refreshChildTabStyles(): void {
        const showChildTabs = this.activeParent === 'character';

        this.childTabVisuals.forEach((tabVis) => {
            tabVis.bg.setVisible(showChildTabs);
            tabVis.label.setVisible(showChildTabs);

            if (showChildTabs) {
                tabVis.bg.setInteractive(
                    new Phaser.Geom.Rectangle(
                        0,
                        0,
                        tabVis.bg.width,
                        tabVis.bg.height
                    ),
                    Phaser.Geom.Rectangle.Contains
                );
            } else {
                tabVis.bg.disableInteractive();
            }

            if (!showChildTabs) {
                return;
            }

            if (tabVis.key === this.activeChild) {
                tabVis.bg.setFillStyle(0x4b5563);
                tabVis.label.setColor('#facc15');
                tabVis.label.setFontStyle('bold');
            } else {
                tabVis.bg.setFillStyle(0x1f2937);
                tabVis.label.setColor('#e5e7eb');
                tabVis.label.setFontStyle('normal');
            }
        });
    }

    // ───────── Content routing ─────────

    private refreshContent(): void {
        if (!this.contentText) return;

        // Clear old visuals
        this.clearSkillRows();
        this.clearInventoryGrid();
        this.clearInspectPane();
        this.clearTaskCards();


        // By default, text is visible; some modes will hide it
        this.contentText.setVisible(true);

        const charName = this.selectedCharacter
            ? this.selectedCharacter.name
            : 'No character selected';

        let body = '';

        switch (this.activeParent) {
            case 'inspect':
                this.renderInspectPane();
                return;

            case 'settings':
                this.renderSettingsPane();
                return;

            case 'character':
                switch (this.activeChild) {
                    case 'inventory':
                        if (!this.selectedCharacter) {
                            body =
                                'No character selected\n\n' +
                                'Select a character on the left to see their inventory.';
                            break;
                        }
                        this.contentText.setVisible(false);
                        this.renderInventoryGrid();
                        return;

                    case 'skills':
                        if (!this.selectedCharacter) {
                            body =
                                'No character selected\n\n' +
                                'Select a character on the left to see their skills.';
                            break;
                        }
                        this.contentText.setVisible(false);
                        this.renderSkillsRows();
                        return;

                    case 'tasks':
                        this.renderTasksPane();
                        return;
                }
                break;
        }

        this.contentText.setText(body);
    }

    // ───────── Inspect pane ─────────

    private clearInspectPane(): void {
        this.inspectObjects.forEach((c) => c.destroy());
        this.inspectObjects = [];
    }

    private renderInspectPane(): void {
        if (!this.contentText) return;

        const target = this.inspectTarget;

        if (!target || target.type === 'none') {
            this.contentText.setVisible(true);
            this.contentText.setText(
                'Inspect\n\n' +
                'Hover over a character or an interactable object (like a tree)\n' +
                'to see details here.'
            );
            return;
        }

        this.contentText.setVisible(false);

        const padding = 8;
        const startX = this.contentX + padding;
        const startY = this.contentY + padding;

        const container = this.scene.add.container(startX, startY);
        container.setDepth(11);

        switch (target.type) {
            case 'character': {
                const ch = target.character;
                const radius = 18;

                const portrait = this.scene.add
                    .circle(radius, radius, radius, ch.color)
                    .setStrokeStyle(2, 0xfacc15);

                const nameText = this.scene.add.text(
                    radius * 2 + 12,
                    2,
                    ch.name,
                    {
                        fontFamily: 'sans-serif',
                        fontSize: '14px',
                        color: '#e5e7eb',
                    }
                );

                const tileText = this.scene.add.text(
                    radius * 2 + 12,
                    22,
                    `Tile: (${ch.tileX}, ${ch.tileY})`,
                    {
                        fontFamily: 'sans-serif',
                        fontSize: '11px',
                        color: '#9ca3af',
                    }
                );

                container.add([portrait, nameText, tileText]);
                break;
            }

            case 'interactable': {
                const label = target.name;

                const iconContainer = this.scene.add.container(0, 0);

                const trunk = this.scene.add
                    .rectangle(20, 34, 10, 18, 0x78350f)
                    .setOrigin(0.5, 1);

                const foliage = this.scene.add
                    .circle(20, 18, 14, 0x166534)
                    .setStrokeStyle(2, 0x22c55e);

                iconContainer.add([trunk, foliage]);

                const nameText = this.scene.add.text(
                    40,
                    4,
                    label,
                    {
                        fontFamily: 'sans-serif',
                        fontSize: '14px',
                        color: '#e5e7eb',
                    }
                );

                const descText = this.scene.add.text(
                    40,
                    24,
                    'A sturdy tree. You can chop it\nfor logs and Woodcutting XP.',
                    {
                        fontFamily: 'sans-serif',
                        fontSize: '11px',
                        color: '#9ca3af',
                        wordWrap: { width: this.contentWidth - 40 - 8 },
                    }
                );

                container.add([iconContainer, nameText, descText]);
                break;
            }
        }

        this.inspectObjects.push(container);
    }

    // ───────── Skills UI ─────────

    private clearSkillRows(): void {
        this.skillRows.forEach((row) => row.destroy());
        this.skillRows = [];
    }

    private renderSkillsRows(): void {
        if (!this.selectedCharacter) return;

        const skills = this.selectedCharacter.skills;

        const rowHeight = 34;
        const spacing = 8;

        let currentY = this.contentY + 8;

        ALL_SKILLS.forEach((skillKey) => {
            const state = skills[skillKey];
            const label = SKILL_LABELS[skillKey];
            const level = state?.level ?? 1;
            const xp = state?.xp ?? 0;

            const container = this.scene.add.container(this.contentX + 4, currentY);
            container.setDepth(11);

            const bgWidth = this.contentWidth - 8;
            const bg = this.scene.add
                .rectangle(0, 0, bgWidth, rowHeight, 0x020617)
                .setOrigin(0, 0)
                .setStrokeStyle(1, 0x1f2937);

            const iconRadius = 10;
            const iconX = 10 + iconRadius;
            const iconY = rowHeight / 2;

            const icon = this.scene.add
                .circle(iconX, iconY, iconRadius, 0x1d4ed8)
                .setStrokeStyle(1, 0x93c5fd);

            const iconLetter = this.scene.add
                .text(iconX, iconY, label.charAt(0), {
                    fontFamily: 'sans-serif',
                    fontSize: '10px',
                    color: '#e5e7eb',
                })
                .setOrigin(0.5);

            const nameText = this.scene.add.text(iconX + iconRadius + 8, 6, label, {
                fontFamily: 'sans-serif',
                fontSize: '13px',
                color: '#e5e7eb',
            });

            const rightPadding = 8;
            const levelText = this.scene.add.text(
                bgWidth - rightPadding - 60,
                6,
                `Lv ${level}`,
                {
                    fontFamily: 'sans-serif',
                    fontSize: '13px',
                    color: '#facc15',
                }
            );

            const xpText = this.scene.add.text(
                bgWidth - rightPadding - 60,
                20,
                `${xp} xp`,
                {
                    fontFamily: 'sans-serif',
                    fontSize: '11px',
                    color: '#9ca3af',
                }
            );

            container.add([bg, icon, iconLetter, nameText, levelText, xpText]);

            this.skillRows.push(container);
            currentY += rowHeight + spacing;
        });
    }

    // ───────── Inventory UI ─────────

    private clearInventoryGrid(): void {
        this.inventorySlots.forEach((slot) => slot.destroy());
        this.inventorySlots = [];
    }

    private renderInventoryGrid(): void {
        if (!this.selectedCharacter) return;

        const inventory = this.selectedCharacter.inventory;
        const slots = inventory.slots;

        const cols = 4;
        const rows = 7;
        const slotSize = 42;
        const slotSpacing = 8;

        const gridWidth = cols * slotSize + (cols - 1) * slotSpacing;
        const startX = this.contentX + (this.contentWidth - gridWidth) / 2;
        const startY = this.contentY + 8;

        let index = 0;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * (slotSize + slotSpacing);
                const y = startY + row * (slotSize + slotSpacing);

                const container = this.scene.add.container(x, y);
                container.setDepth(11);

                const outer = this.scene.add
                    .rectangle(0, 0, slotSize, slotSize, 0x1f2937)
                    .setOrigin(0, 0)
                    .setStrokeStyle(2, 0x4b5563);

                const inner = this.scene.add
                    .rectangle(2, 2, slotSize - 4, slotSize - 4, 0x111827)
                    .setOrigin(0, 0);

                container.add([outer, inner]);

                outer.setInteractive(
                    new Phaser.Geom.Rectangle(0, 0, slotSize, slotSize),
                    Phaser.Geom.Rectangle.Contains
                );

                outer.on('pointerover', () => {
                    outer.setStrokeStyle(2, 0xfacc15);
                });
                outer.on('pointerout', () => {
                    outer.setStrokeStyle(2, 0x4b5563);
                });

                if (index < slots.length) {
                    const slot = slots[index];
                    if (slot.itemKey) {
                        const def = ITEM_DEFINITIONS[slot.itemKey];

                        const iconRadius = 12;
                        const iconX = slotSize / 2;
                        const iconY = slotSize / 2 - 4;

                        const icon = this.scene.add
                            .circle(iconX, iconY, iconRadius, 0x047857)
                            .setStrokeStyle(1, 0x6ee7b7);

                        const firstLetter = def.name.charAt(0).toUpperCase();

                        const iconText = this.scene.add
                            .text(iconX, iconY, firstLetter, {
                                fontFamily: 'sans-serif',
                                fontSize: '12px',
                                color: '#e5e7eb',
                            })
                            .setOrigin(0.5);

                        container.add([icon, iconText]);

                        if (slot.quantity > 1) {
                            const qtyText = this.scene.add
                                .text(
                                    slotSize - 2,
                                    slotSize - 2,
                                    String(slot.quantity),
                                    {
                                        fontFamily: 'sans-serif',
                                        fontSize: '11px',
                                        color: '#facc15',
                                    }
                                )
                                .setOrigin(1, 1);

                            container.add(qtyText);
                        }
                    }
                }

                this.inventorySlots.push(container);
                index++;
            }
        }
    }

    // ───────── Settings UI (game speed) ─────────

    private createSettingsUi(): void {
        const speeds: GameSpeed[] = [1, 3, 5];

        const btnWidth = 50;
        const btnHeight = 22;
        const spacing = 8;

        const totalWidth = speeds.length * btnWidth + (speeds.length - 1) * spacing;
        const startX = this.contentX + (this.contentWidth - totalWidth) / 2;
        const y = this.contentY + 40;

        speeds.forEach((speed, index) => {
            const x = startX + index * (btnWidth + spacing);

            const bg = this.scene.add
                .rectangle(x, y, btnWidth, btnHeight, 0x1f2937)
                .setOrigin(0, 0)
                .setDepth(11);

            const label = this.scene.add
                .text(
                    x + btnWidth / 2,
                    y + btnHeight / 2,
                    `${speed}x`,
                    {
                        fontFamily: 'sans-serif',
                        fontSize: '12px',
                        color: '#e5e7eb',
                    }
                )
                .setOrigin(0.5)
                .setDepth(12);

            bg.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, btnWidth, btnHeight),
                Phaser.Geom.Rectangle.Contains
            );

            bg.on('pointerover', () => {
                if (this.currentGameSpeed !== speed) {
                    bg.setFillStyle(0x374151);
                }
            });

            bg.on('pointerout', () => {
                if (this.currentGameSpeed !== speed) {
                    bg.setFillStyle(0x1f2937);
                }
            });

            bg.on('pointerup', () => {
                this.currentGameSpeed = speed;
                this.updateSettingsButtonStyles();
                // Emit global event so systems (like CharacterController) can react
                this.scene.game.events.emit('gameSpeedChanged', speed);
            });

            this.gameSpeedButtons.push({ speed, bg, label });
        });

        this.updateSettingsButtonStyles();
        this.updateSettingsVisibility(false); // hidden unless in Settings tab
    }

    private updateSettingsVisibility(show: boolean): void {
        this.gameSpeedButtons.forEach((btn) => {
            btn.bg.setVisible(show);
            btn.label.setVisible(show);
            if (show) {
                btn.bg.setInteractive(
                    new Phaser.Geom.Rectangle(0, 0, btn.bg.width, btn.bg.height),
                    Phaser.Geom.Rectangle.Contains
                );
            } else {
                btn.bg.disableInteractive();
            }
        });
    }

    private updateSettingsButtonStyles(): void {
        this.gameSpeedButtons.forEach((btn) => {
            if (btn.speed === this.currentGameSpeed) {
                btn.bg.setFillStyle(0x4b5563);
                btn.label.setColor('#facc15');
                btn.label.setFontStyle('bold');
            } else {
                btn.bg.setFillStyle(0x1f2937);
                btn.label.setColor('#e5e7eb');
                btn.label.setFontStyle('normal');
            }
        });
    }

    private renderSettingsPane(): void {
        if (!this.contentText) return;

        // Hide the shared content text (we only want the speed row)
        this.contentText.setVisible(false);

        // Position the row nicely near the top of the content area
        const labelX = this.contentX + 8;
        const labelY = this.contentY + 8;

        // Destroy previous temp UI elements (if any)
        this.clearInspectPane();
        this.clearSkillRows();
        this.clearInventoryGrid();

        // Render: "Game Speed:"
        const label = this.scene.add.text(
            labelX,
            labelY,
            'Game Speed:',
            {
                fontFamily: 'sans-serif',
                fontSize: '13px',
                color: '#e5e7eb',
            }
        ).setDepth(12);

        this.inspectObjects.push(label);

        // Settings UI buttons already exist — just place them properly
        this.layoutSettingsButtons(labelY);

        // Make sure buttons are visible only on this tab
        this.updateSettingsVisibility(true);
    }

    private layoutSettingsButtons(baseY: number): void {
        const btnWidth = 50;
        const btnHeight = 22;
        const spacing = 10;

        const totalWidth = this.gameSpeedButtons.length * btnWidth +
            (this.gameSpeedButtons.length - 1) * spacing;

        const startX = this.contentX + 120; // puts them nicely to the right of label

        this.gameSpeedButtons.forEach((btn, index) => {
            const x = startX + index * (btnWidth + spacing);
            const y = baseY - 2; // slight vertical alignment with text baseline

            btn.bg.setPosition(x, y);
            btn.label.setPosition(x + btnWidth / 2, y + btnHeight / 2);
        });
    }

    setTasks(tasks: UITaskSummary[]): void {
        this.currentTasks = tasks;
        if (this.activeParent === 'character' && this.activeChild === 'tasks') {
            this.refreshContent();
        }
    }
    private clearTaskCards(): void {
        this.taskCards.forEach((c) => c.destroy());
        this.taskCards = [];
    }

    private renderTasksPane(): void {
        if (!this.contentText) return;

        this.clearTaskCards();

        if (!this.selectedCharacter) {
            this.contentText.setVisible(true);
            this.contentText.setText(
                'No character selected\n\n' +
                'Select a character on the left to view their task queue.'
            );
            return;
        }

        if (this.currentTasks.length === 0) {
            this.contentText.setVisible(true);
            this.contentText.setText(
                `${this.selectedCharacter.name}\n\n` +
                'No active tasks.\n\n' +
                'Click on a tree or other objects in the world to queue actions.'
            );
            return;
        }

        this.contentText.setVisible(false);

        const cardWidth = this.contentWidth - 16;
        const cardHeight = 40;
        const spacing = 8;

        let y = this.contentY + 8;

        for (const task of this.currentTasks) {
            const container = this.scene.add.container(this.contentX + 8, y);
            container.setDepth(11);

            const bg = this.scene.add
                .rectangle(0, 0, cardWidth, cardHeight, 0x020617)
                .setOrigin(0, 0)
                .setStrokeStyle(1, 0x1f2937);

            const title = this.scene.add.text(
                8,
                4,
                task.label,
                {
                    fontFamily: 'sans-serif',
                    fontSize: '13px',
                    color: '#e5e7eb',
                }
            );


            const statusText = task.status === 'in_progress' ? 'In progress' : 'Queued';
            const statusColor = task.status === 'in_progress' ? '#22c55e' : '#9ca3af';

            const status = this.scene.add.text(
                cardWidth - 8,
                cardHeight - 6,
                statusText,
                {
                    fontFamily: 'sans-serif',
                    fontSize: '11px',
                    color: statusColor,
                }
            );
            status.setOrigin(1, 1);

            container.add([bg, title, status]);

            this.taskCards.push(container);
            y += cardHeight + spacing;
        }
    }


}

