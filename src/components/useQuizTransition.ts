import { useEffect, useRef } from "react";

export function useQuizTransition(position: number, enabled = true) {
  const previous = useRef(position);
  useEffect(() => {
    const direction = position >= previous.current ? 1 : -1;
    previous.current = position;
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const element = document.querySelector<HTMLElement>(".quiz-step");
    const animation = element?.animate([{ opacity: .4, transform: `translateX(${direction * 16}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: 190, easing: "ease-out" });
    return () => animation?.cancel();
  }, [position, enabled]);
}
