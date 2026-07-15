const JAPANESE_TRACTOR_MANUFACTURERS = ['Hinomoto', 'Iseki', 'Kubota', 'Mitsubishi', 'Yanmar'];

const CHINESE_TRACTOR_MANUFACTURERS = ['Dongfeng', 'Foton', 'Jinma', 'Lovol', 'Shifeng', 'Xingtai', 'YTO'];

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

const MOTOBLOCK_MANUFACTURERS = ['Aurora', 'Centaur', 'Forte', 'Kentavr', 'Kipor', 'Neva', 'Zirka'];

const MOTOTRACTOR_MANUFACTURERS = ['Булат', 'ДТЗ', 'Кентавр', 'Скаут', 'Файтер'];

const SEEDER_MANUFACTURERS = ['Amazone', 'Great Plains', 'Horsch', 'John Deere', 'Kinze', 'Kuhn', 'Väderstad'];

const TILLAGE_MANUFACTURERS = ['Amazone', 'Bomet', 'Horsch', 'Kuhn', 'Kverneland', 'Lemken', 'Unia', 'Väderstad'];

const SPRAYER_MANUFACTURERS = ['Amazone', 'Berthoud', 'Hardi', 'John Deere', 'Kuhn', 'Tecnoma'];

const MOWER_MANUFACTURERS = ['Claas', 'Krone', 'Kuhn', 'Pöttinger', 'Sipma'];

const TRAILER_MANUFACTURERS = ['Fliegl', 'Joskin', 'Krone', 'Pronar', 'Schmitz Cargobull', 'Wielton'];

const LOADER_MANUFACTURERS = ['Bobcat', 'Caterpillar', 'JCB', 'Manitou', 'Merlo', 'New Holland'];

const AGRI_DRONE_MANUFACTURERS = ['DJI', 'XAG', 'Agras', 'Hylio'];

const GRAIN_DRYER_MANUFACTURERS = ['AGI', 'Bühler', 'Cimbria', 'Mecmar', 'Riela', 'Sukup'];

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
  'Китайські трактори': CHINESE_TRACTOR_MANUFACTURERS,
  'Китайські міні-трактори': CHINESE_TRACTOR_MANUFACTURERS,
  Мотоблоки: MOTOBLOCK_MANUFACTURERS,
  Мототрактори: MOTOTRACTOR_MANUFACTURERS,
  Сівалки: SEEDER_MANUFACTURERS,
  Культиватори: TILLAGE_MANUFACTURERS,
  Борони: TILLAGE_MANUFACTURERS,
  Плуги: TILLAGE_MANUFACTURERS,
  Оприскувачі: SPRAYER_MANUFACTURERS,
  Косарки: MOWER_MANUFACTURERS,
  Причепи: TRAILER_MANUFACTURERS,
  'Причепне для трактора': [...TRAILER_MANUFACTURERS, ...TILLAGE_MANUFACTURERS],
  'Причепне для міні-трактора': [...TRAILER_MANUFACTURERS, ...TILLAGE_MANUFACTURERS],
  'Причепне для мототрактора': [...TRAILER_MANUFACTURERS, ...TILLAGE_MANUFACTURERS],
  'Причепне для мотоблока': [...TRAILER_MANUFACTURERS, ...MOTOBLOCK_MANUFACTURERS],
  'Навісне для трактора': [...TILLAGE_MANUFACTURERS, ...SEEDER_MANUFACTURERS],
  'Навісне для міні-трактора': [...TILLAGE_MANUFACTURERS, ...TRACTOR_MANUFACTURERS],
  'Навісне для мототрактора': [...TILLAGE_MANUFACTURERS, ...MOTOTRACTOR_MANUFACTURERS],
  'Навісне для мотоблока': [...TILLAGE_MANUFACTURERS, ...MOTOBLOCK_MANUFACTURERS],
  'Ґрунтофрези': TILLAGE_MANUFACTURERS,
  Глибокорозпушувачі: TILLAGE_MANUFACTURERS,
  Навантажувачі: LOADER_MANUFACTURERS,
  Саджалки: ['Bomet', 'Grimme', 'Kverneland', 'Unia'],
  Копачі: ['Bomet', 'Grimme', 'Unia', 'Wirax'],
  Мульчувачі: ['Kuhn', 'Maschio Gaspardo', 'Seppi', 'Spearhead'],
  'Посівні комплекси': SEEDER_MANUFACTURERS,
  Агродрони: AGRI_DRONE_MANUFACTURERS,
  Кормозмішувачі: ['BvL', 'Kuhn', 'Lucas G', 'Siloking', 'Strautmann'],
  Зерносушарки: GRAIN_DRYER_MANUFACTURERS
};

export function getManufacturersForEquipmentType(equipmentType?: string | null) {
  const type = equipmentType?.trim();

  if (!type) {
    return GENERAL_EQUIPMENT_MANUFACTURERS;
  }

  return EQUIPMENT_MANUFACTURERS_BY_TYPE[type] ?? GENERAL_EQUIPMENT_MANUFACTURERS;
}

export function getSpecificManufacturersForEquipmentType(equipmentType?: string | null) {
  const type = equipmentType?.trim();

  if (!type) {
    return [];
  }

  return EQUIPMENT_MANUFACTURERS_BY_TYPE[type] ?? [];
}
