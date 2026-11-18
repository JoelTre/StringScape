// Group unaligned stretches, then merge overlapping or spatially close stretches.
(function (root) {
    function buildGroups(chains, padding, distance) {
        const groups = [], membership = new Map();
        for (const chain of chains) {
            const nodes = chain.nodes;
            for (let i = 0; i < nodes.length;) {
                if (nodes[i].aligned) { i++; continue; }
                const start = i;
                while (i < nodes.length && !nodes[i].aligned) i++;
                const group = { members: nodes.slice(Math.max(0, start - padding), Math.min(nodes.length, i + padding)), unaligned: nodes.slice(start, i) };
                groups.push(group);
            }
        }
        const parent = groups.map((_, i) => i);
        const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
        const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
        groups.forEach((group, i) => group.members.forEach(node => {
            if (membership.has(node)) union(i, membership.get(node)); else membership.set(node, i);
        }));
        if (distance > 0) {
            const grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
            groups.forEach((group, i) => group.unaligned.forEach(node => {
                const p = node.point;
                if (![p.x, p.y, p.z].every(Number.isFinite)) return;
                const x = Math.floor(p.x / distance), y = Math.floor(p.y / distance), z = Math.floor(p.z / distance);
                for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
                    for (const other of grid.get(key(x + dx, y + dy, z + dz)) || []) {
                        if (Math.hypot(p.x - other.p.x, p.y - other.p.y, p.z - other.p.z) <= distance) union(i, other.i);
                    }
                }
                const k = key(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push({p, i});
            }));
        }
        const merged = new Map();
        groups.forEach((group, i) => {
            const id = find(i); if (!merged.has(id)) merged.set(id, new Set());
            group.members.forEach(node => merged.get(id).add(node));
        });
        return [...merged.values()].map(nodes => [...nodes]);
    }
    const api = { buildGroups };
    if (typeof window !== 'undefined') root.ChunkAlignment = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
