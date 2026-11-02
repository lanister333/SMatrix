import type { Metadata } from "next";
import { AboutScreen } from "@/components/site/static-screens";

/**
 * Директива «Чистка навигации» (задача nav-cleanup-2026-09-18):
 * самостоятельный роут «О проекте» — единственный оставшийся пункт
 * меню «Ещё» №3 (href="/about.php" в chrome.tsx). Легаси-стиль адресов
 * проекта — как /traffic.php, /weather.php. Содержимое — тот же
 * AboutPage, что был в SPA-виде view=about (источник один —
 * components/forum/pages.tsx, дублирования нет).
 */

export const metadata: Metadata = {
  title: "О проекте — SakhMatrix",
  description:
    "SakhMatrix — Сахалинская матрица взаимопомощи: независимый форум-портал для жителей острова. О проекте, модерации и правилах санкций.",
  keywords: ["о проекте", "SakhMatrix", "Сахалин", "форум", "взаимопомощь"],
  openGraph: {
    title: "О проекте — SakhMatrix",
    description: "SakhMatrix — Сахалинская матрица взаимопомощи: о проекте и модерации.",
    type: "website",
  },
};

export default function AboutPageRoute() {
  return <AboutScreen />;
}
