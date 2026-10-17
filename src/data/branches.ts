export interface BranchItem {
  id: string;
  slug: string;
  code: string;
  name: string;
  category: 'cs_it' | 'electrical_electronics' | 'mechanical_robotics' | 'civil' | 'chemical_specialized';
  order: number;
}

export const PYQDECK_BRANCHES: BranchItem[] = [
  // Computer Science & IT Family
  {
    id: 'cse',
    slug: 'cse',
    code: 'CSE',
    name: 'Computer Science & Engineering',
    category: 'cs_it',
    order: 1,
  },
  {
    id: 'cse-ai',
    slug: 'cse-ai',
    code: 'CSE-AI',
    name: 'Computer Science & Engineering (AI)',
    category: 'cs_it',
    order: 2,
  },
  {
    id: 'cse-cyber-security',
    slug: 'cse-cyber-security',
    code: 'CSE-CS',
    name: 'Computer Science & Engineering (Cyber Security)',
    category: 'cs_it',
    order: 3,
  },
  {
    id: 'cse-data-science',
    slug: 'cse-data-science',
    code: 'CSE-DS',
    name: 'Computer Science & Engineering (Data Science)',
    category: 'cs_it',
    order: 4,
  },
  {
    id: 'cse-aiml',
    slug: 'cse-aiml',
    code: 'CSE-AIML',
    name: 'Computer Science & Engineering (AI & ML)',
    category: 'cs_it',
    order: 5,
  },
  {
    id: 'cse-iot',
    slug: 'cse-iot',
    code: 'CSE-IOT',
    name: 'Computer Science & Engineering (IoT)',
    category: 'cs_it',
    order: 6,
  },
  {
    id: 'cse-iot-cyber-blockchain',
    slug: 'cse-iot-cyber-blockchain',
    code: 'CSE-IOT-CS-BCT',
    name: 'Computer Science & Engg (IOT & Cyber Security including Block Chain Technology)',
    category: 'cs_it',
    order: 7,
  },
  {
    id: 'cse-networks',
    slug: 'cse-networks',
    code: 'CSE-N',
    name: 'Computer Science & Engineering (Networks)',
    category: 'cs_it',
    order: 8,
  },
  {
    id: 'it',
    slug: 'it',
    code: 'IT',
    name: 'Information Technology',
    category: 'cs_it',
    order: 9,
  },
  {
    id: '3d-animation-graphics',
    slug: '3d-animation-graphics',
    code: '3DAG',
    name: '3-D Animation & Graphics',
    category: 'cs_it',
    order: 10,
  },
  {
    id: 'mathematics-computing',
    slug: 'mathematics-computing',
    code: 'M&C',
    name: 'Mathematics & Computing',
    category: 'cs_it',
    order: 11,
  },

  // Electrical & Electronics Family
  {
    id: 'ee',
    slug: 'ee',
    code: 'EE',
    name: 'Electrical Engineering',
    category: 'electrical_electronics',
    order: 12,
  },
  {
    id: 'eee',
    slug: 'eee',
    code: 'EEE',
    name: 'Electrical and Electronics Engineering',
    category: 'electrical_electronics',
    order: 13,
  },
  {
    id: 'ece',
    slug: 'ece',
    code: 'ECE',
    name: 'Electronics and Communication Engineering',
    category: 'electrical_electronics',
    order: 14,
  },
  {
    id: 'ece-act',
    slug: 'ece-act',
    code: 'ECE-ACT',
    name: 'Electronics and Communication Engineering (Advance Communication Technology)',
    category: 'electrical_electronics',
    order: 15,
  },
  {
    id: 'ee-vlsi',
    slug: 'ee-vlsi',
    code: 'EE-VLSI',
    name: 'Electronics Engineering (VLSI Design & Technology)',
    category: 'electrical_electronics',
    order: 16,
  },
  {
    id: 'eie',
    slug: 'eie',
    code: 'EIE',
    name: 'Electronics and Instrumentation Engineering',
    category: 'electrical_electronics',
    order: 17,
  },

  // Mechanical & Robotics Family
  {
    id: 'me',
    slug: 'me',
    code: 'ME',
    name: 'Mechanical Engineering',
    category: 'mechanical_robotics',
    order: 18,
  },
  {
    id: 'me-smart-manufacturing',
    slug: 'me-smart-manufacturing',
    code: 'ME-SM',
    name: 'Mechanical and Smart Manufacturing Engineering',
    category: 'mechanical_robotics',
    order: 19,
  },
  {
    id: 'robotics-automation',
    slug: 'robotics-automation',
    code: 'RA',
    name: 'Robotics and Automation',
    category: 'mechanical_robotics',
    order: 20,
  },
  {
    id: 'mechatronics',
    slug: 'mechatronics',
    code: 'MTR',
    name: 'Mechatronics Engineering',
    category: 'mechanical_robotics',
    order: 29,
  },

  // Civil Family
  {
    id: 'civil',
    slug: 'civil',
    code: 'CE',
    name: 'Civil Engineering',
    category: 'civil',
    order: 21,
  },
  {
    id: 'civil-ca',
    slug: 'civil-ca',
    code: 'CE-CA',
    name: 'Civil Engineering with Computer Applications',
    category: 'civil',
    order: 22,
  },

  // Chemical & Specialized Technologies
  {
    id: 'petrochemical',
    slug: 'petrochemical',
    code: 'PCE',
    name: 'Petrochemical Engineering',
    category: 'chemical_specialized',
    order: 23,
  },
  {
    id: 'chem-leather',
    slug: 'chem-leather',
    code: 'CH-LE',
    name: 'Chemical Engineering (Leather Technology)',
    category: 'chemical_specialized',
    order: 24,
  },
  {
    id: 'chem-plastic',
    slug: 'chem-plastic',
    code: 'CH-PP',
    name: 'Chemical Engineering (Plastic & Polymer)',
    category: 'chemical_specialized',
    order: 25,
  },
  {
    id: 'waste-management',
    slug: 'waste-management',
    code: 'WM',
    name: 'Waste Management',
    category: 'chemical_specialized',
    order: 26,
  },
  {
    id: 'aeronautical',
    slug: 'aeronautical',
    code: 'AE',
    name: 'Aeronautical Engineering',
    category: 'chemical_specialized',
    order: 27,
  },
  {
    id: 'biomedical-robotics',
    slug: 'biomedical-robotics',
    code: 'BMR',
    name: 'Biomedical & Robotics Engineering',
    category: 'chemical_specialized',
    order: 28,
  },
  {
    id: 'mining',
    slug: 'mining',
    code: 'MIN',
    name: 'Mining Engineering',
    category: 'chemical_specialized',
    order: 30,
  },
  {
    id: 'chemical',
    slug: 'chemical',
    code: 'CHE',
    name: 'Chemical Engineering',
    category: 'chemical_specialized',
    order: 31,
  },
  {
    id: 'fire-safety',
    slug: 'fire-safety',
    code: 'FTS',
    name: 'Fire Technology and Safety',
    category: 'chemical_specialized',
    order: 32,
  },
  {
    id: 'food-processing',
    slug: 'food-processing',
    code: 'FPP',
    name: 'Food Processing and Preservation',
    category: 'chemical_specialized',
    order: 33,
  },
  {
    id: 'food-tech-mgmt',
    slug: 'food-tech-mgmt',
    code: 'FTM',
    name: 'Food Technology and Management',
    category: 'chemical_specialized',
    order: 34,
  },
];

export type BranchFilterCategory =
  | 'all'
  | 'cs_it'
  | 'electrical_electronics'
  | 'mechanical_robotics'
  | 'civil'
  | 'chemical_specialized';

export function searchBranches(
  query: string,
  category: BranchFilterCategory = 'all'
): BranchItem[] {
  const q = query.trim().toLowerCase();

  return PYQDECK_BRANCHES.filter((b) => {
    if (category !== 'all' && b.category !== category) return false;
    if (!q) return true;

    return (
      b.code.toLowerCase().includes(q) ||
      b.name.toLowerCase().includes(q) ||
      b.slug.toLowerCase().includes(q)
    );
  });
}
