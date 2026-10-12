// src/components/forum/admin-bot-theatre.tsx
// Секция админки «Театр ботов»: очередь премодерации рерайтов.
// 2026-10-12 v3: полностью переработан UI для максимальной наглядности.
//                Большие карточки, явные блоки действий, предпросмотр темы-источника,
//                понятные подписи + счетчики + подсказки.

"use client";

import { useCallback, useEffect, useState } from "react";

interface BotQueueItem {
  id: string;
  botNickname: string;
  text: string;
  sourceText: string;
  topicId: number | null;
  rubricId: number | null;
  topicTitle: string | null;
  status: string;
  scheduledAt: string | null;
  publishedMessageId: string | null;
  rejectReason: string;
  order: number;
  batchId: string;
  meta: string;
  createdAt: string;
}

interface BotBatch {
  batchId: string;
  count: number;
  sourceText: string;
  topicTitle: string | null;
  items: BotQueueItem[];
}

interface Props {
  token: string | null;
  notify: (m: string) => void;
  onOpenTopic: (id: number) => void;
}

const RUBRICS = [
  { id: 98, name: "Где поесть" },
  { id: 138, name: "Клубы по интересам" },
  { id: 67, name: "Здоровье" },
  { id: 71, name: "Стоматология" },
  { id: 68, name: "Общие вопросы здоровья" },
  { id: 70, name: "Лекарства и аптеки" },
  { id: 85, name: "Красота" },
  { id: 86, name: "Косметология" },
  { id: 87, name: "Парикмахерские и салоны" },
  { id: 89, name: "Косметика" },
  { id: 90, name: "Отзывы о специалистах и салонах" },
  { id: 99, name: "Недвижимость" },
  { id: 102, name: "Строительство, ремонт" },
  { id: 104, name: "ЖКХ и управляющие компании" },
  { id: 117, name: "Товары и услуги" },
  { id: 118, name: "Где купить" },
  { id: 119, name: "Услуги и специалисты" },
  { id: 120, name: "Цены" },
  { id: 121, name: "Отзывы и рекомендации" },
  { id: 62, name: "Трудовые отношения" },
  { id: 77, name: "Работа" },
  { id: 49, name: "Животные" },
  { id: 56, name: "Пристройство животных" },
  { id: 122, name: "Туризм, отдых" },
];

function rubricName(id: number | null): string {
  if (!id) return "—";
  const r = RUBRICS.find((x) => x.id === id);
  return r ? r.name : `#${id}`;
}

export function BotTheatreSection(props: Props) {
  const [tab, setTab] = useState<"queue" | "add">("queue");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [batches, setBatches] = useState<BotBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  // Form for new topic
  const [topicText, setTopicText] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [rubricId, setRubricId] = useState<number>(98);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!props.token) return;
    setLoading(true);
    try {
      // Token передаём в query (queue route теперь принимает и shared secret, и session token)
      const r = await fetch(
        `/api/theatre-bots/queue?token=${encodeURIComponent(props.token)}&status=${encodeURIComponent(statusFilter)}&limit=200`
      );
      const d = await r.json();
      if (d.batches) setBatches(d.batches);
      else setBatches([]);
    } catch (e) {
      props.notify("Ошибка загрузки очереди");
    } finally {
      setLoading(false);
    }
  }, [props.token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function processTopic() {
    if (!props.token || topicText.trim().length < 10) {
      props.notify("Текст темы слишком короткий");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/theatre-bots/process-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          text: topicText.trim(),
          rubricId,
          topicTitle: topicTitle.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        props.notify(d.error || "Ошибка обработки темы");
        return;
      }
      props.notify(`Готово: выбрано ${d.selectedBots?.length || 0} ботов, в очередь добавлено ${d.queuedCount} реплик`);
      setTopicText("");
      setTopicTitle("");
      setTab("queue");
      setStatusFilter("pending");
      setTimeout(load, 200);
    } catch (e) {
      props.notify("Сеть недоступна — попробуйте ещё раз");
    } finally {
      setSubmitting(false);
    }
  }

  async function action(id: string, action: string, extra: Record<string, unknown> = {}) {
    if (!props.token) return;
    try {
      const r = await fetch("/api/theatre-bots/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action, id, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) {
        props.notify(d.error || `Ошибка действия ${action}`);
        return;
      }
      const msg = action === "approve" ? "✓ Одобрено — публикация запланирована (15-120 мин)" :
                  action === "reject" ? (d.regenerated ? "✗ Отклонено — бот сгенерирует новый текст" : "✗ Отклонено") :
                  action === "edit" ? "✓ Текст обновлён" :
                  action === "update-published" ? "✓ Текст в форуме обновлён" :
                  action === "publish-now" ? `🚀 Опубликовано: тема #${d.topicId}` :
                  action === "delete-published" ? "🗑 Удалено из форума" :
                  action === "update-to-pending" ? "✓ Текст обновлён (статус: ожидает)" :
                  "OK";
      props.notify(msg);
      setTimeout(load, 200);
    } catch (e) {
      props.notify("Сеть недоступна");
    }
  }

  async function actionBatch(batchId: string, action: string) {
    if (!props.token) return;
    try {
      const r = await fetch("/api/theatre-bots/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action, batchId }),
      });
      const d = await r.json();
      if (!r.ok) {
        props.notify(d.error || `Ошибка действия ${action}`);
        return;
      }
      const msg = action === "approve-batch" ? `✓ Одобрено: ${d.approved} реплик` : "OK";
      props.notify(msg);
      setTimeout(load, 200);
    } catch (e) {
      props.notify("Сеть недоступна");
    }
  }

  function startEdit(item: BotQueueItem) {
    setEditingId(item.id);
    setEditText(item.text);
  }
  async function saveEdit(id: string) {
    const item = batches.flatMap(b => b.items).find(i => i.id === id);
    const actionName = item?.status === "published" ? "update-published" : "edit";
    await action(id, actionName, { text: editText });
    setEditingId(null);
  }

  // Stats: count items per status
  const allItems = batches.flatMap(b => b.items);
  const pendingCount = allItems.filter(i => i.status === "pending").length;
  const approvedCount = allItems.filter(i => i.status === "approved").length;
  const publishedCount = allItems.filter(i => i.status === "published").length;
  const rejectedCount = allItems.filter(i => i.status === "rejected").length;

  return (
    <div className="p-2 space-y-2 max-w-[1400px] mx-auto">
      {/* Заголовок — ОДНА строка */}
      <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2A5278] text-white p-2 rounded-lg flex items-center gap-2 flex-wrap">
        <h2 className="text-[13px] font-bold flex-shrink-0">🎭 Театр ботов</h2>
        <div className="flex gap-1 text-[10px] flex-wrap">
          <button onClick={() => { setTab("queue"); setStatusFilter('pending'); }} className={`px-1.5 py-0.5 rounded-full ${statusFilter === 'pending' && tab === 'queue' ? 'bg-yellow-400 text-black' : 'bg-white/20 hover:bg-white/30'}`}>⏳ {pendingCount}</button>
          <button onClick={() => { setTab("queue"); setStatusFilter('approved'); }} className={`px-1.5 py-0.5 rounded-full ${statusFilter === 'approved' && tab === 'queue' ? 'bg-blue-400 text-black' : 'bg-white/20 hover:bg-white/30'}`}>✓ {approvedCount}</button>
          <button onClick={() => { setTab("queue"); setStatusFilter('published'); }} className={`px-1.5 py-0.5 rounded-full ${statusFilter === 'published' && tab === 'queue' ? 'bg-green-400 text-black' : 'bg-white/20 hover:bg-white/30'}`}>📤 {publishedCount}</button>
          <button onClick={() => { setTab("queue"); setStatusFilter('rejected'); }} className={`px-1.5 py-0.5 rounded-full ${statusFilter === 'rejected' && tab === 'queue' ? 'bg-red-400 text-black' : 'bg-white/20 hover:bg-white/30'}`}>✗ {rejectedCount}</button>
        </div>
        <div className="ml-auto flex gap-1">
          <button className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tab === "queue" ? "bg-white text-[#1E3A5F]" : "bg-white/20 hover:bg-white/30"}`} onClick={() => setTab("queue")} title="Очередь модерации">📋 Очередь</button>
          <button className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tab === "add" ? "bg-white text-[#1E3A5F]" : "bg-white/20 hover:bg-white/30"}`} onClick={() => setTab("add")} title="Создать новую тему">➕ Новая</button>
          <button className="px-2 py-0.5 rounded text-[10px] bg-white/20 hover:bg-white/30" onClick={load} disabled={loading} title="Обновить">{loading ? "⏳" : "🔄"}</button>
        </div>
      </div>

      {/* === TAB: ADD NEW TOPIC === */}
      {tab === "add" && (
        <div className="bg-white p-3 rounded-lg border border-[#C9D4E2] space-y-2">
          <h3 className="font-bold text-[14px] text-[#1E3A5F]">Создать тему для ботов</h3>
          <input
            type="text"
            value={topicTitle}
            onChange={(e) => setTopicTitle(e.target.value)}
            placeholder="Заголовок темы (необязательно)"
            className="w-full px-2 py-1.5 border border-[#C9D4E2] rounded text-[13px] focus:border-[#1E3A5F] outline-none"
          />
          <textarea
            value={topicText}
            onChange={(e) => setTopicText(e.target.value)}
            placeholder="Текст темы..."
            rows={4}
            className="w-full px-2 py-1.5 border border-[#C9D4E2] rounded text-[13px] focus:border-[#1E3A5F] outline-none"
          />
          <div className="flex gap-2">
            <select
              value={rubricId}
              onChange={(e) => setRubricId(parseInt(e.target.value, 10))}
              className="flex-1 px-2 py-1.5 border border-[#C9D4E2] rounded text-[13px] bg-white focus:border-[#1E3A5F] outline-none"
            >
              {RUBRICS.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button
              className="px-3 py-1.5 bg-[#1E3A5F] text-white rounded text-[13px] font-semibold hover:bg-[#163050] disabled:opacity-50"
              onClick={processTopic}
              disabled={submitting || topicText.trim().length < 10}
            >
              {submitting ? "⏳ Z.ai..." : "🚀 Рерайт"}
            </button>
          </div>
        </div>
      )}

      {/* === TAB: QUEUE === */}
      {tab === "queue" && (
        <div className="space-y-2">
          {/* Empty state */}
          {batches.length === 0 && !loading && (
            <div className="bg-white p-6 rounded-lg border border-[#C9D4E2] text-center">
              <div className="text-[32px] mb-1">📭</div>
              <p className="text-[14px] text-[#56657a]">
                Нет реплик со статусом «{statusFilter}».
              </p>
            </div>
          )}

          {/* Batches — компактные карточки */}
          {batches.map((batch) => {
            const allPending = batch.items.every((i) => i.status === "pending");
            return (
              <div key={batch.batchId} className="bg-white rounded-lg border border-[#C9D4E2] overflow-hidden">
                {/* Batch header — ОДНА строка, на всю ширину */}
                <div className="bg-[#F8FAFC] border-b border-[#C9D4E2] px-2 py-1 flex items-center gap-2">
                  <span className="text-[10px] text-[#56657a] uppercase tracking-wide flex-shrink-0">Источник:</span>
                  <span className="text-[11px] text-[#1a1a1a] italic truncate flex-1" title={batch.sourceText}>
                    {batch.sourceText.slice(0, 200)}{batch.sourceText.length > 200 ? "…" : ""}
                  </span>
                  {batch.topicTitle && (
                    batch.items[0]?.topicId ? (
                      // topicId есть (тема уже создана) → кликабельная ссылка на тему форума
                      <a
                        href={`/?topic=${batch.items[0].topicId}`}
                        className="text-[10px] text-[#0a5caa] hover:text-[#c40000] hover:underline flex-shrink-0 cursor-pointer font-semibold"
                        title={`Открыть тему #${batch.items[0].topicId} на форуме`}
                      >
                        📝 {batch.topicTitle.slice(0, 60)}{batch.topicTitle.length > 60 ? "…" : ""}
                      </a>
                    ) : (
                      // topicId нет → тема ещё не опубликована, заголовок НЕ кликабельный
                      <span
                        className="text-[10px] text-[#56657a] flex-shrink-0 italic"
                        title="Тема ещё не опубликована — одобрите реплики, чтобы создать тему в форуме"
                      >
                        📝 {batch.topicTitle.slice(0, 60)}{batch.topicTitle.length > 60 ? "…" : ""}
                      </span>
                    )
                  )}
                  {allPending && (
                    <button
                      className="flex-shrink-0 px-2 py-0.5 bg-green-600 text-white rounded text-[10px] font-semibold hover:bg-green-700"
                      onClick={() => actionBatch(batch.batchId, "approve-batch")}
                      title="Одобрить все реплики этого батча"
                    >
                      ✓ Все ({batch.count})
                    </button>
                  )}
                </div>

                {/* Items list — компактно, но текст виден полностью */}
                <div className="divide-y divide-[#E5EBF2]">
                  {batch.items.map((item, idx) => (
                    <div key={item.id} className="px-2 py-1.5 hover:bg-[#FAFBFC] flex items-start gap-2">
                      {/* Левая колонка — ник + статус + время */}
                      <div className="flex-shrink-0 w-[120px]">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[#999]">#{idx + 1}</span>
                          <span className="font-bold text-[12px] text-[#0a5caa]">{item.botNickname}</span>
                        </div>
                        <div className="mt-0.5">
                          <StatusBadge status={item.status} />
                        </div>
                        {item.scheduledAt && (item.status === "approved" || item.status === "published") && (
                          <div className="text-[9px] text-[#56657a] mt-0.5">
                            🕐 {new Date(item.scheduledAt).toLocaleString("ru-RU", {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}
                          </div>
                        )}
                        {/* Кнопки действий — под ником, мелкие, в столбик или в ряд */}
                        <div className="flex gap-0.5 mt-1 flex-wrap">
                          {editingId === item.id ? (
                            <>
                              <button className="px-1.5 py-0.5 bg-[#1E3A5F] text-white rounded text-[10px] hover:bg-[#163050]" onClick={() => saveEdit(item.id)} title="Сохранить">💾</button>
                              <button className="px-1.5 py-0.5 bg-white border border-[#C9D4E2] text-[#1E3A5F] rounded text-[10px] hover:bg-gray-50" onClick={() => setEditingId(null)} title="Отмена">✕</button>
                            </>
                          ) : (
                            <>
                              {item.status === "pending" && (
                                <>
                                  <button className="px-1.5 py-0.5 bg-green-600 text-white rounded text-[10px] font-semibold hover:bg-green-700" onClick={() => action(item.id, "approve")} title="Одобрить — публикация 15-120 мин">✓</button>
                                  <button className="px-1.5 py-0.5 bg-white border border-[#C9D4E2] text-[#1E3A5F] rounded text-[10px] hover:bg-gray-50" onClick={() => startEdit(item)} title="Редактировать текст">✏️</button>
                                  <button className="px-1.5 py-0.5 bg-white border border-red-400 text-red-600 rounded text-[10px] hover:bg-red-50" onClick={() => action(item.id, "reject")} title="Отклонить — бот регенерирует">✗</button>
                                </>
                              )}
                              {item.status === "approved" && (
                                <button className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-semibold hover:bg-blue-700" onClick={() => action(item.id, "publish-now")} title="Опубликовать немедленно">🚀 Сейчас</button>
                              )}
                              {item.status === "published" && (
                                <>
                                  <button className="px-1.5 py-0.5 bg-white border border-[#C9D4E2] text-[#1E3A5F] rounded text-[10px] hover:bg-gray-50" onClick={() => startEdit(item)} title="Редактировать">✏️</button>
                                  <button className="px-1.5 py-0.5 bg-[#1E3A5F] text-white rounded text-[10px] hover:bg-[#163050]" onClick={() => action(item.id, "update-published")} disabled={!editText || editingId !== item.id} title="Сохранить в форуме">💾</button>
                                  {item.topicId && (
                                    <button className="px-1.5 py-0.5 bg-white border border-[#0a5caa] text-[#0a5caa] rounded text-[10px] hover:bg-blue-50" onClick={() => props.onOpenTopic(item.topicId!)} title="Открыть тему">🔗</button>
                                  )}
                                  <button className="px-1.5 py-0.5 bg-white border border-red-500 text-red-600 rounded text-[10px] hover:bg-red-50" onClick={() => { if (confirm("Удалить из форума? Тема удалится если это корневой пост.")) { action(item.id, "delete-published"); } }} title="Удалить из форума">🗑</button>
                                </>
                              )}
                              {item.status === "rejected" && (
                                <button className="px-1.5 py-0.5 bg-orange-500 text-white rounded text-[10px] font-semibold hover:bg-orange-600" onClick={() => action(item.id, "regenerate")} title="Регенерировать">🔄</button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Правая — текст реплики, виден полностью */}
                      <div className="flex-1 min-w-0">
                        {editingId === item.id ? (
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            className="w-full px-1.5 py-1 border border-[#0a5caa] rounded text-[12px] focus:outline-none"
                          />
                        ) : (
                          <p className="text-[12px] text-[#1a1a1a] leading-snug whitespace-pre-wrap">
                            {item.text || <span className="italic text-[#999]">(текст ещё не сгенерирован)</span>}
                          </p>
                        )}
                        {item.rejectReason && (
                          <p className="text-[10px] text-[#c00] mt-0.5">
                            Причина: {item.rejectReason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "⏳ Ожидает", color: "#92400e", bg: "#fef3c7" },
    pending_rewrite: { label: "⏳ Z.ai...", color: "#92400e", bg: "#fef3c7" },
    approved: { label: "✓ Одобрено", color: "#1e40af", bg: "#dbeafe" },
    published: { label: "📤 Опубл.", color: "#166534", bg: "#dcfce7" },
    rejected: { label: "✗ Откл.", color: "#991b1b", bg: "#fee2e2" },
  };
  const s = labels[status] || { label: status, color: "#56657a", bg: "#f1f5f9" };
  return (
    <span style={{ color: s.color, background: s.bg, padding: "1px 6px", borderRadius: "8px", fontWeight: 600, fontSize: "10px" }}>
      {s.label}
    </span>
  );
}
