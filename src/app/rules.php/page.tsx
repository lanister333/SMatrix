import type { Metadata } from "next";
import { RulesScreen } from "@/components/site/static-screens";

/**
 * Директива «Чистка навигации» (задача nav-cleanup-2026-09-18):
 * самостоятельный роут «Правила форума» — единственный оставшийся
 * пункт меню «Ещё» №1 (href="/rules.php" в chrome.tsx). Легаси-стиль
 * адресов проекта — как /traffic.php, /weather.php. Содержимое —
 * тот же RulesPage, что был в SPA-виде view=rules (источник один —
 * components/forum/pages.tsx, дублирования нет).
 */

export const metadata: Metadata = {
  title: "Правила форума — SakhMatrix",
  description:
    "Правила форума SakhMatrix: порядок создания тем и сообщений, мягкая система санкций, модерация ИИ и человека-модератора, порядок обжалования решений.",
  keywords: ["правила форума", "SakhMatrix", "Сахалин", "модерация", "санкции"],
  openGraph: {
    title: "Правила форума — SakhMatrix",
    description: "Правила форума SakhMatrix: порядок публикаций, модерация, санкции и обжалование.",
    type: "website",
  },
};

export default function RulesPageRoute() {
  return <RulesScreen />;
}
