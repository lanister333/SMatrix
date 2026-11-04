"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import twemoji from "twemoji";

/**
 * EmojiPicker — всплывающая панель смайликов с категориями и поиском.
 *
 * 2026-11-04: рендер через Twemoji (цветные SVG с CDN jsdelivr) —
 * смайлики выглядят ярко и весело на любой системе (включая Linux
 * где системных emoji-шрифтов нет). До этого использовались Unicode-
 * символы которые на некоторых системах рендерились чёрно-белыми.
 *
 * По клику на кнопку «😀» панель открывается. По клику вне — закрывается.
 * Поиск фильтрует по имени (рус/англ). Клик на смайл вставляет его в textarea.
 */

interface Props {
  onPick: (emoji: string) => void;
  onClose?: () => void;
}

interface EmojiItem {
  e: string;
  n: string;
}

// Категории смайликов
const CATEGORIES: { id: string; icon: string; name: string; emojis: EmojiItem[] }[] = [
  {
    id: "smileys",
    icon: "😀",
    name: "Лица",
    emojis: [
      { e: "😀", n: "улыбка smile happy" }, { e: "😃", n: "радость smile" }, { e: "😄", n: "счастье happy" },
      { e: "😁", n: "ухмылка grin" }, { e: "😆", n: "смех laugh" }, { e: "😅", n: "пот sweat smile" },
      { e: "🤣", n: "ржу rofl" }, { e: "😂", n: "слёзы joy tears" }, { e: "🙂", n: "лёгкая улыбка" },
      { e: "🙃", n: "перевёрнутая upside" }, { e: "😉", n: "подмигивание wink" }, { e: "😊", n: "милая улыбка blush" },
      { e: "😇", n: "ангел halo" }, { e: "🥰", n: "влюблён hearts" }, { e: "😍", n: "обожание heart eyes" },
      { e: "🤩", n: "восторг stars" }, { e: "😘", n: "поцелуй kiss" }, { e: "😚", n: "поцелуй 3" },
      { e: "😋", n: "вкусно yum" }, { e: "😛", n: "язык tongue" }, { e: "😜", n: "подмигивание язык" },
      { e: "🤪", n: "чокнутый crazy" }, { e: "🤗", n: "объятия hug" }, { e: "🤭", n: "рука mouth" },
      { e: "🤫", n: "тихо shush" }, { e: "🤔", n: "думаю think" }, { e: "🤐", n: "молчу zip" },
      { e: "🤨", n: "сомнение raised" }, { e: "😐", n: "нейтрально neutral" }, { e: "😑", n: "без эмоций" },
      { e: "😶", n: "нет рта" }, { e: "😏", n: "ухмылка smirk" }, { e: "😒", n: "недовольство unamused" },
      { e: "🙄", n: "закатил глаза roll" }, { e: "😬", n: "гримаса grimace" }, { e: "🤥", n: "ложь lie" },
      { e: "😌", n: "облегчение relieved" }, { e: "😔", n: "грусть pensive" }, { e: "😪", n: "сонно sleepy" },
      { e: "🤤", n: "слюни drool" }, { e: "😴", n: "сплю sleep" }, { e: "😷", n: "маска mask" },
      { e: "🤒", n: "термометр sick" }, { e: "🤕", n: "повязка hurt" }, { e: "🤢", n: "тошнота nauseated" },
      { e: "🤮", n: "рвота vomit" }, { e: "🤧", n: "чих sneeze" }, { e: "🥵", n: "жара hot" },
      { e: "🥶", n: "холод cold" }, { e: "🥴", n: "пьян woozy" }, { e: "😵", n: "голова кружится" },
      { e: "🤯", n: "взрыв мозга mind blown" }, { e: "🤠", n: "ковбой cowboy" }, { e: "🥳", n: "праздник party" },
      { e: "😎", n: "круто cool" }, { e: "🤓", n: "ботан nerd" }, { e: "🧐", n: "монокль" },
      { e: "😕", n: "смущение confused" }, { e: "😟", n: "беспокойство worried" }, { e: "🙁", n: "недовольно frown" },
      { e: "☹️", n: "грустно sad" }, { e: "😮", n: "удивлён open mouth" }, { e: "😯", n: "удивлён 2 hushed" },
      { e: "😲", n: "ошарашен astonished" }, { e: "😳", n: "краснею flushed" }, { e: "🥺", n: "умоляю pleading" },
      { e: "😦", n: "рот открыт frown" }, { e: "😨", n: "страх fearful" }, { e: "😰", n: "тревога sweat" },
      { e: "😥", n: "disappointed" }, { e: "😢", n: "плач cry" }, { e: "😭", n: "рыдания sob" },
      { e: "😱", n: "крик scream" }, { e: "😖", n: "confounded" }, { e: "😣", n: "persevere" },
      { e: "😞", n: "disappointed" }, { e: "😩", n: "weary" }, { e: "😫", n: "tired" },
      { e: "🥱", n: "зевок yawn" }, { e: "😤", n: "triumph" }, { e: "😡", n: "злой rage" },
      { e: "😠", n: "angry" }, { e: "🤬", n: "мат swearing" }, { e: "😈", n: "черт devil" },
      { e: "👿", n: "дьявол devil 2" }, { e: "💀", n: "череп skull" }, { e: "💩", n: "дерьмо poop" },
      { e: "🤡", n: "клоун clown" }, { e: "👹", n: "огр ogre" }, { e: "👻", n: "призрак ghost" },
      { e: "👽", n: "пришелец alien" }, { e: "🤖", n: "робот robot" },
    ],
  },
  {
    id: "gestures",
    icon: "👍",
    name: "Жесты",
    emojis: [
      { e: "👍", n: "класс thumbs up" }, { e: "👎", n: "не нравится thumbs down" }, { e: "👌", n: "ок ok" },
      { e: "🤌", n: "пальцы fingers" }, { e: "🤏", n: "щипок pinch" }, { e: "✌️", n: "мир victory" },
      { e: "🤞", n: "крестик fingers crossed" }, { e: "🤟", n: "люблю love" }, { e: "🤘", n: "рок horns" },
      { e: "🤙", n: "звони call" }, { e: "👈", n: "влево left" }, { e: "👉", n: "вправо right" },
      { e: "👆", n: "вверх up" }, { e: "👇", n: "вниз down" }, { e: "☝️", n: "один up" },
      { e: "👋", n: "привет wave" }, { e: "🤚", n: "рука raised" }, { e: "✋", n: "стоп stop" },
      { e: "🖖", n: "вулкан vulcan" }, { e: "👏", n: "аплодисменты clap" }, { e: "🙌", n: "руки up" },
      { e: "🤝", n: "рукопожатие handshake" }, { e: "🙏", n: "спасибо pray" }, { e: "✍️", n: "пишу write" },
      { e: "💪", n: "сила muscle" }, { e: "👊", n: "кулак fist bump" }, { e: "🤛", n: "кулак left" },
      { e: "🤜", n: "кулак right" }, { e: "🫶", n: "сердце hands heart" },
    ],
  },
  {
    id: "hearts",
    icon: "❤️",
    name: "Сердца",
    emojis: [
      { e: "❤️", n: "сердце heart red" }, { e: "🧡", n: "оранжевое orange" }, { e: "💛", n: "жёлтое yellow" },
      { e: "💚", n: "зелёное green" }, { e: "💙", n: "синее blue" }, { e: "💜", n: "фиолетовое purple" },
      { e: "🖤", n: "чёрное black" }, { e: "🤍", n: "белое white" }, { e: "🤎", n: "коричневое brown" },
      { e: "💔", n: "разбитое broken" }, { e: "❣️", n: "восклицание heart" }, { e: "💕", n: "два two" },
      { e: "💞", n: "revolving" }, { e: "💓", n: "пульс beating" }, { e: "💗", n: "растущее growing" },
      { e: "💖", n: "блестящее sparkling" }, { e: "💘", n: "стрела arrow" }, { e: "💝", n: "лента ribbon" },
      { e: "💟", n: "decorated" }, { e: "♥️", n: "масть suit" }, { e: "💌", n: "письмо love letter" },
      { e: "💍", n: "кольцо ring" }, { e: "💎", n: "бриллиант diamond" }, { e: "💐", n: "букет flowers" },
      { e: "🌹", n: "роза rose" }, { e: "🌷", n: "тюльпан tulip" }, { e: "🌸", n: "цветение blossom" },
      { e: "🌺", n: "гибискус hibiscus" }, { e: "🌻", n: "подсолнух sunflower" },
    ],
  },
  {
    id: "animals",
    icon: "🐶",
    name: "Животные",
    emojis: [
      { e: "🐶", n: "собака dog" }, { e: "🐱", n: "кошка cat" }, { e: "🐭", n: "мышь mouse" },
      { e: "🐹", n: "хомяк hamster" }, { e: "🐰", n: "кролик rabbit" }, { e: "🦊", n: "лиса fox" },
      { e: "🐻", n: "медведь bear" }, { e: "🐼", n: "панда panda" }, { e: "🐨", n: "коала koala" },
      { e: "🐯", n: "тигр tiger" }, { e: "🦁", n: "лев lion" }, { e: "🐮", n: "корова cow" },
      { e: "🐷", n: "свинья pig" }, { e: "🐸", n: "лягушка frog" }, { e: "🐵", n: "обезьяна monkey" },
      { e: "🐔", n: "курица chicken" }, { e: "🐧", n: "пингвин penguin" }, { e: "🐦", n: "птица bird" },
      { e: "🦆", n: "утка duck" }, { e: "🦉", n: "сова owl" }, { e: "🐺", n: "волк wolf" },
      { e: "🐗", n: "кабан boar" }, { e: "🐴", n: "лошадь horse" }, { e: "🦄", n: "единорог unicorn" },
      { e: "🐝", n: "пчела bee" }, { e: "🦋", n: "бабочка butterfly" }, { e: "🐌", n: "улитка snail" },
      { e: "🐞", n: "божья коровка ladybug" }, { e: "🐟", n: "рыба fish" }, { e: "🐠", n: "тропическая рыба" },
      { e: "🐡", n: "рыба шар" }, { e: "🦈", n: "акула shark" }, { e: "🐙", n: "осьминог octopus" },
      { e: "🦑", n: "кальмар squid" }, { e: "🦐", n: "креветка shrimp" }, { e: "🦀", n: "краб crab" },
      { e: "🐢", n: "черепаха turtle" }, { e: "🐬", n: "дельфин dolphin" }, { e: "🐳", n: "кит whale" },
      { e: "🐊", n: "крокодил crocodile" }, { e: "🦎", n: "ящерица lizard" }, { e: "🐍", n: "змея snake" },
      { e: "🐉", n: "дракон dragon" },
    ],
  },
  {
    id: "food",
    icon: "🍔",
    name: "Еда",
    emojis: [
      { e: "🍔", n: "бургер burger" }, { e: "🍟", n: "картошка фри fries" }, { e: "🍕", n: "пицца pizza" },
      { e: "🌭", n: "хот-дог hotdog" }, { e: "🥪", n: "сэндвич sandwich" }, { e: "🌮", n: "тако taco" },
      { e: "🌯", n: "буррито burrito" }, { e: "🍜", n: "лапша ramen" }, { e: "🍝", n: "спагетти spaghetti" },
      { e: "🍣", n: "суши sushi" }, { e: "🍤", n: "темпура shrimp" }, { e: "🍚", n: "рис rice" },
      { e: "🍰", n: "торт cake" }, { e: "🎂", n: "праздничный торт birthday" }, { e: "🍩", n: "пончик donut" },
      { e: "🍪", n: "печенье cookie" }, { e: "🍫", n: "шоколад chocolate" }, { e: "🍬", n: "конфета candy" },
      { e: "🍭", n: "леденец lollipop" }, { e: "🍦", n: "мороженое ice cream" }, { e: "☕", n: "кофе coffee" },
      { e: "🍵", n: "чай tea" }, { e: "🍺", n: "пиво beer" }, { e: "🍻", n: "пиво 2 cheers" },
      { e: "🍷", n: "вино wine" }, { e: "🥂", n: "бокалы clink" }, { e: "🥃", n: "виски whiskey" },
      { e: "🍹", n: "коктейль cocktail" }, { e: "🍸", n: "мартини martini" }, { e: "🥤", n: "газировка cup" },
      { e: "🧃", n: "сок juice box" }, { e: "🍎", n: "яблоко apple" }, { e: "🍊", n: "апельсин orange" },
      { e: "🍋", n: "лимон lemon" }, { e: "🍌", n: "банан banana" }, { e: "🍉", n: "арбуз watermelon" },
      { e: "🍇", n: "виноград grapes" }, { e: "🍓", n: "клубника strawberry" }, { e: "🍑", n: "персик peach" },
      { e: "🥭", n: "манго mango" }, { e: "🍍", n: "ананас pineapple" }, { e: "🥥", n: "кокос coconut" },
      { e: "🥦", n: "брокколи broccoli" }, { e: "🍅", n: "помидор tomato" }, { e: "🌽", n: "кукуруза corn" },
      { e: "🥕", n: "морковь carrot" }, { e: "🥔", n: "картошка potato" },
    ],
  },
  {
    id: "activity",
    icon: "⚽",
    name: "Спорт",
    emojis: [
      { e: "⚽", n: "футбол soccer" }, { e: "🏀", n: "баскетбол basketball" }, { e: "🏈", n: "американский футбол" },
      { e: "⚾", n: "бейсбол baseball" }, { e: "🎾", n: "теннис tennis" }, { e: "🏐", n: "волейбол volleyball" },
      { e: "🏓", n: "пинг-понг ping pong" }, { e: "🏸", n: "бадминтон badminton" }, { e: "🥊", n: "бокс boxing" },
      { e: "🥋", n: "карате martial arts" }, { e: "⛳", n: "гольф golf" }, { e: "🏹", n: "лук archery" },
      { e: "🎣", n: "рыбалка fishing" }, { e: "🥌", n: "кёрлинг curling" }, { e: "🎿", n: "лыжи ski" },
      { e: "🏂", n: "сноуборд snowboard" }, { e: "🏃", n: "бег run" }, { e: "🤸", n: "кувырок cartwheel" },
      { e: "🏋️", n: "штанга lift" }, { e: "🤼", n: "борьба wrestling" }, { e: "🤽", n: "водное поло" },
      { e: "🤾", n: "гандбол handball" }, { e: "🏌️", n: "гольф swing" }, { e: "🏄", n: "сёрф surf" },
      { e: "🏊", n: "плавание swim" }, { e: "🤿", n: "дайвинг diving" }, { e: "🚴", n: "велосипед bike" },
      { e: "🚵", n: "горный велосипед" }, { e: "🏆", n: "кубок trophy" }, { e: "🥇", n: "золото gold" },
      { e: "🥈", n: "серебро silver" }, { e: "🥉", n: "бронза bronze" }, { e: "🎯", n: "мишень dart" },
      { e: "🎮", n: "джойстик game" }, { e: "🎲", n: "кубик dice" }, { e: "🧩", n: "пазл puzzle" },
      { e: "🎭", n: "театр masks" }, { e: "🎨", n: "палитра art" }, { e: "🎤", n: "микрофон mic" },
      { e: "🎧", n: "наушники headphone" }, { e: "🎼", n: "ноты music" }, { e: "🎹", n: "пианино piano" },
      { e: "🥁", n: "барабан drum" }, { e: "🎸", n: "гитара guitar" }, { e: "🎻", n: "скрипка violin" },
    ],
  },
  {
    id: "travel",
    icon: "✈️",
    name: "Путешествия",
    emojis: [
      { e: "✈️", n: "самолёт plane" }, { e: "🚀", n: "ракета rocket" }, { e: "🚁", n: "вертолёт helicopter" },
      { e: "🚂", n: "поезд train" }, { e: "🚊", n: "трамвай tram" }, { e: "🚄", n: "скоростной поезд" },
      { e: "🚅", n: "поезд 2" }, { e: "🚆", n: "поезд 3" }, { e: "🚇", n: "метро metro" },
      { e: "🚉", n: "станция station" }, { e: "🚌", n: "автобус bus" }, { e: "🚐", n: "минивэн minibus" },
      { e: "🚑", n: "скорая ambulance" }, { e: "🚒", n: "пожарная fire" }, { e: "🚓", n: "полиция police" },
      { e: "🚗", n: "машина car" }, { e: "🚕", n: "такси taxi" }, { e: "🚙", n: "внедорожник suv" },
      { e: "🚚", n: "грузовик truck" }, { e: "🚲", n: "велосипед bike" }, { e: "🛵", n: "мопед scooter" },
      { e: "🏍️", n: "мотоцикл motorcycle" }, { e: "🛳️", n: "лайнер ship" }, { e: "⛵", n: "яхта sailboat" },
      { e: "🚤", n: "катер speedboat" }, { e: "⚓", n: "якорь anchor" }, { e: "🗺️", n: "карта map" },
      { e: "🗿", n: "моаи moyai" }, { e: "🗽", n: "статуя свободы statue" }, { e: "🗼", n: "башня tokyo" },
      { e: "🏰", n: "замок castle" }, { e: "🏯", n: "японский замок" }, { e: "🏟️", n: "стадион stadium" },
      { e: "🎡", n: "колесо ferris" }, { e: "🎢", n: "американские горки" }, { e: "🎠", n: "карусель carousel" },
      { e: "⛲", n: "фонтан fountain" }, { e: "🏖️", n: "пляж beach" }, { e: "🏝️", n: "остров island" },
      { e: "🌋", n: "вулкан volcano" }, { e: "⛰️", n: "гора mountain" }, { e: "🏔️", n: "снежная гора" },
      { e: "🗻", n: "фудзи fuji" }, { e: "🏕️", n: "палатка camping" }, { e: "⛺", n: "tent" },
    ],
  },
  {
    id: "objects",
    icon: "💡",
    name: "Объекты",
    emojis: [
      { e: "⌚", n: "часы watch" }, { e: "📱", n: "телефон phone" }, { e: "💻", n: "ноутбук laptop" },
      { e: "⌨️", n: "клавиатура keyboard" }, { e: "🖥️", n: "компьютер desktop" }, { e: "🖨️", n: "принтер printer" },
      { e: "🖱️", n: "мышь mouse" }, { e: "💾", n: "дискета floppy" }, { e: "💿", n: "cd" },
      { e: "📷", n: "камера camera" }, { e: "📸", n: "флешка camera flash" }, { e: "📹", n: "видео video" },
      { e: "🎥", n: "кино movie" }, { e: "📺", n: "телевизор tv" }, { e: "📻", n: "радио radio" },
      { e: "🎙️", n: "микрофон studio" }, { e: "💡", n: "лампочка idea" }, { e: "🔦", n: "фонарик flashlight" },
      { e: "🕯️", n: "свеча candle" }, { e: "🔋", n: "батарея battery" }, { e: "🔌", n: "вилка plug" },
      { e: "🛒", n: "корзина cart" }, { e: "💸", n: "деньги money" }, { e: "💵", n: "доллар dollar" },
      { e: "💴", n: "иена yen" }, { e: "💶", n: "евро euro" }, { e: "💷", n: "фунт pound" },
      { e: "💳", n: "карта card" }, { e: "📋", n: "планшет clipboard" }, { e: "📌", n: "кнопка pushpin" },
      { e: "📎", n: "скрепка paperclip" }, { e: "✂️", n: "ножницы scissors" }, { e: "📐", n: "линейка triangle" },
      { e: "📕", n: "книга red" }, { e: "📖", n: "книга open" }, { e: "📚", n: "книги books" },
      { e: "📝", n: "заметка memo" }, { e: "✏️", n: "карандаш pencil" }, { e: "🖊️", n: "ручка pen" },
      { e: "🔑", n: "ключ key" }, { e: "🔒", n: "замок lock" }, { e: "🔓", n: "открыто unlock" },
      { e: "🎁", n: "подарок gift" }, { e: "🎈", n: "шар balloon" }, { e: "🎉", n: "конфетти party" },
      { e: "🎊", n: "шары party 2" }, { e: "🎀", n: "бант ribbon" }, { e: "🏆", n: "кубок trophy" },
      { e: "🏠", n: "дом home" }, { e: "🏡", n: "дом garden" }, { e: "🏢", n: "офис office" },
      { e: "🏫", n: "школа school" }, { e: "🏥", n: "больница hospital" }, { e: "🏦", n: "банк bank" },
    ],
  },
  {
    id: "symbols",
    icon: "✅",
    name: "Символы",
    emojis: [
      { e: "✅", n: "галочка check" }, { e: "❌", n: "крестик cross" }, { e: "☑️", n: "отмечено check box" },
      { e: "✔️", n: "галочка 2" }, { e: "❎", n: "крестик 2" }, { e: "⭕", n: "круг circle" },
      { e: "🚫", n: "запрет no" }, { e: "⛔", n: "запрет 2" }, { e: "⚠️", n: "внимание warning" },
      { e: "❓", n: "вопрос question" }, { e: "❔", n: "вопрос 2" }, { e: "❕", n: "восклицание white" },
      { e: "❗", n: "восклицание exclamation" }, { e: "‼️", n: "двойное восклицание" }, { e: "⁉️", n: "вопрос восклицание" },
      { e: "💯", n: "100 hundred" }, { e: "🔗", n: "ссылка link" }, { e: "🔢", n: "цифры numbers" },
      { e: "🔤", n: "буквы abc" }, { e: "🔡", n: "abc lower" }, { e: "🔠", n: "ABC upper" },
      { e: "🅰️", n: "a blood" }, { e: "🆎", n: "ab blood" }, { e: "🅱️", n: "b blood" },
      { e: "🆒", n: "cool" }, { e: "🆓", n: "free" }, { e: "ℹ️", n: "info" },
      { e: "🆔", n: "id" }, { e: "Ⓜ️", n: "m" }, { e: "🆕", n: "new" },
      { e: "🆗", n: "ok" }, { e: "🅿️", n: "parking" }, { e: "🆘", n: "sos" },
      { e: "🆙", n: "up" }, { e: "🆚", n: "vs" }, { e: "🔴", n: "красный круг red" },
      { e: "🟠", n: "оранжевый круг orange" }, { e: "🟡", n: "жёлтый круг yellow" }, { e: "🟢", n: "зелёный круг green" },
      { e: "🔵", n: "синий круг blue" }, { e: "🟣", n: "фиолетовый круг purple" }, { e: "🟤", n: "коричневый круг brown" },
      { e: "⚫", n: "чёрный круг black" }, { e: "⚪", n: "белый круг white" },
    ],
  },
];

/** Получить URL SVG-картинки для emoji через Twemoji CDN. */
function emojiUrl(emoji: string): string {
  // twemoji.convert.toCodePoint возвращает кодовые точки emoji без U+
  const code = twemoji.convert.toCodePoint(emoji);
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`;
}

/** Компонент-картинка emoji через Twemoji SVG. */
const TwemojiImg = memo(function TwemojiImg({ emoji, size }: { emoji: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={emojiUrl(emoji)}
      alt={emoji}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle", pointerEvents: "none" }}
      loading="lazy"
    />
  );
});

export function EmojiPicker({ onPick, onClose }: Props) {
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const currentEmojis = useMemo(() => {
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const all = CATEGORIES.flatMap((c) => c.emojis);
      return all.filter((e) => e.n.toLowerCase().includes(q));
    }
    const cat = CATEGORIES.find((c) => c.id === activeCat);
    return cat ? cat.emojis : [];
  }, [activeCat, query]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        bottom: "100%",
        right: 0,
        marginBottom: 8,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        width: 340,
        maxHeight: 380,
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {/* Поиск */}
      <div style={{ padding: 10, borderBottom: "1px solid #f1f5f9", background: "#fafbfc" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Поиск..."
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            background: "#fff",
          }}
        />
      </div>

      {/* Категории */}
      {!query.trim() && (
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "8px 10px",
            borderBottom: "1px solid #f1f5f9",
            overflowX: "auto",
            background: "#fff",
          }}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id)}
              title={c.name}
              style={{
                flex: "0 0 auto",
                width: 36,
                height: 36,
                border: "none",
                background: activeCat === c.id ? "#fef3c7" : "transparent",
                borderRadius: 8,
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
              }}
            >
              <TwemojiImg emoji={c.icon} size={22} />
            </button>
          ))}
        </div>
      )}

      {/* Сетка смайликов */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          minHeight: 220,
          background: "#fff",
        }}
      >
        {currentEmojis.map((emoji, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(emoji.e)}
            title={emoji.n.split(" ")[0]}
            style={{
              width: "100%",
              aspectRatio: "1",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              borderRadius: 8,
              transition: "background 0.1s, transform 0.1s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fef3c7";
              e.currentTarget.style.transform = "scale(1.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <TwemojiImg emoji={emoji.e} size={26} />
          </button>
        ))}
        {currentEmojis.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 14,
              padding: 32,
            }}
          >
            😔 Ничего не найдено
          </div>
        )}
      </div>
    </div>
  );
}

/** Кнопка-триггер для открытия EmojiPicker. */
export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Смайлики"
        style={{
          background: "transparent",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: "4px 10px",
          cursor: "pointer",
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TwemojiImg emoji="😀" size={20} />
      </button>
      {open && (
        <EmojiPicker
          onPick={(e) => {
            onPick(e);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
