/**
 * Settings Schema
 * 使用 TypeBox 定義 API 請求/回應的驗證規則
 */

import { Type as t } from '@sinclair/typebox'

/**
 * Agent Definition Schema
 */
const AgentDefinitionSchema = t.Object({
    description: t.String({ minLength: 1 }),
    prompt: t.String({ minLength: 1 }),
    tools: t.Optional(t.Array(t.String())),
    model: t.Optional(t.Union([
        t.Literal('sonnet'),
        t.Literal('opus'),
        t.Literal('haiku')
    ])),
    disallowedTools: t.Optional(t.Array(t.String()))
})

/**
 * MCP Server Config Schema
 */
const McpServerConfigSchema = t.Object({
    type: t.Optional(t.Union([t.Literal('stdio'), t.Literal('sse')])),
    command: t.Optional(t.String()),
    args: t.Optional(t.Array(t.String())),
    env: t.Optional(t.Record(t.String(), t.String())),
    url: t.Optional(t.String()),
    headers: t.Optional(t.Record(t.String(), t.String()))
})

/**
 * Setting Source Schema
 */
const SettingSourceSchema = t.Union([
    t.Literal('user'),
    t.Literal('project'),
    t.Literal('local')
])

/**
 * 建立工作空間設定的請求 Schema
 */
export const CreateSettingsSchema = t.Object({
    workspacePath: t.String({
        minLength: 1,
        description: 'Workspace path (absolute or relative)'
    }),
    systemPrompt: t.Optional(t.String()),
    allowedTools: t.Optional(t.Array(t.String())),
    disallowedTools: t.Optional(t.Array(t.String())),
    agents: t.Optional(t.Record(t.String(), AgentDefinitionSchema)),
    mcpServers: t.Optional(t.Record(t.String(), McpServerConfigSchema)),
    hooks: t.Optional(t.Record(t.String(), t.Any())),
    settingSources: t.Optional(t.Array(SettingSourceSchema))
})

/**
 * 更新工作空間設定的請求 Schema
 */
export const UpdateSettingsSchema = t.Object({
    systemPrompt: t.Optional(t.String()),
    allowedTools: t.Optional(t.Array(t.String())),
    disallowedTools: t.Optional(t.Array(t.String())),
    agents: t.Optional(t.Record(t.String(), AgentDefinitionSchema)),
    mcpServers: t.Optional(t.Record(t.String(), McpServerConfigSchema)),
    hooks: t.Optional(t.Record(t.String(), t.Any())),
    settingSources: t.Optional(t.Array(SettingSourceSchema))
})

/**
 * Workspace Path 參數 Schema
 */
export const WorkspacePathParamSchema = t.Object({
    path: t.String({ minLength: 1 })
})
