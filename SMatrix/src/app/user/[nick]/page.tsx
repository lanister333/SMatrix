"use client";

import UserScreen from "@/components/site/user-screen";

/**
 * 2026-10-01: самостоятельная страница профиля пользователя /user/[nick].
 * UserScreen читает ник из URL (window.location.pathname) на стороне клиента.
 */

export default function UserProfilePage() {
  return <UserScreen />;
}
