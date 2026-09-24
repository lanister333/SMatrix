#!/usr/bin/env python3
"""ШАГ 12: заменяет старый AdminPanel в pages.tsx на публичную страницу разделов."""
path = "/home/z/my-project/src/components/forum/pages.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Найти начало блока (interface ModerationEntry) и конец (строка перед export function PlaceholderPage)
start = None
end = None
for i, l in enumerate(lines):
    if l.startswith("interface ModerationEntry {"):
        start = i
    if l.startswith("export function PlaceholderPage"):
        end = i
assert start is not None and end is not None, (start, end)

new_block = '''/**
 * ШАГ 12. Публичные разделы «Объявления», «Практическая информация»,
 * «Справочник» — содержимое ведётся в админ-панели (ContentItem).
 */
const SECTION_META: Record<string, { title: string; empty: string }> = {
  ads: { title: "Объявления", empty: "Объявлений пока нет — загляните позже." },
  info: { title: "Практическая информация", empty: "Записей пока нет — раздел наполняется." },
  directory: { title: "Справочник", empty: "Справочник пока пуст — раздел наполняется." },
};

export function SectionPage(props: { section: "ads" | "info" | "directory"; onForum: () => void }) {
  const meta = SECTION_META[props.section];
  const [items, setItems] = useState<{ id: string; title: string; body: string; contact: string; updatedAt: string }[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = false;
    setItems(null);
    setError("");
    fetch(`/api/sections?section=${props.section}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Ошибка загрузки");
        return d;
      })
      .then((d) => {
        if (!alive) setItems(d.items || []);
      })
      .catch((e) => {
        if (!alive) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      });
    return () => {
      alive = true;
    };
  }, [props.section]);

  return (
    <div className="sm-frame-2 mx-auto max-w-[860px]">
      <div className="sm-frame-title">{meta.title}</div>
      {error && <p className="p-4 text-[14px] text-[#B22335]">{error}</p>}
      {items === null && !error && <p className="p-4 text-[14px] text-[#64748B]">Загрузка…</p>}
      {items !== null && items.length === 0 && (
        <div className="space-y-3 p-6 text-center text-[15px]">
          <p>{meta.empty}</p>
          <button className="sm-btn sm-btn-primary px-5 py-2" onClick={props.onForum}>
            Перейти на форум
          </button>
        </div>
      )}
      {items !== null && items.length > 0 && (
        <ul className="divide-y divide-[#D8DEE7]">
          {items.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <b className="text-[15.5px]">{i.title}</b>
                {i.contact && <span className="text-[13px] text-[#0A5CAA]">{i.contact}</span>}
                <span className="ml-auto text-[11.5px] text-[#8a97a5]">обновлено {fmtDate(i.updatedAt)}</span>
              </div>
              {i.body && <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed">{i.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'''

lines[start:end] = [new_block]
with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)
print(f"Replaced lines {start+1}-{end} with SectionPage")
