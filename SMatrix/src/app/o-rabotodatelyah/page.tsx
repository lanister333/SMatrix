import type { Metadata } from "next";
import EmployersScreen from "@/components/site/employers-screen";

/**
 * ШАГ (восстановление): самостоятельный роут «О работодателях».
 * Отдельная страница проекта SakhMatrix со своим URL /o-rabotodatelyah —
 * не форум и не рекламная площадка. Отзывы о работодателях Сахалина
 * на основе личного опыта работы.
 */

export const metadata: Metadata = {
  title: "О работодателях — SakhMatrix",
  description:
    "Фиксация личного трудового опыта жителей Сахалина и Курил: компания, период работы, факты. Без «чёрных списков» и лозунгов; вакансии и личные данные физлиц запрещены.",
  keywords: ["работодатели", "опыт работы", "Сахалин", "Южно-Сахалинск", "Холмск", "Корсаков", "зарплата", "трудовой опыт", "SakhMatrix"],
  openGraph: {
    title: "О работодателях — SakhMatrix",
    description: "Сухая фиксация личного трудового опыта: компания, период работы, факты — без лозунгов и «чёрных списков».",
    type: "website",
  },
};

export default function EmployersPageRoute() {
  return <EmployersScreen />;
}
