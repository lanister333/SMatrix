const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const t = await p.authToken.findFirst({where: {user: {email: 'priem-test@sakhmatrix.ru'}, purpose: 'verify'}});
  console.log(t ? t.token : 'NO TOKEN');
  await p.$disconnect();
})();
