import { WORLD_TILES_X, WORLD_TILES_Y } from './WorldConfig';
import type { TileCoord } from './WorldTypes';

export class Pathfinder {
    private walkable: boolean[][];

    constructor(walkable: boolean[][]) {
        this.walkable = walkable;
    }
    findPath(start: TileCoord, goal: TileCoord): TileCoord[] {
        const inBounds = (x: number, y: number) =>
            x >= 0 && x < WORLD_TILES_X && y >= 0 && y < WORLD_TILES_Y;

        const key = (x: number, y: number) => `${x},${y}`;

        type Node = {
            x: number;
            y: number;
            g: number;
            h: number;
            f: number;
            parent?: Node;
        };

        const open = new Map<string, Node>();
        const closed = new Set<string>();

        const startNode: Node = {
            x: start.x,
            y: start.y,
            g: 0,
            h: Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y),
            f: 0,
        };
        startNode.f = startNode.g + startNode.h;

        open.set(key(startNode.x, startNode.y), startNode);

        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ];

        while (open.size > 0) {
            let current: Node | null = null;
            for (const node of open.values()) {
                if (!current || node.f < current.f) {
                    current = node;
                }
            }
            if (!current) break;

            const currentKey = key(current.x, current.y);

            if (current.x === goal.x && current.y === goal.y) {
                const path: TileCoord[] = [];
                let node: Node | undefined = current;
                while (node) {
                    path.push({ x: node.x, y: node.y });
                    node = node.parent;
                }
                path.reverse();
                return path;
            }

            open.delete(currentKey);
            closed.add(currentKey);

            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;

                if (!inBounds(nx, ny)) continue;

                const neighborKey = key(nx, ny);
                if (closed.has(neighborKey)) continue;

                if (!this.walkable[ny][nx]) continue;

                const tentativeG = current.g + 1;

                let neighbor = open.get(neighborKey);
                if (!neighbor) {
                    neighbor = {
                        x: nx,
                        y: ny,
                        g: tentativeG,
                        h: Math.abs(nx - goal.x) + Math.abs(ny - goal.y),
                        f: 0,
                        parent: current,
                    };
                    neighbor.f = neighbor.g + neighbor.h;
                    open.set(neighborKey, neighbor);
                } else if (tentativeG < neighbor.g) {
                    neighbor.g = tentativeG;
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = current;
                }
            }
        }

        return [];
    }
}
