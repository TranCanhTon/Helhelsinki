export function quarterNumber(value) {
  const match = /^(\d{4})Q([1-4])\*?$/.exec(value);
  return match ? Number(match[1]) * 4 + Number(match[2]) - 1 : null;
}
export function quarterChange(previous, current, periods) {
  return Number.isFinite(previous) &&
    previous > 0 &&
    Number.isFinite(current) &&
    quarterNumber(periods[0]) !== null &&
    quarterNumber(periods[1]) === quarterNumber(periods[0]) + 1
    ? (current / previous - 1) * 100
    : null;
}
export function decodeJsonStat(data) {
  if (data.class !== 'dataset' || !Array.isArray(data.id) || data.id.length !== data.size.length)
    throw new Error('Invalid JSON-stat dataset');
  const categories = data.id.map((id, i) => {
    const index = data.dimension[id].category.index;
    const ordered = Array.isArray(index) ? index : Object.keys(index).sort((a, b) => index[a] - index[b]);
    if (ordered.length !== data.size[i]) throw new Error('Dimension size mismatch: ' + id);
    return ordered;
  });
  const result = [];
  const count = data.size.reduce((a, b) => a * b, 1);
  for (let offset = 0; offset < count; offset++) {
    let rest = offset;
    const keys = {};
    for (let i = data.id.length - 1; i >= 0; i--) {
      keys[data.id[i]] = categories[i][rest % data.size[i]];
      rest = Math.floor(rest / data.size[i]);
    }
    const value = data.value[offset];
    const status = typeof data.status === 'string' ? data.status : data.status?.[offset];
    result.push({
      keys,
      value:
        typeof value === 'number' && Number.isFinite(value) && !['..', '...', '.', 'c'].includes(status) ? value : null,
    });
  }
  return result;
}
// JSON Schema subset used by our checked-in schema.
export function validateSchema(value, schema, path = '$') {
  if (schema.anyOf) {
    if (
      !schema.anyOf.some(s => {
        try {
          validateSchema(value, s, path);
          return true;
        } catch {
          return false;
        }
      })
    )
      throw new Error(path + ' has invalid type');
    return;
  }
  const valid = {
    object: () => value !== null && typeof value === 'object' && !Array.isArray(value),
    array: () => Array.isArray(value),
    string: () => typeof value === 'string',
    number: () => typeof value === 'number' && Number.isFinite(value),
    integer: () => Number.isInteger(value),
    boolean: () => typeof value === 'boolean',
    null: () => value === null,
  };
  if (schema.type && !valid[schema.type]?.()) throw new Error(path + ' must be ' + schema.type);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(path + ' is not allowed');
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw new Error(path + ' has invalid format');
  if (schema.type === 'object') {
    for (const k of schema.required ?? []) if (!(k in value)) throw new Error(path + '.' + k + ' is required');
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) validateSchema(v, schema.properties[k], path + '.' + k);
      else if (schema.additionalProperties === false) throw new Error(path + '.' + k + ' is unexpected');
    }
  }
  if (schema.type === 'array') {
    if (
      (schema.minItems != null && value.length < schema.minItems) ||
      (schema.maxItems != null && value.length > schema.maxItems)
    )
      throw new Error(path + ' wrong length');
    if (schema.items) value.forEach((v, i) => validateSchema(v, schema.items, path + '[' + i + ']'));
  }
}
