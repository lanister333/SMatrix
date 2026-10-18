/**
 * Манифест SakhMatrix — блок для правой колонки (СОКРАЩЁННАЯ версия).
 *
 * 2026-10-18: сокращён до 1 тезиса + слоган + ссылка «Читать полностью».
 * Раньше было 4 тезиса — слишком длинно для сайдбара.
 */

export function ManifestTrust() {
  return (
    <div className="sk-sidezone sk-manifest">
      <div className="sk-blocktitle">
        <span className="tri">▼</span>📋 Манифест SakhMatrix
      </div>

      <div className="sk-manifest-content">
        <p className="sk-manifest-eyebrow">Сахалинская матрица взаимопомощи</p>
        <p className="sk-manifest-slogan">«Спроси у города — город ответит.»</p>
        <p className="sk-manifest-p">
          Пространство взаимопомощи жителей Сахалина: знания, опыт и готовность
          помогать друг другу. Критика и несогласие — не нарушение.
        </p>
        <a
          href="/manifest"
          className="sk-manifest-readmore"
          title="Открыть полный текст Манифеста SakhMatrix"
        >
          Читать манифест полностью →
        </a>
      </div>
    </div>
  );
}

export default ManifestTrust;
