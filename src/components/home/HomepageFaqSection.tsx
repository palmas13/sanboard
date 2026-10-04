'use client';

import Link from 'next/link';
import { useId, useState, type CSSProperties } from 'react';
import { ArrowRight, ChevronDown, MessageCircleQuestion, MessageSquareText, Minus, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { homepageFaqItems } from '@/data/faq';
import { useHomepageReveal } from './useHomepageReveal';

const supportPath = '/hesabim/destek';

export function HomepageFaqSection() {
  const sectionRef = useHomepageReveal<HTMLElement>();
  const accordionId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { currentProfile } = useAuth();
  const supportHref = currentProfile ? supportPath : `/giris?redirect=${encodeURIComponent(supportPath)}`;

  return (
    <section ref={sectionRef} aria-labelledby="homepage-faq-title" className="homepage-faq mx-auto mt-10 max-w-[1480px] px-4 sm:mt-14 sm:px-6 lg:px-8">
      <div className="homepage-faq-panel">
        <div className="homepage-faq-copy">
          <div className="homepage-faq-badge">S.S.S.</div>
          <h2 id="homepage-faq-title" className="homepage-faq-title">Aklında <span>soru mu kaldı?</span></h2>
          <p className="homepage-faq-description">Sanboard&apos;un işleyişi, ilanlar ve güvenli kullanım hakkında en çok merak edilen yanıtları burada bulabilirsin.</p>
          <Link href={supportHref} className="homepage-faq-cta">
            <MessageSquareText aria-hidden="true" className="h-4 w-4" />
            <span>Bizimle İletişime Geç</span>
            <ArrowRight aria-hidden="true" className="homepage-faq-cta-arrow h-4 w-4" />
          </Link>
          <div aria-hidden="true" className="homepage-faq-decoration">
            <MessageCircleQuestion />
          </div>
        </div>

        <div className="homepage-faq-list">
          {homepageFaqItems.map(([question, answer], index) => {
            const isOpen = openIndex === index;
            const panelId = `${accordionId}-panel-${index}`;
            const triggerId = `${accordionId}-trigger-${index}`;

            return (
              <article key={question} className={`homepage-faq-item ${isOpen ? 'is-open' : ''}`} style={{ '--reveal-index': index } as CSSProperties}>
                <h3>
                  <button id={triggerId} type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenIndex(isOpen ? null : index)} className="homepage-faq-trigger">
                    <span aria-hidden="true" className="homepage-faq-icon">{isOpen ? <Minus /> : <Plus />}</span>
                    <span className="homepage-faq-question">{question}</span>
                    <ChevronDown aria-hidden="true" className="homepage-faq-chevron" />
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={triggerId} aria-hidden={!isOpen} className="homepage-faq-answer-grid">
                  <div className="min-h-0 overflow-hidden">
                    <p className="homepage-faq-answer">{answer}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}