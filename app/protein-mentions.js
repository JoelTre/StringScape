/* Shared, DOM-independent protein name and compressed-complex recognition. */
(function (root) {
    function create(records) {
        const names = new Map(), families = new Map();
        const namesById = new Map(records.map(record => [record.id, record.name]));
        for (const { id, name } of records) {
            const key = String(name || '').trim().toLowerCase();
            if (!key || key === 'unknown') continue;
            if (!names.has(key)) names.set(key, new Set());
            names.get(key).add(id);
            const match = key.match(/^(.+?)([a-z]|\d+)$/);
            if (match) {
                if (!families.has(match[1])) families.set(match[1], new Map());
                families.get(match[1]).set(match[2], names.get(key));
            }
        }
        const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = [...names.keys()].sort((a,b) => b.length-a.length).map(escape).join('|');
        const direct = pattern ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`, 'giu') : null;
        function resolve(token) {
            const key = token.toLowerCase(), ids = new Set(names.get(key) || []);
            // Compressed names reuse the three-letter family prefix for every suffix.
            // Reject the entire expansion if even one implied subunit is unknown.
            const family = families.get(key.slice(0, 3));
            const suffix = key.slice(3);
            if (family && suffix.length > 1 && /^[a-z]+$/.test(suffix)) {
                const members = [...suffix].map(c => family.get(c));
                if (members.every(Boolean)) members.forEach(group => group.forEach(id => ids.add(id)));
            }
            return ids;
        }
        function find(text) {
            text = String(text || '');
            const candidates = [];
            for (const match of text.matchAll(/[\p{L}\p{N}_]+(?:[-/][\p{L}\p{N}_]+)*/gu)) {
                const ids = resolve(match[0]);
                const parts = match[0].split(/[-/]/);
                const base = parts[0].match(/^(.+?)[a-z]$/i)?.[1];
                parts.forEach((part, index) => {
                    resolve(part).forEach(id => ids.add(id));
                    if (index && base && /^[a-z]$/i.test(part)) resolve(base + part).forEach(id => ids.add(id));
                });
                if (ids.size) candidates.push({ start: match.index, end: match.index + match[0].length, ids: [...ids] });
            }
            if (direct) for (const match of text.matchAll(direct)) candidates.push({start: match.index, end: match.index + match[0].length, ids: [...names.get(match[0].toLowerCase())]});
            candidates.sort((a,b) => a.start-b.start || b.end-a.end);
            const result = [];
            for (const hit of candidates) {
                const previous = result[result.length-1];
                if (previous && hit.start < previous.end) { hit.ids.forEach(id => { if (!previous.ids.includes(id)) previous.ids.push(id); }); continue; }
                result.push(hit);
            }
            return result;
        }
        const outgoing = new Map(records.map(r => [r.id, new Set()]));
        const incoming = new Map(records.map(r => [r.id, new Set()]));
        const complexes = new Map(records.map(r => [r.id, new Set()]));
        for (const record of records) for (const hit of find(record.annotation)) {
            for (const id of hit.ids) if (id !== record.id) { outgoing.get(record.id).add(id); incoming.get(id).add(record.id); }
            if (hit.ids.length > 1) {
                const memberNames = [...new Set(hit.ids.map(id => namesById.get(id)))].sort();
                if (memberNames.length > 1) hit.ids.forEach(id => complexes.get(id).add(memberNames.join(' + ')));
            }
        }
        return { find, outgoing, incoming, complexes };
    }
    if (typeof module === 'object' && module.exports) module.exports = { create };
    else root.ProteinMentions = { create };
})(typeof globalThis === 'object' ? globalThis : this);
