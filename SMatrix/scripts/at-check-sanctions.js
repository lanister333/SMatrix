const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const s = await p.sanction.findMany({include: {user: {select: {nickname: true}}}, orderBy: {createdAt: 'desc'}, take: 8});
  console.log(JSON.stringify(s.map(x => ({id: x.id.slice(-6), user: x.user.nickname, kind: x.kind, source: x.source, revoked: x.revoked, reason: x.reason.slice(0, 50), createdAt: x.createdAt})), null, 1));
  await p.$disconnect();
})();
