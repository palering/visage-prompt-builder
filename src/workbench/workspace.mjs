import { createDefaultState, validateWorkbench } from './state.mjs';

export const WORKSPACE_VERSION = 'visage-workspace-v0.1';
export const MAX_CHARACTERS = 30;
export const MAX_VERSIONS = 30;

const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

// Validate before cloning: JSON serialization must not silently drop values or
// execute a getter/toJSON hook supplied by an imported object. Reference-image
// fields are excluded by exactFields; canonical authored text stays untouched.
function validateJson(value, ancestors = new Set(), depth = 0) {
  if (depth > 100) throw new Error('工作区数据层级过深');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || (!Array.isArray(value) && !isObject(value))) throw new Error('工作区必须仅包含 JSON 数据');
  if (ancestors.has(value)) throw new Error('工作区不可包含循环引用');
  ancestors.add(value);
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value) && keys.length !== value.length + 1) throw new Error('工作区数组不可缺项或包含额外字段');
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string' || unsafeKeys.has(key)) throw new Error('不安全的工作区字段');
    if (Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) throw new Error('工作区数组包含额外字段');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new Error('工作区必须仅包含 JSON 数据');
    validateJson(descriptor.value, ancestors, depth + 1);
  }
  ancestors.delete(value);
}

function exactFields(value, fields, label) {
  if (!isObject(value)) throw new Error(`${label}必须是对象`);
  for (const key of Object.keys(value)) if (!fields.includes(key)) throw new Error(`${label}未知字段：${key}`);
  for (const key of fields) if (!Object.hasOwn(value, key)) throw new Error(`${label}缺少字段：${key}`);
}

function validateId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id) || unsafeKeys.has(id)) throw new Error('无效的工作区 ID');
}

function validateName(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new Error('角色名称须为 1–80 字符');
}

function validateState(state) {
  validateJson(state);
  validateWorkbench(state);
}

/** Validate the entire persisted document atomically, without changing it. */
export function validateWorkspace(raw) {
  validateJson(raw);
  exactFields(raw, ['version', 'activeId', 'characters'], '工作区');
  if (raw.version !== WORKSPACE_VERSION) throw new Error('不支持的工作区版本');
  if (!Array.isArray(raw.characters) || !raw.characters.length || raw.characters.length > MAX_CHARACTERS) throw new Error('工作区须包含 1–30 个角色');
  validateId(raw.activeId);
  const ids = new Set();
  const register = id => {
    validateId(id);
    if (ids.has(id)) throw new Error('工作区 ID 不可重复');
    ids.add(id);
  };
  for (const character of raw.characters) {
    exactFields(character, ['id', 'name', 'draft', 'versions'], '角色');
    register(character.id);
    validateName(character.name);
    validateWorkbench(character.draft);
    if (!Array.isArray(character.versions) || character.versions.length > MAX_VERSIONS) throw new Error('每个角色最多保存 30 个版本');
    for (const [index, version] of character.versions.entries()) {
      exactFields(version, ['id', 'label', 'state', 'createdAt'], '版本');
      register(version.id);
      if (version.label !== `v${String(index + 1).padStart(2, '0')}`) throw new Error('版本标签须按 v01 起连续编号');
      if (typeof version.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(version.createdAt)
        || !Number.isFinite(Date.parse(version.createdAt)) || new Date(version.createdAt).toISOString() !== version.createdAt) throw new Error('无效的版本保存时间');
      validateWorkbench(version.state);
    }
  }
  if (!raw.characters.some(character => character.id === raw.activeId)) throw new Error('当前角色不存在');
  return raw;
}

const clone = value => structuredClone(value);

function nextId(workspace, prefix) {
  const ids = new Set(workspace.characters.flatMap(character => [character.id, ...character.versions.map(version => version.id)]));
  let number = 1;
  while (ids.has(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

function getCharacter(workspace, id) {
  validateId(id);
  const character = workspace.characters.find(entry => entry.id === id);
  if (!character) throw new Error('角色不存在');
  return character;
}

/** A new workspace starts with one unsaved character and no version history. */
export function createWorkspace(initialState = createDefaultState()) {
  validateState(initialState);
  return { version: WORKSPACE_VERSION, activeId: 'character-1', characters: [
    { id: 'character-1', name: '角色 01', draft: clone(initialState), versions: [] }
  ] };
}

/** Add and activate a character. The source state is copied, not shared. */
export function addCharacter(workspace, state, name) {
  validateWorkspace(workspace);
  validateState(state);
  if (workspace.characters.length >= MAX_CHARACTERS) throw new Error('工作区最多保存 30 个角色');
  const selectedName = name === undefined ? `角色 ${String(workspace.characters.length + 1).padStart(2, '0')}` : name;
  validateName(selectedName);
  const next = clone(workspace);
  const id = nextId(next, 'character');
  next.characters.push({ id, name: selectedName.trim(), draft: clone(state), versions: [] });
  next.activeId = id;
  return next;
}

export function renameCharacter(workspace, id, name) {
  validateWorkspace(workspace);
  getCharacter(workspace, id);
  validateName(name);
  const next = clone(workspace);
  getCharacter(next, id).name = name.trim();
  return next;
}

/** Replace a draft without touching its immutable saved versions or selection. */
export function updateDraft(workspace, id, state) {
  validateWorkspace(workspace);
  getCharacter(workspace, id);
  validateState(state);
  const next = clone(workspace);
  getCharacter(next, id).draft = clone(state);
  return next;
}

/** Save a snapshot and synchronize its draft; saving never changes selection. */
export function saveVersion(workspace, id, state) {
  validateWorkspace(workspace);
  const character = getCharacter(workspace, id);
  validateState(state);
  if (character.versions.length >= MAX_VERSIONS) throw new Error('每个角色最多保存 30 个版本');
  const next = clone(workspace);
  const target = getCharacter(next, id);
  const label = `v${String(target.versions.length + 1).padStart(2, '0')}`;
  target.draft = clone(state);
  target.versions.push({ id: nextId(next, 'version'), label, state: clone(state), createdAt: new Date().toISOString() });
  return next;
}

export function activateCharacter(workspace, id) {
  validateWorkspace(workspace);
  getCharacter(workspace, id);
  const next = clone(workspace);
  next.activeId = id;
  return next;
}

/** Restore into the draft and activate its character, preserving all history. */
export function restoreVersion(workspace, id, versionId) {
  validateWorkspace(workspace);
  const character = getCharacter(workspace, id);
  validateId(versionId);
  const version = character.versions.find(entry => entry.id === versionId);
  if (!version) throw new Error('保存的版本不存在');
  const next = clone(workspace);
  getCharacter(next, id).draft = clone(version.state);
  next.activeId = id;
  return next;
}
