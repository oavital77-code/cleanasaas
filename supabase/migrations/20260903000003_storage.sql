-- Cleana SaaS — Storage: תמונות חדרים, מבודד לפי קליניקה (spec §10)
--
-- מוסכמת נתיב: rooms/{clinic_id}/{room_id}/{filename}. storage.foldername(name)
-- מחזירה מערך המקטעים של הנתיב — המקטע הראשון הוא clinic_id. בניגוד למקור
-- (bucket ציבורי לחלוטין לקריאה — לא רגיש, אבל בעולם רב-דיירי "לא רגיש" כבר
-- לא נכון: תמונות החדרים של קליניקה א' לא אמורות להיות דפדפות ע"י קליניקה ב',
-- ר' spec §10), כאן קריאה דורשת גם היא חברות בקליניקה התואמת.

insert into storage.buckets (id, name, public)
values ('room-images', 'room-images', false)
on conflict (id) do nothing;

create policy "room_images_clinic_read"
  on storage.objects for select
  using (
    bucket_id = 'room-images'
    and (storage.foldername(name))[1] = current_clinic_id()::text
  );

create policy "room_images_admin_write"
  on storage.objects for insert
  with check (
    bucket_id = 'room-images'
    and is_admin()
    and (storage.foldername(name))[1] = current_clinic_id()::text
  );

create policy "room_images_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'room-images'
    and is_admin()
    and (storage.foldername(name))[1] = current_clinic_id()::text
  );

create policy "room_images_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'room-images'
    and is_admin()
    and (storage.foldername(name))[1] = current_clinic_id()::text
  );
