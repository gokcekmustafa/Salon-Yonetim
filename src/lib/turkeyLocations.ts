export const TURKEY_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
  'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur',
  'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan',
  'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir',
  'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop',
  'Sivas', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
];

const CITY_DISTRICTS: Record<string, string[]> = {
  'İstanbul': ['Kadıköy', 'Üsküdar', 'Beşiktaş', 'Şişli', 'Bakırköy'],
  'Ankara': ['Çankaya', 'Keçiören', 'Yenimahalle', 'Mamak', 'Etimesgut'],
  'İzmir': ['Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Bayraklı'],
  'Bursa': ['Osmangazi', 'Nilüfer', 'Yıldırım', 'Mudanya', 'Gemlik'],
  'Antalya': ['Muratpaşa', 'Kepez', 'Konyaaltı', 'Alanya', 'Manavgat'],
  'Adana': ['Seyhan', 'Çukurova', 'Yüreğir', 'Sarıçam', 'Ceyhan'],
  'Gaziantep': ['Şahinbey', 'Şehitkamil', 'Nizip', 'İslahiye', 'Oğuzeli']
};

const DISTRICT_NEIGHBORHOODS: Record<string, string[]> = {
  'İstanbul-Kadıköy': ['Fenerbahçe Mahallesi', 'Caddebostan Mahallesi', 'Kozyatağı Mahallesi'],
  'İstanbul-Üsküdar': ['Altunizade Mahallesi', 'Acıbadem Mahallesi', 'Kuzguncuk Mahallesi'],
  'Ankara-Çankaya': ['Kızılay Mahallesi', 'Bahçelievler Mahallesi', 'Ayrancı Mahallesi'],
  'İzmir-Konak': ['Alsancak Mahallesi', 'Güzelyalı Mahallesi', 'Mithatpaşa Mahallesi']
};

const DEFAULT_DISTRICTS = ['Merkez'];
const DEFAULT_NEIGHBORHOODS = ['Merkez Mahallesi', 'Cumhuriyet Mahallesi', 'Yeni Mahalle'];

export function getDistrictsByCity(city: string) {
  if (!city) return [];
  return CITY_DISTRICTS[city] ?? DEFAULT_DISTRICTS;
}

export function getNeighborhoodsByDistrict(city: string, district: string) {
  if (!city || !district) return [];
  return DISTRICT_NEIGHBORHOODS[`${city}-${district}`] ?? DEFAULT_NEIGHBORHOODS;
}
