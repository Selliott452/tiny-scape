import type { CharacterData } from './CharacterData';

export type InspectTarget =
    | { type: 'none' }
    | { type: 'character'; character: CharacterData }
    | {
    type: 'interactable';
    id: string;
    kind: string;   // e.g. 'tree'
    name: string;   // display name like "Tree"
};
