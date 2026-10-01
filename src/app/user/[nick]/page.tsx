import type { Metadata } from "next";
import UserScreen from "@/components/site/user-screen";

/**
 * 2026-10-01: самостоятельная страница профиля пользователя /user/[nick].
 * Показывает: ник (по полу), дату регистрации, кол-во тем и сообщений,
 * список последних 10 тем и 10 сообщений пользователя.
 * Источник данных: /api/users/[nick].
 * Каркас: бирюзовая шапка (Masthead), синяя навигация (MainNav),
 * трёхколоночный монолит (ForumSideNav | профиль | HomeRight), футер.
 */

export const metadata: Metadata = {
  title: "Профиль пользователя — SakhMatrix",
  description: "Профиль пользователя форума SakhMatrix: темы, сообщения, дата регистрации.",
};

export default async function UserProfilePage({ params }: { params: Promise<{ nick: string }> }) {
  const { nick } = await params;
  const decoded = decodeURIComponent(nick);
  return <UserScreen nick={decoded} />;
}
