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
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-mauve leading-tight md:text-[2rem]">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
    </motion.header>
  );
}
