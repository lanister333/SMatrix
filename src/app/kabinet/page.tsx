import type { Metadata } from "next";
import OrgCabinetScreen from "@/components/site/org-cabinet";

/**
 * ТЗ 2026-09-22: «Кабинет представителя организации» — отдельный роут
 * /kabinet (.matrix-business-cabinet). Представитель организации (orgRep)
 * видит отзывы жителей о своей организации и даёт ЕДИНСТВЕННЫЙ официальный
 * ответ (Пункт 13 Манифеста, паттерн ЖКХ). Ответ публикуется и в ленте
 * /rekomenduyu (блок .review-official-response).
 */

export const metadata: Metadata = {
  title: "Кабинет представителя организации — SakhMatrix",
  description:
    "Кабинет представителя организации: отзывы жителей Сахалина о вашей компании и один официальный ответ на каждый отзыв по правилам SakhMatrix.",
  robots: { index: false },
};

export default function KabinetPageRoute() {
  return <OrgCabinetScreen />;
}
