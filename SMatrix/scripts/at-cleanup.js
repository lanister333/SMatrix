const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const log = [];
  // 1. Апелляции приёмочного теста
  const ap = await p.decisionAppeal.deleteMany({where: {OR: [{userNick: 'ПриёмныйТест'}, {userNick: 'Админ'}]}});
  log.push(`appeals deleted: ${ap.count}`);
  // 2. Жалобы на сообщения тем 43/44
  const cp = await p.complaint.deleteMany({where: {message: {topicId: {in: [43, 44]}}}});
  log.push(`complaints deleted: ${cp.count}`);
  // 3. Санкции теста
  const sn = await p.sanction.deleteMany({});
  log.push(`sanctions deleted: ${sn.count}`);
  // 4. Тестовые темы (сообщения удалятся каскадом)
  const t44 = await p.topic.delete({where: {id: 44}});
  const t43 = await p.topic.delete({where: {id: 43}});
  log.push(`topics deleted: 43, 44`);
  // 5. Тестовый пользователь (сессии/токены каскадом)
  const u1 = await p.user.deleteMany({where: {email: 'priem-test@sakhmatrix.ru'}});
  const u2 = await p.user.deleteMany({where: {email: {endsWith: '@test.local'}}});
  log.push(`users deleted: priem=${u1.count}, test.local=${u2.count}`);
  // Финальное состояние
  const state = {
    topics: await p.topic.count(),
    messages: await p.message.count(),
    users: await p.user.count(),
    appeals: await p.decisionAppeal.count(),
    sanctions: await p.sanction.count(),
    complaints: await p.complaint.count(),
    unresolvedComplaints: await p.complaint.count({where: {resolved: false}}),
    hiddenByAi: await p.message.count({where: {isHiddenByAi: true}}),
  };
  console.log(log.join('\n'));
  console.log('FINAL STATE:', JSON.stringify(state, null, 1));
  await p.$disconnect();
})();
