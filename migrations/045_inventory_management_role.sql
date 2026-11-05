-- Dedicated dashboard role for Inventory. This does not restore Leader accounts or task management.

ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_role_group_check;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_role_group_check
  CHECK (role_group IN (
    'management',
    'inventory',
    'operational',
    'production',
    'customer_service',
    'marketing'
  ));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE r.name = 'management'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Active legacy management users exist; review them before enabling the Inventory Management role.';
  END IF;
END;
$$;

INSERT INTO public.roles (name, role_group, description, allowed_stages, permissions)
VALUES (
  'management',
  'inventory',
  'Management Inventory dashboard',
  '[]'::jsonb,
  '{"can_read": true, "can_insert": true, "can_update": true, "can_delete": false, "inventory.read": true, "inventory.write": true, "inventory.adjust.approve": true}'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET role_group = EXCLUDED.role_group,
    description = EXCLUDED.description,
    allowed_stages = EXCLUDED.allowed_stages,
    permissions = EXCLUDED.permissions;
