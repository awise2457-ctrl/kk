import { useSyncExternalStore } from "react";

export interface Route {
  page: "home" | "find" | "verify" | "login" | "app";
  jobId?: string;
  findProject?: string;
}
let route: Route = { page: "home" };
const listeners = new Set<() => void>();
export function navTo(r: Route) {
  route = r;
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}
export function navAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
export const getRoute = () => route;
export const subRoute = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const useRoute = () => useSyncExternalStore(subRoute, getRoute);
