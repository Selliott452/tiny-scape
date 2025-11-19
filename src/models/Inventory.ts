export const INVENTORY_SIZE = 28;

export type ItemKey =
    | 'logs'
    | 'raw_fish'
    | 'cooked_fish'
    | 'ore'
    | 'bar'
    | 'coins';

export interface ItemDefinition {
    key: ItemKey;
    name: string;
    maxStack: number;
}

export const ITEM_DEFINITIONS: Record<ItemKey, ItemDefinition> = {
    logs: {
        key: 'logs',
        name: 'Logs',
        maxStack: 1, // non-stackable
    },
    raw_fish: {
        key: 'raw_fish',
        name: 'Raw Fish',
        maxStack: 1,
    },
    cooked_fish: {
        key: 'cooked_fish',
        name: 'Cooked Fish',
        maxStack: 1,
    },
    ore: {
        key: 'ore',
        name: 'Ore',
        maxStack: 1,
    },
    bar: {
        key: 'bar',
        name: 'Metal Bar',
        maxStack: 1,
    },
    coins: {
        key: 'coins',
        name: 'Coins',
        maxStack: 1_000_000, // stackable example
    },
};

export interface InventorySlot {
    itemKey: ItemKey | null;
    quantity: number;
}

export interface InventoryState {
    slots: InventorySlot[];
}

export function createEmptyInventory(): InventoryState {
    const slots: InventorySlot[] = [];
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        slots.push({ itemKey: null, quantity: 0 });
    }
    return { slots };
}

/**
 * Adds `quantity` of `itemKey` into the inventory, respecting maxStack and free slots.
 * Returns the remainder that could NOT be added (0 if everything fit).
 */
export function addItemToInventory(
    inventory: InventoryState,
    itemKey: ItemKey,
    quantity: number
): number {
    if (quantity <= 0) return 0;
    const def = ITEM_DEFINITIONS[itemKey];
    let remaining = quantity;

    // Fill existing stacks (if stackable)
    if (def.maxStack > 1) {
        for (const slot of inventory.slots) {
            if (remaining <= 0) break;
            if (slot.itemKey !== itemKey) continue;
            const space = def.maxStack - slot.quantity;
            if (space <= 0) continue;
            const add = Math.min(space, remaining);
            slot.quantity += add;
            remaining -= add;
        }
    }

    // Use empty slots
    for (const slot of inventory.slots) {
        if (remaining <= 0) break;
        if (slot.itemKey !== null && slot.quantity > 0) continue;

        const add = def.maxStack > 1 ? Math.min(def.maxStack, remaining) : 1;
        slot.itemKey = itemKey;
        slot.quantity = add;
        remaining -= add;
    }

    return remaining;
}

export function hasCapacityForItem(
    inventory: InventoryState,
    itemKey: ItemKey,
    quantity: number
): boolean {
    if (quantity <= 0) return true;
    const def = ITEM_DEFINITIONS[itemKey];

    // make a shallow copy of slots so we don't mutate real inventory
    const tempSlots = inventory.slots.map((s) => ({
        itemKey: s.itemKey,
        quantity: s.quantity,
    }));

    let remaining = quantity;

    // Fill existing stacks (if stackable)
    if (def.maxStack > 1) {
        for (const slot of tempSlots) {
            if (remaining <= 0) break;
            if (slot.itemKey !== itemKey) continue;
            const space = def.maxStack - slot.quantity;
            if (space <= 0) continue;
            const add = Math.min(space, remaining);
            slot.quantity += add;
            remaining -= add;
        }
    }

    // Use empty slots
    for (const slot of tempSlots) {
        if (remaining <= 0) break;
        if (slot.itemKey !== null && slot.quantity > 0) continue;

        const add = def.maxStack > 1 ? Math.min(def.maxStack, remaining) : 1;
        slot.itemKey = itemKey;
        slot.quantity = add;
        remaining -= add;
    }

    return remaining <= 0;
}

