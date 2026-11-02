-- ============================================================================
-- МИГРАЦИЯ «кто кому ответил» (спека ReplyLines, п.1)
-- Адаптация под фактический стек проекта: Prisma ORM + SQLite (db/custom.db),
-- таблица сообщений называется `Message` (проверить: SELECT name FROM
-- sqlite_master WHERE type='table';). PostgreSQL-вариант из спеки приведён
-- в комментарии в конце файла.
--
-- ФАКТ по текущей схеме (prisma/schema.prisma, model Message):
--   parent_id  -> parentId  String?           ЕСТЬ, заполнен у 271/832 постов
--   depth      -> depth     Int default 0     ЕСТЬ колонкой; честное значение
--                                           считает API (depthOf по parentId)
--   is_deleted -> isDeleted Boolean            ЕСТЬ (мягкое удаление)
--   path, root_id                            НЕТ и НЕ ТРЕБУЮТСЯ реализации:
--                                           дерево обходится по parentId в
--                                           памяти (832 поста), N+1 нет.
--                                           Ниже — как добавить, ЕСЛИ
--                                           понадобятся (например, для
--                                           выборок веток чистым SQL).
-- ============================================================================

-- 1) Добавление полей (SQLite: ALTER без IF NOT EXISTS — сначала проверить
--    PRAGMA table_info(Message); колонки ниже добавлять только при отсутствии):
-- ALTER TABLE Message ADD COLUMN path   TEXT; -- материализованный путь '/id1/id7/id12'
-- ALTER TABLE Message ADD COLUMN root_id TEXT; -- id корня ветки

-- 2) Индексы (аналоги idx_posts_* из спеки; parent/topic уже нужны линии):
CREATE INDEX IF NOT EXISTS idx_message_parent ON Message(parentId);
CREATE INDEX IF NOT EXISTS idx_message_topic  ON Message(topicId);
-- CREATE INDEX IF NOT EXISTS idx_message_path  ON Message(path);
-- CREATE INDEX IF NOT EXISTS idx_message_root  ON Message(root_id);

-- 3) Заполнение path/root_id (если добавлены) — один проход по parentId
--    в клиенте (см. scripts/backfill-reply-links.mjs, режим --apply-path):
--    root_id  = id вершины цепочки parentId;
--    path     = '/'+join(цепочка root-first, '/')+'/'+own id.

-- ============================================================================
-- СПРАВКА: PostgreSQL-вариант из спеки (для переноса на PG, если проект
-- переедет с SQLite):
--
--   ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES posts(id) ON DELETE SET NULL;
--   ALTER TABLE posts ADD COLUMN IF NOT EXISTS depth INT DEFAULT 0;
--   ALTER TABLE posts ADD COLUMN IF NOT EXISTS path TEXT;
--   ALTER TABLE posts ADD COLUMN IF NOT EXISTS root_id BIGINT;
--   CREATE INDEX IF NOT EXISTS idx_posts_topic  ON posts(topic_id);
--   CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id);
--   CREATE INDEX IF NOT EXISTS idx_posts_path   ON posts(path);
--   CREATE INDEX IF NOT EXISTS idx_posts_root   ON posts(root_id);
-- ============================================================================
