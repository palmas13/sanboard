'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqAccordionProps {
  items: ReadonlyArray<readonly [question: string, answer: string]>;
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const accordionId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="grid gap-3">
      {items.map(([question, answer], index) => {
        const isOpen = openIndex === index;
        const panelId = `${accordionId}-panel-${index}`;
        const triggerId = `${accordionId}-trigger-${index}`;

        return (
          <article
            key={question}
            className={`overflow-hidden rounded-2xl border bg-[var(--bg-surface)] transition-[border-color,background-color,box-shadow] duration-200 ${
              isOpen
                ? 'border-[#FF8A1F]/35 bg-[#FF8A1F]/[0.045] shadow-[0_12px_32px_rgba(255,138,31,0.06)]'
                : 'border-[var(--border-app)] hover:border-[#FF8A1F]/30 hover:bg-[var(--bg-surface-secondary)]/60'
            }`}
          >
            <h3>
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="group flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-[var(--text-main)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#FF8A1F]/70 focus-visible:ring-inset sm:px-6 sm:py-5"
              >
                <span className="min-w-0">{question}</span>
                <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-[var(--text-dim)] transition-[color,transform] duration-200 group-hover:text-[#FF8A1F] ${isOpen ? 'rotate-180 text-[#FF8A1F]' : ''}`} />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              aria-hidden={!isOpen}
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <div className="min-h-0 overflow-hidden">
                <p className="mx-5 border-t border-[var(--border-app)] pb-5 pt-4 text-sm leading-7 text-[var(--text-muted)] sm:mx-6 sm:pb-6">{answer}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}