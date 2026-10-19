import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePlatformConfig, deriveCapabilities, PLATFORM_CONFIG_VERSION,
} from '../src/platform-config.js';

const DOMAIN = 'chat.example.com';

function makeRaw(overrides = {}) {
  return Object.assign({
    version: PLATFORM_CONFIG_VERSION,
    domain: DOMAIN,
    messageFlow: ['.flow'],
    messageRow: ['.row'],
    inputBox: ['textarea'],
    identity: { mode: 'header', header: ['.head'] },
  }, overrides);
}

test('合法配置通过并保留白名单字段', () => {
  const raw = makeRaw({
    textBubble: ['.bubble', '.bubble', '.bad<>', '.bubble2', '.b3', '.b4', '.b5', '.b6'],
    sendButton: null,
    selfMatch: { kind: 'selector', selector: '.is-self' },
  });
  const config = normalizePlatformConfig(raw, DOMAIN);
  assert.ok(config);
  assert.equal(config.domain, DOMAIN);
  assert.deepEqual(config.textBubble, ['.bubble', '.bubble2', '.b3', '.b4', '.b5']);
  assert.equal(config.sendButton, null);
  assert.deepEqual(config.selfMatch, { kind: 'selector', selector: '.is-self' });
});

test('必填链缺失或为空返回 null', () => {
  assert.equal(normalizePlatformConfig(makeRaw({ messageRow: [] }), DOMAIN), null);
  assert.equal(normalizePlatformConfig(makeRaw({ messageFlow: null }), DOMAIN), null);
  assert.equal(normalizePlatformConfig(makeRaw({ inputBox: undefined }), DOMAIN), null);
});

test('域名不匹配或非法返回 null', () => {
  assert.equal(normalizePlatformConfig(makeRaw(), 'other.example.com'), null);
  assert.equal(normalizePlatformConfig(makeRaw({ domain: 'bad domain!' }), DOMAIN), null);
  assert.equal(normalizePlatformConfig(makeRaw({ domain: '' }), DOMAIN), null);
});

test('版本与根类型非法返回 null', () => {
  assert.equal(normalizePlatformConfig(null, DOMAIN), null);
  assert.equal(normalizePlatformConfig('x', DOMAIN), null);
  assert.equal(normalizePlatformConfig(makeRaw({ version: 99 }), DOMAIN), null);
});

test('identity 模式枚举校验', () => {
  assert.equal(normalizePlatformConfig(makeRaw({ identity: { mode: 'magic' } }), DOMAIN), null);
  assert.equal(normalizePlatformConfig(makeRaw({ identity: null }), DOMAIN), null);
  const url = normalizePlatformConfig(makeRaw({ identity: { mode: 'url' } }), DOMAIN);
  assert.deepEqual(url.identity, { mode: 'url' });
  // sidebar 必须带 entry 链
  assert.equal(normalizePlatformConfig(makeRaw({ identity: { mode: 'sidebar' } }), DOMAIN), null);
  const sidebar = normalizePlatformConfig(makeRaw({
    identity: { mode: 'sidebar', entry: ['.item'], activeMatch: { kind: 'selector', selector: '.on' } },
  }), DOMAIN);
  assert.deepEqual(sidebar.identity.entry, ['.item']);
  assert.deepEqual(sidebar.identity.activeMatch, { kind: 'selector', selector: '.on' });
});

test('selfMatch 的 style 规则限白名单属性', () => {
  const ok = normalizePlatformConfig(makeRaw({
    selfMatch: { kind: 'style', prop: 'justifyContent', value: 'flex-end' },
  }), DOMAIN);
  assert.deepEqual(ok.selfMatch, { kind: 'style', prop: 'justifyContent', value: 'flex-end' });
  assert.equal(normalizePlatformConfig(makeRaw({
    selfMatch: { kind: 'style', prop: 'color', value: 'red' },
  }), DOMAIN).selfMatch, null);
  assert.equal(normalizePlatformConfig(makeRaw({ selfMatch: { kind: 'x' } }), DOMAIN).selfMatch, null);
});

test('选择器字符串合法性：长度与非法字符', () => {
  assert.equal(normalizePlatformConfig(makeRaw({ messageRow: ['a'.repeat(200)] }), DOMAIN), null);
  assert.equal(normalizePlatformConfig(makeRaw({ messageRow: ['div<svg>'] }), DOMAIN), null);
  assert.equal(normalizePlatformConfig(makeRaw({ messageRow: ['   '] }), DOMAIN), null);
});

test('deriveCapabilities 按配置推导能力', () => {
  const caps = deriveCapabilities(makeRaw({
    selfMatch: { kind: 'selector', selector: '.is-self' },
    peerCard: ['.card'],
    identity: { mode: 'url' },
  }));
  assert.deepEqual(caps, { stableIdentity: true, roleDetection: true, peerProfile: true });
  const bare = deriveCapabilities(makeRaw());
  assert.deepEqual(bare, { stableIdentity: false, roleDetection: false, peerProfile: false });
  assert.deepEqual(deriveCapabilities(null), { stableIdentity: false, roleDetection: false, peerProfile: false });
});
