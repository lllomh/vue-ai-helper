import type { App, InjectionKey } from 'vue'
import { generateApi } from './api'
import { ApiError } from './api'
import { getField, listFields, registerField, unregisterField } from './field-registry'
import { generateCrud, generateForm, generateTable } from './runtime'
import {
  createModel,
  evaluateCondition,
  generateRules,
  isFieldDisabled,
  isFieldVisible,
  normalizeSchema
} from './schema'
import type { AiAdapter, AiConfig } from './types'

let adapter: AiAdapter | undefined

export const ai = {
  configure(config: AiConfig) {
    adapter = config.adapter
    for (const [name, definition] of Object.entries(config.fields ?? {})) {
      registerField(name, definition)
    }
  },
  async prompt(prompt: string, context?: Record<string, unknown>) {
    if (!adapter) {
      throw new Error('尚未配置 AI adapter，请先调用 ai.configure({ adapter })。')
    }
    return adapter.generate(prompt, context)
  },
  generateForm,
  generateTable,
  generateCrud,
  generateApi,
  normalizeSchema,
  createModel,
  generateRules,
  registerField,
  unregisterField,
  getField,
  listFields,
  evaluateCondition,
  isFieldVisible,
  isFieldDisabled
}

export type VueAiHelper = typeof ai
export const AI_HELPER_KEY: InjectionKey<VueAiHelper> = Symbol('vue-ai-helper')

export const VueAiHelperPlugin = {
  install(app: App, config: AiConfig = {}) {
    ai.configure(config)
    app.provide(AI_HELPER_KEY, ai)
    app.config.globalProperties.$ai = ai
  }
}

export default VueAiHelperPlugin

export { generateApi, generateCrud, generateForm, generateTable }
export { ApiError }
export { getField, listFields, registerField, unregisterField }
export {
  createModel,
  evaluateCondition,
  generateRules,
  isFieldDisabled,
  isFieldVisible,
  normalizeSchema
}
export type * from './types'

declare module 'vue' {
  interface ComponentCustomProperties {
    $ai: VueAiHelper
  }
}
