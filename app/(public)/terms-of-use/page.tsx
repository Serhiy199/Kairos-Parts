import type { Metadata } from 'next';
import Link from 'next/link';

import { companyLegalDetails } from '@/lib/company-details';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_SEO.termsOfUse);

const TERMS_DATE = '1 серпня 2026 року';

const sections = [
  { id: 'general', title: '1. Загальні положення' },
  { id: 'operator', title: '2. Оператор сервісу' },
  { id: 'scope', title: '3. Предмет і сфера застосування Умов' },
  { id: 'account', title: '4. Реєстрація та обліковий запис' },
  { id: 'security', title: '5. Авторизація і безпека акаунта' },
  { id: 'accuracy', title: '6. Достовірність даних' },
  { id: 'requests', title: '7. Створення та опрацювання заявок' },
  { id: 'request-status', title: '8. Статус заявки та відсутність автоматичного договору' },
  { id: 'approvals', title: '9. Погодження позицій і комерційних пропозицій' },
  { id: 'logistics', title: '10. Logistics-заявки' },
  { id: 'vehicles-files', title: '11. Техніка, фотографії та документи' },
  { id: 'materials', title: '12. Вимоги до матеріалів користувача' },
  { id: 'prohibited', title: '13. Заборонені дії' },
  { id: 'restrictions', title: '14. Обмеження або припинення доступу' },
  { id: 'intellectual-property', title: '15. Інтелектуальна власність' },
  { id: 'availability', title: '16. Доступність сервісу і технічні роботи' },
  { id: 'external-services', title: '17. Сторонні сервіси та посилання' },
  { id: 'liability', title: '18. Межі відповідальності' },
  { id: 'personal-data', title: '19. Персональні дані' },
  { id: 'claims', title: '20. Офіційні звернення та претензії' },
  { id: 'changes', title: '21. Зміни до Умов' },
  { id: 'law', title: '22. Застосовне право' },
  { id: 'contacts', title: '23. Контактна інформація' },
  { id: 'effective-date', title: '24. Дата набрання чинності' }
] as const;

const listClassName = 'mt-3 grid gap-2 pl-5 text-base leading-7 text-public-muted';
const linkClassName =
  'font-semibold text-public-primary underline decoration-accent underline-offset-4 transition hover:text-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export default function TermsOfUsePage() {
  return (
    <>
      <section className="bg-primary py-16 text-white sm:py-20 lg:py-24">
        <div className="kp-container">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent sm:text-sm">
            ПРАВИЛА СЕРВІСУ
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">
            Умови користування
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
            Правила користування сайтом, особистим кабінетом, заявками, документами та іншими функціями
            Kairos Parts.
          </p>
          <p className="mt-5 text-sm font-semibold text-white/80">
            Дата набрання чинності та останнє оновлення: {TERMS_DATE}
          </p>
        </div>
      </section>

      <section className="bg-public-page py-12 sm:py-16 lg:py-20">
        <div className="kp-container grid items-start gap-8 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)]">
          <aside className="grid gap-6 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-[22px] border border-public-border bg-public-card shadow-panel">
              <div className="border-b border-public-border bg-primary px-6 py-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Оператор сервісу</p>
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
                  <dt className="font-bold text-public-primary">Email</dt>
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

            <nav aria-label="Зміст Умов" className="rounded-[22px] border border-public-border bg-public-card p-6">
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
              Ці Умови описують поточну роботу сервісу й підготовлені для подальшого погодження з юристом.
              Вони не є публічною офертою та не замінюють окремі домовленості або документи сторін.
            </p>

            <TermsSection id="general" title="1. Загальні положення">
              <p>
                Ці Умови регулюють користування сайтом kairos-parts.com.ua, його публічними сторінками,
                реєстрацією, особистим кабінетом, заявками та файлами. Перед використанням відповідної
                функції користувачеві слід ознайомитися з Умовами. Простий перегляд сторінок не означає
                безумовного укладення договору.
              </p>
            </TermsSection>

            <TermsSection id="operator" title="2. Оператор сервісу">
              <p>
                Оператором є {companyLegalDetails.fullName}, код ЄДРПОУ {companyLegalDetails.edrpou},
                юридична адреса: {companyLegalDetails.legalAddress.display}. Офіційний email:{' '}
                <a className={linkClassName} href={companyLegalDetails.email.href}>
                  {companyLegalDetails.email.display}
                </a>
                .
              </p>
            </TermsSection>

            <TermsSection id="scope" title="3. Предмет і сфера застосування Умов">
              <p>
                Сервіс допомагає передавати й опрацьовувати запити на запчастини та логістику, вести дані
                техніки, обмінюватися матеріалами, показувати статуси, позиції та документи. Використання
                сервісу не замінює окремий договір, рахунок, комерційну пропозицію або іншу домовленість,
                якщо сторони визначили її окремо. Обробка персональних даних регулюється окремою{' '}
                <Link className={linkClassName} href="/privacy-policy">
                  Політикою конфіденційності
                </Link>
                .
              </p>
            </TermsSection>

            <TermsSection id="account" title="4. Реєстрація та обліковий запис">
              <ul className={listClassName}>
                <li className="list-disc">надавайте правдиві й актуальні контактні та компанійні дані;</li>
                <li className="list-disc">не створюйте акаунт від імені іншої особи або компанії без повноважень;</li>
                <li className="list-disc">підтримуйте актуальність контактів і повідомляйте про суттєві зміни;</li>
                <li className="list-disc">не передавайте дані для входу іншим особам;</li>
                <li className="list-disc">враховуйте, що доступ може залежати від ролі та зв’язку акаунта з компанією.</li>
              </ul>
              <p className="mt-3">
                Запрошення працівників і керування їхніми ролями є внутрішньою функцією, а не публічною
                реєстрацією клієнта.
              </p>
            </TermsSection>

            <TermsSection id="security" title="5. Авторизація і безпека акаунта">
              <p>
                Користувач повинен зберігати пароль та інші дані для входу у таємниці. У разі підозри на
                компрометацію слід повідомити Kairos Parts і припинити використання скомпрометованих даних.
                Для захисту акаунта або сервісу доступ може бути тимчасово обмежений під час перевірки.
                Технічні заходи знижують ризики, але не є абсолютною гарантією безпеки.
              </p>
            </TermsSection>

            <TermsSection id="accuracy" title="6. Достовірність даних">
              <p>
                Контактні дані, відомості про компанію, техніку, VIN або серійні й каталожні номери, адреси,
                опис вантажу, бажану дату та інші дані заявки мають бути точними. Неточності можуть вплинути
                на підбір, розрахунок, строки або можливість опрацювання. Це не звільняє оператора чи
                менеджера від відповідальності за їхні власні помилки.
              </p>
            </TermsSection>

            <TermsSection id="requests" title="7. Створення та опрацювання заявок">
              <p>
                Заявка є зверненням до менеджера і запускає процес уточнення. Менеджер може запросити
                додаткові дані або матеріали. Службові статуси відображають етап процесу і не завжди мають
                самостійне юридичне значення. Наявність, ціна, строки постачання, умови передачі товару та
                інші істотні умови погоджуються з менеджером або визначаються окремими документами сторін.
              </p>
            </TermsSection>

            <TermsSection id="request-status" title="8. Статус заявки та відсутність автоматичного договору">
              <p className="font-semibold text-public-primary">
                Надсилання заявки через сайт не є автоматичним укладенням договору, підтвердженням наявності
                товару або остаточним підтвердженням замовлення.
              </p>
              <p className="mt-3">
                Наявність товару підтверджує менеджер; ціна та строки погоджуються окремо. Статус, дія в
                кабінеті, відображення рахунку чи комерційної пропозиції самі по собі не повинні тлумачитися
                як завершений договір поза окремо погодженим процесом.
              </p>
            </TermsSection>

            <TermsSection id="approvals" title="9. Погодження позицій і комерційних пропозицій">
              <p>
                Клієнт може позначати погоджені позиції; непозначені позиції обробляються як непогоджені за
                чинним UI flow. Рішення фіксується в системі, а менеджер може формувати наступні документи на
                підставі фінального набору. Це операційне рішення в межах заявки, не кваліфікований
                електронний підпис і не автоматичне прийняття публічної оферти. Перед використанням
                пропозиції або рахунку перевірте дані та повідомте менеджера про розбіжності.
              </p>
            </TermsSection>

            <TermsSection id="logistics" title="10. Logistics-заявки">
              <p>
                У заявці потрібно вказати правдиві адреси, один тарифний населений пункт, точки відвантаження,
                опис вантажу, контакти й бажану дату. Кілька точок допускаються відповідно до форми. Бажана
                дата не гарантує виконання саме цього дня. Автоматичний або індивідуальний розрахунок,
                можливість і умови виконання підтверджуються менеджером; заявка не є автоматичним договором
                перевезення.
              </p>
            </TermsSection>

            <TermsSection id="vehicles-files" title="11. Техніка, фотографії та документи">
              <p>
                Дані техніки та вкладення використовуються для підбору, історії звернень і роботи з
                документами. Користувач може завантажувати лише підтримувані формати в установлених
                інтерфейсом межах. Для окремих фото й документів доступні дозволені функції видалення або
                архівування; загального автоматичного видалення всіх матеріалів разом з акаунтом сервіс не
                обіцяє.
              </p>
            </TermsSection>

            <TermsSection id="materials" title="12. Вимоги до матеріалів користувача">
              <ul className={listClassName}>
                <li className="list-disc">передавайте лише матеріали, які маєте право використовувати;</li>
                <li className="list-disc">не завантажуйте незаконний контент, шкідливі файли або матеріали, що порушують права інших осіб;</li>
                <li className="list-disc">не надсилайте паролі, платіжні секрети, access tokens або зайві персональні дані;</li>
                <li className="list-disc">перевіряйте, що файл стосується заявки чи функції сервісу.</li>
              </ul>
              <p className="mt-3">
                Користувач або правовласник зберігає права на свої матеріали й надає оператору лише
                обмежений дозвіл технічно зберігати, обробляти та показувати їх для роботи сервісу. Оператор
                може обмежити доступ, видалити матеріал, що порушує правила, або попросити завантажити його
                повторно.
              </p>
            </TermsSection>

            <TermsSection id="prohibited" title="13. Заборонені дії">
              <ul className={listClassName}>
                <li className="list-disc">несанкціонований доступ, використання чужого акаунта або обхід ролей;</li>
                <li className="list-disc">атаки, шкідливий код, навмисне перевантаження чи втручання у роботу сервісу;</li>
                <li className="list-disc">підміна даних, неправдиві заявки або втручання у журнали, статуси й документи;</li>
                <li className="list-disc">використання бота або API поза дозволеним процесом;</li>
                <li className="list-disc">scraping, якщо він шкодить сервісу або порушує права;</li>
                <li className="list-disc">незаконна мета або порушення прав третіх осіб.</li>
              </ul>
              <p className="mt-3">Це не обмежує законне цитування чи індексацію публічних сторінок пошуковими системами.</p>
            </TermsSection>

            <TermsSection id="restrictions" title="14. Обмеження або припинення доступу">
              <p>
                Доступ може бути обґрунтовано обмежений через підозру на компрометацію, порушення Умов,
                зловживання, загрозу безпеці, вимогу закону, недостовірні дані облікового запису або необхідність
                технічної перевірки. Обмеження має відповідати причині та можливостям сервісу; попереднє
                повідомлення може бути неможливим у невідкладній ситуації. Технічний статус DISABLED у
                фактичному процесі авторизації припиняє вхід до відновлення доступу уповноваженим адміністратором.
              </p>
            </TermsSection>

            <TermsSection id="intellectual-property" title="15. Інтелектуальна власність">
              <p>
                Дизайн, код, бренд і власний контент сайту охороняються відповідно до законодавства.
                Користування сервісом не надає права копіювати систему або комерційно використовувати її
                елементи поза дозволеним законом чи письмовою домовленістю. Права на завантажені користувачем матеріали
                залишаються у користувача або відповідного правовласника.
              </p>
            </TermsSection>

            <TermsSection id="availability" title="16. Доступність сервісу і технічні роботи">
              <p>
                Сервіс може тимчасово бути недоступним через технічні роботи, оновлення, інцидент або роботу
                сторонньої інфраструктури. Оператор прагне відновлювати роботу, але не гарантує абсолютної
                безперервності. Під час технічних робіт дані в кабінеті можуть оновлюватися із затримкою.
              </p>
            </TermsSection>

            <TermsSection id="external-services" title="17. Сторонні сервіси та посилання">
              <p>
                Сервіс використовує або посилається на Telegram, зовнішні карти та файлову й хостингову
                інфраструктуру, зокрема Cloudinary для частини матеріалів. Такі ресурси мають власні умови,
                а оператор не контролює весь їхній контент або технічну доступність. Заплановані, але не
                активні інтеграції у цих Умовах не заявляються.
              </p>
            </TermsSection>

            <TermsSection id="liability" title="18. Межі відповідальності">
              <p>
                Сервіс є інструментом комунікації та опрацювання заявок. Результат залежить, зокрема, від
                точності наданих користувачем даних. Оператор не відповідає за наслідки свідомо неправдивої
                інформації користувача чи дії незалежних сторонніх сервісів поза розумним контролем, але це
                не виключає відповідальності оператора у випадках, передбачених законом. Остаточні товарні й
                договірні умови погоджуються окремо.
              </p>
            </TermsSection>

            <TermsSection id="personal-data" title="19. Персональні дані">
              <p>
                Персональні дані обробляються відповідно до{' '}
                <Link className={linkClassName} href="/privacy-policy">
                  Політики конфіденційності
                </Link>
                . Ознайомлення з цими Умовами не є згодою на маркетингові повідомлення.
              </p>
            </TermsSection>

            <TermsSection id="claims" title="20. Офіційні звернення та претензії">
              <p>
                Загальне або офіційне звернення можна надіслати на{' '}
                <a className={linkClassName} href={companyLegalDetails.email.href}>
                  {companyLegalDetails.email.display}
                </a>
                . Зазначте ім’я чи назву компанії, контакт, опис питання і номер заявки, якщо він є.
                Письмові претензії приймаються поштою за юридичною адресою: {companyLegalDetails.legalAddress.display}.
                Telegram не замінює цей порядок. Фіксований строк розгляду цими Умовами не встановлюється.
              </p>
            </TermsSection>

            <TermsSection id="changes" title="21. Зміни до Умов">
              <p>
                Актуальна редакція й дата оновлення розміщуються на цій сторінці. Суттєві зміни можуть
                супроводжуватися повідомленням у сервісі, якщо відповідний механізм використовується. Саме лише
                продовження перегляду сайту не визначається цими Умовами як безумовне автоматичне прийняття
                будь-яких змін у всіх випадках.
              </p>
            </TermsSection>

            <TermsSection id="law" title="22. Застосовне право">
              <p>До цих Умов і користування сервісом застосовується законодавство України.</p>
            </TermsSection>

            <TermsSection id="contacts" title="23. Контактна інформація">
              <p>
                Оператор: {companyLegalDetails.shortName}. Email:{' '}
                <a className={linkClassName} href={companyLegalDetails.email.href}>
                  {companyLegalDetails.email.display}
                </a>
                . Юридична адреса: {companyLegalDetails.legalAddress.display}. Інші актуальні канали наведені
                на сторінці{' '}
                <Link className={linkClassName} href="/contacts">
                  «Контакти»
                </Link>
                .
              </p>
            </TermsSection>

            <TermsSection id="effective-date" title="24. Дата набрання чинності">
              <p>Дата набрання чинності: {TERMS_DATE}. Останнє оновлення: {TERMS_DATE}.</p>
            </TermsSection>
          </article>
        </div>
      </section>
    </>
  );
}

function TermsSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-public-border py-8 first:pt-8 last:border-b-0 last:pb-0">
      <h2 className="text-2xl font-bold leading-tight text-public-primary sm:text-3xl">{title}</h2>
      <div className="mt-4 text-base leading-7 text-public-muted">{children}</div>
    </section>
  );
}
