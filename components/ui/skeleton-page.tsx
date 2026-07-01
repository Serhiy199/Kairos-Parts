type SkeletonPageProps = {
  title: string;
  description: string;
  items?: string[];
};

export function SkeletonPage({ title, description, items = [] }: SkeletonPageProps) {
  return (
    <section className="mx-auto max-w-7xl">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-semibold text-warning">Day 1 skeleton</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{description}</p>
        {items.length > 0 ? (
          <ul className="mt-5 grid gap-3 text-sm text-foreground sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item} className="rounded-md border border-border bg-surface-muted px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
