import type { Metadata } from "next";
import { FeedbackScreen } from "@/components/site/static-screens";

/**
 * Директива «Чистка навигации» (задача nav-cleanup-2026-09-18):
 * самостоятельный роут «Обращение к администратору» — единственный
 * оставшийся пункт меню «Ещё» №2 (href="/feedback.php" в chrome.tsx).
 * Легаси-стиль адресов проекта — как /traffic.php, /weather.php.
 * Содержимое — тот же AppealPage, что был в SPA-виде view=appeal
 * (источник один — components/forum/pages.tsx, дублирования нет).
 */

export const metadata: Metadata = {
  title: "Обращение к администратору — SakhMatrix",
  description:
    "Обращение к администратору SakhMatrix: обжалование решений модерации, вопросы и предложения по работе проекта.",
  keywords: ["обращение к администратору", "SakhMatrix", "апелляция", "обжалование", "Сахалин"],
  openGraph: {
    title: "Обращение к администратору — SakhMatrix",
    description: "Обжалование решений модерации, вопросы и предложения по проекту SakhMatrix.",
    type: "website",
  },
};

export default function FeedbackPageRoute() {
  return <FeedbackScreen />;
}
