UPDATE public.roles
SET permissions = permissions || '{"warranty.contract.read": true, "warranty.claim.read": true}'::jsonb
WHERE name = 'operational_supervisor';
