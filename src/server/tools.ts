import {toolDefinition} from "@tanstack/ai";
import {z} from "zod";

// 模拟产品数据
const products = [
  {
    id: "1",
    name: "AI 编程助手",
    category: "software",
    price: 29.99,
    sales: 1234,
    rating: 4.5,
  },
  {
    id: "2",
    name: "机械键盘",
    category: "hardware",
    price: 199.99,
    sales: 567,
    rating: 4.8,
  },
  {
    id: "3",
    name: "4K 显示器",
    category: "hardware",
    price: 399.99,
    sales: 890,
    rating: 4.6,
  },
  {
    id: "4",
    name: "无线鼠标",
    category: "hardware",
    price: 49.99,
    sales: 2345,
    rating: 4.3,
  },
  {
    id: "5",
    name: "TypeScript 教程",
    category: "book",
    price: 39.99,
    sales: 4567,
    rating: 4.9,
  },
];

// 工具1: 获取热门产品
export const getTopProducts = toolDefinition({
  name: "get_top_products",
  description: "获取销量最高的产品列表",
  inputSchema: z.object({
    limit: z.number().default(5).describe("返回的产品数量"),
    category: z.string().optional().describe("可选的品类筛选"),
  }),
  outputSchema: z.object({
    products: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        sales: z.number(),
        price: z.number(),
        category: z.string(),
      }),
    ),
  }),
}).server(async (args) => {
  const {limit, category} = args as {limit: number; category?: string};
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 100));

  let filtered = [...products];
  if (category) {
    filtered = filtered.filter((p) => p.category === category);
  }

  const sorted = filtered.sort((a, b) => b.sales - a.sales);
  return {products: sorted.slice(0, limit)};
});

// 工具2: 获取产品评分
export const getProductRatings = toolDefinition({
  name: "get_product_ratings",
  description: "获取指定产品的详细评分信息",
  inputSchema: z.object({
    productId: z.string().describe("产品 ID"),
  }),
  outputSchema: z.object({
    productId: z.string(),
    ratings: z.array(
      z.object({
        score: z.number(),
        comment: z.string().optional(),
      }),
    ),
  }),
}).server(async (args) => {
  const {productId} = args as {productId: string};
  await new Promise((resolve) => setTimeout(resolve, 80));

  const product = products.find((p) => p.id === productId);
  if (!product) {
    throw new Error("Product not found");
  }

  // 模拟评分数据
  const ratings = Array.from({length: (product.sales % 10) + 3}, () => ({
    score: product.rating + (Math.random() - 0.5) * 0.6,
  }));

  return {productId, ratings};
});

// 工具3: 计算统计数据
export const calculateStats = toolDefinition({
  name: "calculate_stats",
  description: "计算产品数据的统计信息",
  inputSchema: z.object({
    values: z.array(z.number()),
    operation: z.enum(["sum", "average", "min", "max"]),
  }),
  outputSchema: z.object({
    result: z.number(),
    operation: z.string(),
  }),
}).server(async (args) => {
  const {values, operation} = args as {values: number[]; operation: string};
  if (values.length === 0) {
    return {result: 0, operation};
  }

  let result: number;
  switch (operation) {
    case "sum":
      result = values.reduce((a: number, b: number) => a + b, 0);
      break;
    case "average":
      result = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      break;
    case "min":
      result = Math.min(...values);
      break;
    case "max":
      result = Math.max(...values);
      break;
    default:
      result = 0;
  }

  return {result, operation};
});
