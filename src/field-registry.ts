import type { FieldComponentDefinition } from './types'

const registry = new Map<string, FieldComponentDefinition>()

export function registerField(name: string, definition: FieldComponentDefinition): void {
  const key = name.trim()
  if (!key) throw new Error('字段组件名称不能为空。')
  if (!definition.component && !definition.render) {
    throw new Error(`字段组件 ${key} 必须提供 component 或 render。`)
  }
  registry.set(key, definition)
}

export function unregisterField(name: string): boolean {
  return registry.delete(name)
}

export function getField(name: string): FieldComponentDefinition | undefined {
  return registry.get(name)
}

export function listFields(): string[] {
  return [...registry.keys()]
}
