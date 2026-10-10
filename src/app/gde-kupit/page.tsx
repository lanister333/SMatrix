import type { Metadata } from "next";
import WhereToBuyScreen from "@/components/site/wheretobuy-screen";

/**
 * ШАГ 18: самостоятельный роут «Где купить».
 * Отдельная страница проекта SakhMatrix со своим URL /gde-kupit —
 * не форум, не «Подслушано Сахалин», не «Нужна помощь» и не рекламная
 * площадка (ТЗ п.1/27). Вопросы жителей о конкретных товарах Сахалина.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Где купить — SakhMatrix",
  description:
    "Где купить конкретный товар на Сахалине: задайте вопрос о конкретной модели, артикуле или размере — Южно-Сахалинск, Холмск, Корсаков, Долинск. Ответы жителей — в обсуждении на форуме.",
  keywords: ["где купить", "Сахалин", "Южно-Сахалинск", "Холмск", "Корсаков", "Долинск", "товары", "магазины", "SakhMatrix"],
  openGraph: {
    title: "Где купить — SakhMatrix",
    description: "Задайте вопрос о том, где на Сахалине купить конкретный товар.",
    type: "website",
  },
};

export default function WhereToBuyPageRoute() {
  return <WhereToBuyScreen />;
}
