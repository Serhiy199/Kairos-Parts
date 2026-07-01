export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  requestHint: string;
  subcategories: string[];
  manufacturers: string[];
};

export const catalogCategories = [
  {
    id: 'cat_agricultural_parts',
    name: 'Запчастини до сільгосптехніки',
    slug: 'agricultural-parts',
    description: 'Підбір запчастин для тракторів, комбайнів, посівної, ґрунтообробної та навісної техніки.',
    requestHint: 'Вкажіть модель техніки, вузол, фото шильдика або список потрібних позицій.',
    subcategories: ['двигун', 'трансмісія', 'гідравліка', 'фільтри', 'ремені', 'підшипники', 'електрика', 'ходова частина', 'навісне обладнання'],
    manufacturers: ['John Deere', 'Case IH', 'Claas', 'New Holland', 'Fendt', 'Massey Ferguson', 'Deutz-Fahr', 'Amazone', 'Horsch', 'Lemken']
  },
  {
    id: 'cat_truck_parts',
    name: 'Запчастини до вантажних авто',
    slug: 'truck-parts',
    description: 'Напрям для вантажних автомобілів, тягачів і техніки, що працює у регулярних перевезеннях.',
    requestHint: 'Додайте VIN, модель, рік, фото вузла або перелік потрібних позицій.',
    subcategories: ['двигун', 'ходова', 'гальмівна система', 'електрика', 'кузовні елементи', 'фільтри', 'підвіска', 'трансмісія'],
    manufacturers: ['MAN', 'Mercedes-Benz', 'Volvo', 'Scania', 'DAF', 'Renault Trucks', 'Iveco']
  },
  {
    id: 'cat_tires_tubes',
    name: 'Шини та камери',
    slug: 'tires-tubes',
    description: 'Підбір шин, камер, дисків і супутніх позицій для аграрної, вантажної та спеціальної техніки.',
    requestHint: 'Вкажіть розмір, тип техніки, умови експлуатації та терміновість поставки.',
    subcategories: ['агрошини', 'вантажні шини', 'камери', 'обідні стрічки', 'диски'],
    manufacturers: ['BKT', 'Trelleborg', 'Michelin', 'Mitas', 'Continental']
  },
  {
    id: 'cat_trailers_semitrailers',
    name: 'Запчастини до причепів і напівпричепів',
    slug: 'trailers-semitrailers',
    description: 'Позиції для причепів, напівпричепів, зерновозів, платформ і транспортних надбудов.',
    requestHint: 'Опишіть тип причепа, вузол, виробника, вантажність або додайте фото потрібної деталі.',
    subcategories: ['осі', 'підвіска', 'гальмівні системи', 'електрика', 'кузовна фурнітура', 'зчіпні пристрої'],
    manufacturers: ['Schmitz', 'Krone', 'Kögel', 'Wielton', 'Schwarzmüller']
  },
  {
    id: 'cat_commercial_transport',
    name: 'Комерційний транспорт',
    slug: 'commercial-transport',
    description: 'Запчастини для фургонів, малотоннажного транспорту й комерційних авто у бізнес-парку.',
    requestHint: 'Найкраще додати VIN або дані авто, щоб менеджер перевірив сумісність.',
    subcategories: ['двигун', 'підвіска', 'електрика', 'кузовні деталі', 'фільтри', 'витратні матеріали'],
    manufacturers: ['Mercedes-Benz', 'Volkswagen', 'Ford', 'Renault', 'Iveco', 'Fiat']
  },
  {
    id: 'cat_universal_parts',
    name: 'Універсальні запчастини',
    slug: 'universal-parts',
    description: 'Підбір універсальних технічних позицій, які часто потрібні для різних типів техніки.',
    requestHint: 'Додайте розміри, маркування, фото або старий артикул, якщо він є.',
    subcategories: ['підшипники', 'ремені', 'ущільнення', 'кріплення', 'мастильні матеріали', 'гідравлічні елементи'],
    manufacturers: ['SKF', 'Gates', 'Bosch', 'Parker', 'Donaldson']
  },
  {
    id: 'cat_consumables',
    name: 'Витратні матеріали',
    slug: 'consumables',
    description: 'Фільтри, масла, рідини, лампи та інші регулярні позиції для обслуговування техніки.',
    requestHint: 'Вкажіть техніку, регламент ТО, бренд або бажаний аналог.',
    subcategories: ['фільтри', 'масла', 'мастила', 'технічні рідини', 'ремені', 'лампи', 'дрібні комплектуючі'],
    manufacturers: ['Fleetguard', 'Donaldson', 'Mann-Filter', 'Bosch', 'Gates']
  }
] as const satisfies CatalogCategory[];

export function getCategoryBySlug(slug: string) {
  return catalogCategories.find((category) => category.slug === slug);
}

export function getAllManufacturers() {
  const manufacturers = catalogCategories.flatMap((category) =>
    category.manufacturers.map((manufacturer) => ({
      name: manufacturer,
      categoryName: category.name,
      categorySlug: category.slug
    }))
  );

  return manufacturers.sort((left, right) => left.name.localeCompare(right.name, 'uk'));
}
