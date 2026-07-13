-- Add optional production year captured from the public/client request form.
ALTER TABLE "Request" ADD COLUMN "vehicleYear" INTEGER;
