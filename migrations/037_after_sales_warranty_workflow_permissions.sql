UPDATE public.roles
SET permissions = permissions || '{"warranty.claim.cancel": true, "warranty.exception.request": true}'::jsonb
WHERE name = 'after_sales';
