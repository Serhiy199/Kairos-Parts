import type { Metadata } from 'next';
import Link from 'next/link';

import { companyLegalDetails } from '@/lib/company-details';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_SEO.privacyPolicy);

const POLICY_DATE = '1 серпня 2026 року';

const sections = [
  { id: 'general', title: '1. Загальні положення' },
  { id: 'controller', title: '2. Хто обробляє персональні дані' },
  { id: 'data', title: '3. Які дані ми можемо отримувати' },
  { id: 'sources', title: '4. Як ми отримуємо дані' },
  { id: 'purposes', title: '5. Для чого використовуються дані' },
  { id: 'legal-bases', title: '6. Правові підстави обробки' },
  { id: 'account', title: '7. Акаунт, авторизація та cookies' },
  { id: 'requests', title: '8. Заявки, документи та фотографії' },
  { id: 'telegram', title: '9. Telegram та інші канали зв’язку' },
  { id: 'providers', title: '10. Сторонні постачальники й передача даних' },
  { id: 'retention', title: '11. Зберігання та строки зберігання' },
  { id: 'security', title: '12. Захист персональних даних' },
  { id: 'rights', title: '13. Права користувача' },
  { id: 'request-procedure', title: '14. Як подати запит щодо даних' },
  { id: 'minors', title: '15. Дані неповнолітніх' },
  { id: 'external-links', title: '16. Зовнішні посилання' },
  { id: 'changes', title: '17. Зміни до Політики' },
  { id: 'contacts', title: '18. Контактна інформація' },
  { id: 'effective-date', title: '19. Дата набрання чинності' }
] as const;

const listClassName = 'mt-3 grid gap-2 pl-5 text-base leading-7 text-public-muted';

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="bg-primary py-16 text-white sm:py-20 lg:py-24">
        <div className="kp-container">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent sm:text-sm">
            ПРАВОВА ІНФОРМАЦІЯ
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">
            Політика конфіденційності
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
            Практичне пояснення того, які персональні дані обробляє Kairos Parts, навіщо це потрібно та
            як звернутися щодо своїх даних.
          </p>
          <p className="mt-5 text-sm font-semibold text-white/80">
            Дата набрання чинності та останнє оновлення: {POLICY_DATE}
          </p>
        </div>
      </section>

      <section className="bg-public-page py-12 sm:py-16 lg:py-20">
        <div className="kp-container grid items-start gap-8 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)]">
          <aside className="grid gap-6 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-[22px] border border-public-border bg-public-card shadow-panel">
              <div className="border-b border-public-border bg-primary px-6 py-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Володілець даних</p>
                <p className="mt-2 text-xl font-bold">{companyLegalDetails.shortName}</p>
              </div>
              <dl className="grid gap-4 px-6 py-6 text-sm leading-6">
                <div>
                  <dt className="font-bold text-public-primary">Код ЄДРПОУ</dt>
                  <dd className="mt-1 text-public-muted">{companyLegalDetails.edrpou}</dd>
                </div>
                <div>
                  <dt className="font-bold text-public-primary">Юридична адреса</dt>
                  <dd className="mt-1 break-words text-public-muted">
                    {companyLegalDetails.legalAddress.display}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-public-primary">Privacy-запити</dt>
                  <dd className="mt-1 break-all">
                    <a
                      href={companyLegalDetails.email.href}
                      className="font-semibold text-public-primary underline decoration-accent underline-offset-4 transition hover:text-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      {companyLegalDetails.email.display}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <nav aria-label="Зміст Політики" className="rounded-[22px] border border-public-border bg-public-card p-6">
              <h2 className="text-lg font-bold text-public-primary">Зміст</h2>
              <ol className="mt-4 grid gap-2 text-sm leading-6 text-public-muted">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="transition hover:text-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="min-w-0 overflow-hidden rounded-[22px] border border-public-border bg-public-card px-6 py-8 shadow-panel sm:px-8 lg:px-10 lg:py-10">
            <p className="rounded-xl border border-accent/30 bg-accent/10 px-5 py-4 text-sm leading-6 text-public-secondary">
              Цей текст описує поточну роботу сервісу та підготовлений для подальшого погодження з юристом.
              Він не є індивідуальною юридичною консультацією.
            </p>

            <PolicySection id="general" title="1. Загальні положення">
              <p>
                Ця Політика пояснює обробку персональних даних під час використання сайту Kairos Parts,
                особистого кабінету, форм заявок, контактної форми та офіційного Telegram-бота. Ми
                обробляємо лише дані, потрібні для роботи сервісу, комунікації, безпеки та виконання
                застосовних обов’язків.
              </p>
            </PolicySection>

            <PolicySection id="controller" title="2. Хто обробляє персональні дані">
              <p>
                Володільцем персональних даних та оператором сервісу є {companyLegalDetails.fullName}, код
                ЄДРПОУ {companyLegalDetails.edrpou}, юридична адреса: {companyLegalDetails.legalAddress.display}.
              </p>
            </PolicySection>

            <PolicySection id="data" title="3. Які дані ми можемо отримувати">
              <p>Залежно від використаної функції це можуть бути:</p>
              <ul className={listClassName}>
                <li className="list-disc">ім’я, прізвище, телефон, email, назва та реквізити компанії;</li>
                <li className="list-disc">дані акаунта, роль, статус і зв’язок із компанією;</li>
                <li className="list-disc">опис заявки, коментарі, погодження, статуси, рахунки та пропозиції;</li>
                <li className="list-disc">тип, виробник, модель, рік, VIN або серійний номер техніки;</li>
                <li className="list-disc">адреси завантаження й доставки, дані постачальника, вантажу та бажаної дати;</li>
                <li className="list-disc">фотографії, скани, документи та інші вкладення;</li>
                <li className="list-disc">Telegram user/chat ID і дані заявки, надіслані через бота;</li>
                <li className="list-disc">IP-адреса, user agent, час подій, session identifiers, події входу, аудиту й захисту від зловживань.</li>
              </ul>
              <p className="mt-3">
                Ми не використовуємо ці дані для маркетингового профілювання або автоматизованих рішень,
                що створюють юридичні чи подібні суттєві наслідки. Розпізнавання тексту у вкладеннях лише
                допомагає опрацювати заявку.
              </p>
            </PolicySection>

            <PolicySection id="sources" title="4. Як ми отримуємо дані">
              <p>
                Дані надходять безпосередньо від вас або уповноваженого представника через реєстрацію,
                вхід, профіль, заявки, завантаження, контактну форму, Telegram чи спілкування з менеджером.
                Частина технічних даних створюється автоматично під час роботи сайту та засобів безпеки.
              </p>
            </PolicySection>

            <PolicySection id="purposes" title="5. Для чого використовуються дані">
              <ul className={listClassName}>
                <li className="list-disc">створення, підтримка й захист акаунта;</li>
                <li className="list-disc">приймання заявок, підбір запчастин і комунікація з клієнтом;</li>
                <li className="list-disc">робота з технікою, документами, пропозиціями, погодженнями та рахунками;</li>
                <li className="list-disc">розрахунок і виконання Logistics-заявок;</li>
                <li className="list-disc">відповіді на контактні та privacy-звернення;</li>
                <li className="list-disc">запобігання зловживанням, журналювання критичних дій, резервування та захист прав сторін;</li>
                <li className="list-disc">виконання вимог законодавства, якщо вони застосовні.</li>
              </ul>
            </PolicySection>

            <PolicySection id="legal-bases" title="6. Правові підстави обробки">
              <p>
                Залежно від ситуації обробка може спиратися на вашу згоду, необхідність розглянути запит або
                заявку, забезпечити роботу акаунта, виконати встановлений законом обов’язок, запобігти
                зловживанням або захистити законні інтереси компанії та користувачів. Остаточна правова
                кваліфікація окремих процесів підлягає юридичному погодженню.
              </p>
            </PolicySection>

            <PolicySection id="account" title="7. Акаунт, авторизація та cookies">
              <p>
                Для реєстрації та входу ми використовуємо контактний ідентифікатор, захищене представлення
                пароля, статус акаунта та дані сесії. Сайт використовує технічно необхідні cookies або
                подібні ідентифікатори для авторизації, підтримання сесії та безпеки. Активних рекламних,
                поведінкових або сторонніх аналітичних cookies на момент цієї редакції не виявлено, тому
                окремий cookie banner не використовується.
              </p>
            </PolicySection>

            <PolicySection id="requests" title="8. Заявки, документи та фотографії">
              <p>
                Дані заявки потрібні для з’ясування потреби, підбору позицій, погодження та підготовки
                пов’язаних документів. Не завантажуйте зайві персональні дані, паролі, платіжні секрети або
                документи, які не потрібні для звернення. Надсилання заявки саме по собі не є автоматичним
                укладенням договору чи підтвердженням наявності товару.
              </p>
            </PolicySection>

            <PolicySection id="telegram" title="9. Telegram та інші канали зв’язку">
              <p>
                Під час звернення до офіційного Telegram-бота ми можемо отримувати Telegram user/chat ID,
                підтверджений номер телефону, повідомлення, дані заявки та вкладення. Telegram самостійно
                обробляє дані за власними правилами. Дані також можуть надходити телефоном або email —
                надсилайте лише інформацію, необхідну для вашого питання.
              </p>
            </PolicySection>

            <PolicySection id="providers" title="10. Сторонні постачальники й передача даних">
              <p>
                Для роботи сервісу можуть залучатися постачальники хостингу, баз даних, зберігання файлів і
                каналів зв’язку. Код сервісу підтверджує використання Cloudinary для частини фото й
                документів та Telegram для взаємодії через бота; серверна інфраструктура використовує
                PostgreSQL, а середовища розміщуються на VPS та у preview-інфраструктурі Vercel/Neon.
                Постачальнику передається лише обсяг даних, потрібний для відповідної функції.
              </p>
              <p className="mt-3">
                Обробка постачальником може відбуватися за межами України. У такому разі застосовуються
                умови й механізми захисту відповідного постачальника та вимоги застосовного законодавства.
              </p>
            </PolicySection>

            <PolicySection id="retention" title="11. Зберігання та строки зберігання">
              <p>
                Ми зберігаємо дані не довше, ніж це потрібно для акаунта, заявки, комунікації, безпеки,
                бухгалтерського чи іншого правового обов’язку та захисту прав сторін. Строк залежить від
                категорії даних, стану взаємовідносин і законодавчих вимог. Технічні журнали можуть мати
                окремі строки або позначки завершення строку; резервні копії можуть зберігати дані до
                завершення відповідного циклу оновлення. Після втрати потреби дані видаляються,
                знеособлюються або обмежуються в обробці, якщо їх подальше зберігання не вимагається законом.
              </p>
            </PolicySection>

            <PolicySection id="security" title="12. Захист персональних даних">
              <p>
                Ми застосовуємо організаційні й технічні заходи відповідно до характеру сервісу: контроль
                доступу за ролями, захист облікових даних, обмеження спроб входу, журналювання критичних дій,
                приватний режим для частини файлів і резервування. Жоден спосіб передавання або зберігання не
                гарантує абсолютної безпеки, тому заходи переглядаються з урахуванням ризиків.
              </p>
            </PolicySection>

            <PolicySection id="rights" title="13. Права користувача">
              <p>
                У межах застосовного законодавства ви можете запитати інформацію про обробку й доступ до
                даних, їх уточнення або виправлення, заперечити проти певної обробки, відкликати згоду, якщо
                обробка ґрунтується на ній, а також просити видалення чи обмеження обробки. Окремі дані можуть
                бути збережені, якщо цього вимагає закон або вони потрібні для захисту прав сторін.
              </p>
            </PolicySection>

            <PolicySection id="request-procedure" title="14. Як подати запит щодо даних">
              <p>
                Для запиту про доступ, уточнення, виправлення або видалення персональних даних надішліть
                звернення на{' '}
                <a className="font-semibold text-public-primary underline decoration-accent underline-offset-4" href={companyLegalDetails.email.href}>
                  {companyLegalDetails.email.display}
                </a>
                . У зверненні зазначте ім’я, контактні дані, опис запиту та інформацію, яка допоможе
                ідентифікувати ваш акаунт або звернення. Не надсилайте пароль або інші секретні дані. Для
                захисту від несанкціонованих запитів ми можемо попросити підтвердити особу чи повноваження.
              </p>
            </PolicySection>

            <PolicySection id="minors" title="15. Дані неповнолітніх">
              <p>
                Сервіс орієнтований на повнолітніх користувачів і представників бізнесу та не призначений
                для свідомого збору даних дітей. Якщо такі дані потрапили до сервісу, користувач або законний
                представник може звернутися щодо їх видалення.
              </p>
            </PolicySection>

            <PolicySection id="external-links" title="16. Зовнішні посилання">
              <p>
                Сайт може містити посилання на зовнішні ресурси, зокрема карти або Telegram. Їхні оператори
                мають власні правила конфіденційності, за які Kairos Parts не відповідає. Перед передаванням
                даних ознайомтеся з правилами відповідного ресурсу.
              </p>
            </PolicySection>

            <PolicySection id="changes" title="17. Зміни до Політики">
              <p>
                Ми можемо оновлювати Політику у зв’язку зі змінами сервісу, постачальників або вимог
                законодавства. Актуальна редакція та дата останнього оновлення публікуються на цій сторінці.
              </p>
            </PolicySection>

            <PolicySection id="contacts" title="18. Контактна інформація">
              <p>
                Володілець даних: {companyLegalDetails.shortName}. Email для privacy-запитів:{' '}
                <a className="font-semibold text-public-primary underline decoration-accent underline-offset-4" href={companyLegalDetails.email.href}>
                  {companyLegalDetails.email.display}
                </a>
                . Поштова адреса: {companyLegalDetails.legalAddress.display}. Інші актуальні канали наведені
                на сторінці{' '}
                <Link className="font-semibold text-public-primary underline decoration-accent underline-offset-4" href="/contacts">
                  «Контакти»
                </Link>
                .
              </p>
            </PolicySection>

            <PolicySection id="effective-date" title="19. Дата набрання чинності">
              <p>Дата набрання чинності: {POLICY_DATE}. Останнє оновлення: {POLICY_DATE}.</p>
            </PolicySection>
          </article>
        </div>
      </section>
    </>
  );
}

function PolicySection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-public-border py-8 first:pt-8 last:border-b-0 last:pb-0">
      <h2 className="text-2xl font-bold leading-tight text-public-primary sm:text-3xl">{title}</h2>
      <div className="mt-4 text-base leading-7 text-public-muted">{children}</div>
    </section>
  );
}
