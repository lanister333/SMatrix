/**
 * Манифест SakhMatrix — блок для правой колонки.
 *
 * Сокращённая версия Манифеста: слоган + ключевые тезисы (1, 5, 9, 13).
 * Полный текст (13 пунктов) — на странице /manifest (src/app/manifest/page.tsx).
 *
 * Дизайн: как у остальных блоков сайта — синяя шапка с маркером ▼
 * (.sk-blocktitle), белое тело (.sk-sidezone с border+box-shadow), текст
 * внутри. Высота — по содержимому; ссылка «Читать манифест полностью →»
 * прижата к низу через margin-top:auto (.sk-manifest).
 */

export function ManifestTrust() {
  return (
    <div className="sk-sidezone sk-manifest">
      <div className="sk-blocktitle">
        <span className="tri">▼</span>📋 Манифест SakhMatrix
      </div>

      <div className="sk-manifest-content">
        <p className="sk-manifest-eyebrow">Сахалинская матрица взаимопомощи</p>

        {/* Слоган — курсивом */}
        <p className="sk-manifest-slogan">«Спроси у города — город ответит.»</p>

        {/* Краткий тезис 1: зачем существует SakhMatrix */}
        <h3 className="sk-manifest-h">Зачем существует SakhMatrix</h3>
        <p className="sk-manifest-p">
          SakhMatrix создан как пространство взаимопомощи жителей Сахалина. Его
          задача — соединять людей, их знания, опыт, вопросы, наблюдения и
          готовность помогать друг другу.
        </p>

        {/* Краткий тезис 5: живой единый организм */}
        <h3 className="sk-manifest-h">Живой организм Сахалина</h3>
        <p className="sk-manifest-p">
          SakhMatrix — живой единый организм информационной жизни Сахалина. Мы
          создаём фундамент, но его дальнейшее развитие определяется
          взаимодействием людей и изменениями самого города.
        </p>

        {/* Краткий тезис 9: «Не нравится ≠ нарушение» */}
        <h3 className="sk-manifest-h">Не нравится ≠ нарушение</h3>
        <p className="sk-manifest-p">
          Критика, несогласие, негативное мнение и жалоба сами по себе не
          являются нарушением. Живой организм не означает единомыслие.
        </p>

        {/* Краткий тезис 13: главная формула */}
        <h3 className="sk-manifest-h">Главная формула</h3>
        <p className="sk-manifest-p">
          SakhMatrix — это пространство, где знания, опыт и готовность людей
          помогать друг другу соединяются в постоянно развивающуюся
          информационную среду Сахалина.
        </p>

        {/* Ссылка «Читать полностью» — прижата к низу блока */}
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
