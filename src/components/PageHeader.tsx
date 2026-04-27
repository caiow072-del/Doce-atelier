import { motion } from "framer-motion";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-6"
    >
      {eyebrow && (
        <p className="text-[11px] uppercase tracking-[0.22em] text-rose font-medium">{eyebrow}</p>
      )}
      <h1 className="font-display text-4xl italic text-mauve mt-1 leading-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
    </motion.header>
  );
}
