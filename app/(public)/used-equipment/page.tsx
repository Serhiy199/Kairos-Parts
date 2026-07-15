import Link from 'next/link';

import { ActionIcon } from '@/components/ui/action-icons';

export default function UsedEquipmentPage() {
  return (
    <>
      <section className="bg-primary py-16 text-white">
        <div className="kp-container">
          <div className="max-w-4xl">
            <p className="text-sm font-bold uppercase text-accent">Майбутній розділ</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Майданчик БВ техніки</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-sidebar-text">
              У майбутньому тут буде розділ для розміщення та пошуку вживаної аграрної, вантажної та спеціальної техніки.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-public-page py-16">
        <div className="kp-container">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-start">
            <article className="public-card p-6">
              <p className="text-sm font-bold uppercase text-accent">Екосистема Kairos Parts</p>
              <h2 className="mt-2 text-3xl font-bold text-public-primary">Сервіс підбору запчастин сьогодні, цифровий майданчик завтра</h2>
              <p className="mt-5 text-sm leading-6 text-public-muted">
                Kairos Parts розвиває не лише сервіс підбору запчастин, а й цифрову екосистему для компаній
                із власним парком техніки. Майданчик БВ техніки дозволить клієнтам розміщувати техніку,
                переглядати доступні пропозиції та працювати з історією обслуговування в одному кабінеті.
              </p>
            </article>
            <aside className="public-card p-6">
              <p className="text-sm font-bold uppercase text-accent">Зараз доступно</p>
              <h2 className="mt-2 text-2xl font-bold text-public-primary">Підбір запчастин за заявкою</h2>
              <p className="mt-4 text-sm leading-6 text-public-muted">
                Повноцінний marketplace із оголошеннями, фото, цінами, фільтрами та адмінкою не входить у цей етап.
              </p>
              <Link
                href="/request"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ActionIcon name="plus" />
                Створити заявку на підбір запчастин
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
