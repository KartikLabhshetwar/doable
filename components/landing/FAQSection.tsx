"use client";

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FAQSectionProps {
  className?: string;
}

const faqData = [
  {
    question: "Who is Doable for?",
    answer: "Doable is built for individuals and indie hackers who want to get things done instead of wasting time on complicated tools. If you're building something solo or with a small team, and you want a simple, fast way to manage tasks without all the bloat, Doable is for you."
  },
  {
    question: "What is Doable?",
    answer: "Doable is a simple, AI-powered task management tool. You can create tasks, organize projects, and manage your work through natural language. No need to learn complex interfaces - just tell the AI what you need and it handles the rest."
  },
  {
    question: "How does the AI assistant work?",
    answer: "Just chat with it naturally. Say things like 'Create a task for fixing the login bug' or 'Show me all high-priority tasks' and the AI does it. No clicking through menus or filling out forms - just talk to it like a teammate."
  },
  {
    question: "Is Doable free?",
    answer: "Yes! Doable is completely free and open source. You'll need a Groq API key for the AI features (which has a generous free tier), but everything else is unlimited. You can also self-host it on your own server."
  },
  {
    question: "Can I use my own API key?",
    answer: "Absolutely. Bring your own Groq API key and use it. You can set it globally or per-team, giving you full control over costs and usage."
  },
  {
    question: "Do I need a team to use it?",
    answer: "Nope. While Doable supports teams, it works great for solo projects too. Create your workspace, add projects, and start managing tasks. Invite others later if you want."
  },
  {
    question: "How do I get started?",
    answer: "Sign up with Google, create a workspace, and start chatting with the AI. That's it. The AI will help you create your first project and tasks. No tutorial needed."
  },
  {
    question: "Is my data safe?",
    answer: "Yes. Doable uses secure authentication and you can self-host it to keep your data on your own server. The code is open source, so you can verify everything yourself."
  }
];

export const FAQSection: React.FC<FAQSectionProps> = ({ className = '' }) => {
  return (
    <div className={`w-full py-12 md:py-20 relative ${className}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-3 md:mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Everything you need to know about Doable
          </p>
        </div>

        {/* Accordion */}
        <Accordion type="single" collapsible className="w-full">
          {faqData.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="border-b border-border/50">
              <AccordionTrigger className="text-left text-base sm:text-lg font-medium py-4 hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-base text-muted-foreground leading-relaxed pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

