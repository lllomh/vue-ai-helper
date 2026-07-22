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
  // 如果后端返回 { data: { rows: [] } }，可在这里适配
  transformList: (payload: any) => payload.data.rows
})

await usersApi.client.list({ page: 1 })
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
  schema: {
    id: { type: 'number', label: 'ID', form: false },
    name: { type: 'string', label: '姓名', required: true },
    age: { type: 'number', label: '年龄', min: 1, max: 120 },
    role: { type: 'select', label: '角色', enum: ['admin', 'member'] },
    enabled: { type: 'boolean', label: '启用' }
  },
  api: {
    baseURL: '/api',
    resource: '/users'
  }
})
</script>

<template>
  <component :is="crud.component" />
</template>
```

CRUD 组件已包含加载、分页、新增、编辑、删除、弹窗表单和保存后的自动刷新。若项目已经有请求层，也可以直接传入自己的客户端：

```ts
const crud = ai.generateCrud({
  schema,
  api: {
    list: () => http.get('/users'),
    get: (id) => http.get(`/users/${id}`),
    create: (data) => http.post('/users', data),
    update: (id, data) => http.put(`/users/${id}`, data),
    remove: (id) => http.delete(`/users/${id}`)
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

```bash
# 选择 patch、minor 或 major，并自动创建 Git tag
npm run release:patch

# 推送提交和 v* 标签后，GitHub Actions 会完成检查、构建和 npm 发布
git push --follow-tags
```

发布标签必须与 `package.json` 中的版本一致。例如 `0.1.1` 对应 `v0.1.1`。同一个 npm 版本不能重复发布。

## License

MIT
