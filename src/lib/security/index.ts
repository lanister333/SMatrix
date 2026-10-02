/**
 * ПРОМТ №1 (защита платформы): экспорты.
 *
 *   client-info    — IP/UA/fingerprint извлечение.
 *   login-guard    — лимитер входа (5/10 попыток, lockout, auto-link аккаунтов).
 *   password-blacklist — проверка слабых паролей (>= 200 + паттерны).
 *   rate-limits    — лимиты для fresh-account в форуме/жалобах/ЛС.
 *   complaint-guard — унификация жалоб: rate-limit + рейд-детектор + уникальность.
 */

export * from "./client-info";
export * from "./login-guard";
export * from "./password-blacklist";
export * from "./rate-limits";
export * from "./complaint-guard";
