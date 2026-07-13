export type EquipmentTypeGroup = {
  label: string;
  options: string[];
};

export const EQUIPMENT_TYPE_GROUPS: EquipmentTypeGroup[] = [
  {
    label: 'Аграрна техніка',
    options: [
      'Трактор',
      'Комбайн',
      'Жниварка',
      'Сівалка',
      'Культиватор',
      'Плуг',
      'Борона',
      'Обприскувач',
      'Розкидач добрив',
      'Прес-підбирач',
      'Косарка',
      'Навантажувач',
      'Причіп',
      'Напівпричіп',
      'Інша сільгосптехніка'
    ]
  },
  {
    label: 'Вантажна та спеціальна техніка',
    options: [
      'Вантажний автомобіль',
      'Тягач',
      'Самоскид',
      'Фургон',
      'Автобус',
      'Мікроавтобус',
      'Причіп',
      'Напівпричіп',
      'Спецтехніка',
      'Навантажувач',
      'Екскаватор',
      'Бульдозер',
      'Кран',
      'Інша техніка'
    ]
  }
];

export const EQUIPMENT_TYPE_OPTIONS = Array.from(
  new Set(EQUIPMENT_TYPE_GROUPS.flatMap((group) => group.options))
).sort((left, right) => left.localeCompare(right, 'uk'));
