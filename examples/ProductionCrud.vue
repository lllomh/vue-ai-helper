<script setup lang="ts">
import { ai, type ApiClient, type PaginatedResult, type QueryParams } from '../src'

interface User extends Record<string, unknown> {
  id: number
  name: string
  role: string
  enabled: boolean
  locked?: boolean
}

let users: User[] = [
  { id: 1, name: 'Ada', role: 'admin', enabled: true, locked: true },
  { id: 2, name: 'Linus', role: 'member', enabled: true }
]

const api: ApiClient<User> = {
  async list() {
    return users
  },
  async listPage(params: QueryParams = {}): Promise<PaginatedResult<User>> {
    const keyword = String(params.name ?? '').toLowerCase()
    const filtered = users.filter((user) => user.name.toLowerCase().includes(keyword))
    const page = Number(params.page ?? 1)
    const pageSize = Number(params.pageSize ?? 20)
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length
    }
  },
  async get(id) {
    return users.find((user) => user.id === Number(id))!
  },
  async create(data) {
    const user = { id: Date.now(), ...data } as User
    users = [...users, user]
    return user
  },
  async update(id, data) {
    const index = users.findIndex((user) => user.id === Number(id))
    users[index] = { ...users[index], ...data }
    return users[index]
  },
  async remove(id) {
    users = users.filter((user) => user.id !== Number(id))
  }
}

const crud = ai.generateCrud<User>({
  title: '用户管理',
  rowKey: 'id',
  pagination: 'server',
  pageSize: 20,
  schema: {
    id: { type: 'number', label: 'ID', form: false },
    name: { type: 'string', label: '姓名', required: true, searchable: true },
    role: { type: 'select', label: '角色', enum: ['admin', 'member'], searchable: true },
    enabled: { type: 'boolean', label: '启用' }
  },
  api,
  permissions: {
    edit: (row) => row?.locked !== true,
    remove: (row) => row?.locked !== true
  }
})
</script>

<template>
  <component :is="crud.component" />
</template>
