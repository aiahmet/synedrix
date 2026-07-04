"use client";

import { ReactNode, useState } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";

/**
 * ConvexClientProvider.
 *
 * `useState` with a lazy initializer gives us a single
 * `ConvexReactClient` instance per provider tree without the
 * "ref-accessed-during-render" lint warning that `useRef` raises.
 * The lazy initializer runs exactly once (on first mount), so
 * the constructor is never re-invoked across re-renders or
 * StrictMode double-invocation.
 */
export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [convex] = useState<ConvexReactClient>(() => {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
      throw new Error("Missing NEXT_PUBLIC_CONVEX_URL in your .env file");
    }
    return new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  });

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
