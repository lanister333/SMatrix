const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const del = await p.complaint.deleteMany({where: {id: 'cmtxaiyie000rqixmyqw4uk1q'}});
  console.log('deleted test complaints:', del.count);
  const left = await p.complaint.count({where: {resolved: false}});
  console.log('remaining unresolved complaints:', left);
  // also verify no stray sanctions/appeals
  const s = await p.sanction.count({where: {revoked: false}});
  const a = await p.decisionAppeal.count({where: {status: 'open'}});
  console.log('active sanctions:', s, '| open appeals:', a);
  await p.$disconnect();
})();
