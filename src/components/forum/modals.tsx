"use client";

import { useCallback, useEffect, useState } from "react";
import type { ForumUser, Rubric } from "@/lib/ui";

/**
 * ШАГ 11. Модалка «Оспорить решение» — апелляция на скрытие сообщения
 * или на ограничение аккаунта. Апелляцию рассматривает человек-модератор;
 * ИИ не пересматривает собственные решения.
 */
export function AppealModal(props: {
  target: { messageId?: string; sanctionId?: string; label: string };
  onClose: () => void;
  onDone: (msg: string) => void;
  token: string | null;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/appeals/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          messageId: props.target.messageId,
          sanctionId: props.target.sanctionId,
          text: text.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка отправки");
      props.onDone(d.note || "Апелляция отправлена. Её рассмотрит человек-модератор.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
      setBusy(false);
    }
  };
  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>Оспорить решение</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-hint" style={{ marginTop: 0, marginBottom: 8 }}>
            Оспаривается: <b>{props.target.label}</b>
          </div>
          <div className="sk-appeal-note">
            Апелляцию рассматривает человек-модератор. ИИ не пересматривает собственные спорные решения — человек может
            отменить решение ИИ. Модерация направлена на нарушения правил, а не на подавление критики.
          </div>
          <div className="sk-modal-row">
            <label>Почему вы считаете решение ошибочным?</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
              placeholder="Опишите ситуацию…"
              style={{ minHeight: 110 }}
            />
          </div>
          {error && <div className="sk-modal-err">{error}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" style={{ marginTop: 0 }} onClick={props.onClose} disabled={busy}>
              Отмена
            </button>
            <button
              className="sk-btn-classic right"
              style={{ marginTop: 0 }}
              disabled={busy || text.trim().length < 10}
              onClick={submit}
            >
              {busy ? "Отправка…" : "Отправить апелляцию"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SECRET_QUESTIONS = [
  "Девичья фамилия матери",
  "Кличка первого домашнего животного",
  "Название вашей первой школы",
  "Город, где вы родились",
  "Марка первого автомобиля",
  "Ваше любимое блюдо",
];

/** ШАГ 27: initialTab — какая вкладка открыта сразу («login» | «register»);
 *  навигация открывает «Войти» и «Зарегистрироваться» разными вкладками. */
export function AuthModal(props: { onClose: () => void; onLogin: (token: string, user: ForumUser) => void; standalone?: boolean; initialTab?: "login" | "register" }) {
  const [tab, setTab] = useState(props.initialTab === "register" ? "register" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needVerify, setNeedVerify] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [reg, setReg] = useState({
    nickname: "",
    email: "",
    password: "",
    password2: "",
    // ТЗ 2026-09-21: при регистрации строго два пола; по умолчанию выбран первый («Мужчина»).
    gender: "male",
    question: SECRET_QUESTIONS[0],
    answer: "",
  });
  const [captcha, setCaptcha] = useState<{ id: string; question: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [verifyPath, setVerifyPath] = useState("");
  const [recEmail, setRecEmail] = useState("");
  const [resetPath, setResetPath] = useState("");

  const loadCaptcha = useCallback(() => {
    setCaptchaAnswer("");
    fetch("/api/auth/captcha")
      .then((r) => r.json())
      .then((r) => setCaptcha({ id: r.id, question: r.question }))
      .catch(() => setCaptcha(null));
  }, []);

  useEffect(() => {
    if (tab === "register" && !captcha) loadCaptcha();
  }, [tab, captcha, loadCaptcha]);

  const doLogin = async () => {
    setBusy(true);
    setError("");
    setNeedVerify(false);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.needVerify) setNeedVerify(true);
        throw Error(data.error || "Ошибка входа");
      }
      props.onLogin(data.user.token, data.user);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const doResend = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Ошибка");
      setError("");
      setVerifyPath(data.verifyPath || "");
      setTab("register");
      window.setTimeout(() => setTab("done-verify"), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: reg.nickname.trim(),
          email: reg.email.trim(),
          password: reg.password,
          password2: reg.password2,
          gender: reg.gender,
          question: reg.question,
          answer: reg.answer,
          captchaId: captcha?.id || "",
          captchaAnswer,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Ошибка регистрации");
      setVerifyPath(data.verifyPath || "");
      setTab("done-verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка регистрации");
      loadCaptcha();
    } finally {
      setBusy(false);
    }
  };

  const doRecover = async () => {
    setBusy(true);
    setError("");
    setResetPath("");
    try {
      const r = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recEmail.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Ошибка");
      setResetPath(data.resetPath || "ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setReg((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal sk-modal-auth" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>{props.standalone ? "Вход на SakhMatrix" : "Вход на форум"}</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          {tab !== "done-verify" && (
            <div className="sk-auth-tabs">
              <button
                className={tab === "login" ? "active" : ""}
                onClick={() => {
                  setTab("login");
                  setError("");
                }}
              >
                Вход
              </button>
              <button
                className={tab === "register" ? "active" : ""}
                onClick={() => {
                  setTab("register");
                  setError("");
                }}
              >
                Регистрация
              </button>
            </div>
          )}

          {tab === "login" && (
            <>
              <div className="sk-modal-row">
                <label>Email:</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.ru"
                  autoComplete="email"
                />
              </div>
              <div className="sk-modal-row">
                <label>Пароль:</label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Ваш пароль"
                  autoComplete="current-password"
                />
              </div>
              <button
                className="sk-btn-classic"
                style={{ marginTop: 0 }}
                disabled={busy || !loginEmail.trim() || !loginPass}
                onClick={doLogin}
              >
                {busy ? "Вход…" : "Войти"}
              </button>
              <div className="sk-modal-links">
                <a
                  onClick={() => {
                    setTab("recover");
                    setError("");
                    setResetPath("");
                  }}
                >
                  Забыли пароль?
                </a>
              </div>
              {needVerify && (
                <div className="sk-modal-demo">
                  Email не подтверждён.{" "}
                  <a onClick={doResend}>Отправить письмо подтверждения ещё раз</a>
                </div>
              )}
              <p className="sk-modal-hint">
                Писать могут только авторизованные пользователи. Нет аккаунта — регистрация занимает меньше минуты.
              </p>
            </>
          )}

          {tab === "register" && (
            <>
              <div className="sk-modal-row">
                <label>Ник (публичный):</label>
                <input value={reg.nickname} onChange={setField("nickname")} placeholder={props.standalone ? "Как вас будут видеть на сайте" : "Как вас будут видеть на форуме"} maxLength={20} />
              </div>
              <div className="sk-modal-row">
                <label>Email:</label>
                <input type="email" value={reg.email} onChange={setField("email")} placeholder="you@example.ru" autoComplete="email" />
              </div>
              <div className="sk-modal-row">
                <label>Пароль (от 8 символов, буквы и цифры):</label>
                <input type="password" value={reg.password} onChange={setField("password")} autoComplete="new-password" />
              </div>
              <div className="sk-modal-row">
                <label>Повторите пароль:</label>
                <input type="password" value={reg.password2} onChange={setField("password2")} autoComplete="new-password" />
              </div>
              <div className="sk-modal-row">
                <label>Пол (только цвет вашего ника, нигде не подписывается):</label>
                <div className="sk-gender-row" role="radiogroup" aria-label="Пол">
                  <label>
                    <input
                      type="radio"
                      name="gender"
                      checked={reg.gender === "male"}
                      onChange={() => setReg((p) => ({ ...p, gender: "male" }))}
                    />{" "}
                    Мужчина
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="gender"
                      checked={reg.gender === "female"}
                      onChange={() => setReg((p) => ({ ...p, gender: "female" }))}
                    />{" "}
                    Женщина
                  </label>
                  {/* ТЗ 2026-09-21: вариант «Не указан» удалён — при регистрации строго два пола */}
                </div>
              </div>
              <div className="sk-modal-row">
                <label>
                  CAPTCHA: <b>{captcha?.question || "…"}</b>{" "}
                  <a onClick={loadCaptcha} title="Обновить вопрос">
                    [обновить]
                  </a>
                </label>
                <input value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} placeholder="Ответ числом" inputMode="numeric" />
              </div>
              <div className="sk-modal-row">
                <label>Контрольный вопрос (для защиты аккаунта):</label>
                <select value={reg.question} onChange={setField("question")}>
                  {SECRET_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
                <input value={reg.answer} onChange={setField("answer")} placeholder="Ответ на контрольный вопрос" style={{ marginTop: 6 }} />
              </div>
              <button
                className="sk-btn-classic"
                style={{ marginTop: 0 }}
                disabled={
                  busy || !reg.nickname.trim() || !reg.email.trim() || !reg.password || !reg.password2 || !captchaAnswer.trim() || !reg.answer.trim()
                }
                onClick={doRegister}
              >
                {busy ? "Регистрация…" : "Зарегистрироваться"}
              </button>
              <p className="sk-modal-hint">
                После регистрации мы отправим на email письмо со ссылкой подтверждения. Вход — только после подтверждения.
              </p>
            </>
          )}

          {tab === "done-verify" && (
            <div className="sk-mail-done">
              <div className="md-title">Письмо отправлено</div>
              <p>
                Мы отправили на <b>{reg.email.trim()}</b> письмо со ссылкой подтверждения. Откройте его — и аккаунт активируется
                автоматически.
              </p>
              {verifyPath && (
                <div className="sk-modal-demo">
                  Демо-режим: почтовый шлюз не подключён, ваше письмо —{" "}
                  <a href={verifyPath}>открыть ссылку подтверждения</a>
                </div>
              )}
              <button
                className="sk-btn-classic"
                onClick={() => {
                  setTab("login");
                  setError("");
                }}
              >
                К окну входа
              </button>
            </div>
          )}

          {tab === "recover" && !resetPath && (
            <>
              <p className="sk-modal-hint" style={{ marginTop: 0 }}>
                Введите email, указанный при регистрации — пришлём ссылку для смены пароля.
              </p>
              <div className="sk-modal-row">
                <label>Email:</label>
                <input type="email" value={recEmail} onChange={(e) => setRecEmail(e.target.value)} placeholder="you@example.ru" />
              </div>
              <button className="sk-btn-classic" style={{ marginTop: 0 }} disabled={busy || !recEmail.trim()} onClick={doRecover}>
                {busy ? "Отправка…" : "Отправить ссылку восстановления"}
              </button>
            </>
          )}

          {tab === "recover" && resetPath && (
            <div className="sk-mail-done">
              <div className="md-title">Письмо отправлено</div>
              <p>
                Ссылка для смены пароля отправлена на <b>{recEmail.trim()}</b> (действует 1 час).
              </p>
              {resetPath !== "ok" && (
                <div className="sk-modal-demo">
                  Демо-режим: почтовый шлюз не подключён, ваше письмо — <a href={resetPath}>открыть ссылку восстановления</a>
                </div>
              )}
              <button
                className="sk-btn-classic"
                onClick={() => {
                  setTab("login");
                  setResetPath("");
                  setError("");
                }}
              >
                К окну входа
              </button>
            </div>
          )}

          {error && <div className="sk-modal-err">{error}</div>}
        </div>
      </div>
    </div>
  );
}

export function ResetModal(props: { token: string; onClose: () => void; onLogin: (token: string, user: ForumUser) => void }) {
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, password: pass1, password2: pass2 }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Ошибка");
      props.onLogin(data.user.token, data.user);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>Новый пароль</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <p className="sk-modal-hint" style={{ marginTop: 0 }}>
            Ссылка из письма подтверждена. Задайте новый пароль (от 8 символов, буквы и цифры).
          </p>
          <div className="sk-modal-row">
            <label>Новый пароль:</label>
            <input type="password" value={pass1} onChange={(e) => setPass1(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="sk-modal-row">
            <label>Повторите пароль:</label>
            <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="sk-btn-classic" style={{ marginTop: 0 }} disabled={busy || !pass1 || !pass2} onClick={submit}>
            {busy ? "Сохранение…" : "Сохранить пароль"}
          </button>
          {error && <div className="sk-modal-err">{error}</div>}
        </div>
      </div>
    </div>
  );
}

export function NewTopicModal(props: {
  token: string;
  initialRubric: { slug: string; name: string } | null;
  /**
   * ТЗ 2026-09-24 «Обсудить на форуме из отзыва»: опциональные поля
   * предзаполнения формы новой темы. Передаются со страницы рубрики
   * после подтягивания отзыва из БД (GET /api/recommend/[id]).
   *
   *   initialTitle   — подставляется в поле «Заголовок» ( maxLength 150 ).
   *   initialMessage — подставляется в textarea «Сообщение»
   *                    (maxLength 20000, уже содержит ссылку на источник).
   *
   * Состояние инициализируется лениво: useState с дефолтом из props.*
   * только при первом монтировании, чтобы пользователь мог свободно
   * редактировать поля после открытия формы.
   */
  initialTitle?: string;
  initialMessage?: string;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rubricId, setRubricId] = useState<number | null>(null);
  const [title, setTitle] = useState(props.initialTitle ?? "");
  const [body, setBody] = useState(props.initialMessage ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        const list: Rubric[] = r.rubrics || [];
        setRubrics(list);
        if (props.initialRubric) {
          const all = list.flatMap((x) => [x, ...x.children]);
          const found = all.find((x) => x.slug === props.initialRubric?.slug) || all.find((x) => x.name === props.initialRubric?.name);
          if (found) setRubricId(found.id);
        }
      })
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!rubricId) {
      setError("Выберите раздел, в котором публикуется тема");
      return;
    }
    if (title.trim().length < 5) {
      setError("Заголовок слишком короткий — минимум 5 символов");
      return;
    }
    if (!body.trim()) {
      setError("Напишите текст сообщения — это суть темы");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubricId, title: title.trim(), body: body.trim(), token: props.token }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Не удалось опубликовать. Проверьте связь и попробуйте ещё раз.");
      props.onCreated(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось опубликовать. Проверьте связь и попробуйте ещё раз.");
      setBusy(false);
    }
  };

  const options = rubrics
    .filter((r) => !r.isService)
    .flatMap((r) => [{ id: r.id, label: r.name }, ...r.children.map((c) => ({ id: c.id, label: `${r.name} → ${c.name}` }))]);
  const current = options.find((o) => o.id === rubricId);

  return (
    <div className="sk-modal-overlay" onClick={busy ? undefined : props.onClose}>
      <div className="sk-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>Новая тема</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть" disabled={busy}>
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-row">
            <label>Раздел:</label>
            <div className="sk-modal-rubric">
              {current ? (
                <span className="sk-rubric-current">{current.label}</span>
              ) : (
                <span className="sk-rubric-current none">раздел не выбран</span>
              )}
            </div>
            <select value={rubricId ?? ""} onChange={(e) => setRubricId(parseInt(e.target.value) || null)}>
              <option value="">— выберите раздел —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sk-modal-row">
            <label>Заголовок:</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="О чём тема? (от 5 до 150 символов)" />
            <div className="sk-charcount">
              <span className={title.length > 140 ? "over" : ""}>{title.length}/150</span>
            </div>
          </div>
          <div className="sk-modal-row">
            <label>Сообщение:</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              rows={10}
              placeholder="Опишите вопрос или ситуацию подробно — так проще получить дельный ответ."
              style={{ minHeight: 220, resize: "vertical" }}
            />
            <div className="sk-charcount">
              <span className={body.length > 18000 ? "over" : ""}>{body.length}/20000</span>
            </div>
          </div>
          {error && <div className="sk-modal-err">{error}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" style={{ marginTop: 0 }} onClick={props.onClose} disabled={busy}>
              Отмена
            </button>
            <button
              className="sk-btn-classic right"
              style={{ marginTop: 0 }}
              disabled={busy || !rubricId || title.trim().length < 5 || !body.trim()}
              onClick={submit}
            >
              {busy ? "Проверяем и публикуем…" : "Опубликовать"}
            </button>
          </div>
          <div className="sk-modal-hint" style={{ marginTop: 6 }}>
            Тема будет доступна сразу после публикации и проверки ИИ-модерацией. Права на редактирование и удаление — только у автора
            темы.
          </div>
        </div>
      </div>
    </div>
  );
}
