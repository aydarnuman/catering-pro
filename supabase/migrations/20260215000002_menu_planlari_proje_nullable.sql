-- Hızlı günlük menü planları proje bağımsız olabilir
ALTER TABLE menu_planlari ALTER COLUMN proje_id DROP NOT NULL;
