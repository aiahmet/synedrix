import type { ReactNode } from "react";

/**
 * Layout for `/my-topics/*`.
 *
 * A small container that mirrors the chapter page's
 * vertical rhythm. The deep routes handle their own
 * breadcrumb, header, and topic-not-found rendering
 * because the layout does not have access to the
 * Convex preload primitives (those live server-side in
 * each page).
 */
export default function MyTopicsLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">{children}</div>;
}
