import {createFileRoute} from "@tanstack/react-router";
import {chat, toServerSentEventsResponse} from "@tanstack/ai";
import {createCodeMode} from "@tanstack/ai-code-mode";
import {createNodeIsolateDriver} from "../../server/node-isolate-driver";
import {DeepSeekTextAdapter} from "../../server/deepseek-adapter";
import {
  getTopProducts,
  getProductRatings,
  calculateStats,
} from "../../server/tools";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({request}: {request: Request}) => {
        const abortController = new AbortController();

        try {
          const {messages, useCodeMode = true} = await request.json();
          console.log("[/api/chat] useCodeMode:", useCodeMode, "tools:", useCodeMode ? "codeMode" : "traditional");

          // 创建 Code Mode 实例
          const {tool: codeModeTool, systemPrompt: codeModePrompt} =
            createCodeMode({
              driver: createNodeIsolateDriver(),
              tools: [getTopProducts, getProductRatings, calculateStats],
              timeout: 30000,
            });

          // 配置 LLM 适配器（DeepSeek Chat Completions API）
          const adapter = new DeepSeekTextAdapter(
            {
              apiKey: process.env.DEEPSEEK_API_KEY!,
              baseURL: "https://api.deepseek.com",
            },
            process.env.DEEPSEEK_MODEL || "deepseek-chat",
          );

          // 构建系统提示词
          const systemPrompts = [
            "你是一个数据分析助手，可以帮助用户分析产品数据。",
            useCodeMode
              ? codeModePrompt
              : "请使用可用的工具逐一响应用户请求。",
          ];

          // 创建聊天流
          const stream = await chat({
            adapter,
            messages,
            systemPrompts,
            tools: useCodeMode
              ? [codeModeTool]
              : [getTopProducts, getProductRatings, calculateStats],
            abortController,
          });

          return toServerSentEventsResponse(stream, {abortController});
        } catch (error: any) {
          if (error.name === "AbortError" || abortController.signal.aborted) {
            return new Response(null, {status: 499});
          }
          return new Response(
            JSON.stringify({error: "处理聊天请求失败"}),
            {status: 500, headers: {"Content-Type": "application/json"}},
          );
        }
      },
    },
  },
});
