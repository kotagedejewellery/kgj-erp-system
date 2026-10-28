INSERT INTO public.roles (name, role_group, description, allowed_stages, permissions)
VALUES (
  'after_sales',
  'operational',
  'After Sales dan Warranty Administrator',
  '[]'::jsonb,
  '{"can_read": true, "can_insert": true, "can_update": true, "can_delete": false, "warranty_administrator": true, "warranty.activation.validate": true, "warranty.activation.activate": true, "warranty.contract.read": true, "warranty.claim.read": true}'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET role_group = EXCLUDED.role_group,
    description = EXCLUDED.description,
    permissions = public.roles.permissions || EXCLUDED.permissions;
