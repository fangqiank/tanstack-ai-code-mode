import { wrapCode } from "@tanstack/ai-code-mode";

interface DriverConfig {
  timeout?: number;
}

interface ExecutionContext {
  execute: (
    code: string,
  ) => Promise<{
    success: boolean;
    value?: any;
    error?: { name: string; message: string };
    logs: string[];
  }>;
  dispose: () => Promise<void>;
}

/**
 * Node.js vm 模块驱动的 Code Mode 隔离执行环境
 * 不依赖 WASM，适用于 Vercel serverless 等 Node.js 环境
 */
export function createNodeIsolateDriver(config: DriverConfig = {}) {
  const defaultTimeout = config.timeout ?? 30000;

  return {
    async createContext(isolateConfig: {
      bindings: Record<string, { execute: (args: any) => Promise<any> }>;
      timeout?: number;
    }): Promise<ExecutionContext> {
      const timeout = isolateConfig.timeout ?? defaultTimeout;
      let disposed = false;

      const sandbox: Record<string, any> = {
        console: {
          log: (...args: any[]) => logs.push(args.map(String).join(" ")),
          error: (...args: any[]) => logs.push("ERROR: " + args.map(String).join(" ")),
          warn: (...args: any[]) => logs.push("WARN: " + args.map(String).join(" ")),
          info: (...args: any[]) => logs.push("INFO: " + args.map(String).join(" ")),
        },
        // 提供 JSON 工具
        JSON,
        Math,
        Date,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Map,
        Set,
        Promise,
        Symbol,
        Error,
        TypeError,
        RangeError,
        RegExp,
      };

      // 注册工具绑定为全局异步函数
      for (const [name, binding] of Object.entries(isolateConfig.bindings)) {
        sandbox[name] = async (input: any) => {
          return await binding.execute(input);
        };
      }

      let logs: string[] = [];

      return {
        async execute(code: string) {
          if (disposed) {
            return {
              success: false,
              error: { name: "DisposedError", message: "Context has been disposed" },
              logs: [],
            };
          }

          logs = [];
          const wrappedCode = wrapCode(code);

          try {
            // 动态导入 vm 模块（兼容环境检测）
            const vm = await import("node:vm");
            const context = vm.createContext(sandbox);
            const script = new vm.Script(wrappedCode, {
              filename: "code-mode.ts",
            });

            // 设置超时
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error(`Execution timeout after ${timeout}ms`)),
                timeout
              );
            });

            const resultPromise = script.runInContext(context, { timeout });
            const result = await Promise.race([resultPromise, timeoutPromise]);

            // result 是 wrapCode 返回的 JSON.stringify 结果
            let parsedResult;
            try {
              parsedResult = JSON.parse(result);
            } catch {
              parsedResult = result;
            }

            return {
              success: true,
              value: parsedResult,
              logs: [...logs],
            };
          } catch (error: any) {
            return {
              success: false,
              error: {
                name: error?.name || "Error",
                message: error?.message || String(error),
              },
              logs: [...logs],
            };
          }
        },

        async dispose() {
          disposed = true;
        },
      };
    },
  };
}
