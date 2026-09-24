/* eslint-disable @typescript-eslint/no-require-imports */
// Seed script: restores rubrics, users, topics, messages from scraped content.json
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const GENDERS = ["male", "female", "unspecified"];

async function main() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "reverse", "content.json"), "utf8")
  );

  console.log("Seeding rubrics...");
  const rubricIdBySlug = new Map();
  for (const r of raw.rubrics) {
    const row = await db.rubric.create({
      data: { id: r.id, name: r.name, slug: r.slug, isService: !!r.isService },
    });
    rubricIdBySlug.set(row.slug, row.id);
    for (const c of r.children || []) {
      const child = await db.rubric.create({
        data: { id: c.id, name: c.name, slug: c.slug, isService: false, parentId: row.id },
      });
      rubricIdBySlug.set(child.slug, child.id);
    }
  }

  console.log("Seeding users...");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sakhmatrix.ru";
  const adminPass = process.env.ADMIN_PASSWORD || "Admin2026";
  const nickToId = new Map();
  const usedEmails = new Set();
  let i = 0;
  // collect all authors
  const authors = new Set();
  for (const t of raw.topics) {
    authors.add(t.topic.author);
    for (const m of t.messages) authors.add(m.author);
  }
  // find genders from messages
  const genderOf = new Map();
  for (const t of raw.topics) {
    if (t.topic.authorGender) genderOf.set(t.topic.author, t.topic.authorGender);
    for (const m of t.messages) genderOf.set(m.author, m.authorGender);
  }
  for (const nick of authors) {
    let email;
    if (nick === "Админ") {
      email = adminEmail;
    } else if (nick === "Гость") {
      email = "legacy-guest@sakhmatrix.local";
    } else {
      const slug = String(nick)
        .toLowerCase()
        .replace(/[^a-zа-яё0-9]+/gi, "_");
      email = `u${++i}_${slug}@sakhmatrix.local`;
      while (usedEmails.has(email)) email = `u${++i}_${slug}@sakhmatrix.local`;
    }
    usedEmails.add(email);
    const gender = genderOf.get(nick) || "unspecified";
    const user = await db.user.create({
      data: {
        email,
        passwordHash: hashPassword(
          nick === "Админ"
            ? adminPass
            : nick === "Модератор"
              ? "Moderator2026"
              : crypto.randomBytes(12).toString("hex")
        ),
        nickname: nick,
        gender: GENDERS.includes(gender) ? gender : "unspecified",
        role: nick === "Админ" ? "admin" : nick === "Модератор" ? "moderator" : "user",
        emailVerified: true,
        secretQuestion: "Кличка первого домашнего животного",
        secretAnswer: "seed",
      },
    });
    nickToId.set(nick, user.id);
  }
  console.log(`users created: ${nickToId.size}`);

  console.log("Seeding topics and messages...");
  let topicCount = 0;
  let msgCount = 0;
  for (const { topic: t, messages: msgs } of raw.topics) {
    const rubricId =
      rubricIdBySlug.get(t.subSlug) || rubricIdBySlug.get(t.rubricSlug) || null;
    await db.topic.create({
      data: {
        id: t.id,
        number: t.number,
        title: t.title,
        source: t.source || null,
        authorName: t.author,
        authorId: nickToId.get(t.author) || null,
        rubricId,
        views: t.views || 0,
        isPinned: !!t.isPinned,
        isClosed: !!t.isClosed,
        isArchived: !!t.isArchived,
        createdAt: new Date(t.createdAt),
        lastActivityAt: new Date(t.lastActivityAt),
        lastAuthorName: t.lastAuthor || "",
      },
    });
    topicCount++;
    msgs.sort((a, b) => a.num - b.num);
    const createdIds = new Map();
    for (const m of msgs) {
      const mid = String(m.id);
      const mpid = m.parentId != null ? String(m.parentId) : null;
      await db.message.create({
        data: {
          id: mid,
          topicId: t.id,
          parentId: mpid && createdIds.has(mpid) ? mpid : null,
          depth: m.parentId && createdIds.has(m.parentId) ? m.depth : 0,
          num: m.num,
          authorName: m.author,
          authorId: nickToId.get(m.author) || null,
          body: m.body,
          kind: m.kind || "advice",
          aiStatus: m.aiStatus || "ok",
          aiNote: m.aiNote || "",
          floodCount: m.floodCount || 0,
          isCollapsed: !!m.isCollapsed,
          isHiddenByAi: !!m.isHiddenByAi,
          hiddenReason: m.hiddenReason || "",
          isDeleted: !!m.isDeleted,
          deletedBy: m.deletedBy || "",
          editedAt: m.editedAt ? new Date(m.editedAt) : null,
          createdAt: new Date(m.createdAt),
        },
      });
      createdIds.set(mid, true);
      msgCount++;
    }
  }
  console.log(`topics: ${topicCount}, messages: ${msgCount}`);

  await db.user.update({ where: { email: adminEmail }, data: { emailVerified: true } });
  console.log("ADMIN LOGIN:", adminEmail, "/", adminPass);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
