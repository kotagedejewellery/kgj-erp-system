UPDATE public.roles
SET permissions = permissions || '{"warranty.claim.create": true, "warranty.claim.submit": true, "warranty.claim.complete_non_workshop": true}'::jsonb
WHERE name = 'after_sales';
