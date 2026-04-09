import OpenAI from "openai";
import { BaseTextAdapter } from "@tanstack/ai/adapters";
import type { StreamChunk, TextOptions } from "@tanstack/ai";

/**
 * DeepSeek 文本适配器 - 使用 Chat Completions API（非 Responses API）
 * DeepSeek 兼容 OpenAI Chat Completions 端点但不支持 Responses 端点
 */
export class DeepSeekTextAdapter extends BaseTextAdapter<string, Record<string, any>, readonly ("text")[], any> {
  readonly kind = "text" as const;
  readonly name = "deepseek";
  readonly model: string;
  readonly '~types' = {
    providerOptions: {} as Record<string, any>,
    inputModalities: ['text'] as readonly ("text")[],
    messageMetadataByModality: {} as any,
  };
  private client: OpenAI;

  constructor(config: { apiKey: string; baseURL?: string }, model: string) {
    super(undefined, model);
    this.model = model;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://api.deepseek.com",
    });
  }

  async *chatStream(options: TextOptions): AsyncIterable<StreamChunk> {
    const timestamp = Date.now();
    const runId = this.generateId();
    const messageId = this.generateId();

    // 转换消息格式
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // 系统提示词
    if (options.systemPrompts?.length) {
      messages.push({
        role: "system",
        content: options.systemPrompts.join("\n"),
      });
    }

    // 用户和助手消息
    for (const msg of options.messages) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content as string });
      } else if (msg.role === "assistant") {
        const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: "assistant",
          content: typeof msg.content === "string" ? msg.content : null,
        };
        if (msg.toolCalls?.length) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.function.name,
              arguments:
                typeof tc.function.arguments === "string"
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments),
            },
          }));
        }
        messages.push(assistantMsg);
      } else if (msg.role === "tool") {
        messages.push({
          role: "tool",
          tool_call_id: msg.toolCallId || "",
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
        });
      }
    }

    // 转换工具定义
    const tools = options.tools?.length
      ? options.tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
              ? schemaToJSON(tool.inputSchema)
              : undefined,
          },
        }))
      : undefined;

    // 发起流式请求
    const stream = await this.client.chat.completions.create(
      {
        model: options.model,
        messages,
        tools,
        stream: true,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
      },
      { signal: options.abortController?.signal },
    );

    let accumulatedContent = "";
    let hasEmittedRunStarted = false;
    let hasEmittedTextStart = false;
    let hasEmittedTextEnd = false;

    // 工具调用追踪
    const toolCalls = new Map<
      number,
      { id: string; name: string; args: string; started: boolean }
    >();

    for await (const chunk of stream) {
      // RUN_STARTED
      if (!hasEmittedRunStarted) {
        hasEmittedRunStarted = true;
        yield {
          type: "RUN_STARTED",
          runId,
          model: options.model,
          timestamp,
        } as StreamChunk;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      // 处理文本内容
      const textDelta = choice.delta?.content;
      if (textDelta) {
        if (!hasEmittedTextStart) {
          hasEmittedTextStart = true;
          yield {
            type: "TEXT_MESSAGE_START",
            messageId,
            model: options.model,
            timestamp,
            role: "assistant",
          } as StreamChunk;
        }
        accumulatedContent += textDelta;
        yield {
          type: "TEXT_MESSAGE_CONTENT",
          messageId,
          model: options.model,
          timestamp,
          delta: textDelta,
          content: accumulatedContent,
        } as StreamChunk;
      }

      // 处理工具调用
      const toolCallDeltas = choice.delta?.tool_calls;
      if (toolCallDeltas) {
        for (const tc of toolCallDeltas as OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall[]) {
          const idx = tc.index;
          if (!toolCalls.has(idx)) {
            const id = tc.id || this.generateId();
            const name = tc.function?.name || "";
            toolCalls.set(idx, { id, name, args: "", started: false });
          }

          const entry = toolCalls.get(idx)!;

          // 首次出现：发出 TOOL_CALL_START
          if (!entry.started) {
            entry.started = true;
            entry.id = tc.id || entry.id;
            entry.name = tc.function?.name || entry.name;
            yield {
              type: "TOOL_CALL_START",
              toolCallId: entry.id,
              toolName: entry.name,
              model: options.model,
              timestamp,
            } as StreamChunk;
          }

          // 参数增量
          if (tc.function?.arguments) {
            entry.args += tc.function.arguments;
            yield {
              type: "TOOL_CALL_ARGS",
              toolCallId: entry.id,
              model: options.model,
              timestamp,
              delta: tc.function.arguments,
              args: entry.args,
            } as StreamChunk;
          }
        }
      }

      // 完成处理
      if (choice.finish_reason) {
        // 关闭文本消息
        if (hasEmittedTextStart && !hasEmittedTextEnd) {
          hasEmittedTextEnd = true;
          yield {
            type: "TEXT_MESSAGE_END",
            messageId,
            model: options.model,
            timestamp,
          } as StreamChunk;
        }

        // 关闭工具调用
        for (const [, entry] of toolCalls) {
          yield {
            type: "TOOL_CALL_END",
            toolCallId: entry.id,
            toolName: entry.name,
            model: options.model,
            timestamp,
            input: JSON.parse(entry.args || "{}"),
          } as StreamChunk;
        }

        // RUN_FINISHED
        yield {
          type: "RUN_FINISHED",
          runId,
          model: options.model,
          timestamp,
          finishReason: choice.finish_reason === "tool_calls" ? "tool_calls" : "stop",
        } as StreamChunk;
      }
    }

    // 如果没有 finish_reason 但有文本内容，确保关闭
    if (hasEmittedTextStart && !hasEmittedTextEnd) {
      yield {
        type: "TEXT_MESSAGE_END",
        messageId,
        model: options.model,
        timestamp,
      } as StreamChunk;
    }
  }

  async structuredOutput(_options: any): Promise<any> {
    throw new Error("Structured output is not supported by the DeepSeek adapter");
  }
}

/** 将 schema 对象转为 JSON Schema 格式 */
function schemaToJSON(schema: any): Record<string, any> | undefined {
  if (!schema) return undefined;
  // Zod v4 标准 schema
  if (typeof schema["~standard"]?.jsonSchema?.input === "function") {
    return schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
  }
  // 已经是 JSON Schema 对象
  if (schema.type || schema.properties) return schema;
  return undefined;
}
