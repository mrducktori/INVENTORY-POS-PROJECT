-- ===========================================================================
-- MIGRATION & SEED: Assign Categories to Raw Materials
-- Historical reference of raw material categorization.
-- ===========================================================================

UPDATE public.ingredients SET category = 'PACKAGING & SUPPLIES' WHERE name IN (
  '16OZ PET CUPS', '22OZ PET CUPS', '8OZ PAPER CUPS', 'BOBA STRAWS', 'DOME LIDS', 'FLAT LIDS'
);

UPDATE public.ingredients SET category = 'COFFEE & TEA BASES' WHERE name IN (
  'ASSAM BLACK TEA LEAVES', 'COLD BREW GROUNDS', 'ESPRESSO BLEND BEANS', 'JASMINE GREEN TEA LEAVES', 'SINGLE ORIGIN BEANS'
);

UPDATE public.ingredients SET category = 'DAIRY & CREAMERS' WHERE name IN (
  'EVAPORATED MILK', 'FRESH MILK (FULL CREAM)', 'OAT MILK (BARISTA EDITION)'
);

UPDATE public.ingredients SET category = 'SINKERS & TOPPINGS' WHERE name IN (
  'BLUEBERRY', 'FRUIT POPPING BOBA', 'TAPIOCA PEARLS (BOBA)'
);

UPDATE public.ingredients SET category = 'SWEETENERS & SYRUPS' WHERE name IN (
  'CARAMEL DRIZZLE', 'DARK CHOCOLATE SAUCE'
);

UPDATE public.ingredients SET category = 'FLAVORING POWDERS' WHERE name IN (
  'TARO POWDER'
);

UPDATE public.ingredients SET category = 'BEVERAGE ENHANCERS' WHERE name IN (
  'FRAPPE BASE', 'SODA BASE (SPRITE)'
);
