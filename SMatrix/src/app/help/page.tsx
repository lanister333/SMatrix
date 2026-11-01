import type { Metadata } from "next";
import HelpScreen from "@/components/site/help-screen";

/**
 * ШАГ 16 (исправление): самостоятельный роут «Нужна помощь».
 * Отдельная страница проекта SakhMatrix со своим URL /help —
 * не вкладка форума (?view=help больше не существует) и не часть
 * «Подслушано Сахалин». Дизайн в общем стиле проекта.
 */

export const metadata: Metadata = {
  title: "Нужна помощь — SakhMatrix",
  description:
    "Доска просьб о безвозмездной помощи для жителей Сахалина: опубликуйте просьбу, укажите место и контакт — желающие помочь свяжутся с вами напрямую. Только безвозмездная помощь.",
  keywords: ["Сахалин", "нужна помощь", "взаимопомощь", "Южно-Сахалинск", "SakhMatrix", "помощь жителям"],
  openGraph: {
    title: "Нужна помощь — SakhMatrix",
    description: "Сахалинская матрица взаимопомощи: просьбы о безвозмездной помощи жителей острова.",
    type: "website",
  },
};

export default function HelpPageRoute() {
  return <HelpScreen />;
}
