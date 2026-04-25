# 📘 TypeScript 初學者完整指南

> **一句話核心**：TypeScript 的本質不是「寫更多語法」，而是「讓錯誤在開發階段就被發現，而不是等到執行時才爆炸」。

---

## 目錄

1. [TypeScript 是什麼？](#1-typescript-是什麼)
2. [環境建置（很多人跳過這步）](#2-環境建置很多人跳過這步)
3. [基本型別（Types）](#3-基本型別types)
4. [型別推斷 vs 型別標註](#4-型別推斷-vs-型別標註初學者最常搞混)
5. [陣列與 Tuple](#5-陣列與-tuple)
6. [物件與 Interface / Type Alias](#6-物件與-interface--type-alias)
7. [函式（Function）](#7-函式function)
8. [迴圈（Loop）](#8-迴圈loop)
9. [條件判斷](#9-條件判斷)
10. [比較運算子](#10-比較運算子)
11. [聯合型別與可選屬性](#11-聯合型別與可選屬性初學者超常遺漏)
12. [Null / Undefined 安全處理](#12-null--undefined-安全處理)
13. [常見陣列操作](#13-常見陣列操作)
14. [型別縮窄（Type Narrowing）](#14-型別縮窄type-narrowing初學者不知道的關鍵)
15. [Enum 列舉](#15-enum-列舉)
16. [泛型（Generics）入門](#16-泛型generics入門)
17. [三元運算子與常用簡寫](#17-三元運算子與常用簡寫)
18. [常見錯誤觀念整理](#18-常見錯誤觀念整理)
19. [tsconfig 基礎設定](#19-tsconfig-基礎設定初學者完全忽略)
20. [學習路徑建議](#20-學習路徑建議)

---

## 1. TypeScript 是什麼？

```
TypeScript = JavaScript + 靜態型別系統（編譯期檢查）
```

TypeScript 由 Microsoft 開發，是 JavaScript 的「超集合（Superset）」，代表所有合法的 JavaScript 也是合法的 TypeScript。

### 為什麼要用？

| 問題（JavaScript） | 解決（TypeScript） |
|---|---|
| 執行時才發現變數型別錯誤 | 編譯時立即報錯 |
| 不知道函式要傳什麼參數 | 型別標註讓 IDE 自動提示 |
| 大型專案難以維護 | 明確的型別契約，重構更安全 |
| 拼錯屬性名稱卻沒有警告 | 物件屬性錯誤即時偵測 |

### 運作流程

```
你寫的 .ts 檔案
      ↓  tsc（TypeScript Compiler）
編譯期型別檢查
      ↓  成功才輸出
.js 檔案（瀏覽器 / Node.js 執行）
```

> ⚠️ **初學者常見誤解**：TypeScript 本身不會在執行時做型別檢查。所有型別資訊在編譯成 JS 後會被「抹除（Type Erasure）」。型別系統只保護你在「寫程式」的時候。

---

## 2. 環境建置（很多人跳過這步）

```bash
# 安裝 TypeScript（全域）
npm install -g typescript

# 確認版本
tsc --version

# 初始化專案（產生 tsconfig.json）
tsc --init

# 編譯單一檔案
tsc index.ts

# 監看模式（存檔自動編譯）
tsc --watch
```

### 直接執行 ts 檔案（開發用）

```bash
npm install -g ts-node
ts-node index.ts
```

---

## 3. 基本型別（Types）

### 原始型別（Primitive Types）

```ts
let username: string = "Tom"
let age: number = 20
let isAdmin: boolean = false
let nothing: null = null
let notSet: undefined = undefined
```

### 型別對照表

| 型別 | 說明 | 範例 |
|---|---|---|
| `string` | 字串 | `"Hello"`, `'Hi'`, `` `模板字串` `` |
| `number` | 數字（含整數、浮點數） | `42`, `3.14`, `-7` |
| `boolean` | 布林值 | `true`, `false` |
| `null` | 刻意設為空值 | `null` |
| `undefined` | 尚未賦值 | `undefined` |
| `any` | 關閉型別檢查（**盡量避免**） | 任何值 |
| `unknown` | 安全版 any（使用前需型別檢查） | 任何值，但更安全 |
| `never` | 永遠不會出現的型別（拋錯、無窮迴圈） | — |
| `void` | 函式沒有回傳值 | — |

### `any` vs `unknown`（初學者必懂差異）

```ts
// any：完全關閉型別檢查，危險
let a: any = "hello"
a.toFixed()        // ❌ 不會報錯，但執行時會爆炸

// unknown：使用前必須先確認型別，安全
let b: unknown = "hello"
b.toFixed()        // ✅ 編譯錯誤，保護你
if (typeof b === "number") {
  b.toFixed()      // ✅ 確認是 number 後才能用
}
```

---

## 4. 型別推斷 vs 型別標註（初學者最常搞混）

TypeScript 很聰明，很多時候**不需要手動標型別**，它會自動推斷：

```ts
// 型別推斷（TypeScript 自動判斷）
let name = "Tom"        // 自動推斷為 string
let count = 0           // 自動推斷為 number
let done = false        // 自動推斷為 boolean

// 型別標註（手動指定，在推斷不夠精確時使用）
let input: string       // 宣告但未賦值，必須標註
```

### 什麼時候需要手動標？

```ts
// 1. 宣告時未賦值
let result: string

// 2. 函式參數（無法自動推斷）
function greet(name: string) { ... }

// 3. 推斷結果太寬鬆時
let status = "active"          // 推斷為 string
let status: "active" | "inactive" = "active"  // 更精確的字面值型別
```

---

## 5. 陣列與 Tuple

### 陣列（Array）

```ts
// 方法一：型別[]
let nums: number[] = [1, 2, 3]
let names: string[] = ["Tom", "Alice"]

// 方法二：Array<型別>（泛型寫法）
let scores: Array<number> = [90, 85, 78]

// 多型別陣列（聯合型別）
let mixed: (string | number)[] = ["Tom", 20, "Alice", 25]
```

### Tuple（固定長度、固定型別的陣列）

```ts
// Tuple：位置和型別都是固定的
let person: [string, number] = ["Tom", 20]

// ✅ 正確存取
console.log(person[0])  // "Tom"（string）
console.log(person[1])  // 20（number）

// ❌ 錯誤：型別不符
let wrong: [string, number] = [20, "Tom"]  // 編譯錯誤

// 常見用途：函式回傳多個值
function getUser(): [string, number] {
  return ["Tom", 20]
}
const [name, userAge] = getUser()
```

---

## 6. 物件與 Interface / Type Alias

### 直接定義物件型別

```ts
let user: { name: string; age: number } = {
  name: "Tom",
  age: 20
}
```

### Interface（介面）——定義物件結構的標準方式

```ts
interface User {
  name: string
  age: number
  email?: string        // ? 代表可選屬性
  readonly id: number   // readonly 代表不可修改
}

const user: User = {
  id: 1,
  name: "Tom",
  age: 20
  // email 可以不填
}

user.id = 2  // ❌ 編譯錯誤：readonly 屬性不可修改
```

### Type Alias（型別別名）

```ts
type Point = {
  x: number
  y: number
}

type ID = string | number  // 型別別名也可以定義聯合型別
```

### Interface vs Type：何時用哪個？

| 情境 | 建議 |
|---|---|
| 定義物件形狀 | `interface` 或 `type` 都可以 |
| 需要繼承擴展 | 優先用 `interface`（`extends`） |
| 聯合型別、交叉型別 | 必須用 `type` |
| 函式型別 | `type` 較直觀 |

```ts
// Interface 繼承
interface Animal {
  name: string
}
interface Dog extends Animal {
  breed: string
}

// Type 交叉型別
type Dog = Animal & { breed: string }
```

---

## 7. 函式（Function）

### 基本寫法

```ts
// 具名函式
function add(a: number, b: number): number {
  return a + b
}

// Arrow Function
const add = (a: number, b: number): number => a + b

// 無回傳值（void）
function log(message: string): void {
  console.log(message)
  // 不需要 return
}
```

### 可選參數與預設值

```ts
// 可選參數：必須放在必填參數後面
function greet(name: string, greeting?: string): string {
  return `${greeting ?? "Hello"}, ${name}!`
}

// 預設參數
function greet(name: string, greeting: string = "Hello"): string {
  return `${greeting}, ${name}!`
}

greet("Tom")           // "Hello, Tom!"
greet("Tom", "Hi")     // "Hi, Tom!"
```

### 其餘參數（Rest Parameters）

```ts
function sum(...nums: number[]): number {
  return nums.reduce((total, n) => total + n, 0)
}

sum(1, 2, 3, 4)  // 10
```

### 函式型別定義

```ts
// 定義函式型別
type MathFn = (a: number, b: number) => number

const multiply: MathFn = (a, b) => a * b

// 回呼函式（Callback）型別
function process(nums: number[], callback: (n: number) => number): number[] {
  return nums.map(callback)
}
```

> ⚠️ **重要**：宣告了回傳型別，就**一定**要在所有分支都回傳正確型別。

```ts
// ❌ 錯誤：不是所有路徑都有 return
function getLabel(score: number): string {
  if (score >= 60) {
    return "Pass"
  }
  // 忘記 else，TypeScript 會報錯
}

// ✅ 正確
function getLabel(score: number): string {
  if (score >= 60) {
    return "Pass"
  }
  return "Fail"
}
```

---

## 8. 迴圈（Loop）

### for 迴圈

```ts
const nums: number[] = [1, 2, 3, 4, 5]

// 傳統 for
for (let i = 0; i < nums.length; i++) {
  console.log(nums[i])
}

// for...of（推薦，遍歷值）
for (const n of nums) {
  console.log(n)
}

// for...in（遍歷索引/鍵，較少用）
for (const key in nums) {
  console.log(key)  // "0", "1", "2"...
}
```

### forEach / while

```ts
nums.forEach((n, index) => {
  console.log(`第 ${index} 個：${n}`)
})

let i = 0
while (i < nums.length) {
  console.log(nums[i])
  i++
}
```

---

## 9. 條件判斷

### 基本 if / else if / else

```ts
const age: number = 25

if (age < 18) {
  console.log("未成年")
} else if (age < 65) {
  console.log("成年")
} else {
  console.log("銀髮族")
}
```

### 邏輯運算子

```ts
// AND（&&）：兩者都為 true
if (age >= 18 && age <= 60) {
  console.log("工作年齡")
}

// OR（||）：任一為 true
if (age < 18 || age > 60) {
  console.log("非工作年齡")
}

// NOT（!）：反轉布林值
const isLoggedIn = false
if (!isLoggedIn) {
  console.log("請先登入")
}
```

### switch

```ts
const role: string = "admin"

switch (role) {
  case "admin":
    console.log("管理員")
    break
  case "user":
    console.log("一般用戶")
    break
  default:
    console.log("未知角色")
}
```

---

## 10. 比較運算子

| 運算子 | 說明 | 建議 |
|---|---|---|
| `===` | 嚴格相等（值和型別都要相同） | ✅ 永遠用這個 |
| `!==` | 嚴格不等 | ✅ 永遠用這個 |
| `==` | 寬鬆相等（會自動型別轉換） | ❌ 避免使用 |
| `!=` | 寬鬆不等 | ❌ 避免使用 |
| `>` `<` | 大於 / 小於 | — |
| `>=` `<=` | 大於等於 / 小於等於 | — |

```ts
// == 的危險：型別自動轉換
0 == ""       // true  ← 意料之外
0 == false    // true  ← 意料之外
null == undefined  // true ← 意料之外

// === 的安全
0 === ""      // false ✅
0 === false   // false ✅
null === undefined  // false ✅
```

> ⚠️ **常見錯誤**：連鎖比較在 TypeScript/JavaScript 中**不如數學直覺**

```ts
// ❌ 數學直覺：200 < age < 300 ← 這在 JS 永遠是 true！
if (200 < age < 300) { }  // 實際上是 (200 < age) < 300 → true < 300 → 1 < 300 → true

// ✅ 正確寫法
if (age > 200 && age < 300) { }
```

---

## 11. 聯合型別與可選屬性（初學者超常遺漏）

### 聯合型別（Union Type）

```ts
// 變數可以是多種型別之一
let id: string | number = "abc123"
id = 123  // ✅ 也可以是 number

// 函式接受多種型別
function printId(id: string | number): void {
  console.log("ID:", id)
}
```

### 字面值型別（Literal Type）

```ts
// 不只限制型別，還限制具體的值
type Direction = "left" | "right" | "up" | "down"
type Status = "pending" | "active" | "closed"
type DiceValue = 1 | 2 | 3 | 4 | 5 | 6

let move: Direction = "left"
move = "diagonal"  // ❌ 編譯錯誤：不在允許範圍內
```

### 可選屬性（Optional Property）

```ts
interface UserProfile {
  name: string         // 必填
  age: number          // 必填
  email?: string       // 選填（型別為 string | undefined）
  phone?: string       // 選填
}

// ✅ email 和 phone 可以不填
const user: UserProfile = { name: "Tom", age: 20 }

// 存取可選屬性前要確認存在
if (user.email) {
  console.log(user.email.toUpperCase())
}
// 或用可選鏈：
console.log(user.email?.toUpperCase())
```

---

## 12. Null / Undefined 安全處理

### 可選鏈（Optional Chaining：`?.`）

```ts
interface User {
  name: string
  address?: {
    city?: string
  }
}

const user: User = { name: "Tom" }

// ❌ 危險：可能 undefined
console.log(user.address.city)  // 執行時錯誤！

// ✅ 安全：找不到就回傳 undefined，不會爆炸
console.log(user.address?.city)   // undefined

// 可以連鎖多層
console.log(user?.address?.city)
```

### Nullish Coalescing（`??`）— 空值合併

```ts
// ?? 只有在左側是 null 或 undefined 時，才使用右側的值
const input: string | null = null
const value = input ?? "預設值"    // "預設值"

// ❌ 不要用 || 取代 ??，|| 會把 0 和 "" 也當成假值
const count = 0
const a = count || 10   // 10 ← 不對！0 是有意義的值
const b = count ?? 10   // 0  ✅ 正確
```

### Non-null Assertion（`!`）— 謹慎使用

```ts
// 告訴 TypeScript「我確定這不是 null」
const element = document.getElementById("app")!  // 加 ! 斷言非 null

// ⚠️ 如果你錯了，執行時還是會爆炸，只是 TS 不會警告你了
// 優先使用 if 檢查，只在非常確定時用 !
```

---

## 13. 常見陣列操作

```ts
const nums: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

### map — 轉換每個元素，回傳新陣列

```ts
const doubled = nums.map(n => n * 2)
// [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]

// 實際應用：將 API 資料轉換格式
const users = [{ id: 1, name: "Tom" }]
const names = users.map(u => u.name)  // ["Tom"]
```

### filter — 過濾，回傳符合條件的元素

```ts
const evens = nums.filter(n => n % 2 === 0)
// [2, 4, 6, 8, 10]
```

### reduce — 聚合，將陣列縮減為單一值

```ts
const total = nums.reduce((acc, n) => acc + n, 0)
// 55（1+2+3+...+10）

// reduce 的結構：reduce((累積值, 當前元素) => 新累積值, 初始值)
```

### find / findIndex — 找第一個符合條件的元素

```ts
const firstBig = nums.find(n => n > 5)        // 6
const firstBigIdx = nums.findIndex(n => n > 5) // 5（索引）
```

### some / every — 判斷是否符合條件

```ts
const hasNegative = nums.some(n => n < 0)    // false
const allPositive = nums.every(n => n > 0)   // true
```

### 串接（Chaining）— 組合使用

```ts
// 取出偶數，乘以 3，加總
const result = nums
  .filter(n => n % 2 === 0)  // [2, 4, 6, 8, 10]
  .map(n => n * 3)            // [6, 12, 18, 24, 30]
  .reduce((acc, n) => acc + n, 0)  // 90
```

### includes / indexOf

```ts
nums.includes(5)    // true
nums.indexOf(5)     // 4（索引）
nums.indexOf(99)    // -1（找不到）
```

---

## 14. 型別縮窄（Type Narrowing）——初學者不知道的關鍵

當你有一個聯合型別，TypeScript 需要你「縮窄」到具體型別才能安全使用。

### typeof 縮窄

```ts
function process(value: string | number): string {
  if (typeof value === "string") {
    return value.toUpperCase()  // 這裡 TS 知道 value 是 string
  }
  return value.toFixed(2)       // 這裡 TS 知道 value 是 number
}
```

### in 運算子縮窄

```ts
interface Cat { meow(): void }
interface Dog { bark(): void }

function makeSound(animal: Cat | Dog): void {
  if ("meow" in animal) {
    animal.meow()  // TS 知道是 Cat
  } else {
    animal.bark()  // TS 知道是 Dog
  }
}
```

### instanceof 縮窄

```ts
function formatDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}
```

### 型別謂詞（Type Guard Function）

```ts
// is 語法：告訴 TS 這個函式確認了某個型別
function isString(value: unknown): value is string {
  return typeof value === "string"
}

const input: unknown = "hello"
if (isString(input)) {
  console.log(input.toUpperCase())  // ✅ TS 知道是 string
}
```

---

## 15. Enum 列舉

```ts
// 數字 Enum（預設從 0 開始）
enum Direction {
  Up,     // 0
  Down,   // 1
  Left,   // 2
  Right   // 3
}

// 字串 Enum（推薦，除錯更容易）
enum Status {
  Pending = "PENDING",
  Active  = "ACTIVE",
  Closed  = "CLOSED"
}

const currentStatus: Status = Status.Active
console.log(currentStatus)  // "ACTIVE"

// 使用情境：替代魔法字串（Magic String）
// ❌ 魔法字串（容易拼錯）
if (status === "actve") { }  // 拼錯了，沒有任何警告

// ✅ 使用 Enum
if (status === Status.Active) { }  // 拼錯立刻報錯
```

---

## 16. 泛型（Generics）入門

泛型讓你的函式或型別可以「通用」，不鎖死特定型別。

```ts
// 沒有泛型：只能處理 number
function firstItem(arr: number[]): number {
  return arr[0]
}

// 有泛型：任何型別都能用
function firstItem<T>(arr: T[]): T {
  return arr[0]
}

firstItem([1, 2, 3])          // 回傳 number
firstItem(["a", "b", "c"])    // 回傳 string
firstItem([true, false])      // 回傳 boolean
```

### 泛型搭配 Interface

```ts
interface ApiResponse<T> {
  data: T
  status: number
  message: string
}

// 用法：
const userResponse: ApiResponse<User> = {
  data: { name: "Tom", age: 20 },
  status: 200,
  message: "OK"
}

const listResponse: ApiResponse<User[]> = {
  data: [{ name: "Tom", age: 20 }],
  status: 200,
  message: "OK"
}
```

---

## 17. 三元運算子與常用簡寫

### 三元運算子

```ts
// 條件 ? 值A : 值B
const label = age >= 18 ? "成人" : "未成年"

// 巢狀三元（不推薦超過兩層，可讀性差）
const grade =
  score >= 90 ? "A" :
  score >= 80 ? "B" :
  score >= 70 ? "C" : "F"
```

### 必學邏輯符號總覽

```ts
// 比較
===  !==   >   <   >=   <=

// 邏輯
&&    // AND：全部為 true 才 true
||    // OR：任一為 true 就 true
!     // NOT：反轉

// 空值處理
??    // Nullish Coalescing：左側為 null/undefined 才用右側
?.    // Optional Chaining：安全存取可能不存在的屬性

// 賦值簡寫
+=  -=  *=  /=       // x += 1 等於 x = x + 1
&&=  ||=  ??=        // 條件賦值
```

---

## 18. 常見錯誤觀念整理

### ❌ 錯誤：用 `==` 比較

```ts
// 避免用 ==，它會自動轉換型別
"0" == 0    // true（危險！）
"0" === 0   // false（正確）
```

### ❌ 錯誤：連鎖比較

```ts
if (0 < age < 100) { }   // ❌ 永遠是 true
if (age > 0 && age < 100) { }  // ✅ 正確
```

### ❌ 錯誤：用 `any` 解決型別錯誤

```ts
// 不要用 any 逃避型別問題
function process(data: any) { }  // ❌ 放棄了型別保護

// 用 unknown 加上型別縮窄
function process(data: unknown) {
  if (typeof data === "string") { ... }  // ✅
}
```

### ❌ 錯誤：忽略可能是 undefined 的值

```ts
interface User { name: string; email?: string }
const user: User = { name: "Tom" }

// ❌ 直接存取可選屬性
console.log(user.email.toUpperCase())  // 執行時錯誤！

// ✅ 先確認
if (user.email) {
  console.log(user.email.toUpperCase())
}
// 或用可選鏈
console.log(user.email?.toUpperCase())
```

### ❌ 錯誤：`null` 和 `undefined` 混用

```ts
// null：「刻意的空值」，你設的
// undefined：「還沒有值」，還沒被賦值

let intentionallyEmpty: string | null = null      // 刻意為空
let notYetAssigned: string | undefined = undefined // 尚未賦值

// 函式可選參數是 undefined，不是 null
function greet(name?: string) {
  // name 的型別是 string | undefined
}
```

### ❌ 錯誤：忘記函式的回傳型別

```ts
// ❌ 不是所有 if 分支都有 return
function divide(a: number, b: number): number {
  if (b !== 0) {
    return a / b
  }
  // 忘記 b === 0 的情況，TypeScript 會報錯
}

// ✅ 處理所有分支
function divide(a: number, b: number): number {
  if (b === 0) throw new Error("除數不能為 0")
  return a / b
}
```

---

## 19. tsconfig 基礎設定（初學者完全忽略）

`tsconfig.json` 控制 TypeScript 的行為，這幾個選項初學者應該知道：

```json
{
  "compilerOptions": {
    "target": "ES2020",        // 編譯輸出的 JS 版本
    "module": "commonjs",      // 模組系統（Node.js 用 commonjs）
    "strict": true,            // ⚠️ 強烈建議開啟！啟用所有嚴格檢查
    "outDir": "./dist",        // 編譯輸出目錄
    "rootDir": "./src",        // 原始碼目錄
    "noImplicitAny": true,     // 不允許隱式 any（strict 已包含）
    "strictNullChecks": true,  // null/undefined 嚴格檢查（strict 已包含）
    "esModuleInterop": true    // 讓 import 語法更相容
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

> **`"strict": true` 是最重要的一行。** 它啟用了所有嚴格檢查，讓 TypeScript 真正發揮保護作用。很多初學者覺得 TypeScript 沒用，通常是因為沒有開 strict 模式。

---

## 20. 學習路徑建議

### 🥚 第一週：打基礎

1. **基本型別**：`string` / `number` / `boolean` / `null` / `undefined`
2. **型別推斷**：了解 TS 何時會自動推斷
3. **`if` / `for`**：熟悉條件和迴圈
4. **`===` vs `==`**：永遠用嚴格比較

### 🐣 第二週：函式與結構

5. **函式型別標註**：參數型別和回傳型別
6. **`interface`**：定義物件結構
7. **可選屬性 `?`**：處理不確定存在的屬性
8. **陣列操作**：`map` / `filter` / `reduce`

### 🐥 第三週：進階型別

9. **聯合型別**：`string | number`
10. **型別縮窄**：`typeof` / `in` / `instanceof`
11. **`?.` 和 `??`**：安全的空值處理
12. **`unknown` vs `any`**：選擇更安全的做法

### 🐔 第四週：實戰概念

13. **泛型入門**：`function f<T>(arg: T): T`
14. **`strict` 模式**：設定 `tsconfig.json`
15. **`Enum`**：替代魔法字串
16. **整合實際專案**：用 TypeScript 寫一個小 API 或小工具

---

## 附錄：速查表

```ts
// 型別標註
let a: string = "hello"
let b: number = 42
let c: boolean = true
let d: string | number = "or number"

// 物件
interface User { name: string; age?: number }

// 函式
function fn(a: string, b?: number): void { }
const fn = (a: string): string => a.toUpperCase()

// 陣列
let arr: number[] = [1, 2, 3]
let tuple: [string, number] = ["Tom", 20]

// 型別縮窄
if (typeof x === "string") { /* x 是 string */ }
if (x instanceof Date) { /* x 是 Date */ }
if ("property" in obj) { /* obj 有這個屬性 */ }

// 空值處理
const val = obj?.prop          // 安全存取
const val = input ?? "default" // 空值替代
const val = input!             // 非空斷言（謹慎使用）

// 泛型
function identity<T>(arg: T): T { return arg }

// 常見邏輯符號
===  !==  >  <  >=  <=   // 比較
&&   ||   !              // 邏輯
??   ?.                  // 空值
```

---

*最後更新：2025年 | 適用 TypeScript 5.x*
