
const ZAI = (await import("z-ai-web-dev-sdk")).default;
const zai = await ZAI.create();
const t0 = Date.now();
const r = await zai.chat.completions.create({
  messages: [{ role: "user", content: "Ответь одним словом: пинг" }],
  thinking: { type: "disabled" },
});
console.log("SDK OK за", Date.now() - t0, "мс. Ответ:", JSON.stringify(r.choices?.[0]?.message?.content ?? null).slice(0, 120));
