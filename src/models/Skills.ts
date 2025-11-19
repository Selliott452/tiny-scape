export type SkillKey =
    | 'woodcutting'
    | 'fletching'
    | 'mining'
    | 'smithing'
    | 'fishing'
    | 'cooking';

export interface SkillState {
    level: number;
    xp: number;
}

export type CharacterSkills = Record<SkillKey, SkillState>;

export const ALL_SKILLS: SkillKey[] = [
    'woodcutting',
    'fletching',
    'mining',
    'smithing',
    'fishing',
    'cooking',
];

export const SKILL_LABELS: Record<SkillKey, string> = {
    woodcutting: 'Woodcutting',
    fletching:  'Fletching',
    mining:      'Mining',
    smithing:    'Smithing',
    fishing:     'Fishing',
    cooking:     'Cooking',
};

export function createInitialSkills(): CharacterSkills {
    const skills: Partial<CharacterSkills> = {};
    for (const key of ALL_SKILLS) {
        skills[key] = { level: 1, xp: 0 };
    }
    return skills as CharacterSkills;
}

/**
 * Adds XP to a skill and does a very simple level calculation:
 * every 100 XP = +1 level (starting from level 1).
 */
export function addSkillXp(
    skills: CharacterSkills,
    key: SkillKey,
    amount: number
): void {
    const skill = skills[key];
    if (!skill) return;

    skill.xp += amount;

    const newLevel = Math.max(1, Math.floor(skill.xp / 100) + 1);
    if (newLevel > skill.level) {
        skill.level = newLevel;
    }
}
