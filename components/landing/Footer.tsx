import Link from "next/link";
import Image from "next/image";

import { footerLinkColumns } from "@/components/landing/data";

export function Footer() {
  return (
    <footer
      aria-labelledby="footer-heading"
      className="border-t border-border bg-background"
    >
      <h2 id="footer-heading" className="sr-only">
        Website-Fußzeile
      </h2>
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-12 sm:gap-8">
          <div className="sm:col-span-4">
            <div className="inline-flex items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-md">
                <Image
                  src="/synedrix-logo.png"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </span>
              <span className="text-[13.5px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">
                Synedrix
              </span>
            </div>
            <p className="mt-4 max-w-md text-[13px] leading-[1.5] text-muted-foreground">
              Open Source unter der MIT-Lizenz. Selbst hosten, forken oder die gehostete Instanz nutzen.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8 sm:col-span-8 sm:grid-cols-3"
          >
            {footerLinkColumns.map((column) => (
              <div key={column.heading}>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
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
                        className="rounded-sm text-[13px] text-muted-foreground outline-none transition-colors duration-200 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
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

        <div className="mt-12 border-t border-border/40 pt-6 text-[11.5px] text-muted-foreground/80">
          <p>
            Synedrix von{" "}
            <a
              href="https://github.com/aiahmet"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm font-medium text-foreground outline-none transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
            >
              Ahmet Cetin
            </a>
            · MIT-Lizenz.
          </p>
        </div>
      </div>
    </footer>
  );
}
