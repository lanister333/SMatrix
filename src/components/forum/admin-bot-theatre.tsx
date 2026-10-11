// src/components/forum/admin-bot-theatre.tsx
// Секция админки «Театр ботов»: очередь премодерации рерайтов.
// 2026-10-12: список реплик из /api/theatre-bots/queue, действия:
//   - одобрить (одну или весь батч) → публикация с задержкой 15мин-2ч
//   - редактировать текст
//   - отклонить (→ бот регенерирует новый текст)
//   - опубликовать немедленно
// Также: форма ввода новой темы для рерайта → POST /api/theatre-bots/process-topic

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
  { id: 130, name: "Обсуждение сообщений из «Подслушано»" },
  { id: 117, name: "Товары и услуги" },
  { id: 119, name: "Услуги и специалисты" },
  { id: 71, name: "Стоматология" },
  { id: 73, name: "Другое (здоровье)" },
  { id: 75, name: "Спорт и здоровье" },
  { id: 120, name: "Цены" },
  { id: 122, name: "Туризм, отдых" },
  { id: 88, name: "Уход за собой" },
];

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
  const [rubricId, setRubricId] = useState<number>(130);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!props.token) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/theatre-bots/queue?token=${encodeURIComponent(props.token)}&status=${encodeURIComponent(statusFilter)}&limit=200`);
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
      const msg = action === "approve" ? "Одобрено — публикация запланирована" :
                  action === "reject" ? (d.regenerated ? "Отклонено — бот сгенерирует заново" : "Отклонено") :
                  action === "edit" ? "Текст обновлён" :
                  action === "publish-now" ? `Опубликовано: тема #${d.topicId}` : "OK";
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
      const msg = action === "approve-batch" ? `Одобрено: ${d.approved} реплик, публикации каскадом 15-60мин` : "OK";
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
    await action(id, "edit", { text: editText });
    setEditingId(null);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#C9D4E2] pb-2">
        <button className={`sm-btn ${tab === "queue" ? "sm-btn-primary" : ""}`} onClick={() => setTab("queue")}>
          Очередь премодерации
        </button>
        <button className={`sm-btn ${tab === "add" ? "sm-btn-primary" : ""}`} onClick={() => setTab("add")}>
          + Новая тема для рерайта
        </button>
      </div>

      {/* Add new topic */}
      {tab === "add" && (
        <div className="space-y-3 p-4 bg-[#F8FAFC] rounded border border-[#C9D4E2]">
          <h3 className="font-bold text-[15px] text-[#1E3A5F]">Ввести тему для рерайта</h3>
          <p className="text-[13px] text-[#56657a]">
            Вставь текст темы (можно с форума biz65 или придумать). Selector подберёт 3-6 ботов,
            Z.ai сделает рерайт в диалог, каждая реплика попадёт в очередь премодерации.
          </p>
          <div>
            <label className="block text-[12px] text-[#56657a] mb-1">Заголовок темы (необязательно — если пусто, сгенерируется из текста)</label>
            <input
              type="text"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="Например: Где вкусно покушать в городе?"
              className="w-full px-3 py-2 border border-[#C9D4E2] rounded text-[14px]"
            />
          </div>
          <div>
            <label className="block text-[12px] text-[#56657a] mb-1">Текст темы *</label>
            <textarea
              value={topicText}
              onChange={(e) => setTopicText(e.target.value)}
              placeholder="Форумчане, подскажите: где у нас в городе можно вкусно покушать?"
              rows={6}
              className="w-full px-3 py-2 border border-[#C9D4E2] rounded text-[14px]"
            />
          </div>
          <div>
            <label className="block text-[12px] text-[#56657a] mb-1">Рубрика для публикации</label>
            <select
              value={rubricId}
              onChange={(e) => setRubricId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-[#C9D4E2] rounded text-[14px]"
            >
              {RUBRICS.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <button
            className="sm-btn sm-btn-primary px-4 py-2"
            onClick={processTopic}
            disabled={submitting || topicText.trim().length < 10}
          >
            {submitting ? "Обработка…" : "Запустить рерайт (3-6 ботов)"}
          </button>
        </div>
      )}

      {/* Queue */}
      {tab === "queue" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {["pending", "approved", "published", "rejected", "all"].map((s) => (
              <button
                key={s}
                className={`sm-btn ${statusFilter === s ? "sm-btn-primary" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "pending" ? "Ожидают" :
                 s === "approved" ? "Одобрены" :
                 s === "published" ? "Опубликованы" :
                 s === "rejected" ? "Отклонены" : "Все"}
              </button>
            ))}
            <button className="sm-btn" onClick={load} disabled={loading}>
              {loading ? "Загрузка…" : "↻ Обновить"}
            </button>
          </div>

          {/* Batches */}
          {batches.length === 0 && !loading && (
            <p className="text-center text-[14px] text-[#56657a] p-8">
              Нет реплик со статусом «{statusFilter}».
            </p>
          )}
          {batches.map((batch) => (
            <div key={batch.batchId} className="border border-[#C9D4E2] rounded bg-white">
              {/* Batch header */}
              <div className="bg-[#FDFEFF] border-b border-[#C9D4E2] px-3 py-2 flex items-center gap-3 flex-wrap">
                <div className="text-[13px] font-bold text-[#1E3A5F]">
                  Батч: {batch.count} реплик
                </div>
                <div className="text-[12px] text-[#56657a] flex-1 min-w-0 truncate">
                  Источник: <span className="italic">{batch.sourceText.slice(0, 100)}{batch.sourceText.length > 100 ? "…" : ""}</span>
                </div>
                {batch.items.every((i) => i.status === "pending") && (
                  <button
                    className="sm-btn sm-btn-primary text-[12px] px-2 py-1"
                    onClick={() => actionBatch(batch.batchId, "approve-batch")}
                  >
                    ✓ Одобрить весь батч
                  </button>
                )}
              </div>
              {/* Items */}
              <div className="divide-y divide-[#E5EBF2]">
                {batch.items.map((item) => (
                  <div key={item.id} className="p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-[140px]">
                        <div className="font-bold text-[14px] text-[#0a5caa]">{item.botNickname}</div>
                        <div className="text-[11px] text-[#56657a]">#{item.order + 1} в диалоге</div>
                        <div className="text-[11px] mt-1">
                          <StatusBadge status={item.status} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingId === item.id ? (
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            className="w-full px-2 py-1 border border-[#0a5caa] rounded text-[14px]"
                          />
                        ) : (
                          <p className="text-[14px] text-[#1a1a1a] whitespace-pre-wrap">{item.text}</p>
                        )}
                        {item.scheduledAt && (
                          <p className="text-[11px] text-[#56657a] mt-1">
                            🕐 Запланировано: {new Date(item.scheduledAt).toLocaleString("ru-RU")}
                          </p>
                        )}
                        {item.rejectReason && (
                          <p className="text-[11px] text-[#c00] mt-1">Причина отклонения: {item.rejectReason}</p>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {editingId === item.id ? (
                        <>
                          <button className="sm-btn sm-btn-primary text-[12px] px-2 py-1" onClick={() => saveEdit(item.id)}>Сохранить</button>
                          <button className="sm-btn text-[12px] px-2 py-1" onClick={() => setEditingId(null)}>Отмена</button>
                        </>
                      ) : (
                        <>
                          {item.status === "pending" && (
                            <button className="sm-btn sm-btn-primary text-[12px] px-2 py-1" onClick={() => action(item.id, "approve")}>
                              ✓ Одобрить
                            </button>
                          )}
                          {item.status === "approved" && (
                            <button className="sm-btn sm-btn-primary text-[12px] px-2 py-1" onClick={() => action(item.id, "publish-now")}>
                              🚀 Опубликовать сейчас
                            </button>
                          )}
                          <button className="sm-btn text-[12px] px-2 py-1" onClick={() => startEdit(item)}>✏️ Редактировать</button>
                          {item.status !== "rejected" && item.status !== "published" && (
                            <button className="sm-btn text-[12px] px-2 py-1" onClick={() => action(item.id, "reject")}>❌ Отклонить</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    pending: { label: "Ожидает", color: "#f59e0b" },
    approved: { label: "Одобрено", color: "#3b82f6" },
    published: { label: "Опубликовано", color: "#10b981" },
    rejected: { label: "Отклонено", color: "#ef4444" },
  };
  const s = labels[status] || { label: status, color: "#56657a" };
  return (
    <span style={{ color: s.color, border: `1px solid ${s.color}`, padding: "1px 6px", borderRadius: "3px", fontWeight: 600 }}>
      {s.label}
    </span>
  );
}
