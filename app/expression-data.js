/* Data handling shared by experimental-expression importers. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.StringScapeExpressionData = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';

    function parseDelimited(text) {
        const input = String(text ?? '').replace(/^\uFEFF/, '');
        const first = input.split(/\r?\n/, 1)[0];
        const delimiter = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
        const rows = [];
        let row = [], field = '', quoted = false;
        for (let i = 0; i < input.length; i++) {
            const ch = input[i];
            if (quoted) {
                if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
                else if (ch === '"') quoted = false;
                else field += ch;
            } else if (ch === '"' && field === '') quoted = true;
            else if (ch === delimiter) { row.push(field); field = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && input[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.some(value => value.trim())) rows.push(row);
                row = [];
            } else field += ch;
        }
        if (quoted) throw new Error('The file contains an unterminated quoted field.');
        if (field || row.length) { row.push(field); if (row.some(value => value.trim())) rows.push(row); }
        if (rows.length < 2 || rows[0].length < 2) throw new Error('Expected an identifier column and at least one measurement column.');
        const headers = rows[0].map(value => value.trim());
        if (headers.some(value => !value) || new Set(headers).size !== headers.length) throw new Error('Column names must be non-empty and unique.');
        if (rows.slice(1).some(value => value.length !== headers.length)) throw new Error('Rows must have the same number of columns as the header.');
        const measurements = headers.slice(1).map(name => ({ id: name, label: name, sample: name }));
        const records = rows.slice(1).map((values, index) => {
            const id = values[0].trim();
            if (!id) throw new Error(`Missing identifier on row ${index + 2}.`);
            return { id, values: values.slice(1).map(value => {
                const clean = value.trim();
                if (!clean || /^(?:NA|N\/A|null|nan)$/i.test(clean)) return null;
                const number = Number(clean);
                if (!Number.isFinite(number)) throw new Error(`Invalid numeric value on row ${index + 2}.`);
                return number;
            }) };
        });
        return { identifierLabel: headers[0], measurements, records };
    }

    // Only unique aliases are resolved. Repeated records for the same node and
    // measurement are ambiguous and are omitted rather than silently averaged.
    function mapRecords(dataset, nodes) {
        const aliases = new Map();
        for (const node of nodes) {
            for (const alias of new Set([node.id, ...(node.aliases || [])].filter(Boolean).map(String))) {
                if (!aliases.has(alias)) aliases.set(alias, new Set());
                aliases.get(alias).add(node.id);
            }
        }
        const mapped = new Map(), ambiguous = [], unmatched = [];
        for (const record of dataset.records) {
            const matches = aliases.get(record.id);
            if (!matches || !matches.size) { unmatched.push(record.id); continue; }
            if (matches.size !== 1) { ambiguous.push(record.id); continue; }
            const nodeId = matches.values().next().value;
            if (!mapped.has(nodeId)) mapped.set(nodeId, []);
            mapped.get(nodeId).push(record);
        }
        const values = new Map();
        for (const [nodeId, records] of mapped) {
            if (records.length !== 1) { ambiguous.push(...records.map(record => record.id)); continue; }
            values.set(nodeId, records[0].values);
        }
        return { values, report: { total: dataset.records.length, matched: [...values.values()].length, unmatched, ambiguous } };
    }

    function selectedValue(values, measurements, selection = {}) {
        const matches = measurements.map((measurement, index) => ({ measurement, index })).filter(({ measurement }) =>
            ['condition', 'time', 'sample'].every(key => !selection[key] || selection[key] === measurement[key]));
        const numbers = matches.map(({ index }) => values[index]).filter(Number.isFinite);
        if (!numbers.length) return null;
        if (numbers.length > 1 && selection.aggregate !== 'mean') return null;
        return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }
    return { parseDelimited, mapRecords, selectedValue };
});
