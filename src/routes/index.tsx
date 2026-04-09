import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react';
import {
  Code,
  Zap,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Terminal,
  ArrowRight
} from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

// 提取聊天面板为独立组件，通过 key={mode} 强制重新挂载
function ChatPanel({ mode }: { mode: 'traditional' | 'codemode' }) {
  const [input, setInput] = useState('');

  const connection = useMemo(
    () =>
      fetchServerSentEvents('/api/chat', () => ({
        body: { useCodeMode: mode === 'codemode' },
      })),
    [mode],
  );

  const { messages, sendMessage, isLoading, error } = useChat({
    connection,
    onCustomEvent: (eventType, data) => {
      console.log('Code Mode Event:', eventType, data);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage({ content: input });
      setInput('');
    }
  };

  const examples = [
    '找出销量最高的5款产品，并计算它们的平均评分',
    '统计所有产品的总销量和平均价格',
    '哪款产品的评分最高？它的销量如何？',
  ];

  return (
    <>
      {/* 示例查询 */}
      <div className="mb-6">
        <p className="text-sm text-slate-500 mb-3">试试这些查询：</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example, i) => (
            <button
              key={i}
              onClick={() => {
                setInput(example);
                sendMessage({ content: example });
              }}
              className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* 聊天区域 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* 消息列表 */}
        <div className="h-[500px] overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl mb-4">
                <Terminal className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">开始探索 Code Mode</h3>
              <p className="text-slate-500 max-w-md">
                在 Code Mode 下，AI 会编写 TypeScript 程序来高效处理你的请求，
                使用并行调用和精确计算。
              </p>
            </div>
          ) : (
            messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {message.parts?.map((part, i) => {
                    if (part.type === 'text') {
                      return <p key={i} className="whitespace-pre-wrap">{part.content}</p>;
                    }
                    if (part.type === 'tool-call') {
                      return (
                        <div key={i} className="text-sm opacity-80 flex items-center gap-2 mt-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          调用工具: {part.name}
                        </div>
                      );
                    }
                    if (part.type === 'tool-result') {
                      return (
                        <div key={i} className="text-sm opacity-80 flex items-center gap-2 mt-1">
                          {part.state === 'error' ? (
                            <AlertCircle className="w-3 h-3 text-red-500" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          )}
                          工具完成: {part.toolCallId}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))
          )}
          {error && (
            <div className="flex justify-start">
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-1 -mt-0.5" />
                {error.message}
              </div>
            </div>
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <form onSubmit={handleSubmit} className="border-t border-slate-200 dark:border-slate-800 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的问题..."
              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              发送
            </button>
          </div>
        </form>
      </div>

      {/* Code Mode 生成的代码 */}
      {mode === 'codemode' && (() => {
        let generatedCode = '';
        for (const msg of messages) {
          for (const part of msg.parts || []) {
            if (
              part.type === 'tool-call' &&
              part.name === 'execute_typescript' &&
              part.arguments
            ) {
              try {
                const args = JSON.parse(part.arguments);
                if (args.typescriptCode) generatedCode = args.typescriptCode;
              } catch {}
            }
          }
        }
        if (!generatedCode) return null;
        return (
          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold">AI 生成的 Code Mode 代码</h3>
            </div>
            <div className="p-3 bg-slate-900 text-slate-300 rounded-lg font-mono text-xs overflow-x-auto max-h-100 overflow-y-auto">
              <pre>{generatedCode}</pre>
            </div>
          </div>
        );
      })()}

      {/* 技术说明（无代码时显示） */}
      {mode === 'codemode' && !messages.some(msg =>
        (msg.parts || []).some(
          (p: any) => p.type === 'tool-call' && p.name === 'execute_typescript'
        )
      ) && (
        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold">Code Mode 工作原理</h3>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              在 <strong>Code Mode</strong> 下，AI 会编写 TypeScript 程序来协调工具调用，而不是逐一调用工具。
              这个程序在安全的 <strong>QuickJS 沙箱</strong> 中执行，利用 JavaScript 运行时进行精确计算。
            </p>
            <p className="mt-2 text-xs text-slate-400">
              发送一个问题后，AI 生成的代码会显示在这里。
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function HomePage() {
  const [mode, setMode] = useState<'traditional' | 'codemode'>('codemode');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Code className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  TanStack AI Code Mode Demo
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  让 AI 写代码，而不是调用工具
                </p>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setMode('traditional')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'traditional'
                    ? 'bg-white dark:bg-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  传统模式
                </div>
              </button>
              <button
                onClick={() => setMode('codemode')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'codemode'
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Code Mode
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 对比说明卡片 */}
        <div className="mb-8 grid md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border-2 transition-all ${
            mode === 'traditional'
              ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20'
              : 'border-slate-200 bg-slate-50 dark:bg-slate-800/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold">传统工具调用</h3>
            </div>
            <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
              <li>• 每个工具调用一次往返</li>
              <li>• 上下文窗口膨胀</li>
              <li>• LLM 不擅长数学计算</li>
              <li>• N+1 问题难以避免</li>
            </ul>
          </div>

          <div className={`p-4 rounded-xl border-2 transition-all ${
            mode === 'codemode'
              ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/20'
              : 'border-slate-200 bg-slate-50 dark:bg-slate-800/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold">Code Mode</h3>
            </div>
            <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
              <li>• 一次调用，批量处理</li>
              <li>• 上下文高效利用</li>
              <li>• JavaScript 运行时精确计算</li>
              <li>• 自动并行化，消除 N+1</li>
            </ul>
          </div>
        </div>

        {/* key={mode} 强制切换模式时重新挂载整个 ChatPanel */}
        <ChatPanel key={mode} mode={mode} />
      </main>
    </div>
  );
}