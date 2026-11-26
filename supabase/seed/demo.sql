-- Fictional demo catalog only. Do not treat sample availability, addresses, or offers as real.
insert into public.areas(id,name_ar,name_en) values
 ('nasr-city','مدينة نصر','Nasr City'),('new-cairo','التجمع','New Cairo'),
 ('heliopolis','مصر الجديدة','Heliopolis'),('maadi','المعادي','Maadi'),
 ('mohandessin','المهندسين','Mohandessin'),('zamalek','الزمالك','Zamalek'),
 ('downtown','وسط البلد','Downtown'),('6-october','6 أكتوبر','6th of October'),('giza','الهرم','Haram')
on conflict(id) do update set name_ar=excluded.name_ar,name_en=excluded.name_en;

insert into public.stores(id,slug,name_ar,name_en,description_ar,description_en,area_id,address_ar,address_en,status) values
 ('00000000-0000-0000-0000-000000000101','style-house','ستايل هاوس','Style House','اختيارات عصرية للملابس اليومية.','Contemporary picks for everyday dressing.','nasr-city','شارع عباس العقاد، مدينة نصر','Abbas El Akkad St, Nasr City','active'),
 ('00000000-0000-0000-0000-000000000102','urban-cairo','أوربان كايرو','Urban Cairo','أساسيات وقطع كاجوال للرجال.','Men’s essentials and casual pieces.','maadi','شارع 9، المعادي','Road 9, Maadi','active'),
 ('00000000-0000-0000-0000-000000000103','closet-9','كلوزيت 9','Closet 9','أزياء نسائية بتصميمات عصرية.','Modern designs for women.','new-cairo','كايرو فيستيفال سيتي، التجمع','Cairo Festival City, New Cairo','active')
on conflict(id) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,area_id=excluded.area_id,status=excluded.status;

insert into public.products(id,store_id,name_ar,name_en,description_ar,description_en,category,price_egp,sizes,colors,images,available,active) values
 ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','جاكيت جينز كلاسيك','Classic denim jacket','قطعة يومية سهلة التنسيق.','An easy everyday layer.','women',1250,array['S','M','L','XL'],array['denim'],array['photo-1543076447-215ad9ba6923'],true,true),
 ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000101','بلوزة ساتان','Satin blouse','قصة أنيقة للمساء والنهار.','A polished day-to-evening piece.','women',980,array['S','M','L'],array['cream'],array['photo-1551163943-3f6a855d1153'],true,true),
 ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000102','قميص كتان صيفي','Summer linen shirt','قميص مريح بقماش كتان.','A relaxed linen shirt.','men',890,array['M','L','XL'],array['white'],array['photo-1598033129183-c4f50c736f10'],true,true),
 ('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000102','تيشيرت يومي','Everyday tee','أساس عملي للملابس اليومية.','A versatile everyday essential.','men',540,array['S','M','L','XL'],array['navy'],array['photo-1521572163474-6864f9cf17ab'],true,true),
 ('00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000103','فستان يومي أنيق','Elegant day dress','تصميم عصري مناسب لليوم.','A modern, easy day dress.','women',1450,array['S','M','L'],array['burgundy'],array['photo-1595777457583-95e059d581b8'],true,true),
 ('00000000-0000-0000-0000-000000000206','00000000-0000-0000-0000-000000000103','طقم خروج أطفال','Kids outing set','طقم مريح للأطفال.','A comfortable kids set.','kids',890,array['2Y','4Y','6Y'],array['sand'],array['photo-1519238263530-99bdd11df2ea'],true,true)
on conflict(id) do update set price_egp=excluded.price_egp,available=excluded.available,active=excluded.active;

insert into public.coupons(id,store_id,product_id,title_ar,title_en,description_ar,description_en,code,discount_percent,active) values
 ('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201','عرض تجريبي من المحل','Sample in-store offer','أبرز هذا الكود للمحل عند الزيارة.','Show this code in store during your visit.','CAIRO10',10,true),
 ('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000103',null,'ميزة ترحيبية','Welcome offer','عرض توضيحي — تحقق من الشروط لدى المحل.','Demo offer — confirm terms with the store.','VISIT5',5,true)
on conflict(id) do update set title_ar=excluded.title_ar,title_en=excluded.title_en,active=excluded.active;
