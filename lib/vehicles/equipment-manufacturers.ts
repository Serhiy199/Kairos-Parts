const JAPANESE_TRACTOR_MANUFACTURERS = ['Hinomoto', 'Iseki', 'Kubota', 'Mitsubishi', 'Yanmar'];

const TRACTOR_MANUFACTURERS = [
  'Case IH',
  'Claas',
  'Deutz-Fahr',
  'Fendt',
  'John Deere',
  'Kubota',
  'Massey Ferguson',
  'New Holland',
  'Valtra',
  'YTO',
  'Беларус',
  'МТЗ',
  'ХТЗ',
  'ЮМЗ'
];

const COMBINE_MANUFACTURERS = [
  'Case IH',
  'Claas',
  'Deutz-Fahr',
  'Fendt',
  'John Deere',
  'Laverda',
  'Massey Ferguson',
  'New Holland',
  'Sampo Rosenlew',
  'Valtra',
  'Акрос',
  'Дон',
  'Енисей',
  'Нива',
  'Палессе',
  'Ростсельмаш',
  'Славутич'
];

export const GENERAL_EQUIPMENT_MANUFACTURERS = [
  'Case IH',
  'Claas',
  'Deutz-Fahr',
  'Fendt',
  'Horsch',
  'John Deere',
  'JCB',
  'Kuhn',
  'Kubota',
  'Lemken',
  'Massey Ferguson',
  'New Holland',
  'Pottinger',
  'Väderstad',
  'Valtra',
  'Amazone',
  'Great Plains',
  'Kinze',
  'Kverneland',
  'Manitou',
  'Merlo',
  'МТЗ',
  'ХТЗ',
  'ЮМЗ',
  'Ростсельмаш'
];

export const EQUIPMENT_MANUFACTURERS_BY_TYPE: Record<string, string[]> = {
  Комбайн: COMBINE_MANUFACTURERS,
  Трактори: TRACTOR_MANUFACTURERS,
  'Трактори 4x4': TRACTOR_MANUFACTURERS,
  'Саморобні трактори': TRACTOR_MANUFACTURERS,
  'Міні-трактори': TRACTOR_MANUFACTURERS,
  'Мінітрактори 4x4': TRACTOR_MANUFACTURERS,
  'Саморобні міні-трактори': TRACTOR_MANUFACTURERS,
  'Японські трактори': JAPANESE_TRACTOR_MANUFACTURERS,
  'Японські міні-трактори': JAPANESE_TRACTOR_MANUFACTURERS,
  'Китайські трактори': ['Dongfeng', 'Foton', 'Jinma', 'Lovol', 'Shifeng', 'Xingtai', 'YTO'],
  'Китайські міні-трактори': ['Dongfeng', 'Foton', 'Jinma', 'Lovol', 'Shifeng', 'Xingtai', 'YTO'],
  Мотоблоки: ['Aurora', 'Centaur', 'Forte', 'Kentavr', 'Kipor', 'Neva', 'Zirka'],
  Мототрактори: ['Булат', 'ДТЗ', 'Кентавр', 'Скаут', 'Файтер'],
  Сівалки: ['Amazone', 'Great Plains', 'Horsch', 'John Deere', 'Kinze', 'Kuhn', 'Väderstad'],
  Культиватори: ['Amazone', 'Case IH', 'Horsch', 'John Deere', 'Kuhn', 'Lemken'],
  Борони: ['Amazone', 'Bomet', 'Horsch', 'Kuhn', 'Lemken', 'Väderstad'],
  Плуги: ['Kuhn', 'Kverneland', 'Lemken', 'Overum', 'Unia'],
  Оприскувачі: ['Amazone', 'Berthoud', 'Hardi', 'John Deere', 'Kuhn', 'Tecnoma'],
  Косарки: ['Claas', 'Krone', 'Kuhn', 'Pöttinger', 'Sipma'],
  Причепи: ['Fliegl', 'Joskin', 'Pronar', 'Schmitz Cargobull', 'Wielton'],
  Навантажувачі: ['Bobcat', 'Caterpillar', 'JCB', 'Manitou', 'Merlo', 'New Holland']
};

export function getManufacturersForEquipmentType(equipmentType?: string | null) {
  const type = equipmentType?.trim();

  if (!type) {
    return GENERAL_EQUIPMENT_MANUFACTURERS;
  }

  return EQUIPMENT_MANUFACTURERS_BY_TYPE[type] ?? GENERAL_EQUIPMENT_MANUFACTURERS;
}
