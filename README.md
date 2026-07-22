# @lllomh/vue-ai-helper

用一份 Schema 生成 Vue 3 + Element Plus 的表单、表格、CRUD 页面、API 客户端和校验规则。生成结果同时包含：

- 可立即渲染的 Vue 组件 `component`
- 可保存为 `.vue` 文件的 SFC 源码 `code`
- 标准化字段、响应式表单模型和校验规则
- 可选的 AI Adapter，可接入任意大模型服务

## 安装

```bash
npm install @lllomh/vue-ai-helper vue element-plus
```

在入口安装 Element Plus。`@lllomh/vue-ai-helper` 生成的运行时组件会使用全局注册的 Element Plus 组件：

```ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import VueAiHelper from '@lllomh/vue-ai-helper'
import App from './App.vue'

createApp(App).use(ElementPlus).use(VueAiHelper).mount('#app')
```

## 30 秒生成表单

```vue
<script setup lang="ts">
import { ai } from '@lllomh/vue-ai-helper'

const userSchema = {
  name: { type: 'string', label: '姓名', required: true },
  age: { type: 'number', label: '年龄', min: 1, max: 120 },
  role: { type: 'select', label: '角色', enum: ['管理员', '成员'] },
  enabled: { type: 'boolean', label: '启用', default: true },
  birthday: { type: 'date', label: '生日' }
} as const

const form = ai.generateForm({
  schema: userSchema,
  async onSubmit(value) {
    console.log('submit:', value)
  }
})

// 完整的 <el-form> 单文件组件源码，可复制或写入文件
console.log(form.code)
</script>

<template>
  <component :is="form.component" @submit="console.log" />
</template>
```

最短写法同样支持：

```ts
const form = ai.generateForm({
  schema: {
    name: 'string',
    age: 'number'
  }
})
```

## 标准 JSON Schema

```ts
const schema = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string', title: '姓名', minLength: 2 },
    email: { type: 'string', title: '邮箱', pattern: '^.+@.+$' },
    status: { type: 'string', title: '状态', enum: ['active', 'disabled'] }
  }
} as const

const form = ai.generateForm({ schema })
```

## 生成 Table

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ai } from '@lllomh/vue-ai-helper'

const rows = ref([
  { name: 'Ada', age: 28 },
  { name: 'Linus', age: 32 }
])

const table = ai.generateTable({
  schema: { name: 'string', age: 'number' },
  data: rows
})
</script>

<template>
  <component :is="table.component" />
</template>
```

也可以在渲染时传数据：

```vue
<component :is="table.component" :data="filteredRows" />
```

## 生成 API 客户端

```ts
const usersApi = ai.generateApi<User>({
  baseURL: 'https://api.example.com',
  resource: '/users',
  headers: { Authorization: `Bearer ${token}` },
  timeout: 10_000,
  retries: 2,
  // 如果后端返回自定义分页格式，可在这里适配
  transformPage: (payload: any) => ({
    items: payload.data.rows,
    total: payload.data.total
  })
})

await usersApi.client.list({ page: 1 })
await usersApi.client.listPage?.({ page: 1, pageSize: 20 })
await usersApi.client.get(1)
await usersApi.client.create({ name: 'Ada' })
await usersApi.client.update(1, { name: 'Grace' })
await usersApi.client.remove(1)

console.log(usersApi.code) // 无依赖的 fetch API 源码
```

## 一行生成 CRUD 页面

```vue
<script setup lang="ts">
import { ai } from '@lllomh/vue-ai-helper'

const crud = ai.generateCrud({
  title: '用户管理',
  rowKey: 'id',
  pagination: 'server',
  pageSize: 20,
  schema: {
    id: { type: 'number', label: 'ID', form: false },
    name: { type: 'string', label: '姓名', required: true, searchable: true },
    age: { type: 'number', label: '年龄', min: 1, max: 120 },
    role: { type: 'select', label: '角色', enum: ['admin', 'member'], searchable: true },
    enabled: { type: 'boolean', label: '启用' }
  },
  api: {
    baseURL: '/api',
    resource: '/users',
    transformPage: (payload: any) => ({
      items: payload.data.rows,
      total: payload.data.total
    })
  },
  permissions: {
    create: true,
    edit: (row) => row?.locked !== true,
    remove: (row) => row?.system !== true,
    batchRemove: true
  },
  beforeSave: async (data, mode) => ({ ...data, source: mode })
})
</script>

<template>
  <component :is="crud.component" />
</template>
```

CRUD 组件包含：

- 搜索与重置（字段设置 `searchable: true`）
- 客户端或服务端分页
- 服务端排序与本地排序
- 新增、编辑、详情和删除
- 多选与批量删除
- 按操作或按行判断权限
- Element Plus 删除确认、成功消息和错误消息
- 保存前数据转换与操作回调
- 保存或删除后的自动刷新

若项目已经有请求层，也可以直接传入自己的客户端。服务端分页模式建议实现 `listPage`：

```ts
const crud = ai.generateCrud({
  schema,
  api: {
    list: () => http.get('/users'),
    listPage: async (params) => {
      const result = await http.get('/users', { params })
      return { items: result.data.rows, total: result.data.total }
    },
    get: (id) => http.get(`/users/${id}`),
    create: (data) => http.post('/users', data),
    update: (id, data) => http.put(`/users/${id}`, data),
    remove: (id) => http.delete(`/users/${id}`)
  }
})
```

## 表单联动与异步选项

条件可以使用对象匹配，也可以使用函数。`dependsOn` 用来限制监听字段，避免无关字段变化时重复请求：

```ts
const form = ai.generateForm({
  schema: {
    accountType: {
      type: 'select',
      label: '账号类型',
      enum: ['personal', 'business']
    },
    company: {
      type: 'string',
      label: '企业名称',
      dependsOn: ['accountType'],
      visibleWhen: { accountType: 'business' },
      clearOnHide: true
    },
    province: {
      type: 'select',
      label: '省份',
      options: provinceOptions
    },
    city: {
      type: 'select',
      label: '城市',
      dependsOn: ['province'],
      disabledWhen: (model) => !model.province,
      loadOptions: async (model) => fetchCities(String(model.province))
    },
    slug: {
      type: 'string',
      label: '标识',
      readonly: true,
      dependsOn: ['company'],
      compute: (model) => String(model.company ?? '').toLowerCase()
    }
  }
})
```

支持异步自定义校验：

```ts
{
  username: {
    type: 'string',
    validate: async (value) => {
      const exists = await checkUsername(String(value))
      return exists ? '用户名已经存在' : undefined
    }
  }
}
```

## 注册业务字段组件

注册后 Schema 只保存稳定的组件名称，适合用户选择器、部门树、上传组件和富文本编辑器：

```ts
import UserSelect from './UserSelect.vue'
import { ai } from '@lllomh/vue-ai-helper'

ai.registerField('user-select', {
  component: UserSelect,
  defaultValue: () => [],
  optionsProp: 'users',
  getProps: ({ field }) => ({
    multiple: field.type === 'array'
  })
})

const form = ai.generateForm({
  schema: {
    owners: {
      type: 'array',
      label: '负责人',
      component: 'user-select'
    }
  }
})
```

也可以在安装插件时集中注册：

```ts
app.use(VueAiHelper, {
  fields: {
    'user-select': { component: UserSelect }
  }
})
```

## 字段配置

| 配置 | 说明 |
| --- | --- |
| `type` | `string`、`text`、`number`、`integer`、`boolean`、`date`、`datetime`、`select`、`array` |
| `label` / `title` | 中文标签 |
| `required` | 必填校验 |
| `min` / `max` | 数值范围或文本长度 |
| `pattern` | 正则校验字符串 |
| `enum` / `options` | 下拉选项 |
| `default` | 默认值 |
| `hidden` | 表格和表单都隐藏 |
| `form: false` | 仅不出现在表单 |
| `table: false` | 仅不出现在表格 |
| `readonly` | 表单控件禁用 |
| `component` | 自定义全局组件名 |
| `props` | 透传给表单控件的属性 |
| `searchable` | 在 CRUD 搜索区域显示 |
| `dependsOn` | 当前字段依赖的字段名 |
| `visibleWhen` | 条件显示，对象匹配或判断函数 |
| `disabledWhen` | 条件禁用，对象匹配或判断函数 |
| `clearOnHide` | 字段隐藏时恢复默认值 |
| `loadOptions` | 根据当前模型异步加载选项 |
| `compute` | 根据依赖字段计算当前值 |
| `validate` | 同步或异步自定义校验 |

运行时支持函数型联动，但函数无法写入 JSON/SFC。生成结果的 `warnings` 会列出需要手动补回生成文件的函数：

```ts
const result = ai.generateForm({ schema })
console.log(result.warnings)
```

## 接入真正的 AI

核心 Schema 生成器不依赖网络，结果稳定、可测试。需要让大模型根据自然语言生成业务代码时，注入自己的 Adapter，密钥只保留在服务端：

```ts
ai.configure({
  adapter: {
    async generate(prompt, context) {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context })
      })
      return (await response.json()).code
    }
  }
})

const code = await ai.prompt('生成一个带搜索条件的用户管理页', { schema })
```

不要把模型服务的 API Key 写进浏览器代码中。

## 开发

```bash
npm install
npm run typecheck
npm test
npm run build
```

## 发布新版本

仓库使用 GitHub Actions 和 npm Trusted Publishing 自动发布，不需要在 GitHub 中保存长期 npm token。

普通 `git push` 只会触发 CI，不会发布 npm。只有推送与 `package.json` 版本一致的 `v*` 标签才会触发发布。

```bash
# 1. 确保功能代码已经提交并推送，工作区必须干净
git status
git push origin main

# 2. 选择 patch、minor 或 major；命令会修改版本、创建提交和 Git tag
npm run release:patch

# 3. 由你亲自推送版本提交和标签，触发 GitHub Actions 发布
git push --follow-tags
```

版本选择：

- 修复问题：`npm run release:patch`，例如 `0.1.0 → 0.1.1`
- 向后兼容的新功能：`npm run release:minor`，例如 `0.1.0 → 0.2.0`
- 不兼容升级：`npm run release:major`，例如 `0.1.0 → 1.0.0`

发布标签必须与 `package.json` 中的版本一致，例如 `0.2.0` 对应 `v0.2.0`。同一个 npm 版本不能重复发布。发布进度可在 [GitHub Actions](https://github.com/lllomh/vue-ai-helper/actions) 查看。

## License

MIT
