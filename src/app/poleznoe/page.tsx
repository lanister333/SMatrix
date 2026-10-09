import type { Metadata } from "next";
import PoleznoeScreen from "@/components/site/poleznoe-screen";

/**
 * ШАГ 24 (восстановление): самостоятельный роут «Полезное».
 * Справочный раздел SakhMatrix: пять сервисов с полезной информацией
 * для жителей Сахалина — важные телефоны, паром, автовокзал, аэропорт,
 * потерянные документы.
 */

export const metadata: Metadata = {
  title: "Полезное — SakhMatrix",
  description:
    "Полезные сервисы для жителей Сахалина: важные телефоны экстренных служб, паром Ванино — Холмск, автовокзал, аэропорт Южно-Сахалинска, что делать при потере документов.",
  keywords: ["полезное", "телефоны", "паром Ванино Холмск", "автовокзал", "аэропорт Южно-Сахалинск", "потерянные документы", "Сахалин", "SakhMatrix"],
  openGraph: {
    title: "Полезное — SakhMatrix",
    description: "Важные телефоны, паром, автобусы, аэропорт и инструкции для жителей Сахалина.",
    type: "website",
  },
};

export default function PoleznoePageRoute() {
  return <PoleznoeScreen />;
}
