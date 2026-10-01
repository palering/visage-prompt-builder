import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, exportWorkbench, importWorkbench, randomizeWorkbench } from '../src/workbench/state.mjs';
import {
  WORKSPACE_VERSION, MAX_CHARACTERS, MAX_VERSIONS, createWorkspace, validateWorkspace,
  addCharacter, renameCharacter, updateDraft, saveVersion, activateCharacter, restoreVersion
} from '../src/workbench/workspace.mjs';

const copy = value => structuredClone(value);
const selected = workspace => workspace.characters.find(character => character.id === workspace.activeId);
function edited(value = 75) {
  const state = createDefaultState();
  state.profile.face_geometry.face_width = value;
  return state;
}
function frozen(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}

test('workspace begins with one independent unsaved draft and roundtrips through JSON', () => {
  const state = createDefaultState();
  const workspace = createWorkspace(state);
  assert.equal(workspace.version, WORKSPACE_VERSION);
  assert.equal(workspace.characters.length, 1);
  assert.equal(selected(workspace).name, '角色 01');
  assert.deepEqual(selected(workspace).draft, state);
  assert.deepEqual(selected(workspace).versions, []);
  assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(workspace))), workspace);
  state.profile.face_geometry.face_width = 80;
  assert.equal(selected(workspace).draft.profile.face_geometry.face_width, 50);
  assert.deepEqual(createWorkspace(), createWorkspace(createDefaultState()));
});

test('adding and switching characters preserves independent unsaved drafts', () => {
  const first = frozen(createWorkspace());
  const state = edited();
  const added = addCharacter(first, state, '  林  ');
  assert.notEqual(added.activeId, first.activeId);
  assert.equal(selected(added).name, '林');
  assert.deepEqual(selected(added).versions, []);
  assert.deepEqual(selected(added).draft, state);
  state.profile.face_geometry.face_width = 20;
  assert.equal(selected(added).draft.profile.face_geometry.face_width, 75);
  const updated = updateDraft(frozen(added), first.activeId, edited(60));
  assert.equal(updated.activeId, added.activeId);
  assert.equal(selected(updated).draft.profile.face_geometry.face_width, 75);
  const switched = activateCharacter(frozen(updated), first.activeId);
  assert.equal(selected(switched).draft.profile.face_geometry.face_width, 60);
  assert.equal(selected(first).draft.profile.face_geometry.face_width, 50);
  assert.equal(addCharacter(first, edited()).characters[1].name, '角色 02');
});

test('rename changes only the requested name and accepts 80 characters', () => {
  const workspace = frozen(addCharacter(createWorkspace(), edited(), '第二个'));
  const renamed = renameCharacter(workspace, workspace.characters[0].id, '  新名字  ');
  assert.equal(renamed.characters[0].name, '新名字');
  assert.equal(renamed.activeId, workspace.activeId);
  assert.deepEqual(renamed.characters[1], workspace.characters[1]);
  assert.equal(renameCharacter(workspace, workspace.activeId, '字'.repeat(80)).characters[1].name.length, 80);
  for (const name of ['', '  ', null, 3, '字'.repeat(81)]) {
    assert.throws(() => renameCharacter(workspace, workspace.activeId, name));
    assert.throws(() => addCharacter(workspace, edited(), name));
  }
});

test('save appends snapshots labeled v01 onward, updates the draft, and leaves selection alone', () => {
  const base = createWorkspace();
  const workspace = frozen(addCharacter(base, edited(), '第二个'));
  const state = edited(90);
  const once = saveVersion(workspace, base.activeId, state);
  const character = once.characters[0];
  assert.equal(once.activeId, workspace.activeId);
  assert.equal(character.versions.length, 1);
  assert.equal(character.versions[0].label, 'v01');
  assert.equal(new Date(character.versions[0].createdAt).toISOString(), character.versions[0].createdAt);
  assert.deepEqual(character.versions[0].state, state);
  assert.deepEqual(character.draft, state);
  state.profile.face_geometry.face_width = 1;
  character.draft.profile.face_geometry.face_width = 2;
  assert.equal(character.versions[0].state.profile.face_geometry.face_width, 90);
  const twice = saveVersion(frozen(once), base.activeId, edited(60));
  assert.equal(twice.characters[0].versions[1].label, 'v02');
  assert.notEqual(twice.characters[0].versions[0].id, twice.characters[0].versions[1].id);
  assert.equal(twice.characters[0].versions[0].state.profile.face_geometry.face_width, 90);
  assert.equal(once.characters[0].versions.length, 1);
});

test('restore activates the selected character and copies its saved state without deleting history', () => {
  let workspace = createWorkspace();
  const id = workspace.activeId;
  workspace = saveVersion(workspace, id, edited(80));
  const versionId = selected(workspace).versions[0].id;
  workspace = saveVersion(workspace, id, edited(30));
  workspace = addCharacter(workspace, edited(10));
  const snapshot = copy(workspace);
  const restored = restoreVersion(workspace, id, versionId);
  assert.equal(restored.activeId, id);
  assert.equal(selected(restored).draft.profile.face_geometry.face_width, 80);
  assert.deepEqual(selected(restored).versions, workspace.characters[0].versions);
  selected(restored).draft.profile.face_geometry.face_width = 50;
  assert.equal(selected(restored).versions[0].state.profile.face_geometry.face_width, 80);
  assert.deepEqual(workspace, snapshot);
});

test('character and version limits reject overflow without losing prior work', () => {
  let workspace = createWorkspace();
  for (let index = 1; index < MAX_CHARACTERS; index += 1) workspace = addCharacter(workspace, edited());
  assert.equal(workspace.characters.length, 30);
  assert.throws(() => addCharacter(workspace, edited()), /30/);
  for (let index = 0; index < MAX_VERSIONS; index += 1) workspace = saveVersion(workspace, workspace.activeId, edited(index));
  assert.equal(selected(workspace).versions.length, 30);
  assert.equal(selected(workspace).versions.at(-1).label, 'v30');
  const snapshot = JSON.stringify(workspace);
  assert.throws(() => saveVersion(workspace, workspace.activeId, edited()), /30/);
  assert.equal(JSON.stringify(workspace), snapshot);
  const excessCharacters = copy(workspace);
  excessCharacters.characters.push({ ...copy(excessCharacters.characters[0]), id: 'excess' });
  assert.throws(() => validateWorkspace(excessCharacters));
  const excessVersions = copy(workspace);
  selected(excessVersions).versions.push({ ...copy(selected(excessVersions).versions[0]), id: 'excess', label: 'v31' });
  assert.throws(() => validateWorkspace(excessVersions));
});

test('validation rejects malformed structure, fields, IDs, labels, dates and active selection', () => {
  const base = saveVersion(createWorkspace(), 'character-1', edited());
  for (const invalid of [null, [], {}, { ...base, version: 'unknown' }, { ...base, characters: [] }, { ...base, activeId: 'missing' }, { ...base, extra: true }]) {
    assert.throws(() => validateWorkspace(invalid));
  }
  const changes = [
    state => { delete state.activeId; },
    state => { state.characters[0].name = ''; },
    state => { state.characters[0].versions = {}; },
    state => { state.characters[0].id = 'bad id'; },
    state => { state.characters[0].id = 'constructor'; },
    state => { state.characters[0].referenceImage = 'runtime-only'; },
    state => { delete state.characters[0].draft; },
    state => { state.characters[0].versions[0].extra = true; },
    state => { state.characters[0].versions[0].label = 'v02'; },
    state => { state.characters[0].versions[0].createdAt = 'yesterday'; },
    state => { state.characters[0].versions[0].createdAt = '2026-02-30T00:00:00.000Z'; },
    state => { delete state.characters[0].versions[0].state; }
  ];
  for (const change of changes) {
    const invalid = copy(base);
    change(invalid);
    assert.throws(() => validateWorkspace(invalid));
  }
});

test('all IDs are unique across characters and version history, including imported workspaces', () => {
  let workspace = createWorkspace();
  workspace = saveVersion(workspace, workspace.activeId, edited());
  workspace = addCharacter(workspace, edited());
  workspace = saveVersion(workspace, workspace.activeId, edited());
  validateWorkspace(workspace);
  for (const change of [
    state => { state.characters[1].id = state.characters[0].id; },
    state => { state.characters[1].versions[0].id = state.characters[0].versions[0].id; },
    state => { state.characters[1].versions[0].id = state.characters[0].id; }
  ]) {
    const invalid = copy(workspace);
    change(invalid);
    assert.throws(() => validateWorkspace(invalid), /重复/);
  }
  workspace.characters[0].versions[0].id = 'character-3';
  assert.equal(addCharacter(workspace, edited()).activeId, 'character-4');
});

test('every mutation validates the whole input and rejects invalid states atomically', () => {
  const workspace = frozen(saveVersion(createWorkspace(), 'character-1', edited()));
  const snapshot = JSON.stringify(workspace);
  const bad = edited(101);
  for (const operation of [
    () => createWorkspace(bad),
    () => addCharacter(workspace, bad),
    () => updateDraft(workspace, workspace.activeId, bad),
    () => saveVersion(workspace, workspace.activeId, bad),
    () => activateCharacter(workspace, 'missing'),
    () => renameCharacter(workspace, 'missing', 'name'),
    () => updateDraft(workspace, 'missing', edited()),
    () => saveVersion(workspace, 'missing', edited()),
    () => restoreVersion(workspace, 'missing', 'version-1'),
    () => restoreVersion(workspace, workspace.activeId, 'missing')
  ]) assert.throws(operation);
  assert.equal(JSON.stringify(workspace), snapshot);
  const invalid = copy(workspace);
  invalid.characters[0].versions[0].state.profile.subject.age_group = 'child';
  for (const operation of [
    () => validateWorkspace(invalid),
    () => addCharacter(invalid, edited()),
    () => renameCharacter(invalid, invalid.activeId, 'name'),
    () => updateDraft(invalid, invalid.activeId, edited()),
    () => saveVersion(invalid, invalid.activeId, edited()),
    () => activateCharacter(invalid, invalid.activeId),
    () => restoreVersion(invalid, invalid.activeId, 'version-1')
  ]) assert.throws(operation);
});

test('workspace rejects unsafe metadata, non-JSON data and getters', () => {
  const values = [
    JSON.parse('{"__proto__":{"polluted":true}}'),
    JSON.parse('{"constructor":{}}'),
    JSON.parse('{"prototype":{}}'),
    { unsupported: undefined }, { unsupported: NaN }, { unsupported: Infinity },
    { unsupported: 1n }, { unsupported: () => true }, new Date(), new Uint8Array([1]),
    Object.create({ inherited: true }), { sparse: new Array(2) }
  ];
  let getterCalls = 0;
  values.push(Object.defineProperty({}, 'value', { enumerable: true, get() { getterCalls += 1; return 'bad'; } }));
  values.push(Object.defineProperty({}, 'hidden', { value: 'bad' }));
  values.push({ [Symbol('hidden')]: 'bad' });
  const cycle = {}; cycle.self = cycle; values.push(cycle);
  for (const metadata of values) {
    const state = createDefaultState();
    state.profile.metadata = metadata;
    assert.throws(() => createWorkspace(state));
    const workspace = createWorkspace();
    workspace.characters[0].draft.profile.metadata = metadata;
    assert.throws(() => validateWorkspace(workspace));
  }
  assert.equal(getterCalls, 0);
  assert.equal({}.polluted, undefined);
});

test('canonical authored identity text and metadata preserve blob: and data:image/ prefixes exactly', () => {
  for (const text of ['blob: a creative label', 'data:image/ a creative label', '  blob: with spacing  ', 'data:image/png;base64,AAAA']) {
    const state = createDefaultState();
    state.profile.face_geometry.face_shape = text;
    state.profile.subject.appearance = text;
    state.profile.metadata = { userText: text, nested: [text] };
    const canonical = exportWorkbench(state);
    assert.deepEqual(importWorkbench(canonical), state);
    let workspace = createWorkspace(state);
    workspace = addCharacter(workspace, state);
    workspace = updateDraft(workspace, workspace.activeId, state);
    workspace = saveVersion(workspace, workspace.activeId, state);
    workspace = restoreVersion(workspace, workspace.activeId, selected(workspace).versions[0].id);
    const roundtrip = validateWorkspace(JSON.parse(JSON.stringify(workspace)));
    assert.deepEqual(selected(roundtrip).draft, state);
    assert.deepEqual(selected(roundtrip).versions[0].state, state);
    assert.equal(exportWorkbench(selected(roundtrip).draft), canonical);
  }
});

test('persisted reference-image fields are rejected by workspace structure rather than text content', () => {
  const base = saveVersion(createWorkspace(), 'character-1', edited());
  for (const field of ['referenceImage', 'referenceImages', 'image', 'imageData', 'previewUrl']) {
    for (const target of ['workspace', 'character', 'version']) {
      const invalid = copy(base);
      const object = target === 'workspace' ? invalid : target === 'character' ? invalid.characters[0] : invalid.characters[0].versions[0];
      object[field] = 'blob:https://example.test/reference';
      assert.throws(() => validateWorkspace(invalid), /未知字段/);
    }
  }
});

test('workspace keeps the canonical workbench export separate and preserves sampler provenance', () => {
  const state = randomizeWorkbench(createDefaultState(), 'workspace-test');
  const workspace = saveVersion(createWorkspace(state), 'character-1', state);
  const restored = restoreVersion(workspace, workspace.activeId, selected(workspace).versions[0].id);
  const draft = selected(restored).draft;
  assert.deepEqual(draft, state);
  const canonical = exportWorkbench(draft);
  assert.equal(JSON.parse(canonical).version, 'workbench-v0.2');
  assert.equal(Object.hasOwn(JSON.parse(canonical), 'characters'), false);
  assert.deepEqual(importWorkbench(canonical), importWorkbench(exportWorkbench(state)));
  assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(restored))), restored);
});
