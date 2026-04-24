import { chromium } from "playwright";

(async () => {

    // =========================================================
    // 🟢 1️⃣ 啟動瀏覽器（Playwright 控制 Chrome）
    // =========================================================
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // =========================================================
    // 🟡 2️⃣ 建立全域資料容器（houseid → color）
    //    👉 Map 比 object 更適合做 key-value lookup
    // =========================================================
    const colorMap = new Map<number, string>();

    // =========================================================
    // 🔵 3️⃣ 攔截 API response（核心資料來源）
    // =========================================================
    page.on("response", async (response) => {

        const url = response.url();

        // 👉 只處理 591 房屋列表 API
        if (!url.includes("bff-house.591.com.tw/v1/web/sale/list")) return;

        try {
            const json = await response.json();

            // 👉 房屋清單
            const houseList = json?.data?.house_list || [];

            // =====================================================
            // 🟣 4️⃣ 資料清洗 + 分類（business logic）
            //    👉 把 price 轉換成顏色
            // =====================================================
            houseList.forEach((item: any) => {

                const id = Number(item.houseid);     // 房屋唯一 ID
                const price = Number(item.price);    // 價格

                // 👉 分級邏輯（你寫的核心規則）
                const color =
                    price < 3000
                        ? "green"   // 便宜
                        : price < 6000
                            ? "blue"    // 中等
                            : "red";    // 高價

                // 👉 存入 Map：之後用 id 找 color
                colorMap.set(id, color);
            });

            console.log("📦 colorMap size:", colorMap.size);

        } catch (err) {
            console.log("❌ API error:", err);
        }
    });

    // =========================================================
    // 🟢 5️⃣ 打開網站
    // =========================================================
    await page.goto("https://www.591.com.tw/");

    // 👉 選擇地區
    await page.locator("#area-box-body").getByText("台北市").click();

    // 👉 點中古屋
    await page.getByRole("link", { name: "中古屋" }).nth(1).click();

    // =========================================================
    // 🌊 6️⃣ 滾動頁面（觸發 lazy load / API）
    // =========================================================
    await autoScroll(page);

    // =========================================================
    // 📄 7️⃣ 找 pagination（頁碼區）
    // =========================================================
    const paginator = page.locator(".paginator-container");
    await paginator.waitFor();

    console.log("📍 paginator ready");

    // 👉 抓頁碼（例如 1~815）
    const pageNumbers = await paginator.locator("a, span").allTextContents();

    const pages = pageNumbers
        .map(p => p.trim())
        .filter(p => /^\d+$/.test(p));

    const lastPage = Number(pages.at(-1));

    console.log("🔥 lastPage:", lastPage);

    // =========================================================
    // 🔁 8️⃣ 分頁 loop（核心流程）
    // =========================================================
    for (let i = 1; i <= 10; i++) {

        console.log(`👉 第 ${i} 頁`);

        // =====================================================
        // 🟡 8-1 點擊頁碼
        // =====================================================
        await paginator.getByRole("link", {
            name: String(i),
            exact: true,
        }).click();

        // =====================================================
        // 🟡 8-2 等 API 更新（確保資料已換頁）
        // =====================================================
        await page.waitForResponse(res =>
            res.url().includes("sale/list")
        );

        // =====================================================
        // 🟡 8-3 等 DOM render 完成（避免抓不到元素）
        // =====================================================
        await page.waitForSelector('[data-id]', {
            timeout: 10000
        });

        // =====================================================
        // 🎨 8-4 DOM 上色（核心 UI mapping）
        // =====================================================
        await page.evaluate((mapObj) => {

            // 👉 把 Map 轉回 JS object
            const map = new Map(
                Object.entries(mapObj).map(([k, v]) => [Number(k), v])
            );

            // 👉 找所有房屋卡片
            const rows = document.querySelectorAll('[data-id]');

            rows.forEach((row: any) => {

                // 👉 DOM 的房屋 id
                const id = Number(row.getAttribute('data-id'));

                // 👉 從 API map 找顏色
                const color = map.get(id);

                // 👉 找 title（不同網站可能要調整 selector）
                const title =
                    row.querySelector('.ware-item__header') ||
                    row.querySelector('[title]');

                // 👉 如果有資料 → 上色
                if (title && color) {
                    (title as HTMLElement).style.setProperty(
                        "color",
                        color,
                        "important" // 🔥 強制覆蓋 CSS
                    );
                }
            });

        }, Object.fromEntries(colorMap));

        // 👉 穩定等待 UI 更新
        await page.waitForTimeout(5000);
    }

    // =========================================================
    // 🟢 9️⃣ 結束
    // =========================================================
    console.log("✅ 完成");

    await page.waitForTimeout(3000);
    await browser.close();

})();

// =========================================================
// 🌊 工具函式：自動滾動頁面（觸發 lazy load API）
// =========================================================
async function autoScroll(page: any) {
    await page.evaluate(async () => {

        await new Promise<void>((resolve) => {

            let total = 0;
            const distance = 500;

            const timer = setInterval(() => {

                window.scrollBy(0, distance);
                total += distance;

                // 👉 滾到底就停止
                if (total >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }

            }, 200);
        });
    });
}