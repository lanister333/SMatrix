import type { Metadata } from "next";
import GdedeshevleScreen from "@/components/site/gdedeshevle-screen";

/**
 * ШАГ 23: самостоятельный роут «Где дешевле».
 * Отдельная страница проекта SakhMatrix со своим URL /gde-deshevle —
 * не форум, не «Подслушано Сахалин», не «Где купить» и не рекламная
 * площадка (ТЗ п.1/30). Сравнение цен жителей Сахалина на конкретные товары.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Где дешевле — SakhMatrix",
  description:
    "Где дешевле купить конкретный товар на Сахалине: сравнивайте цены на конкретную модель, артикул или размер — Южно-Сахалинск, Холмск, Корсаков, Долинск. Обсуждение цен — на форуме.",
  keywords: ["где дешевле", "цены", "Сахалин", "Южно-Сахалинск", "Холмск", "Корсаков", "Долинск", "сравнение цен", "SakhMatrix"],
  openGraph: {
    title: "Где дешевле — SakhMatrix",
    description: "Сравнивайте цены на конкретный товар и находите, где его можно купить дешевле.",
    type: "website",
  },
};

export default function GdedeshevlePageRoute() {
  return <GdedeshevleScreen />;
}
