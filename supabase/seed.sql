-- ===========================================================================
-- CHooseMyLaptop — Seed laptop catalog (SAMPLE / ESTIMATED DATA)
-- Run AFTER schema.sql and rls.sql.
--
-- IMPORTANT: These are illustrative sample listings for the MVP. Prices,
-- availability, and stores are approximate and NOT live data. The UI labels
-- recommendations built on this data as "estimated". Replace with real,
-- verified listings (or scraped/imported rows) before relying on them.
--
-- Prices are in KWD, sized around the 250 KWD teacher persona.
-- specs_json matches the LaptopSpecs TypeScript shape in lib/types.ts.
-- ===========================================================================

insert into public.laptop_listings
  (store_name, product_title, brand, model, price, currency, availability, url, specs_json, rating, review_count, source_type, last_checked_at)
values
-- 1) Budget all-rounder ------------------------------------------------------
('Xcite', 'Lenovo IdeaPad Slim 3 15', 'Lenovo', 'IdeaPad Slim 3', 165, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-12450H","cpu_tier":7,"ram_gb":8,"storage_gb":512,"storage_type":"SSD","gpu":"Intel UHD Graphics","gpu_tier":1,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":6,"weight_kg":1.6,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":7,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 4.3, 210, 'seed', now()),

-- 2) Office / teaching sweet spot -------------------------------------------
('Best Al-Yousifi', 'HP Pavilion 15', 'HP', 'Pavilion 15-eg', 210, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-1335U","cpu_tier":7,"ram_gb":16,"storage_gb":512,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":7,"weight_kg":1.75,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":7,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 4.4, 188, 'seed', now()),

-- 3) Cheap thin all-rounder --------------------------------------------------
('Eureka', 'ASUS Vivobook 15', 'ASUS', 'Vivobook X1502', 155, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-1235U","cpu_tier":6,"ram_gb":8,"storage_gb":512,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":6,"weight_kg":1.7,"os":"Windows 11","release_year":2022,"arabic_keyboard":true,"upgradeable_ram":false,"upgradeable_storage":true,"build_quality":6,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 4.1, 142, 'seed', now()),

-- 4) Dell budget -------------------------------------------------------------
('Xcite', 'Dell Inspiron 15 3520', 'Dell', 'Inspiron 3520', 175, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-1235U","cpu_tier":6,"ram_gb":8,"storage_gb":512,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":6,"weight_kg":1.9,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":7,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 4.2, 167, 'seed', now()),

-- 5) Durable business 14" (great for teaching) ------------------------------
('Best Al-Yousifi', 'Lenovo ThinkPad E14 Gen 5', 'Lenovo', 'ThinkPad E14', 245, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-1335U","cpu_tier":7,"ram_gb":16,"storage_gb":512,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":14,"display_resolution":"1920x1200","display_panel":"IPS","battery_hours":9,"weight_kg":1.4,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":9,"ports":["HDMI","USB-A","USB-C","Thunderbolt"]}'::jsonb,
 4.6, 96, 'seed', now()),

-- 6) Very cheap basic --------------------------------------------------------
('Eureka', 'HP 250 G9', 'HP', '250 G9', 120, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i3-1215U","cpu_tier":4,"ram_gb":8,"storage_gb":256,"storage_type":"SSD","gpu":"Intel UHD Graphics","gpu_tier":1,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"TN","battery_hours":6,"weight_kg":1.7,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":6,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 3.9, 120, 'seed', now()),

-- 7) AMD value champ ---------------------------------------------------------
('Xcite', 'Acer Aspire 5', 'Acer', 'Aspire A515', 185, 'KWD', 'in_stock', null,
 '{"cpu":"AMD Ryzen 5 7530U","cpu_tier":7,"ram_gb":16,"storage_gb":512,"storage_type":"SSD","gpu":"AMD Radeon Graphics","gpu_tier":2,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":8,"weight_kg":1.7,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":6,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 4.3, 205, 'seed', now()),

-- 8) Bigger screen, more CPU -------------------------------------------------
('Best Al-Yousifi', 'ASUS Vivobook 16', 'ASUS', 'Vivobook X1605', 265, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i7-1355U","cpu_tier":7,"ram_gb":16,"storage_gb":512,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":16,"display_resolution":"1920x1200","display_panel":"IPS","battery_hours":7,"weight_kg":1.8,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":false,"upgradeable_storage":true,"build_quality":6,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 4.2, 88, 'seed', now()),

-- 9) MacBook Air M1 (great battery/build, slightly older) --------------------
('Xcite', 'Apple MacBook Air M1', 'Apple', 'MacBook Air M1', 270, 'KWD', 'in_stock', null,
 '{"cpu":"Apple M1","cpu_tier":7,"ram_gb":8,"storage_gb":256,"storage_type":"SSD","gpu":"Apple M1 GPU","gpu_tier":3,"display_inch":13.3,"display_resolution":"2560x1600","display_panel":"IPS","battery_hours":15,"weight_kg":1.29,"os":"macOS","release_year":2020,"arabic_keyboard":true,"upgradeable_ram":false,"upgradeable_storage":false,"build_quality":9,"ports":["USB-C","Thunderbolt"]}'::jsonb,
 4.8, 540, 'seed', now()),

-- 10) MacBook Air M2 (above budget — tests budget filtering) -----------------
('Best Al-Yousifi', 'Apple MacBook Air M2 13"', 'Apple', 'MacBook Air M2', 330, 'KWD', 'in_stock', null,
 '{"cpu":"Apple M2","cpu_tier":8,"ram_gb":8,"storage_gb":256,"storage_type":"SSD","gpu":"Apple M2 GPU","gpu_tier":4,"display_inch":13.6,"display_resolution":"2560x1664","display_panel":"IPS","battery_hours":16,"weight_kg":1.24,"os":"macOS","release_year":2022,"arabic_keyboard":true,"upgradeable_ram":false,"upgradeable_storage":false,"build_quality":9,"ports":["USB-C","Thunderbolt"]}'::jsonb,
 4.8, 320, 'seed', now()),

-- 11) Entry gaming -----------------------------------------------------------
('Xcite', 'Lenovo LOQ 15', 'Lenovo', 'LOQ 15IRH', 290, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-12450H","cpu_tier":7,"ram_gb":16,"storage_gb":512,"storage_type":"SSD","gpu":"NVIDIA RTX 2050","gpu_tier":4,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":4,"weight_kg":2.4,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":7,"ports":["HDMI","USB-A","USB-C","RJ45"]}'::jsonb,
 4.4, 130, 'seed', now()),

-- 12) Mid gaming (above budget) ---------------------------------------------
('Best Al-Yousifi', 'Acer Nitro 5', 'Acer', 'Nitro AN515', 330, 'KWD', 'preorder', null,
 '{"cpu":"AMD Ryzen 5 7535HS","cpu_tier":7,"ram_gb":8,"storage_gb":512,"storage_type":"SSD","gpu":"NVIDIA RTX 3050","gpu_tier":5,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":4,"weight_kg":2.5,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":6,"ports":["HDMI","USB-A","USB-C","RJ45"]}'::jsonb,
 4.3, 175, 'seed', now()),

-- 13) Gaming/creator ---------------------------------------------------------
('Xcite', 'HP Victus 15', 'HP', 'Victus 15-fa', 300, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-12450H","cpu_tier":7,"ram_gb":16,"storage_gb":512,"storage_type":"SSD","gpu":"NVIDIA RTX 2050","gpu_tier":4,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":5,"weight_kg":2.3,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":7,"ports":["HDMI","USB-A","USB-C","RJ45"]}'::jsonb,
 4.2, 154, 'seed', now()),

-- 14) Business ultrabook (used) ---------------------------------------------
('Marina Computer', 'Dell Latitude 5430 (Used)', 'Dell', 'Latitude 5430', 190, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-1245U","cpu_tier":6,"ram_gb":16,"storage_gb":256,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":14,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":10,"weight_kg":1.4,"os":"Windows 11","release_year":2022,"arabic_keyboard":false,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":8,"ports":["HDMI","USB-A","USB-C","Thunderbolt"]}'::jsonb,
 4.1, 64, 'seed', now()),

-- 15) Very cheap older -------------------------------------------------------
('Eureka', 'Lenovo V15 G3', 'Lenovo', 'V15 G3', 110, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i3-1215U","cpu_tier":4,"ram_gb":8,"storage_gb":256,"storage_type":"SSD","gpu":"Intel UHD Graphics","gpu_tier":1,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"TN","battery_hours":6,"weight_kg":1.7,"os":"Windows 11","release_year":2022,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":6,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 3.8, 90, 'seed', now()),

-- 16) Premium OLED ultrabook (above budget) ---------------------------------
('Best Al-Yousifi', 'ASUS Zenbook 14 OLED', 'ASUS', 'Zenbook UX3402', 320, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-1340P","cpu_tier":7,"ram_gb":16,"storage_gb":512,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":14,"display_resolution":"2880x1800","display_panel":"OLED","battery_hours":12,"weight_kg":1.3,"os":"Windows 11","release_year":2023,"arabic_keyboard":true,"upgradeable_ram":false,"upgradeable_storage":true,"build_quality":8,"ports":["HDMI","USB-A","USB-C","Thunderbolt"]}'::jsonb,
 4.6, 140, 'seed', now()),

-- 17) Weak / avoid candidate -------------------------------------------------
('Eureka', 'HP 14 (Celeron)', 'HP', '14-dq', 95, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Celeron N4500","cpu_tier":2,"ram_gb":4,"storage_gb":64,"storage_type":"HDD","gpu":"Intel UHD Graphics","gpu_tier":1,"display_inch":14,"display_resolution":"1366x768","display_panel":"TN","battery_hours":8,"weight_kg":1.5,"os":"Windows 11","release_year":2021,"arabic_keyboard":true,"upgradeable_ram":false,"upgradeable_storage":false,"build_quality":4,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 3.2, 58, 'seed', now()),

-- 18) Older gaming -----------------------------------------------------------
('Marina Computer', 'Lenovo IdeaPad Gaming 3 (2021)', 'Lenovo', 'IdeaPad Gaming 3', 230, 'KWD', 'in_stock', null,
 '{"cpu":"AMD Ryzen 5 5600H","cpu_tier":7,"ram_gb":8,"storage_gb":512,"storage_type":"SSD","gpu":"NVIDIA GTX 1650","gpu_tier":4,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":4,"weight_kg":2.3,"os":"Windows 11","release_year":2021,"arabic_keyboard":true,"upgradeable_ram":true,"upgradeable_storage":true,"build_quality":6,"ports":["HDMI","USB-A","USB-C","RJ45"]}'::jsonb,
 4.0, 110, 'seed', now()),

-- 19) Ultra-light, small storage --------------------------------------------
('Xcite', 'Microsoft Surface Laptop Go 2', 'Microsoft', 'Surface Laptop Go 2', 240, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-1135G7","cpu_tier":6,"ram_gb":8,"storage_gb":128,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":12.4,"display_resolution":"1536x1024","display_panel":"IPS","battery_hours":13,"weight_kg":1.1,"os":"Windows 11","release_year":2022,"arabic_keyboard":false,"upgradeable_ram":false,"upgradeable_storage":false,"build_quality":8,"ports":["USB-A","USB-C"]}'::jsonb,
 4.1, 76, 'seed', now()),

-- 20) Slim mainstream --------------------------------------------------------
('Eureka', 'Huawei MateBook D15', 'Huawei', 'MateBook D15', 170, 'KWD', 'in_stock', null,
 '{"cpu":"Intel Core i5-1155G7","cpu_tier":6,"ram_gb":8,"storage_gb":512,"storage_type":"SSD","gpu":"Intel Iris Xe","gpu_tier":2,"display_inch":15.6,"display_resolution":"1920x1080","display_panel":"IPS","battery_hours":7,"weight_kg":1.56,"os":"Windows 11","release_year":2022,"arabic_keyboard":true,"upgradeable_ram":false,"upgradeable_storage":true,"build_quality":7,"ports":["HDMI","USB-A","USB-C"]}'::jsonb,
 4.2, 132, 'seed', now());
