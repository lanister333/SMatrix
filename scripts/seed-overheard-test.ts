import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const tags = ["rumor", "observation", "message"];
const posts = [
  {
    title: "Говорят, на Комсомольской меняют асфальт в выходные",
    text: "Слышал от соседа, который работает в дорожной службе. Якобы в эту субботу и воскресенье будут перекрывать движение на участке от Сахалинской до Ленина. Официального подтверждения пока нет, но техника уже стоит у обочины.",
    place: "Южно-Сахалинск",
    tag: "rumor",
    authorId: "cmtwykyha000eqiixi5n9ifur",
    authorName: "zorkiy58",
  },
  {
    title: "Возле торгового центра вижу скопление ворон — необычно много",
    text: "Сегодня утром проходил мимо ТЦ и обратил внимание: сотни ворон сидят на деревьях и проводах вокруг парковки. Такое чувство, что они что-то почувствовали — может, к перемене погоды или к землетрясению. Никто из прохожих не обращает внимания, но мне показалось это странным.",
    place: "Южно-Сахалинск",
    tag: "observation",
    authorId: "cmtwykyej000bqiix7r5m9tkc",
    authorName: "Пельмень",
  },
  {
    title: "В Холмске паром задержали на 3 часа из-за тумана",
    text: "Сегодня утром паромная переправа Холмск — Ванино работала с задержкой. Туман был настолько плотный, что видимость не превышала 50 метров. Несколько машин стояли в очереди с ночи. К обеду движение восстановили, но очередь была огромная.",
    place: "Холмск",
    tag: "message",
    authorId: "cmtwyky9v0006qiixej4fo3d8",
    authorName: "ТихийОкеан",
  },
  {
    title: "Слух: на рынке горбуша подешевеет к концу недели",
    text: "Разговаривал с продавцом на центральном рынке — он сказал, что к пятнице ожидается большая партия свежей горбуши и цена может упасть до 180-200 рублей за килограмм. Пока это только разговоры, но если повезёт — будет отличный шанс затариться.",
    place: "Южно-Сахалинск",
    tag: "rumor",
    authorId: "cmtwykyyn000xqiixn9qk2y29",
    authorName: "SnowQueen",
  },
  {
    title: "В Корсакове заметил разлив нефти у причала",
    text: "Проходил вдоль набережной в Корсакове и увидел радужную плёнку на воде у одного из причалов. Площадь небольшая, но заметно. Сфотографировал, но выкладывать фото не буду — вдруг это не нефть, а что-то другое. Может, кто-то из местных знает, что там происходит?",
    place: "Корсаков",
    tag: "observation",
    authorId: "cmtwykymr000kqiixs8wrouwd",
    authorName: "slon_potap",
  },
];

async function main() {
  for (const p of posts) {
    const created = await db.overheardPost.create({
      data: {
        title: p.title,
        text: p.text,
        place: p.place,
        tag: p.tag,
        authorId: p.authorId,
        authorName: p.authorName,
        aiStatus: "ok",
        isHiddenByAi: false,
        isDeleted: false,
      },
    });
    console.log(`✓ Создано: [${p.tag}] "${p.title}" — id=${created.id}`);
  }
  console.log(`\nИтого: ${posts.length} публикаций`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
