import type { Model } from './api';

/** 手机端固定可选模型；不跟随桌面端的完整模型目录展示。 */
export const PHONE_DEFAULT_MODEL = 'ark-code-latest';

const phoneModelCatalog: Model[] = [
  { id: 'ark-code-latest', name: 'ark-code-latest', provider: 'Ark Code' },
  { id: 'agnes-2.5-flash', name: 'agnes-2.5-flash', provider: 'Agnes' },
  { id: 'poolside/laguna-s-2.1:free', name: 'poolside/laguna-s-2.1:free', provider: 'OpenRouter' },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    provider: 'OpenRouter',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'nvidia/nemotron-3.5-lightning:free',
    provider: 'OpenRouter',
  },
];

const phoneModelIds = new Set(phoneModelCatalog.map((model) => model.id));

/** 保留桌面端返回的展示信息；尚未列出的 OpenRouter 模型使用固定信息补全。 */
export function filterPhoneModels(models: Model[]): Model[] {
  const modelsById = new Map(models.map((model) => [model.id, model]));
  return phoneModelCatalog.map((model) => modelsById.get(model.id) ?? model);
}

/** 旧版本保存的模型不在白名单中时，安全回退到手机端默认模型。 */
export function resolvePhoneModel(value: string | null | undefined): string {
  return value && phoneModelIds.has(value) ? value : PHONE_DEFAULT_MODEL;
}
