UPDATE public.roles
SET permissions = permissions || '{"warranty.work.update": true}'::jsonb
WHERE name IN (
  'jewelry_expert_finishing',
  'jewelry_expert_lebur_bahan',
  'jewelry_expert_pembentukan_awal',
  'jewelry_expert_poles',
  'laser',
  'qc_1',
  'qc_2',
  'racik',
  'packing'
);
