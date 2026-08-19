import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHONE_DEFAULT_MODEL, filterPhoneModels, resolvePhoneModel } from './phone-models.ts';

const wanted = [
  'ark-code-latest',
  'agnes-2.5-flash',
  'poolside/laguna-s-2.1:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
];

test('filterPhoneModels 只按规定顺序返回五个手机端模型', () => {
  const models = filterPhoneModels([
    { id: 'random-model', name: 'Random', provider: 'Other' },
    { id: 'agnes-2.5-flash', name: 'Agnes', provider: 'Agnes' },
    { id: 'ark-code-latest', name: 'Ark Code', provider: 'Ark' },
  ]);
  assert.deepEqual(models.map((m) => m.id), wanted);
  assert.equal(models[0].name, 'Ark Code', '已配置模型沿用 Hermes 返回的显示名称');
  assert.equal(models[2].provider, 'OpenRouter', '未列在 Bridge 配置的 OpenRouter 模型仍应可供选择');
});

test('resolvePhoneModel 将未知旧偏好回退为 ark-code-latest', () => {
  assert.equal(PHONE_DEFAULT_MODEL, 'ark-code-latest');
  assert.equal(resolvePhoneModel(null), 'ark-code-latest');
  assert.equal(resolvePhoneModel('legacy-model'), 'ark-code-latest');
  assert.equal(resolvePhoneModel('agnes-2.5-flash'), 'agnes-2.5-flash');
});
