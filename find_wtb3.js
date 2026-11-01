const {PrismaClient} = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const posts = await p.whereToBuyPost.findMany({
    select: { id: true, text: true, authorName: true, authorId: true, topicId: true, createdAt: true, postType: true, answerText: true, answerAuthorName: true, answeredAt: true, answers: true, place: true, status: true },
    take: 30,
    orderBy: { createdAt: "desc" }
  });
  posts.forEach((post, i) => {
    console.log("--- Post #" + (i+1) + " (id=" + post.id + ") ---");
    console.log("Author:", post.authorName);
    console.log("TopicId:", post.topicId);
    console.log("Place:", post.place);
    console.log("PostType:", post.postType);
    console.log("Text:", post.text);
    if (post.answerText) console.log("AnswerText:", post.answerText, "(by " + post.answerAuthorName + ")");
    if (post.answers && post.answers.length > 0) {
      console.log("Answers:", post.answers.length);
      post.answers.forEach(a => console.log("  -", JSON.stringify(a).slice(0, 400)));
    }
    console.log("");
  });
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
