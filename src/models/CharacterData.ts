import type { CharacterSkills } from './Skills';
import type { InventoryState } from './Inventory';

export interface CharacterData {
    id: string;
    name: string;
    color: number;
    tileX: number;
    tileY: number;
    skills: CharacterSkills;
    inventory: InventoryState;
}
