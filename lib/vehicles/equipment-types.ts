export type EquipmentTypeGroup = {
  label: string;
  options: string[];
};

export const EQUIPMENT_TYPE_GROUPS: EquipmentTypeGroup[] = [
  {
    label: 'Основні типи агротехніки',
    options: [
      'Комбайн',
      'Трактори',
      'Японські трактори',
      'Китайські трактори',
      'Трактори 4x4',
      'Саморобні трактори',
      'Міні-трактори',
      'Японські міні-трактори',
      'Китайські міні-трактори',
      'Мінітрактори 4x4',
      'Саморобні міні-трактори',
      'Мотоблоки',
      'Мототрактори',
      'Сівалки',
      'Культиватори',
      'Борони',
      'Плуги',
      'Оприскувачі',
      'Косарки',
      'Причепи',
      'Ґрунтофрези',
      'Глибокорозпушувачі',
      'Навантажувачі',
      'Саджалки',
      'Копачі',
      'Мульчувачі',
      'Посівні комплекси',
      'Агродрони',
      'Кормозмішувачі',
      'Зерносушарки'
    ]
  },
  {
    label: 'Причепне обладнання',
    options: [
      'Причепне для трактора',
      'Причепне для міні-трактора',
      'Причепне для мототрактора',
      'Причепне для мотоблока'
    ]
  },
  {
    label: 'Навісне обладнання',
    options: [
      'Навісне для трактора',
      'Навісне для міні-трактора',
      'Навісне для мототрактора',
      'Навісне для мотоблока'
    ]
  },
  {
    label: 'Інше',
    options: ['Інша техніка']
  }
];

export const EQUIPMENT_TYPE_OPTIONS = Array.from(
  new Set(EQUIPMENT_TYPE_GROUPS.flatMap((group) => group.options))
).sort((left, right) => left.localeCompare(right, 'uk'));

export function getEquipmentTypeLabel(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return 'Тип техніки уточнюється';
  }

  return EQUIPMENT_TYPE_OPTIONS.includes(normalizedValue) ? normalizedValue : normalizedValue;
}
