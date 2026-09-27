'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FaqSection {
  id: string;
  label: string;
  items: Array<{ question: string; answer: string }>;
}

export function FaqExperience({ sections }: { sections: FaqSection[] }) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '');
  const [openQuestion, setOpenQuestion] = useState<string | null>(sections[0]?.items[0]?.question || null);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
      <nav aria-label="S.S.S kategorileri" className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {sections.map((section) => <button key={section.id} type="button" onClick={() => scrollToSection(section.id)} className={`shrink-0 border-l-2 px-4 py-2.5 text-left text-sm transition-colors ${activeSection === section.id ? 'border-[#FF8A1F] text-[var(--text-main)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>{section.label}</button>)}
        </div>
      </nav>
      <div className="space-y-12">
        {sections.map((section) => <section id={`faq-${section.id}`} key={section.id} className="scroll-mt-28" onMouseEnter={() => setActiveSection(section.id)}><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#FF8A1F]">{section.label}</p><div className="border-t border-[var(--border-app)]">{section.items.map((item) => { const open = openQuestion === item.question; return <div key={item.question} className="border-b border-[var(--border-app)]"><button type="button" aria-expanded={open} onClick={() => setOpenQuestion(open ? null : item.question)} className="flex w-full items-center justify-between gap-6 px-2 py-5 text-left hover:bg-[var(--bg-surface-secondary)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A1F]/50"><span className="text-sm font-semibold text-[var(--text-main)] sm:text-base">{item.question}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-[#FF8A1F]' : 'text-[var(--text-muted)]'}`} /></button><div className={`grid transition-[grid-template-rows,opacity] duration-200 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><div className="overflow-hidden"><p className="px-2 pb-5 pr-10 text-sm leading-7 text-[var(--text-muted)]">{item.answer}</p></div></div></div>; })}</div></section>)}
      </div>
    </div>
  );
}