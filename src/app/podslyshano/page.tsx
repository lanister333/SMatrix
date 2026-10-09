import type { Metadata } from "next";
import OverheardScreen from "@/components/site/overheard-screen";

/**
 * ШАГ 17: самостоятельный роут «Подслушано Сахалин».
 * Отдельная страница проекта SakhMatrix со своим URL /podslyshano —
 * не форум, не «Нужна помощь» и не часть другой ленты (ТЗ п.1/23).
 * Городская лента слухов, наблюдений и сообщений жителей.
 */

export const metadata: Metadata = {
  title: "Подслушано Сахалин — SakhMatrix",
  description:
    "Городская лента слухов, наблюдений и сообщений жителей Сахалина: что слышали и заметили в городе — Южно-Сахалинск, Корсаков, Холмск. Не вся информация является подтверждённым фактом.",
  keywords: ["подслушано", "Сахалин", "слухи", "наблюдения", "Южно-Сахалинск", "Корсаков", "Холмск", "SakhMatrix"],
  openGraph: {
    title: "Подслушано Сахалин — SakhMatrix",
    description: "Городская лента слухов, наблюдений и сообщений жителей Сахалина.",
    type: "website",
  },
};

export default function PodslushanoPageRoute() {
  return <OverheardScreen />;
}
