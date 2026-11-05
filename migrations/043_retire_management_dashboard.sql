-- Retire the obsolete Leader dashboard without deleting user, order, or production data.
-- Files in the task-attachments storage bucket are intentionally untouched.

UPDATE users
SET status = 'inactive', updated_at = now()
WHERE deleted_at IS NULL
  AND role_id IN (
    SELECT id
    FROM roles
    WHERE name LIKE 'leader\_%' ESCAPE '\'
  );

DELETE FROM management_tasks;
