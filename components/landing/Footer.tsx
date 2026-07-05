import Link from "next/link";
import Image from "next/image";

import { footerLinkColumns, heroStats } from "@/components/landing/data";

/**
 * Footer.
 *
 * Three-column layout. The left column carries the brand mark, the
 * one-liner, and four spec chips pulled from the spec so the footer
 * never feels like a link farm dumped on top of a logo. The right
 * two columns carry the actual links. The bottom row carries the
 * license and the build metadata in a single hairline ribbon.
 */
export function Footer() {
  return (
    <footer
      aria-labelledby="footer-heading"
      className="border-t border-border bg-surface"
    >
      <h2 id="footer-heading" className="sr-only">
        Site footer
      </h2>
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-12 sm:gap-8">
          <div className="sm:col-span-6">
            <div className="inline-flex items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
                <Image
                  src="/synedrix-logo.png"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                Synedrix
              </span>
            </div>
            <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
              A personal learning operating system. Five systems sharing one
              state. Open source under the MIT License.
            </p>

            <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {heroStats.map((stat) => (
                <li
                  key={stat.caption}
                  className="rounded-md border border-border bg-surface-elevated px-2.5 py-2"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {stat.caption}
                  </p>
                  <p className="mt-1 font-mono text-[15px] font-semibold tabular-nums leading-none text-foreground">
                    {stat.value}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8 sm:col-span-6 sm:grid-cols-3"
          >
            {footerLinkColumns.map((column) => (
              <div key={column.heading}>
                <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {column.heading}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        target={
                          link.href.startsWith("http") ? "_blank" : undefined
                        }
                        rel={
                          link.href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        className="text-[13px] text-muted-foreground outline-none transition-colors duration-200 hover:text-foreground focus-visible:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center">
          <p>
            Built with obsession for the perfect study session. Synedrix by{" "}
            <a
              href="https://github.com/aiahmet"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground outline-none transition-colors hover:text-accent focus-visible:text-accent"
            >
              Ahmet Cetin
            </a>
            .
          </p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
            Released under the MIT License. Built with Convex, Clerk,
            OpenRouter.
          </p>
        </div>
      </div>
    </footer>
  );
}
