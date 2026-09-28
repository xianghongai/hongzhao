import { ArrowRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';

import { TOOLS } from '@/tools/registry';

export function Home() {
  const { t } = useTranslation();

  return (
    <div className="py-12 sm:py-20">
      <section className="max-w-2xl">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('home.headline1')}
          <br />
          {t('home.headline2')}
        </h1>
        <p className="mt-4 text-muted-foreground text-pretty">{t('home.intro')}</p>
      </section>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(({ id, path, icon: Icon }, index) => (
          <motion.li
            key={id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
          >
            <Link
              href={path}
              className="group flex h-full flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-[box-shadow,background-color] hover:ring-brand/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon className="size-5" />
              </span>
              <span className="grid gap-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  {t(`tools.${id}.title`)}
                  <ArrowRightIcon className="size-4 -translate-x-1 opacity-0 transition-[translate,opacity] group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
                <span className="text-sm text-muted-foreground">{t(`tools.${id}.summary`)}</span>
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
