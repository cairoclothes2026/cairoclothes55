export type Locale = 'ar' | 'en';
export type Area = { id: string; ar: string; en: string };
export type StoreOffer = { titleAr: string; titleEn: string; descriptionAr: string; descriptionEn: string; code: string; discountPercent: number };
export type Store = { id: string; slug: string; ar: string; en: string; areaId: string; addressAr: string; addressEn: string; locationUrl?: string; products: number; image: string; descriptionAr: string; descriptionEn: string; offer?: StoreOffer; whatsapp?: string; phone?: string; latitude?: number; longitude?: number; openingHoursSpecification?: unknown };
export type Product = { updatedAt?: string; piece_type?: string; colors?: string[]; pattern?: string; fabric?: string; id: string; ar: string; en: string; descriptionAr?: string; descriptionEn?: string; category: 'women'|'men'|'kids'; price: number; discountPercent?: number; storeId: string; areaId: string; color: string; image: string; sizes: string[]; available: boolean; offer?: number };
export type CatalogData = { areas: Area[]; stores: Store[]; products: Product[]; source: 'demo' | 'database' };
export const areas: Area[] = [
 {id:'nasr-city',ar:'مدينة نصر',en:'Nasr City'},{id:'new-cairo',ar:'التجمع',en:'New Cairo'},{id:'heliopolis',ar:'مصر الجديدة',en:'Heliopolis'},{id:'maadi',ar:'المعادي',en:'Maadi'},{id:'mohandessin',ar:'المهندسين',en:'Mohandessin'},{id:'zamalek',ar:'الزمالك',en:'Zamalek'},{id:'downtown',ar:'وسط البلد',en:'Downtown'},{id:'6-october',ar:'6 أكتوبر',en:'6th of October'},{id:'giza',ar:'الهرم',en:'Haram'}
];
// Demo names, locations, descriptions, products and prices follow the Cairo Clothes project catalog.
export const stores: Store[] = [
 {id:'store-style-house',slug:'style-house',ar:'ستايل هاوس',en:'Style House',areaId:'nasr-city',addressAr:'شارع عباس العقاد، مدينة نصر',addressEn:'Abbas El Akkad St, Nasr City',products:3,image:'photo-1483985988355-763728e1935b',descriptionAr:'اختيارات عصرية للملابس اليومية.',descriptionEn:'Contemporary picks for everyday dressing.',offer:{titleAr:'عرض من المحل',titleEn:'Store offer',descriptionAr:'أبرز هذا الكود للمحل عند الزيارة.',descriptionEn:'Show this code in store during your visit.',code:'CAIRO10',discountPercent:10}},
 {id:'store-urban-cairo',slug:'urban-cairo',ar:'أوربان كايرو',en:'Urban Cairo',areaId:'maadi',addressAr:'شارع 9، المعادي',addressEn:'Road 9, Maadi',products:2,image:'photo-1529139574466-a303027c1d8b',descriptionAr:'أساسيات وقطع كاجوال للرجال.',descriptionEn:'Men’s essentials and casual pieces.'},
 {id:'store-closet-9',slug:'closet-9',ar:'كلوزيت 9',en:'Closet 9',areaId:'new-cairo',addressAr:'كايرو فيستيفال سيتي، التجمع',addressEn:'Cairo Festival City, New Cairo',products:2,image:'photo-1485230895905-ec40ba36b9bc',descriptionAr:'أزياء نسائية بتصميمات عصرية.',descriptionEn:'Modern designs for women.',offer:{titleAr:'ميزة ترحيبية',titleEn:'Welcome offer',descriptionAr:'تحقق من الشروط لدى المحل.',descriptionEn:'Confirm terms with the store.',code:'VISIT5',discountPercent:5}},
 {id:'store-little-cairo',slug:'little-cairo',ar:'ليتل كايرو',en:'Little Cairo',areaId:'heliopolis',addressAr:'شارع بغداد، مصر الجديدة',addressEn:'Baghdad St, Heliopolis',products:2,image:'photo-1519238263530-99bdd11df2ea',descriptionAr:'ملابس مريحة للأطفال.',descriptionEn:'Comfortable clothing for children.'},
 {id:'store-cairo-edit',slug:'cairo-edit',ar:'كايرو إيديت',en:'Cairo Edit',areaId:'mohandessin',addressAr:'شارع جامعة الدول العربية، المهندسين',addressEn:'League of Arab States St, Mohandessin',products:1,image:'photo-1487222477894-8943e31ef7b2',descriptionAr:'قطع مختارة بإطلالات يومية.',descriptionEn:'Curated pieces for everyday looks.'},
 {id:'store-downtown-wear',slug:'downtown-wear',ar:'داون تاون وير',en:'Downtown Wear',areaId:'downtown',addressAr:'شارع طلعت حرب، وسط البلد',addressEn:'Talaat Harb St, Downtown',products:2,image:'photo-1485230895905-ec40ba36b9bc',descriptionAr:'أزياء عملية من قلب القاهرة.',descriptionEn:'Practical style from the heart of Cairo.'},
 {id:'store-mini-mood',slug:'mini-mood',ar:'ميني مود',en:'Mini Mood',areaId:'zamalek',addressAr:'شارع 26 يوليو، الزمالك',addressEn:'26th of July St, Zamalek',products:1,image:'photo-1519238263530-99bdd11df2ea',descriptionAr:'ملابس أطفال بألوان مرحة.',descriptionEn:'Kidswear in cheerful colours.'},
 {id:'store-the-district',slug:'the-district',ar:'ذا ديستريكت',en:'The District',areaId:'6-october',addressAr:'مول العرب، 6 أكتوبر',addressEn:'Mall of Arabia, 6th of October',products:2,image:'photo-1523398002811-999ca8dec234',descriptionAr:'ملابس رجالية لكل يوم.',descriptionEn:'Men’s clothing for every day.'},
 {id:'store-tiny-steps',slug:'tiny-steps',ar:'تايني ستيبس',en:'Tiny Steps',areaId:'giza',addressAr:'شارع الهرم، الجيزة',addressEn:'El Haram St, Giza',products:2,image:'photo-1519238263530-99bdd11df2ea',descriptionAr:'ملابس أطفال مريحة وعملية.',descriptionEn:'Comfortable, practical kidswear.'},
 {id:'store-maadi-mode',slug:'maadi-mode',ar:'معادي مود',en:'Maadi Mode',areaId:'maadi',addressAr:'زهراء المعادي',addressEn:'Zahraa El Maadi',products:1,image:'photo-1490481651871-ab68de25d43d',descriptionAr:'اختيارات نسائية كاجوال.',descriptionEn:'Casual picks for women.'},
 {id:'store-mohandessin-select',slug:'mohandessin-select',ar:'مهندسين سيليكت',en:'Mohandessin Select',areaId:'mohandessin',addressAr:'شارع شهاب، المهندسين',addressEn:'Shehab St, Mohandessin',products:1,image:'photo-1516257984-b1b4d707412e',descriptionAr:'قطع رجالية مختارة.',descriptionEn:'Carefully selected menswear.'},
 {id:'store-zamalek-wardrobe',slug:'zamalek-wardrobe',ar:'زمالك ووردروب',en:'Zamalek Wardrobe',areaId:'zamalek',addressAr:'شارع أبو الفدا، الزمالك',addressEn:'Abu El Feda St, Zamalek',products:1,image:'photo-1595777457583-95e059d581b8',descriptionAr:'فساتين وقطع أنيقة.',descriptionEn:'Elegant dresses and wardrobe pieces.'}
,
 {id:'store-layali-wardrobe',slug:'layali-wardrobe',ar:'ليالي ووردروب',en:'Layali Wardrobe',areaId:'heliopolis',addressAr:'شارع النزهة، مصر الجديدة',addressEn:'El Nozha St, Heliopolis',products:5,image:'photo-1485230895905-ec40ba36b9bc',descriptionAr:'إطلالات أنيقة للمشاوير والمناسبات.',descriptionEn:'Polished looks for everyday outings and occasions.'},
 {id:'store-cotton-road',slug:'cotton-road',ar:'كوتون رود',en:'Cotton Road',areaId:'maadi',addressAr:'شارع 233، المعادي الجديدة',addressEn:'Street 233, New Maadi',products:5,image:'photo-1529139574466-a303027c1d8b',descriptionAr:'قطع قطنية مريحة للبس اليومي.',descriptionEn:'Comfortable cotton pieces for everyday wear.'},
 {id:'store-urban-thread',slug:'urban-thread',ar:'أوربان ثريد',en:'Urban Thread',areaId:'mohandessin',addressAr:'شارع جامعة الدول العربية، المهندسين',addressEn:'League of Arab States St, Mohandessin',products:5,image:'photo-1487222477894-8943e31ef7b2',descriptionAr:'ملابس عصرية بإطلالات عملية.',descriptionEn:'Modern clothing with practical styling.'},
 {id:'store-bloom-kids',slug:'bloom-kids',ar:'بلوم كيدز',en:'Bloom Kids',areaId:'new-cairo',addressAr:'شارع التسعين، التجمع الخامس',addressEn:'90th Street, Fifth Settlement',products:5,image:'photo-1519238263530-99bdd11df2ea',descriptionAr:'ملابس أطفال مريحة ومرحة.',descriptionEn:'Comfortable, cheerful clothing for kids.'},
 {id:'store-nile-edit',slug:'nile-edit',ar:'نايل إيديت',en:'Nile Edit',areaId:'zamalek',addressAr:'شارع أبو الفدا، الزمالك',addressEn:'Abu El Feda St, Zamalek',products:5,image:'photo-1490481651871-ab68de25d43d',descriptionAr:'اختيارات مختارة بإطلالات هادئة.',descriptionEn:'Curated pieces with an easy, understated feel.'},
 {id:'store-daily-form',slug:'daily-form',ar:'ديلي فورم',en:'Daily Form',areaId:'downtown',addressAr:'شارع قصر النيل، وسط البلد',addressEn:'Qasr El Nil St, Downtown',products:5,image:'photo-1523398002811-999ca8dec234',descriptionAr:'أساسيات يومية بتصميمات بسيطة.',descriptionEn:'Everyday essentials with clean, simple designs.'},
 {id:'store-little-loom',slug:'little-loom',ar:'ليتل لوم',en:'Little Loom',areaId:'giza',addressAr:'شارع الهرم، الجيزة',addressEn:'El Haram St, Giza',products:5,image:'photo-1519238263530-99bdd11df2ea',descriptionAr:'اختيارات عملية للأطفال لكل يوم.',descriptionEn:'Practical kidswear for every day.'},
 {id:'store-maadi-lane',slug:'maadi-lane',ar:'معادي لين',en:'Maadi Lane',areaId:'maadi',addressAr:'شارع اللاسلكي، المعادي',addressEn:'El Laselky St, Maadi',products:5,image:'photo-1483985988355-763728e1935b',descriptionAr:'ملابس نسائية كاجوال بتفاصيل مميزة.',descriptionEn:'Casual womenswear with thoughtful details.'},
 {id:'store-heliopolis-closet',slug:'heliopolis-closet',ar:'دولاب مصر الجديدة',en:'Heliopolis Closet',areaId:'heliopolis',addressAr:'شارع بغداد، مصر الجديدة',addressEn:'Baghdad St, Heliopolis',products:5,image:'photo-1485230895905-ec40ba36b9bc',descriptionAr:'قطع متنوعة لإطلالات كل يوم.',descriptionEn:'Versatile pieces for everyday looks.'},
 {id:'store-october-studio',slug:'october-studio',ar:'ستوديو أكتوبر',en:'October Studio',areaId:'6-october',addressAr:'المحور المركزي، 6 أكتوبر',addressEn:'Central Axis, 6th of October',products:5,image:'photo-1529139574466-a303027c1d8b',descriptionAr:'أزياء عصرية للرجال والنساء.',descriptionEn:'Contemporary clothing for men and women.'}
];
const additionalStores: Store[] = stores.slice(-10);
const raw:[string,string,string,string,number,string,string,string,boolean,number][]=[
['product-1','جاكيت جينز كلاسيك','Classic denim jacket','women',1250,'store-style-house','nasr-city','photo-1543076447-215ad9ba6923',true,10],['product-2','قميص يومي','Everyday shirt','men',760,'store-style-house','nasr-city','photo-1598033129183-c4f50c736f10',true,10],['product-3','بلوزة ساتان','Satin blouse','women',980,'store-style-house','nasr-city','photo-1551163943-3f6a855d1153',true,15],['product-4','قميص كتان صيفي','Summer linen shirt','men',890,'store-urban-cairo','maadi','photo-1598033129183-c4f50c736f10',true,15],['product-5','تيشيرت يومي','Everyday tee','men',540,'store-urban-cairo','maadi','photo-1521572163474-6864f9cf17ab',true,10],['product-6','بلوزة كاجوال','Casual blouse','women',820,'store-maadi-mode','maadi','photo-1551163943-3f6a855d1153',true,10],['product-7','فستان يومي أنيق','Elegant day dress','women',1450,'store-closet-9','new-cairo','photo-1595777457583-95e059d581b8',true,10],['product-8','طقم خروج أطفال','Kids outing set','kids',890,'store-closet-9','new-cairo','photo-1519238263530-99bdd11df2ea',true,10],['product-9','طقم أطفال قطني','Cotton kids set','kids',620,'store-little-cairo','heliopolis','photo-1519238263530-99bdd11df2ea',true,5],['product-10','كارديجان شتوي','Winter cardigan','women',1600,'store-little-cairo','heliopolis','photo-1548126032-079a0fb0099d',true,10],['product-11','بنطلون قماش واسع','Wide-leg trousers','women',1100,'store-cairo-edit','mohandessin','photo-1506629905607-d9b1b9f1f8a8',true,10],['product-12','قميص مخطط','Striped shirt','men',980,'store-mohandessin-select','mohandessin','photo-1516257984-b1b4d707412e',true,15],['product-13','جاكيت خفيف','Light jacket','men',1350,'store-downtown-wear','downtown','photo-1591047139829-d91aecb6caea',true,5],['product-14','فستان صيفي','Summer dress','women',1200,'store-downtown-wear','downtown','photo-1595777457583-95e059d581b8',true,5],['product-15','فستان أطفال ملون','Colourful kids dress','kids',750,'store-mini-mood','zamalek','photo-1503919005314-30d93d07d823',true,10],['product-16','فستان سهرة بسيط','Simple evening dress','women',2100,'store-zamalek-wardrobe','zamalek','photo-1595777457583-95e059d581b8',true,15],['product-17','قميص أبيض','White shirt','men',700,'store-the-district','6-october','photo-1598033129183-c4f50c736f10',true,15],['product-18','بنطلون جينز','Jeans','men',1150,'store-the-district','6-october','photo-1542272604-787c3835535d',true,10],['product-19','طقم رياضي أطفال','Kids tracksuit','kids',680,'store-tiny-steps','giza','photo-1519238263530-99bdd11df2ea',true,5],['product-20','جاكيت جينز أطفال','Kids denim jacket','kids',930,'store-tiny-steps','giza','photo-1543076447-215ad9ba6923',false,5]
];
type AddedDemoProduct = [string,string,Product['category'],number,string];
const additionalProductGroups: AddedDemoProduct[][] = [
 [
  ['فستان ميدي ناعم','Soft midi dress','women',1450,'photo-1595777457583-95e059d581b8'],['بلوزة يومية','Everyday blouse','women',780,'photo-1551163943-3f6a855d1153'],['قميص كتان','Linen shirt','men',980,'photo-1598033129183-c4f50c736f10'],['بنطلون واسع','Wide-leg trousers','women',1150,'photo-1506629905607-d9b1b9f1f8a8'],['جاكيت خفيف','Light jacket','men',1750,'photo-1591047139829-d91aecb6caea']
 ],
 [
  ['قميص قطني','Cotton shirt','men',820,'photo-1598033129183-c4f50c736f10'],['تيشيرت أساسي','Essential tee','men',460,'photo-1521572163474-6864f9cf17ab'],['فستان قطني','Cotton dress','women',1280,'photo-1595777457583-95e059d581b8'],['كارديجان خفيف','Light cardigan','women',1390,'photo-1548126032-079a0fb0099d'],['بنطلون كاجوال','Casual trousers','men',1050,'photo-1506629905607-d9b1b9f1f8a8']
 ],
 [
  ['قميص مخطط','Striped shirt','men',920,'photo-1516257984-b1b4d707412e'],['جاكيت جينز','Denim jacket','men',1850,'photo-1543076447-215ad9ba6923'],['بلوزة ساتان','Satin blouse','women',1080,'photo-1551163943-3f6a855d1153'],['فستان يومي','Everyday dress','women',1490,'photo-1595777457583-95e059d581b8'],['بنطلون جينز','Jeans','men',1250,'photo-1542272604-787c3835535d']
 ],
 [
  ['طقم أطفال قطني','Cotton kids set','kids',690,'photo-1519238263530-99bdd11df2ea'],['فستان أطفال','Kids dress','kids',740,'photo-1503919005314-30d93d07d823'],['تيشيرت أطفال','Kids tee','kids',380,'photo-1521572163474-6864f9cf17ab'],['جاكيت أطفال خفيف','Kids light jacket','kids',890,'photo-1543076447-215ad9ba6923'],['بنطلون أطفال','Kids trousers','kids',520,'photo-1506629905607-d9b1b9f1f8a8']
 ],
 [
  ['فستان سهرة بسيط','Simple evening dress','women',2350,'photo-1595777457583-95e059d581b8'],['قميص أنيق','Smart shirt','men',1190,'photo-1598033129183-c4f50c736f10'],['تنورة ميدي','Midi skirt','women',980,'photo-1490481651871-ab68de25d43d'],['جاكيت نسائي','Women’s jacket','women',1980,'photo-1591047139829-d91aecb6caea'],['بلوزة كاجوال','Casual blouse','women',860,'photo-1551163943-3f6a855d1153']
 ],
 [
  ['قميص أبيض','White shirt','men',720,'photo-1598033129183-c4f50c736f10'],['بنطلون قماش','Tailored trousers','men',1190,'photo-1506629905607-d9b1b9f1f8a8'],['بلوزة يومية','Everyday blouse','women',790,'photo-1551163943-3f6a855d1153'],['تيشيرت قطني','Cotton tee','men',430,'photo-1521572163474-6864f9cf17ab'],['فستان صيفي','Summer dress','women',1320,'photo-1595777457583-95e059d581b8']
 ],
 [
  ['طقم رياضي أطفال','Kids tracksuit','kids',820,'photo-1519238263530-99bdd11df2ea'],['تيشيرت أطفال ملون','Colourful kids tee','kids',390,'photo-1521572163474-6864f9cf17ab'],['فستان أطفال مرح','Playful kids dress','kids',760,'photo-1503919005314-30d93d07d823'],['بنطلون أطفال قطني','Cotton kids trousers','kids',540,'photo-1506629905607-d9b1b9f1f8a8'],['جاكيت أطفال','Kids jacket','kids',920,'photo-1543076447-215ad9ba6923']
 ],
 [
  ['بلوزة كاجوال','Casual blouse','women',840,'photo-1551163943-3f6a855d1153'],['فستان يومي','Everyday dress','women',1420,'photo-1595777457583-95e059d581b8'],['قميص كتان','Linen shirt','men',1050,'photo-1598033129183-c4f50c736f10'],['بنطلون واسع','Wide-leg trousers','women',1180,'photo-1506629905607-d9b1b9f1f8a8'],['كارديجان','Cardigan','women',1540,'photo-1548126032-079a0fb0099d']
 ],
 [
  ['قميص مخطط','Striped shirt','men',880,'photo-1516257984-b1b4d707412e'],['فستان صيفي','Summer dress','women',1270,'photo-1595777457583-95e059d581b8'],['تيشيرت يومي','Everyday tee','men',490,'photo-1521572163474-6864f9cf17ab'],['جاكيت خفيف','Light jacket','women',1690,'photo-1591047139829-d91aecb6caea'],['بنطلون جينز','Jeans','men',1210,'photo-1542272604-787c3835535d']
 ],
 [
  ['قميص يومي','Everyday shirt','men',790,'photo-1598033129183-c4f50c736f10'],['جاكيت جينز','Denim jacket','men',1790,'photo-1543076447-215ad9ba6923'],['بلوزة ناعمة','Soft blouse','women',930,'photo-1551163943-3f6a855d1153'],['بنطلون كاجوال','Casual trousers','men',1070,'photo-1506629905607-d9b1b9f1f8a8'],['فستان ميدي','Midi dress','women',1510,'photo-1595777457583-95e059d581b8']
 ]
];
const additionalProducts: Product[] = additionalStores.flatMap((store, storeIndex) =>
  additionalProductGroups[storeIndex].map(([ar,en,category,price,image], productIndex) => ({
    id: `product-${21 + storeIndex * 5 + productIndex}`,
    ar,
    en,
    category,
    price,
    discountPercent: [5,10,0,15,0][productIndex],
    storeId: store.id,
    areaId: store.areaId,
    color: '#e5e0d6',
    image,
    sizes: category === 'kids' ? ['2Y','4Y','6Y'] : ['S','M','L','XL'],
    available: true,
  })),
);
export const products: Product[] = [...raw.map(([id,ar,en,category,price,storeId,areaId,image,available,offer])=>({id,ar,en,category:category as Product['category'],price,storeId,areaId,color:'#e5e0d6',image,sizes:category==='kids'?['2Y','4Y','6Y']:['S','M','L','XL'],available,offer})), ...additionalProducts];
export const t = (locale: Locale, ar: string, en: string) => locale === 'ar' ? ar : en;
export const localName = (locale: Locale, ar: string, en: string) => locale === 'ar' ? ar : en;
