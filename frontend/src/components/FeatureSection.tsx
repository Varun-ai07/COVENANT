"use client";

import { memo, ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureSectionProps {
  label: string;
  heading: string;
  body: string;
  testimonial?: { quote: string; author: string };
  mockup: ReactNode;
  reverse?: boolean;
}

export const FeatureSection = memo(function FeatureSection({
  label,
  heading,
  body,
  testimonial,
  mockup,
  reverse = false,
}: FeatureSectionProps) {
  return (
    <section className="relative py-24 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decoration */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-30 blur-3xl pointer-events-none",
          reverse ? "right-0 bg-accent/5" : "left-0 bg-accent-glow/5"
        )}
      />

      <div
        className={cn(
          "max-w-7xl mx-auto grid gap-12 lg:gap-20 items-center relative z-10",
          "grid-cols-1 lg:grid-cols-2",
          reverse && "lg:grid-flow-dense"
        )}
      >
        {/* Text content */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn(reverse && "lg:col-start-2")}
        >
          {/* Label */}
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-px bg-accent" />
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
              {label}
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-white mb-6 leading-tight">
            {heading.split(",")[0]}
            {heading.includes(",") && (
              <>
                ,
                <br />
                <span className="text-accent-light">{heading.split(",")[1]}</span>
              </>
            )}
          </h2>

          {/* Body */}
          <p className="text-lg text-muted mb-8 max-w-lg leading-relaxed">
            {body}
          </p>

          {/* Testimonial */}
          {testimonial && (
            <motion.blockquote
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative pl-6 py-4 border-l-2 border-accent/50 before:absolute before:left-0 before:top-0 before:w-1 before:h-full before:bg-gradient-to-b before:from-accent before:to-transparent"
            >
              <p className="text-white/90 italic mb-3 leading-relaxed">
                "{testimonial.quote}"
              </p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-xs text-accent">{testimonial.author[0]}</span>
                </div>
                <cite className="text-sm text-muted not-italic font-medium">
                  {testimonial.author}
                </cite>
              </div>
            </motion.blockquote>
          )}
        </motion.div>

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className={cn("relative", reverse && "lg:col-start-1")}
        >
          {/* Glow behind mockup */}
          <div className="absolute inset-0 bg-accent/10 blur-3xl opacity-50 rounded-3xl pointer-events-none" />
          <div className="relative">{mockup}</div>
        </motion.div>
      </div>
    </section>
  );
});
