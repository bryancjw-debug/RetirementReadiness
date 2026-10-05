import { useEffect, useLayoutEffect, useRef } from "react";

export function useQuizTransition(position: number, enabled = true) {
  const previous = useRef<{ position: number; enabled: boolean; snapshots: HTMLElement[] } | null>(null);
  const cleanup = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".quiz-step:not([data-motion-ghost]), .quiz-navigation:not([data-motion-ghost])"));
    const last = previous.current;
    const changed = last?.position !== position;
    if (changed) cleanup.current();
    previous.current = { position, enabled, snapshots: elements.map(element => element.cloneNode(true) as HTMLElement) };
    if (!changed || !last?.enabled || !enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const direction = position > last.position ? 1 : -1;
    const animations: Animation[] = [];
    const ghosts: HTMLElement[] = [];
    elements.forEach((element, index) => {
      const ghost = last.snapshots[index];
      if (!ghost || !element.parentElement) return;
      const parent = element.parentElement;
      parent.style.position = "relative";
      ghost.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
      ghost.removeAttribute("id");
      ghost.inert = true;
      ghost.dataset.motionGhost = "true";
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, { position: "absolute", top: `${element.offsetTop}px`, left: `${element.offsetLeft}px`, bottom: "auto", right: "auto", width: `${element.offsetWidth}px`, margin: "0", pointerEvents: "none", animation: "none", zIndex: "6" });
      parent.appendChild(ghost);
      ghosts.push(ghost);
      const options: KeyframeAnimationOptions = { duration: 1100, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" };
      animations.push(ghost.animate([{ opacity: 1, transform: "translateY(0)", offset: 0 }, { opacity: 0, transform: `translateY(${-direction * 60}px)`, offset: .52 }, { opacity: 0, transform: `translateY(${-direction * 80}px)` }], options));
      animations.push(element.animate([{ opacity: 0, transform: `translateY(${direction * 80}px)` }, { opacity: 0, transform: `translateY(${direction * 70}px)`, offset: .3 }, { opacity: 1, transform: "translateY(0)" }], options));
    });
    const dispose = () => { animations.forEach(animation => animation.cancel()); ghosts.forEach(ghost => ghost.remove()); };
    cleanup.current = dispose;
    void Promise.allSettled(animations.map(animation => animation.finished)).then(dispose);
  });
  useEffect(() => () => cleanup.current(), []);
}
