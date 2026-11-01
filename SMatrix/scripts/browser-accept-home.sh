#!/bin/bash
# Браузерная приёмка главной страницы по согласованному макету (ШАГ 27):
# шапка/навигация с поиском и входом, три колонки, блоки по макету,
# правая колонка (погода/валюты/отключения/телефоны), футер, мобильная
# ширина 390px, консоль без ошибок, скриншоты.
cd /home/z/my-project || exit 1
mkdir -p download/screens

fail=0
chk() { if [ "$2" = "1" ]; then echo "«$1»: есть"; else echo "«$1»: НЕТ"; fail=1; fi; }

echo "========== / — десктоп =========="
agent-browser close > /dev/null 2>&1
agent-browser open "http://localhost:3000/" > /dev/null 2>&1 || { echo "ОТКРЫТЬ НЕ УДАЛОСЬ"; exit 2; }
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 1
echo "title: $(agent-browser get title)"
agent-browser set viewport 1500 1000 > /dev/null 2>&1
sleep 0.5

snap=$(agent-browser snapshot -c 2>/dev/null)
# ШАГ 27: DOM-проверки через eval — снапшот сжимает строки и режет часть текстов
dom=$(agent-browser eval "JSON.stringify({ph: document.body.innerText.includes('Экстренные службы'), ver: document.body.innerText.includes('Версия 1.0'), sw: document.documentElement.scrollWidth})" 2>/dev/null)
echo "DOM-проверки (Экстренные службы / Версия 1.0 / scrollWidth): $dom"
echo "$dom" | grep -q 'ph..:true' || { echo "«Экстренные службы» в DOM: НЕТ"; fail=1; }
echo "$dom" | grep -q 'ver..:true' || { echo "«Версия 1.0» в DOM: НЕТ"; fail=1; }
for item in "Подслушано Сахалин" "Последние темы форума" "Поддержка молодого бизнеса" "Исполнители" "Нужна помощь" "Рекомендую / Не рекомендую" "Где дешевле" "Где купить" "О работодателях" "ЖКХ и городские проблемы" "Объявления" "Знакомства" "Погода на Сахалине" "Курсы валют" "Отключения" "Полезные телефоны и службы" "Войти" "Зарегистрироваться" "Навигация" "Рубрики форума" "Служебный раздел" "Новые сообщения" "Популярные темы" "Активные темы" "Мои темы" "Мои сообщения" "Избранное" "Архив тем" "Предложения и вопросы модератору" "Показать все" "Обновлено" "ЦБ РФ" "Правила SakhMatrix" "Правила публикаций" "Контакты проекта" "Все права защищены" "Техническая информация" "не являются официальной позицией"; do
  if echo "$snap" | grep -q "$item"; then chk "$item" 1; else chk "$item" 0; fi
done

echo ""
echo "---- Чего на главной быть НЕ должно ----"
for item in "Добавить тему" "Вы не вошли" "Вход / регистрация" "Поиск по темам" "Закреплённые темы" "Открыть страницу »"; do
  if echo "$snap" | grep -q "$item"; then echo "«$item»: НАЙДЕНО (не должно быть)"; fail=1; else echo "«$item»: отсутствует ✓"; fi
done

echo ""
echo "---- Ошибки консоли ----"
errs=$(agent-browser errors 2>/dev/null | tail -n +2)
if [ -n "$errs" ]; then echo "PAGE ERRORS: $errs"; fail=1; else echo "page errors: 0"; fi

agent-browser screenshot "download/screens/home-new-desktop.png" > /dev/null 2>&1 && echo "screenshot: home-new-desktop.png ok"

echo ""
echo "---- Поиск из навигации ----"
agent-browser open "http://localhost:3000/" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
agent-browser find text "Поиск по форуму" 2>/dev/null | head -2
# Вводим запрос в навигационный поиск и отправляем
agent-browser type "input#sm-nav-search" "краб" > /dev/null 2>&1 || { echo "ввод в поиск: НЕ УДАЛОСЬ"; fail=1; }
agent-browser press Enter > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 1
url=$(agent-browser get url)
echo "после поиска url: $url"
echo "$url" | grep -q "view=search" || { echo "ПОИСК НЕ ВЕДЁТ К РЕЗУЛЬТАТАМ"; fail=1; }
search_snap=$(agent-browser snapshot -c 2>/dev/null)
echo "$search_snap" | grep -q "Поиск по форуму" && echo "страница результатов: есть" || { echo "страница результатов: НЕТ"; fail=1; }

echo ""
echo "---- Переход «Форум» и клик по теме с главной ----"
agent-browser open "http://localhost:3000/" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 1
agent-browser find text "Форум" click > /dev/null 2>&1 || agent-browser click "text=Форум" > /dev/null 2>&1
sleep 1
url=$(agent-browser get url)
echo "после «Форум» url: $url"
forum_snap=$(agent-browser snapshot -c 2>/dev/null)
if echo "$forum_snap" | grep -q "Добавить тему"; then echo "форумный вид: «Добавить тему» есть ✓"; else echo "форумный вид: «Добавить тему» НЕТ (проверить)"; fi

echo ""
echo "---- Клик по теме в блоке «Последние темы форума» ----"
agent-browser open "http://localhost:3000/" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 1.5
topic_url=$(agent-browser eval "(() => { const a = document.querySelector('.mp-rows .mp-ttext'); if (!a) return 'NONE'; a.click(); return 'clicked'; })()" 2>/dev/null)
echo "клик по теме: $topic_url"
sleep 1.5
url=$(agent-browser get url)
echo "url после клика: $url"
echo "$url" | grep -q "topic=" && echo "тема открылась ✓" || { echo "ТЕМА НЕ ОТКРЫЛАСЬ"; fail=1; }

echo ""
echo "---- Мобильная ширина 390px ----"
agent-browser set viewport 390 844 > /dev/null 2>&1
agent-browser open "http://localhost:3000/" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 1
dims=$(agent-browser eval "JSON.stringify({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})" 2>/dev/null)
echo "390px: $dims"
# scrollWidth не должен превышать clientWidth (сравниваем числа, без экранирования)
noscroll=$(agent-browser eval "document.documentElement.scrollWidth <= document.documentElement.clientWidth" 2>/dev/null)
echo "$noscroll" | grep -qi "true" && echo "горизонтальной прокрутки нет ✓" || { echo "ЕСТЬ ГОРИЗОНТАЛЬНАЯ ПРОКРУТКА"; fail=1; }
errs=$(agent-browser errors 2>/dev/null | tail -n +2)
if [ -n "$errs" ]; then echo "MOBILE ERRORS: $errs"; fail=1; else echo "mobile page errors: 0"; fi
agent-browser screenshot "download/screens/home-new-mobile.png" > /dev/null 2>&1 && echo "screenshot: home-new-mobile.png ok"

echo ""
if [ "$fail" = "0" ]; then echo "ИТОГ: ВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ ✓"; else echo "ИТОГ: ЕСТЬ ПРОВАЛЫ (fail=$fail)"; fi
exit $fail
