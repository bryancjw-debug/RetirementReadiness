import { useEffect, useState } from "react";

export function ResultNavigation() {
  const [items, setItems] = useState<Array<{ id: string; label: string }>>([]);
  const [selected, setSelected] = useState("");
  const [expanded, setExpanded] = useState(() => window.matchMedia("(min-width: 1001px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1001px)");
    const sync = () => setExpanded(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scan = () => {
      const headings = Array.from(document.querySelectorAll<HTMLElement>(".results-section h2, .results-section h3, .page-grid--edit h2"))
        .filter(heading => !heading.closest("details:not([open]), [hidden]"));
      const next = headings.slice(0, 14).map((heading, index) => {
        heading.id ||= `workspace-section-${index}`;
        return { id: heading.id, label: heading.textContent || "Section" };
      });
      setItems(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      document.querySelector("main")?.classList.toggle("has-result-navigation", next.length > 0);
    };
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 100); });
    observer.observe(document.getElementById("root")!, { childList: true, subtree: true });
    scan();
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);
  if (!items.length) return null;
  return <nav className="workspace-navigation" aria-label="Results sections"><details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary>Jump to section</summary>{items.map(item => <button key={item.id} type="button" aria-current={selected === item.id ? "location" : undefined} onClick={() => { const target = document.getElementById(item.id); target?.scrollIntoView({ behavior: "instant", block: "start" }); target?.setAttribute("tabindex", "-1"); target?.focus({ preventScroll: true }); setSelected(item.id); if (window.innerWidth <= 1000) setExpanded(false); }}>{item.label}</button>)}</details></nav>;
}
