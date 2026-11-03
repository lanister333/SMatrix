const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const url = "http://157.22.252.127/forum/topic/1974006";
  console.log("Loading:", url);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Найти все img с class sk-msg-image
  const imgs = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("img"));
    return all.map((i) => ({ src: i.src, alt: i.alt, cls: i.className, parent: i.parentElement?.className }));
  });
  console.log("All imgs:", JSON.stringify(imgs, null, 2));

  // Найти текст с ![фото]
  const txt = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    const matches = [];
    for (const el of all) {
      if (el.children.length === 0) {
        const t = el.textContent || "";
        if (t.includes("![фото]") || t.includes("/media/uploads/")) {
          matches.push({ tag: el.tagName, cls: el.className, text: t.slice(0, 200) });
        }
      }
    }
    return matches;
  });
  console.log("Text containing ![фото]:", JSON.stringify(txt, null, 2));

  // Найти первое сообщение
  const firstMsg = await page.evaluate(() => {
    const el = document.querySelector(".sk-msg-body-first");
    return el ? { html: el.innerHTML.slice(0, 500), text: el.textContent?.slice(0, 200) } : null;
  });
  console.log("First msg (.sk-msg-body-first):", JSON.stringify(firstMsg, null, 2));

  await browser.close();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
