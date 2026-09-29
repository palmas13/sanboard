ALTER TABLE public.vehicle_details
  DROP CONSTRAINT IF EXISTS vehicle_details_transmission_upgrade_check,
  DROP CONSTRAINT IF EXISTS vehicle_details_brake_upgrade_check,
  DROP CONSTRAINT IF EXISTS vehicle_details_lock_level_check,
  DROP CONSTRAINT IF EXISTS vehicle_details_alarm_level_check,
  DROP CONSTRAINT IF EXISTS vehicle_details_anti_theft_level_check;

UPDATE public.vehicle_details
SET
  transmission_upgrade = LEAST(transmission_upgrade, 3),
  brake_upgrade = LEAST(brake_upgrade, 3),
  lock_level = LEAST(lock_level, 3),
  alarm_level = LEAST(alarm_level, 4),
  anti_theft_level = LEAST(anti_theft_level, 4);

ALTER TABLE public.vehicle_details
  ADD CONSTRAINT vehicle_details_transmission_upgrade_check CHECK (transmission_upgrade BETWEEN 0 AND 3),
  ADD CONSTRAINT vehicle_details_brake_upgrade_check CHECK (brake_upgrade BETWEEN 0 AND 3),
  ADD CONSTRAINT vehicle_details_lock_level_check CHECK (lock_level BETWEEN 0 AND 3),
  ADD CONSTRAINT vehicle_details_alarm_level_check CHECK (alarm_level BETWEEN 0 AND 4),
  ADD CONSTRAINT vehicle_details_anti_theft_level_check CHECK (anti_theft_level BETWEEN 0 AND 4);