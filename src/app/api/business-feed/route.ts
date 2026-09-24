import { NextResponse } from "next/server";

/**
 * biz-rotator: лента рубрики «Поддержка молодого бизнеса» — HTML-монолит,
 * который клиент бесшовно вставляет в центр Главной вместо сетки разделов
 * (biz-ajax, без перезагрузки страницы).
 *
 * ВРЕМЕННАЯ СЕРВИСНАЯ ЗАГЛУШКА: платформенный откат рабочего пространства
 * (снапшот 19.09) стёр прежний утверждённый контент ленты вместе с файлом.
 * Данные НЕ выдумываются — контент будет восстановлен по указанию заказчика
 * (например, из опубликованной версии сайта, если она выкладывалась кнопкой
 * Publish). Механика открытия ленты из ротатора/шапки ячейки сохранена.
 */
export async function GET() {
  const html = `
<div style="background:#fff;border:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:18px 16px 20px">
  <div style="color:#1f3a5f;font-size:16px;font-weight:800;margin:0 0 8px">Поддержка молодого бизнеса</div>
  <p style="color:#475569;font-size:13.5px;line-height:1.55;margin:0 0 10px">
    Лента рубрики временно показывается не полностью: 21.09.2026 технический откат
    платформы вернул рабочее пространство к старому снимку, и часть свежего контента
    была утрачена. Мы восстанавливаем блоги новых компаний острова.
  </p>
  <p style="color:#475569;font-size:13.5px;line-height:1.55;margin:0">
    Уже ведёте своё дело на Сахалине? Скоро здесь снова можно будет рассказать о нём
    и читать блоги других новичков.
  </p>
</div>`.trim();
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
