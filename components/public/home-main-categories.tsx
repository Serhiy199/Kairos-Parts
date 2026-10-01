import Image from 'next/image';
import { TbDroplet, TbFilter, TbSettings } from 'react-icons/tb';

type Category = {
  title: string;
  description: string;
  icon: 'oil' | 'filter' | 'bearing' | 'belt' | 'hose';
  image?: { src: string; alt: string };
};

const categories: Category[] = [
  {
    title: 'Оливи',
    description: 'Моторні, гідравлічні, трансмісійні оливи, антифризи, AdBlue та інші технічні рідини. Підбір за маркою та моделлю техніки.',
    icon: 'oil',
    image: { src: '/images/home/categories/oils.webp', alt: 'Оливи та технічні рідини для аграрної та вантажної техніки' }
  },
  {
    title: 'Фільтри',
    description: 'Масляні, паливні, повітряні, гідравлічні та салонні фільтри. Оригінальні та якісні аналоги.',
    icon: 'filter',
    image: { src: '/images/home/categories/filters.webp', alt: 'Фільтри для аграрної та вантажної техніки' }
  },
  {
    title: 'Підшипники',
    description: 'Підшипники для сільськогосподарської, вантажної та спеціальної техніки. Ходові позиції — в наявності, рідкісні — під замовлення.',
    icon: 'bearing',
    image: { src: '/images/home/categories/bearings.webp', alt: 'Підшипники для сільськогосподарської та вантажної техніки' }
  },
  {
    title: 'Ремені',
    description: 'Приводні, клинові та спеціальні ремені для аграрної й вантажної техніки. Підбір за розміром, маркуванням або зразком.',
    icon: 'belt',
    image: { src: '/images/home/categories/belts.webp', alt: 'Приводні та клинові ремені для техніки' }
  },
  {
    title: 'РВТ',
    description: 'Виготовлення та ремонт рукавів високого тиску. Підбір рукава, фітингів і швидке виготовлення під вашу техніку.',
    icon: 'hose',
    image: { src: '/images/home/categories/rvt.webp', alt: 'Рукави високого тиску та гідравлічні фітинги' }
  }
];

function CategoryIcon({ icon }: { icon: Category['icon'] }) {
  const props = { 'aria-hidden': true as const, focusable: false as const, className: 'size-8', strokeWidth: 1.6 };

  if (icon === 'oil') return <TbDroplet {...props} />;
  if (icon === 'filter') return <TbFilter {...props} />;
  if (icon === 'bearing') return <TbSettings {...props} />;

  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {icon === 'belt' ? (
        <>
          <path d="M5 9a5 5 0 0 0 6 8l8-5a5 5 0 0 0-6-8Z" />
          <circle cx="8" cy="13" r="2.5" />
          <circle cx="16" cy="8" r="2.5" />
        </>
      ) : (
        <>
          <path d="M5 17v-7a6 6 0 0 1 12 0v2" />
          <path d="M9 17v-7a2 2 0 0 1 4 0v2" />
          <path d="M3 17h8v4H3zM12 12h6v4h-6z" />
          <path d="M18 13h3v2h-3" />
        </>
      )}
    </svg>
  );
}

function CategoryCard({ category }: { category: Category }) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-public-border-accent bg-public-card shadow-panel">
      <div className="relative aspect-[4/3] w-full border-b border-public-border bg-public-elevated">
        {category.image ? (
          <Image
            src={category.image.src}
            alt={category.image.alt}
            fill
            sizes="(min-width: 1440px) 242px, (min-width: 1280px) 234px, (min-width: 1024px) calc((100vw - 80px) / 3), (min-width: 768px) calc((100vw - 56px) / 2), (min-width: 640px) calc((100vw - 48px) / 2), calc(100vw - 32px)"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6 xl:p-5">
        <span className="flex size-12 items-center justify-center rounded-lg border border-public-border-accent bg-public-page text-accent">
          <CategoryIcon icon={category.icon} />
        </span>
        <h3 className="mt-4 text-xl font-bold uppercase leading-tight text-public-primary">{category.title}</h3>
        <p className="mt-3 text-base leading-7 text-public-secondary xl:text-sm xl:leading-6">{category.description}</p>
        <div className="mt-auto pt-6">
          <div aria-hidden="true" className="h-px w-16 bg-accent" />
        </div>
      </div>
    </article>
  );
}

export function HomeMainCategories() {
  return (
    <>
      <h2 id="main-categories-heading" className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Основні категорії</h2>
      <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {categories.map((category) => <CategoryCard key={category.title} category={category} />)}
      </div>
    </>
  );
}
