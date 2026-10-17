export interface CollegeItem {
  id: string;
  name: string;
  shortName?: string;
  location: string;
  type: 'government' | 'private' | 'university';
}

export const BIHAR_ENGINEERING_COLLEGES: CollegeItem[] = [
  // University Campus
  {
    id: 'beu-campus',
    name: 'Bihar Engineering University Campus',
    shortName: 'BEU Campus',
    location: 'Patna',
    type: 'university',
  },

  // 1 to 38: Government Engineering Colleges (Official Bihar Government list)
  {
    id: 'mit-muzaffarpur',
    name: 'Muzaffarpur Institute of Technology',
    shortName: 'MIT Muzaffarpur',
    location: 'Muzaffarpur',
    type: 'government',
  },
  {
    id: 'gce-gaya',
    name: 'Gaya College of Engineering',
    shortName: 'GCE Gaya',
    location: 'Gaya',
    type: 'government',
  },
  {
    id: 'mce-motihari',
    name: 'Motihari College of Engineering',
    shortName: 'MCE Motihari',
    location: 'Motihari',
    type: 'government',
  },
  {
    id: 'nce-nalanda',
    name: 'Nalanda College of Engineering',
    shortName: 'NCE Chandi',
    location: 'Chandi, Nalanda',
    type: 'government',
  },
  {
    id: 'sit-sitamarhi',
    name: 'Sitamarhi Institute of Technology',
    shortName: 'SIT Sitamarhi',
    location: 'Sitamarhi',
    type: 'government',
  },
  {
    id: 'dce-darbhanga',
    name: 'Darbhanga College of Engineering',
    shortName: 'DCE Darbhanga',
    location: 'Darbhanga',
    type: 'government',
  },
  {
    id: 'lnjpit-chapra',
    name: 'Lok Nayak Jai Prakash Institute of Technology',
    shortName: 'LNJPIT Chapra',
    location: 'Chapra, Saran',
    type: 'government',
  },
  {
    id: 'bce-bhagalpur',
    name: 'Bhagalpur College of Engineering',
    shortName: 'BCE Bhagalpur',
    location: 'Bhagalpur',
    type: 'government',
  },
  {
    id: 'bpmce-madhepura',
    name: 'B.P. Mandal College of Engineering',
    shortName: 'BPMCE Madhepura',
    location: 'Madhepura',
    type: 'government',
  },
  {
    id: 'rrsdce-begusarai',
    name: 'Rashtrakavi Ramdhari Singh Dinkar College of Engineering',
    shortName: 'RRSDCE Begusarai',
    location: 'Begusarai',
    type: 'government',
  },
  {
    id: 'kec-katihar',
    name: 'Katihar Engineering College',
    shortName: 'KEC Katihar',
    location: 'Katihar',
    type: 'government',
  },
  {
    id: 'sec-sasaram',
    name: 'Sershah Engineering College',
    shortName: 'SEC Sasaram',
    location: 'Sasaram, Rohtas',
    type: 'government',
  },
  {
    id: 'bce-bakhtiyarpur',
    name: 'Bakhtiyarpur College of Engineering',
    shortName: 'BCE Bakhtiyarpur',
    location: 'Bakhtiyarpur, Patna',
    type: 'government',
  },
  {
    id: 'sce-supaul',
    name: 'Supaul College of Engineering',
    shortName: 'SCE Supaul',
    location: 'Supaul',
    type: 'government',
  },
  {
    id: 'sce-saharsa',
    name: 'Saharsa College of Engineering',
    shortName: 'SCE Saharsa',
    location: 'Saharsa',
    type: 'government',
  },
  {
    id: 'pce-purnea',
    name: 'Purnea College of Engineering',
    shortName: 'PCE Purnea',
    location: 'Purnea',
    type: 'government',
  },
  {
    id: 'gec-vaishali',
    name: 'Government Engineering College, Vaishali',
    shortName: 'GEC Vaishali',
    location: 'Vaishali',
    type: 'government',
  },
  {
    id: 'gec-jamui',
    name: 'Government Engineering College, Jamui',
    shortName: 'GEC Jamui',
    location: 'Jamui',
    type: 'government',
  },
  {
    id: 'gec-banka',
    name: 'Government Engineering College, Banka',
    shortName: 'GEC Banka',
    location: 'Banka',
    type: 'government',
  },
  {
    id: 'gec-samastipur',
    name: 'Government Engineering College, Samastipur',
    shortName: 'GEC Samastipur',
    location: 'Samastipur',
    type: 'government',
  },
  {
    id: 'gec-west-champaran',
    name: 'Government Engineering College, West Champaran',
    shortName: 'GEC Bettiah',
    location: 'Bettiah',
    type: 'government',
  },
  {
    id: 'gec-madhubani',
    name: 'Government Engineering College, Madhubani',
    shortName: 'GEC Madhubani',
    location: 'Madhubani',
    type: 'government',
  },
  {
    id: 'gec-sheohar',
    name: 'Government Engineering College, Sheohar',
    shortName: 'GEC Sheohar',
    location: 'Sheohar',
    type: 'government',
  },
  {
    id: 'gec-nawada',
    name: 'Government Engineering College, Nawada',
    shortName: 'GEC Nawada',
    location: 'Nawada',
    type: 'government',
  },
  {
    id: 'gec-sheikhpura',
    name: 'Government Engineering College, Sheikhpura',
    shortName: 'GEC Sheikhpura',
    location: 'Sheikhpura',
    type: 'government',
  },
  {
    id: 'spnrec-araria',
    name: 'Shri Phanishwar Nath Renu Engineering College',
    shortName: 'SPNREC Araria',
    location: 'Araria',
    type: 'government',
  },
  {
    id: 'gec-khagaria',
    name: 'Government Engineering College, Khagaria',
    shortName: 'GEC Khagaria',
    location: 'Khagaria',
    type: 'government',
  },
  {
    id: 'gec-aurangabad',
    name: 'Government Engineering College, Aurangabad',
    shortName: 'GEC Aurangabad',
    location: 'Aurangabad',
    type: 'government',
  },
  {
    id: 'gec-jehanabad',
    name: 'Government Engineering College, Jehanabad',
    shortName: 'GEC Jehanabad',
    location: 'Jehanabad',
    type: 'government',
  },
  {
    id: 'gec-arwal',
    name: 'Government Engineering College, Arwal',
    shortName: 'GEC Arwal',
    location: 'Arwal',
    type: 'government',
  },
  {
    id: 'gec-gopalganj',
    name: 'Government Engineering College, Gopalganj',
    shortName: 'GEC Gopalganj',
    location: 'Gopalganj',
    type: 'government',
  },
  {
    id: 'gec-siwan',
    name: 'Government Engineering College, Siwan',
    shortName: 'GEC Siwan',
    location: 'Siwan',
    type: 'government',
  },
  {
    id: 'gec-kaimur',
    name: 'Government Engineering College, Kaimur',
    shortName: 'GEC Kaimur',
    location: 'Kaimur',
    type: 'government',
  },
  {
    id: 'gec-kishanganj',
    name: 'Government Engineering College, Kishanganj',
    shortName: 'GEC Kishanganj',
    location: 'Kishanganj',
    type: 'government',
  },
  {
    id: 'gec-buxar',
    name: 'Government Engineering College, Buxar',
    shortName: 'GEC Buxar',
    location: 'Buxar',
    type: 'government',
  },
  {
    id: 'gec-bhojpur',
    name: 'Government Engineering College, Bhojpur',
    shortName: 'GEC Bhojpur',
    location: 'Bhojpur',
    type: 'government',
  },
  {
    id: 'gec-lakhisarai',
    name: 'Government Engineering College, Lakhisarai',
    shortName: 'GEC Lakhisarai',
    location: 'Lakhisarai',
    type: 'government',
  },
  {
    id: 'gec-munger',
    name: 'Government Engineering College, Munger',
    shortName: 'GEC Munger',
    location: 'Munger',
    type: 'government',
  },

  // 1 to 18: Private Engineering Colleges (BEU & Bihar Technical Institutions)
  {
    id: 'bit-patna',
    name: 'Birla Institute of Technology, Patna',
    shortName: 'BIT Patna',
    location: 'Patna',
    type: 'private',
  },
  {
    id: 'amity-patna',
    name: 'Amity University, Patna',
    shortName: 'Amity Patna',
    location: 'Patna',
    type: 'private',
  },
  {
    id: 'nsit-bihta',
    name: 'Netaji Subhas Institute of Technology',
    shortName: 'NSIT Bihta',
    location: 'Bihta, Patna',
    type: 'private',
  },
  {
    id: 'rpsit-danapur',
    name: 'R.P. Sharma Institute of Technology',
    shortName: 'RPSIT Danapur',
    location: 'Danapur, Patna',
    type: 'private',
  },
  {
    id: 'macet-neora',
    name: 'Maulana Azad College of Engineering and Technology',
    shortName: 'MACET Patna',
    location: 'Neora, Patna',
    type: 'private',
  },
  {
    id: 'sit-aurangabad',
    name: 'Sityog Institute of Technology',
    shortName: 'Sityog Aurangabad',
    location: 'Aurangabad',
    type: 'private',
  },
  {
    id: 'ecet-vaishali',
    name: 'Exalt College of Engineering and Technology',
    shortName: 'Exalt Vaishali',
    location: 'Vaishali',
    type: 'private',
  },
  {
    id: 'ait-kishanganj',
    name: 'Azmet Institute of Technology',
    shortName: 'Azmet Kishanganj',
    location: 'Kishanganj',
    type: 'private',
  },
  {
    id: 'amit-banka',
    name: 'Adwaita Mission Institute of Technology',
    shortName: 'Adwaita Banka',
    location: 'Banka',
    type: 'private',
  },
  {
    id: 'vvit-purnea',
    name: 'Vidya Vihar Institute of Technology',
    shortName: 'VVIT Purnea',
    location: 'Purnea',
    type: 'private',
  },
  {
    id: 'mit-purnea',
    name: 'Millia Institute of Technology',
    shortName: 'Millia Purnea',
    location: 'Purnea',
    type: 'private',
  },
  {
    id: 'mbit-forbesganj',
    name: 'Moti Babu Institute of Technology',
    shortName: 'MBIT Forbesganj',
    location: 'Forbesganj',
    type: 'private',
  },
  {
    id: 'mkcet-kishanganj',
    name: 'Millia Kishanganj College of Engineering and Technology',
    shortName: 'MKCET Kishanganj',
    location: 'Kishanganj',
    type: 'private',
  },
  {
    id: 'jpce-nalanda',
    name: 'J.P. College of Engineering',
    shortName: 'JPCE Biharsharif',
    location: 'Biharsharif, Nalanda',
    type: 'private',
  },
  {
    id: 'mothers-bihta',
    name: 'Mothers Institute of Technology',
    shortName: 'Mothers Bihta',
    location: 'Bihta, Patna',
    type: 'private',
  },
  {
    id: 'pkec-aurangabad',
    name: 'Prabhu Kailash Engineering College',
    shortName: 'PKEC Aurangabad',
    location: 'Aurangabad',
    type: 'private',
  },
  {
    id: 'dagc-bihta',
    name: 'Dr. Ashok Gagan College',
    shortName: 'DAGC Bihta',
    location: 'Bihta, Patna',
    type: 'private',
  },
  {
    id: 'rcpe-sitamarhi',
    name: 'Rajeev College of Professional Education',
    shortName: 'RCPE Sitamarhi',
    location: 'Sitamarhi',
    type: 'private',
  },
];

/**
 * Filter colleges by search query (matching name, short name, or location).
 */
export function searchColleges(
  query: string,
  filterType: 'all' | 'government' | 'private' = 'all'
): CollegeItem[] {
  const q = query.trim().toLowerCase();

  return BIHAR_ENGINEERING_COLLEGES.filter((c) => {
    if (filterType !== 'all') {
      if (filterType === 'government' && c.type !== 'government' && c.type !== 'university') return false;
      if (filterType === 'private' && c.type !== 'private') return false;
    }

    if (!q) return true;

    return (
      c.name.toLowerCase().includes(q) ||
      (c.shortName && c.shortName.toLowerCase().includes(q)) ||
      c.location.toLowerCase().includes(q)
    );
  });
}
