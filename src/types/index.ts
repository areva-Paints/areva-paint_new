import type { ShadeFamily, ShadeTone } from '../data/shadeFamilies';
export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  tagline: string;
  description: string;
  availableSizes: number[]; // in Liters, e.g. [1, 4, 10, 20]
  coverageSqFtPerLiter: number;
  coverageUnit?: 'L' | 'kg';
  calculationBasis?: 'wall' | 'floor';
  sheen: string;
  vocLevel: 'Zero VOC (<5g/L)' | 'Low VOC (<30g/L)' | 'Standard';
  washability: 'Class 1 (Scrubbable)' | 'High Washable' | 'Wipeable' | 'Specialist';
  recommendedCoats: number;
  tintable: boolean;
  image: string;
  featured?: boolean;
  specs: {
    coverageText?: string;
    dilution?: string;
    bases?: string[];
    packing?: string[];
    warrantyLabel?: string;
    dryingTime: string;
    recoatTime: string;
    thinnedWith: string;
    warrantyYears: number;
    recommendedSurfaces: string[];
    surfacePreparation: string;
    applicationMethod: string;
  };
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  accentColor: string;
}

export interface ColorShade {
  code: string;
  name: string;
  hex: string;
  family: ShadeFamily;
  tones?: ShadeTone[];
  goesWellWith: string[]; // array of hex codes
}

export interface RoomPreset {
  id: string;
  name: string;
  category: 'Interior' | 'Exterior';
  imageUrl: string;
  isSvg?: boolean;
  svgData?: string;
  defaultWallHex: string;
  defaultWallName: string;
  accentCoordinates?: [number, number];
}

export interface EnquiryFormData {
  topic: string;
  fullName: string;
  phone: string;
  city: string;
  productName?: string;
  shadeName?: string;
  message?: string;
}
