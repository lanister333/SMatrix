import type { Metadata } from "next";
import ZnakomstvaScreen from "@/components/site/znakomstva-screen";

/**
 * ШАГ 26: самостоятельный роут «Знакомства» — /znakomstva.
 * Единственный публично анонимный раздел SakhMatrix: ровно две категории,
 * объявления без ников и аватаров; автор известен системе и модерации.
 * Не форум, не «Объявления», без комментариев и обсуждений.
 */

export const metadata: Metadata = {
  title: "Знакомства — SakhMatrix",
  description:
    "Анонимные объявления о знакомствах для жителей Сахалина: «Мужчина ищет женщину» и «Женщина ищет мужчину». Публикации без ников и аватаров; автор известен системе и модерации. Без комментариев и обсуждений.",
  keywords: ["знакомства", "Сахалин", "Южно-Сахалинск", "Холмск", "Корсаков", "анонимные объявления", "SakhMatrix"],
  openGraph: {
    title: "Знакомства — SakhMatrix",
    description: "Анонимные объявления о знакомствах для жителей Сахалина. Автор известен системе и модерации.",
    type: "website",
  },
};

export default function ZnakomstvaPageRoute() {
  return <ZnakomstvaScreen />;
}
