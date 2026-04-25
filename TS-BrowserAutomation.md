# TypeScript for Data Engineers: Chrome Extension & Web Crawler

> **受眾定位**：你已經是 Senior Python Data Engineer，熟悉 Pydantic、asyncio、type hints。  
> 本文完全跳過 CSS / React / UI 細節，專注於「資料管道工程」在 TypeScript + 瀏覽器環境的對應實踐。

---

## 心智模型對應表（Python → TypeScript）

| Python 概念 | TypeScript 對應 | 備註 |
|---|---|---|
| `Pydantic BaseModel` | `Zod schema` | 執行時驗證 |
| `dataclass` / `TypedDict` | `interface` / `type` | 編譯期型別，執行時消失 |
| `Optional[str]` | `string \| null` | — |
| `asyncio.gather()` | `Promise.allSettled()` | 並行任務 |
| `requests.get()` | `fetch()` | 內建於瀏覽器 |
| `Literal["a", "b"]` | `"a" \| "b"` | 字面值聯合型別 |
| `Union[A, B]` | `A \| B` | — |
| `TypeVar` | `<T>` 泛型 | — |
| `Protocol` | `interface`（結構型別） | 鴨子定型相同概念 |
| `match` (3.10+) | `switch` / 型別判別聯合 | — |

---

## 目錄

1. [Data Schema & Validation](#1-data-schema--validation)
2. [Type-Safe Messaging](#2-type-safe-messaging)
3. [Defensive Scraping Concept](#3-defensive-scraping-concept)
4. [Asynchronous & Networking](#4-asynchronous--networking)
5. [Advanced Patterns for Crawlers](#5-advanced-patterns-for-crawlers)
6. [Build & Tooling](#6-build--tooling)

---

## 1. Data Schema & Validation

### 1.1 問題背景

TypeScript 的型別系統是**編譯期（compile-time）**的，編譯後全部抹除。這意味著：

```ts
// ⚠️ 這不是執行時驗證，只是給編譯器看的
const data = JSON.parse(response) as ScrapedProduct
data.price  // 你以為是 number，實際上可能是 string 或根本不存在
```

爬蟲從網頁取回的資料本質上是 `any`，必須有**執行時驗證層**，這就是 Zod 的定位：

```
Raw HTML / JSON（any）
      ↓  Zod .parse()
Validated & Typed Data（具體型別）
      ↓  你的 pipeline
Storage / Transform / Export
```

### 1.2 定義 Scraped Data 的 Interface

先定義資料合約（對標 Python `TypedDict` 或 `dataclass`）：

```ts
// types/scraped.ts

// 原始爬取結構（可能有缺漏欄位）
export interface RawProductRecord {
  name: string
  price: number | null
  sku: string
  stock?: number           // 可選：可能不存在
  tags: string[]
  meta: {
    source_url: string
    scraped_at: string     // ISO 8601
    page_num: number
  }
}

// 清洗後的正規化結構（進 DB / 下游 pipeline 用）
export interface NormalizedProduct {
  name: string
  price_cents: number      // 統一轉為整數分（避免浮點數問題）
  sku: string
  stock: number            // 清洗後保證有值
  tags: string[]
  source_url: string
  scraped_at: Date         // 轉為 Date 物件
}
```

### 1.3 Zod：TypeScript 的 Pydantic

安裝：

```bash
npm install zod
```

**對標關係：**

```python
# Python / Pydantic
from pydantic import BaseModel, validator
from typing import Optional, List

class Product(BaseModel):
    name: str
    price: Optional[float] = None
    tags: List[str] = []

    @validator("price")
    def price_must_be_positive(cls, v):
        if v is not None and v < 0:
            raise ValueError("price must be positive")
        return v
```

```ts
// TypeScript / Zod
import { z } from "zod"

const ProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive().nullable(),   // 等同 Optional[PositiveFloat]
  tags: z.array(z.string()).default([]),
})

// 自動推斷型別（不需要另外寫 interface）
type Product = z.infer<typeof ProductSchema>
```

### 1.4 完整的爬蟲驗證 Pipeline

```ts
// schemas/product.schema.ts
import { z } from "zod"

export const RawProductSchema = z.object({
  name: z.string(),
  price: z
    .union([z.string(), z.number()])
    .transform((val) => {
      // 處理 "$1,234.56" 這類字串價格
      const cleaned = String(val).replace(/[^0-9.]/g, "")
      return Math.round(parseFloat(cleaned) * 100)  // 轉為分
    })
    .nullable(),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  stock: z.number().int().nonnegative().optional().default(0),
  tags: z.array(z.string()).optional().default([]),
  meta: z.object({
    source_url: z.string().url(),
    scraped_at: z.string().datetime().transform((s) => new Date(s)),
    page_num: z.number().int().positive(),
  }),
})

export type ScrapedProduct = z.infer<typeof RawProductSchema>

// 驗證函式（對標 Pydantic 的 model_validate）
export function validateProduct(raw: unknown): ScrapedProduct {
  return RawProductSchema.parse(raw)          // 失敗時拋錯
}

export function safeValidateProduct(raw: unknown) {
  return RawProductSchema.safeParse(raw)      // 失敗時回傳 { success: false, error }
}
```

### 1.5 從 DOM 抓資料並驗證

```ts
// scrapers/product.scraper.ts
import { safeValidateProduct } from "../schemas/product.schema"

function extractProductFromDOM(doc: Document): unknown {
  // 從 DOM 提取，刻意回傳 unknown（誠實地承認資料未驗證）
  return {
    name: doc.querySelector("h1.product-title")?.textContent?.trim(),
    price: doc.querySelector("[data-price]")?.getAttribute("data-price"),
    sku: doc.querySelector("[data-sku]")?.getAttribute("data-sku"),
    meta: {
      source_url: doc.location?.href ?? window.location.href,
      scraped_at: new Date().toISOString(),
      page_num: 1,
    }
  }
}

export function scrapeProduct(doc: Document) {
  const raw = extractProductFromDOM(doc)
  const result = safeValidateProduct(raw)

  if (!result.success) {
    // 結構化記錄錯誤（對標 Python logging）
    console.error("[Scraper] Validation failed", {
      url: window.location.href,
      errors: result.error.flatten(),  // Zod 提供清晰的錯誤摘要
    })
    return null
  }

  return result.data  // 型別已完全確認
}
```

---

## 2. Type-Safe Messaging

### 2.1 背景

Chrome Extension 架構中，`background.ts`、`content.ts`、`popup.ts` 是**不同執行環境**，透過 `chrome.runtime.sendMessage` 溝通。這等同於 Python 中的 **IPC（行程間通訊）**，一旦訊息結構不一致，只會在執行時靜默失敗。

解法：使用 **Discriminated Union**（可判別聯合）建立型別安全的訊息匯流排。

### 2.2 定義 Message Protocol

```ts
// types/messages.ts

// --- 定義所有可能的訊息類型 ---

// Content → Background
export interface ScrapeRequestMessage {
  type: "SCRAPE_REQUEST"
  payload: {
    url: string
    selectors: Record<string, string>
  }
}

export interface ExtractJsonMessage {
  type: "EXTRACT_JSON"
  payload: {
    pattern: string    // API endpoint pattern
  }
}

// Background → Content
export interface ScrapeResultMessage {
  type: "SCRAPE_RESULT"
  payload: {
    success: boolean
    data: unknown
    error?: string
  }
}

export interface InjectScriptMessage {
  type: "INJECT_SCRIPT"
  payload: {
    scriptUrl: string
  }
}

// 聚合所有訊息型別（Discriminated Union）
export type ExtensionMessage =
  | ScrapeRequestMessage
  | ExtractJsonMessage
  | ScrapeResultMessage
  | InjectScriptMessage

// 工具型別：根據 type 取出對應 payload
export type MessagePayload<T extends ExtensionMessage["type"]> = Extract<
  ExtensionMessage,
  { type: T }
>["payload"]
```

### 2.3 型別安全的訊息發送與接收

```ts
// utils/messaging.ts
import type { ExtensionMessage, MessagePayload } from "../types/messages"

// 型別安全的 sendMessage 包裝
export function sendMessage<T extends ExtensionMessage["type"]>(
  type: T,
  payload: MessagePayload<T>
): Promise<unknown> {
  return chrome.runtime.sendMessage({ type, payload })
}

// background.ts：使用 switch 窮盡所有 case
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case "SCRAPE_REQUEST":
        // TS 自動縮窄：message.payload 型別為 ScrapeRequestMessage["payload"]
        handleScrapeRequest(message.payload, sendResponse)
        return true  // 保持通道開啟（非同步回應必須）

      case "EXTRACT_JSON":
        handleExtractJson(message.payload, sendResponse)
        return true

      default:
        // 確保所有 case 都處理（Exhaustive Check）
        const _exhaustive: never = message
        console.warn("[Background] Unhandled message type", _exhaustive)
    }
  }
)
```

### 2.4 雙向通訊（Long-lived Connection）

```ts
// 對於需要持續串流資料的場景（如即時監控 XHR）
// types/messages.ts 新增
export interface StreamPort {
  CRAWLER_STREAM: {
    start: { urls: string[]; concurrency: number }
    data: { url: string; record: unknown }
    done: { total: number; failed: number }
    error: { url: string; message: string }
  }
}

// content.ts
const port = chrome.runtime.connect({ name: "CRAWLER_STREAM" })

port.postMessage({ event: "start", payload: { urls, concurrency: 3 } })

port.onMessage.addListener((msg) => {
  if (msg.event === "data") {
    pipeline.push(msg.payload.record)
  }
})
```

---

## 3. Defensive Scraping Concept

### 3.1 核心心態

網頁結構是**不穩定的 Schema**。每一個 DOM 查詢都是一次「不保證成功的資料庫查詢」。
防禦性爬蟲的核心原則：

```
假設所有 DOM 查詢結果都可能是 null
假設所有 attribute 都可能是空字串
假設所有數字都可能是格式化字串
```

### 3.2 HTMLElement | null 的型別收窄

```ts
// ❌ 危險：querySelector 回傳 Element | null
const priceEl = document.querySelector(".price")
const price = parseFloat(priceEl.textContent)  // 編譯錯誤：可能是 null

// ✅ 方法一：Optional Chaining（最常用）
const priceText = document.querySelector(".price")?.textContent?.trim()
// priceText 型別為 string | undefined

// ✅ 方法二：型別謂詞（Type Guard）函式，讓收窄可複用
function queryStrict<T extends Element>(
  root: Document | Element,
  selector: string
): T | null {
  return root.querySelector<T>(selector)
}

// 更嚴格的版本：斷言存在，不存在就拋有意義的錯誤
function queryRequired<T extends Element>(
  root: Document | Element,
  selector: string,
  context?: string
): T {
  const el = root.querySelector<T>(selector)
  if (!el) {
    throw new Error(`[Scraper] Required element not found: "${selector}"${context ? ` on ${context}` : ""}`)
  }
  return el
}

// 使用
const titleEl = queryRequired<HTMLElement>(document, "h1.product-name", window.location.href)
const title = titleEl.textContent!.trim()  // 確認存在後，! 斷言安全
```

### 3.3 爬蟲中的 `?.` 與 `??` 實戰

```ts
// utils/dom.ts：封裝常用的防禦性 DOM 操作

export const DOM = {
  // 取文字，找不到回傳 null（不是空字串，保持語義清晰）
  text(root: Document | Element, selector: string): string | null {
    return root.querySelector(selector)?.textContent?.trim() ?? null
  },

  // 取屬性值
  attr(root: Document | Element, selector: string, attr: string): string | null {
    return root.querySelector(selector)?.getAttribute(attr) ?? null
  },

  // 取數字（處理 "$1,234" 這類格式）
  number(root: Document | Element, selector: string): number | null {
    const raw = DOM.text(root, selector)
    if (raw === null) return null
    const cleaned = raw.replace(/[^0-9.-]/g, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  },

  // 取多個元素的文字陣列
  texts(root: Document | Element, selector: string): string[] {
    return Array.from(root.querySelectorAll(selector))
      .map(el => el.textContent?.trim())
      .filter((t): t is string => Boolean(t))  // 型別謂詞過濾 undefined
  },

  // 解析 JSON-LD（電商網站常見的結構化資料）
  jsonLd<T = unknown>(doc: Document): T | null {
    try {
      const script = doc.querySelector('script[type="application/ld+json"]')
      const text = script?.textContent
      if (!text) return null
      return JSON.parse(text) as T
    } catch {
      return null
    }
  }
}

// 使用範例
function scrapeProductPage(doc: Document) {
  // Nullish Coalescing 提供 fallback 鏈
  const price = DOM.number(doc, "[data-price]")
              ?? DOM.number(doc, ".price-current")
              ?? DOM.number(doc, ".product-price")

  return {
    name: DOM.text(doc, "h1") ?? "Unknown",
    price,                              // number | null，語義清晰
    tags: DOM.texts(doc, ".tag-item"),  // string[]，保證不含 null
    inStock: DOM.attr(doc, "[data-stock]", "data-stock") !== "0",
  }
}
```

### 3.4 處理動態載入的內容（MutationObserver）

```ts
// 等待特定 selector 出現（對標 Python 的 WebDriverWait）
function waitForElement<T extends Element>(
  selector: string,
  timeout = 5000,
  root: Document = document
): Promise<T> {
  return new Promise((resolve, reject) => {
    const existing = root.querySelector<T>(selector)
    if (existing) return resolve(existing)

    const timer = setTimeout(() => {
      observer.disconnect()
      reject(new Error(`[Scraper] Timeout: "${selector}" not found within ${timeout}ms`))
    }, timeout)

    const observer = new MutationObserver(() => {
      const el = root.querySelector<T>(selector)
      if (el) {
        clearTimeout(timer)
        observer.disconnect()
        resolve(el)
      }
    })

    observer.observe(root.body, { childList: true, subtree: true })
  })
}

// 使用
const priceEl = await waitForElement<HTMLElement>(".dynamic-price", 3000)
```

---

## 4. Asynchronous & Networking

### 4.1 `Promise.allSettled` — 對標 `asyncio.gather`

```python
# Python
results = await asyncio.gather(
    *[fetch_page(url) for url in urls],
    return_exceptions=True          # 不讓單一失敗中止全部
)
```

```ts
// TypeScript / 瀏覽器
// Promise.all：任一失敗 → 全部中止（等同 gather 不加 return_exceptions）
// Promise.allSettled：全部跑完，結果帶有 status（等同 gather(return_exceptions=True)）

interface ScrapeResult {
  url: string
  data: ScrapedProduct | null
  error: string | null
}

async function scrapeAll(urls: string[]): Promise<ScrapeResult[]> {
  const tasks = urls.map(url =>
    fetch(url)
      .then(r => r.text())
      .then(html => ({ url, data: parseHTML(html), error: null }))
  )

  const settled = await Promise.allSettled(tasks)

  // 對標 Python 的 result 處理
  return settled.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value
    } else {
      // result.status === "rejected"
      return {
        url: urls[i],
        data: null,
        error: result.reason instanceof Error
          ? result.reason.message
          : String(result.reason)
      }
    }
  })
}
```

### 4.2 並行控制（Semaphore 模式）

Python 有 `asyncio.Semaphore`，TypeScript 需要自己實作：

```ts
// utils/concurrency.ts

// 控制最大並行數（對標 asyncio.Semaphore）
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  const executing = new Set<Promise<void>>()

  for (let i = 0; i < items.length; i++) {
    const task = fn(items[i], i)
      .then(value => {
        results[i] = { status: "fulfilled", value }
      })
      .catch(reason => {
        results[i] = { status: "rejected", reason }
      })
      .finally(() => executing.delete(p))

    const p = task
    executing.add(p)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.allSettled(executing)
  return results
}

// 使用：最多 3 個並行請求
const results = await mapWithConcurrency(urls, 3, async (url) => {
  const res = await fetch(url)
  return res.json()
})
```

### 4.3 封裝型別化的 Fetch 模組

對標 Python 的 `httpx.AsyncClient` 或自訂的 `requests.Session`：

```ts
// utils/http.ts

type RequestInterceptor = (config: RequestInit & { url: string }) => RequestInit & { url: string }
type ResponseInterceptor = (response: Response) => Response | Promise<Response>

interface HttpClientConfig {
  baseUrl?: string
  defaultHeaders?: Record<string, string>
  timeout?: number
  requestInterceptors?: RequestInterceptor[]
  responseInterceptors?: ResponseInterceptor[]
}

export class HttpClient {
  private config: Required<HttpClientConfig>

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? "",
      defaultHeaders: config.defaultHeaders ?? {},
      timeout: config.timeout ?? 10_000,
      requestInterceptors: config.requestInterceptors ?? [],
      responseInterceptors: config.responseInterceptors ?? [],
    }
  }

  // 核心：型別化 GET，泛型指定預期回傳結構
  async get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "GET" })
  }

  async post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    let requestConfig: RequestInit & { url: string } = {
      url: `${this.config.baseUrl}${path}`,
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...this.config.defaultHeaders,
        ...(init.headers ?? {}),
      },
    }

    // 執行 Request Interceptors（對標 axios interceptors）
    for (const interceptor of this.config.requestInterceptors) {
      requestConfig = interceptor(requestConfig)
    }

    try {
      let response = await fetch(requestConfig.url, requestConfig)

      // 執行 Response Interceptors
      for (const interceptor of this.config.responseInterceptors) {
        response = await interceptor(response)
      }

      if (!response.ok) {
        throw new HttpError(response.status, `HTTP ${response.status}: ${path}`, response)
      }

      return response.json() as Promise<T>
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly response: Response
  ) {
    super(message)
    this.name = "HttpError"
  }
}

// 初始化（對標建立 httpx session）
export const apiClient = new HttpClient({
  baseUrl: "https://api.target-site.com",
  timeout: 8_000,
  defaultHeaders: {
    "User-Agent": "Mozilla/5.0 (compatible; DataBot/1.0)",
  },
  requestInterceptors: [
    (config) => ({
      ...config,
      headers: {
        ...config.headers,
        "X-Request-ID": crypto.randomUUID(),
      },
    }),
  ],
  responseInterceptors: [
    async (res) => {
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After") ?? "5"
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000))
        // 在實際場景中這裡會重試
      }
      return res
    },
  ],
})
```

---

## 5. Advanced Patterns for Crawlers

### 5.1 泛型 `extractData<T>`：通用的資料提取函式

對標 Python 中用 TypeVar 寫通用 parser：

```ts
// core/extractor.ts
import { z, ZodSchema } from "zod"

interface ExtractorConfig<T> {
  schema: ZodSchema<T>
  selectors: {
    [K in keyof T]?: string | ((doc: Document) => unknown)
  }
  transform?: (raw: Record<string, unknown>) => Record<string, unknown>
}

// 通用提取函式：傳入 schema 和 selector 映射，自動完成提取 + 驗證
export function createExtractor<T>(config: ExtractorConfig<T>) {
  return function extractData(doc: Document): T {
    const raw: Record<string, unknown> = {}

    for (const [key, selectorOrFn] of Object.entries(config.selectors)) {
      if (typeof selectorOrFn === "function") {
        raw[key] = selectorOrFn(doc)
      } else if (typeof selectorOrFn === "string") {
        raw[key] = doc.querySelector(selectorOrFn)?.textContent?.trim() ?? null
      }
    }

    const transformed = config.transform ? config.transform(raw) : raw
    return config.schema.parse(transformed)  // Zod 驗證
  }
}

// 使用：定義一次，到處複用
const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  rating: z.number().min(0).max(5).nullable(),
})

export const extractProduct = createExtractor({
  schema: ProductSchema,
  selectors: {
    name: "h1.product-name",
    price: (doc) => {
      const text = doc.querySelector("[data-price]")?.getAttribute("data-price")
      return text ? parseFloat(text) : null
    },
    rating: "[data-rating]",
  },
  transform: (raw) => ({
    ...raw,
    rating: raw.rating ? parseFloat(String(raw.rating)) : null,
  }),
})
```

### 5.2 Pipeline 模式：可組合的爬蟲 Stage

對標 Python 的 generator pipeline 或 `functools.reduce`：

```ts
// core/pipeline.ts

type Stage<TIn, TOut> = (input: TIn) => Promise<TOut> | TOut

// 建立可組合的 Pipeline（對標 pipe() / compose()）
export function createPipeline<T>() {
  return {
    // 使用 Builder Pattern 串接 stages
    pipe<TOut>(stage: Stage<T, TOut>) {
      return createPipelineWith<TOut>(stage)
    }
  }
}

function createPipelineWith<T>(stage: Stage<any, T>) {
  return {
    pipe<TOut>(nextStage: Stage<T, TOut>) {
      return createPipelineWith<TOut>(async (input: any) => {
        const intermediate = await stage(input)
        return nextStage(intermediate)
      })
    },
    build(): Stage<any, T> {
      return stage
    }
  }
}

// 實際的爬蟲 pipeline
const crawlerPipeline = createPipeline<string>()  // 輸入：URL string
  .pipe(async (url) => {                           // Stage 1: Fetch
    const res = await apiClient.get<string>(url)
    return { url, html: res }
  })
  .pipe(({ url, html }) => {                       // Stage 2: Parse
    const doc = new DOMParser().parseFromString(html, "text/html")
    return { url, doc }
  })
  .pipe(({ url, doc }) => extractProduct(doc))     // Stage 3: Extract + Validate
  .build()

// 執行
const product = await crawlerPipeline("https://example.com/product/123")
```

### 5.3 Reverse-Engineered API 的型別化

**場景**：從 Network Tab 攔截到 XHR 回應，需要快速建立型別定義。

**流程：Network Tab JSON → TS Definitions**

```
步驟一：在 DevTools Network Tab 找到目標 XHR 請求
步驟二：右鍵 Copy → Copy response
步驟三：貼到 https://transform.tools/json-to-typescript 自動生成 interface
步驟四：用 Zod 補上執行時驗證
```

```ts
// types/reverse-engineered/product-api.ts
// 從 Network Tab 逆向工程得到的原始 API 結構

// 自動生成的 interface（描述 API 回傳的實際結構）
export interface ProductApiResponse {
  code: number
  message: string
  data: {
    items: Array<{
      itemId: string
      itemInfo: {
        title: string
        price: {
          oriPrice: number      // 原價（分）
          discount: number      // 折扣（0-100）
        }
        stock: {
          quantity: number
          sellable: boolean
        }
        images: string[]
      }
      shopInfo: {
        shopId: string
        shopName: string
      }
    }>
    pagination: {
      page: number
      pageSize: number
      total: number
      hasMore: boolean
    }
  }
}

// 對應的 Zod Schema（補上執行時保護）
export const ProductApiSchema = z.object({
  code: z.literal(0),    // 只接受成功的 code
  data: z.object({
    items: z.array(z.object({
      itemId: z.string(),
      itemInfo: z.object({
        title: z.string(),
        price: z.object({
          oriPrice: z.number().int(),
          discount: z.number().min(0).max(100),
        }),
        stock: z.object({
          quantity: z.number().int().nonnegative(),
          sellable: z.boolean(),
        }),
        images: z.array(z.string().url()),
      }),
    })),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      hasMore: z.boolean(),
    }),
  }),
})

// 攔截 XHR / fetch 並驗證（在 Content Script 中使用）
function interceptXHR(targetPattern: RegExp) {
  const originalOpen = XMLHttpRequest.prototype.open
  const originalFetch = window.fetch

  // 攔截 XHR
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (typeof url === "string" && targetPattern.test(url)) {
      this.addEventListener("load", () => {
        const result = ProductApiSchema.safeParse(JSON.parse(this.responseText))
        if (result.success) {
          chrome.runtime.sendMessage({
            type: "SCRAPE_RESULT",
            payload: { success: true, data: result.data }
          })
        }
      })
    }
    return originalOpen.call(this, method, url, ...args)
  }

  // 攔截 fetch
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url
    const response = await originalFetch(input, init)

    if (targetPattern.test(url)) {
      const clone = response.clone()
      clone.json().then((data) => {
        const result = ProductApiSchema.safeParse(data)
        if (result.success) {
          chrome.runtime.sendMessage({
            type: "SCRAPE_RESULT",
            payload: { success: true, data: result.data }
          })
        }
      })
    }

    return response
  }
}

// 使用
interceptXHR(/\/api\/v\d+\/items/)
```

---

## 6. Build & Tooling

### 6.1 專案結構

```
my-extension/
├── src/
│   ├── background.ts       # Service Worker
│   ├── content.ts          # Content Script
│   ├── popup.ts            # Popup（若需要）
│   ├── types/              # 型別定義
│   │   └── messages.ts
│   ├── schemas/            # Zod schemas
│   │   └── product.schema.ts
│   └── utils/              # 工具函式
│       ├── dom.ts
│       ├── http.ts
│       └── concurrency.ts
├── public/
│   └── manifest.json
├── tsconfig.json
├── tsup.config.ts          # 或 vite.config.ts
└── package.json
```

### 6.2 使用 tsup（最簡潔，純 CLI 工具首選）

```bash
npm install -D tsup typescript
```

```ts
// tsup.config.ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    background: "src/background.ts",
    content: "src/content.ts",
    popup: "src/popup.ts",
  },
  outDir: "dist",
  format: ["iife"],            // Chrome Extension 需要 IIFE（不是 ESM）
  target: "chrome112",         // 對應 Chrome 版本
  splitting: false,            // Extension 不支援動態 import
  sourcemap: process.env.NODE_ENV !== "production",
  minify: process.env.NODE_ENV === "production",
  clean: true,
  // 若要打包 content script 樣式
  // injectStyle: true,
})
```

```bash
# 開發
npx tsup --watch

# 生產打包
NODE_ENV=production npx tsup
```

### 6.3 使用 Vite（若有 Popup UI 需求）

```bash
npm install -D vite @crxjs/vite-plugin typescript
```

```ts
// vite.config.ts
import { defineConfig } from "vite"
import { crx } from "@crxjs/vite-plugin"
import manifest from "./public/manifest.json" assert { type: "json" }

export default defineConfig({
  plugins: [
    crx({ manifest }),         // 自動處理 manifest 中定義的所有 script
  ],
  build: {
    target: "chrome112",
    minify: "terser",
  },
})
```

### 6.4 `tsconfig.json`（Extension 專用）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[0] 型別為 T | undefined（更安全）
    "exactOptionalPropertyTypes": true, // 區分 undefined 和缺少屬性
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["chrome"]                 // Chrome Extension API 型別
  },
  "include": ["src/**/*"]
}
```

```bash
# 安裝 Chrome API 型別定義
npm install -D @types/chrome
```

### 6.5 `manifest.json`（MV3 最小範例）

```json
{
  "manifest_version": 3,
  "name": "Data Crawler",
  "version": "1.0.0",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://target-site.com/*"],
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://target-site.com/*"],
      "js": ["dist/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

---

## 附錄：Python vs TypeScript 爬蟲完整對照

```
完整資料管道對比
```

| 任務 | Python | TypeScript（瀏覽器） |
|---|---|---|
| HTTP 請求 | `httpx.AsyncClient` | `HttpClient`（封裝 fetch） |
| HTML 解析 | `BeautifulSoup` | `document.querySelector` |
| 資料驗證 | `Pydantic` | `Zod` |
| 並行控制 | `asyncio.Semaphore` | `mapWithConcurrency` |
| 全部等待 | `asyncio.gather(return_exceptions=True)` | `Promise.allSettled()` |
| 型別定義 | `TypedDict` / `dataclass` | `interface` / `type` |
| 執行時型別縮窄 | `isinstance()` | `typeof` / `instanceof` / `in` |
| 列舉 | `enum.Enum` | `enum` / `as const` |
| 泛型 | `TypeVar` | `<T>` |
| 設定檔驗證 | `pydantic-settings` | `Zod` + `dotenv` |

---

*適用版本：TypeScript 5.x | Chrome Extension Manifest V3 | Zod 3.x*
