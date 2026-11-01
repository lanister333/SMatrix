const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findFirst({where: {email: 'priem-test@sakhmatrix.ru'}, include: {tokens: true}});
  if (!u) { console.log('USER NOT FOUND'); await p.$disconnect(); return; }
  console.log(JSON.stringify({id: u.id, nickname: u.nickname, emailVerified: u.emailVerified, role: u.role, secretQuestion: u.secretQuestion, tokens: u.tokens.map(t => ({purpose: t.purpose, expires: t.expiresAt}))}, null, 1));
  await p.$disconnect();
})();
