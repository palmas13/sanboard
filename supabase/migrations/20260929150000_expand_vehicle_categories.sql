ALTER TABLE public.vehicle_details
  DROP CONSTRAINT IF EXISTS vehicle_details_vehicle_category_check;

ALTER TABLE public.vehicle_details
  ADD CONSTRAINT vehicle_details_vehicle_category_check
  CHECK (vehicle_category IN ('Otomobil', 'Motosiklet', 'SUV', 'Pickup', 'ATV', 'Ticari'));