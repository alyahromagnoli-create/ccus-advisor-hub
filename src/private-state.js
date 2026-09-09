export const PRIVATE_STATE_SCHEMA_VERSION = 1;
export const PRIVATE_STATE_STORAGE_KEY = 'ccus-private-state';
export const PRIVATE_STATUSES = ['未处理', '已收藏', '待联系', '已联系', '不考虑'];

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isValidDate = (value) => typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

export function createPrivateRecord(values = {}) {
  return {
    favorite: values.favorite === true,
    contact_status: PRIVATE_STATUSES.includes(values.contact_status) ? values.contact_status : '未处理',
    note: typeof values.note === 'string' ? values.note : '',
    updated_at: isValidDate(values.updated_at) ? values.updated_at : new Date().toISOString(),
  };
}

export function validatePrivateRecord(value) {
  return isPlainObject(value)
    && typeof value.favorite === 'boolean'
    && PRIVATE_STATUSES.includes(value.contact_status)
    && typeof value.note === 'string'
    && isValidDate(value.updated_at);
}

export function validatePrivateState(value) {
  if (!isPlainObject(value) || value.schema_version !== PRIVATE_STATE_SCHEMA_VERSION || !isPlainObject(value.advisors)) return false;
  return Object.entries(value.advisors).every(([id, record]) => id.trim() && validatePrivateRecord(record));
}

export function serializePrivateState(advisors = {}) {
  const records = isPlainObject(advisors) ? advisors : {};
  const normalized = Object.fromEntries(Object.entries(records).map(([id, record]) => [id, createPrivateRecord(record)]));
  const envelope = { schema_version: PRIVATE_STATE_SCHEMA_VERSION, advisors: normalized };
  if (!validatePrivateState(envelope)) throw new Error('私密状态格式无效');
  return envelope;
}

export function writePrivateState(storage, key, advisors) {
  try {
    storage.setItem(key, JSON.stringify(serializePrivateState(advisors)));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function parsePrivateState(input) {
  let value;
  try { value = typeof input === 'string' ? JSON.parse(input) : input; } catch { throw new Error('私密备份不是有效 JSON'); }
  if (!validatePrivateState(value)) throw new Error('私密备份格式或版本不受支持');
  return value.advisors;
}
