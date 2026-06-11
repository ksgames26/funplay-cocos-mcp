'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  broadcastEditorMessage,
  getEditorPreference,
  setEditorPreference,
  tryEditorRequests,
  tryEditorRequestsStatus,
} = require('../lib/tools/cocos-project');

test('tryEditorRequests returns the first successful editor message candidate', async () => {
  const calls = [];
  global.Editor = {
    Message: {
      request: async (channel, method, payload) => {
        calls.push({ channel, method, payload });
        if (method === 'bad') {
          throw new Error('nope');
        }
        return { ok: true };
      },
    },
  };

  try {
    const result = await tryEditorRequests([
      { channel: 'scene', method: 'bad' },
      { channel: 'scene', method: 'save-scene', args: [{ force: true }] },
    ]);

    assert.equal(result.ok, true);
    assert.equal(result.method, 'save-scene');
    assert.equal(calls.length, 2);
  } finally {
    delete global.Editor;
  }
});

test('tryEditorRequestsStatus returns an unavailable payload instead of throwing', async () => {
  global.Editor = {
    Message: {
      request: async () => {
        throw new Error('missing');
      },
    },
  };

  try {
    const result = await tryEditorRequestsStatus([{ channel: 'builder', method: 'query-build-status' }]);
    assert.equal(result.ok, false);
    assert.equal(result.available, false);
    assert.equal(result.attempts.length, 1);
  } finally {
    delete global.Editor;
  }
});

test('preference helpers and broadcast use available Editor APIs', () => {
  const sent = [];
  const store = new Map();
  global.Editor = {
    Message: {
      send(channel, message, payload) {
        sent.push({ channel, message, payload });
      },
    },
    Profile: {
      getProject(key) {
        return store.get(key);
      },
      setProject(key, value) {
        store.set(key, value);
      },
    },
  };

  try {
    setEditorPreference('project', 'preview.port', 7456);
    assert.equal(getEditorPreference('project', 'preview.port'), 7456);

    const result = broadcastEditorMessage({ channel: 'scene', message: 'custom-event', payload: { ok: true } });
    assert.equal(result.sent, true);
    assert.deepEqual(sent[0], { channel: 'scene', message: 'custom-event', payload: { ok: true } });
  } finally {
    delete global.Editor;
  }
});
