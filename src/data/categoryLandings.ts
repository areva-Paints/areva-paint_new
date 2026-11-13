/** Category landing artwork, separate from home cards and admin-managed product photos. */
export const CATEGORY_LANDINGS: Record<
  string,
  {
    title: string;
    accent: string;
    tone: string;
    image: string;
    features: { icon: string; label: string }[];
  }
> = {
  interior: {
    title: "Interior",
    accent: "Paints",
    tone: "#42165d",
    image: "/assets/images/landing-interior.webp",
    features: [
      { icon: "wall", label: "Interior walls" },
      { icon: "finish", label: "Smooth finishes" },
      { icon: "shield", label: "Washable options" },
      { icon: "palette", label: "Colour choice" },
    ],
  },
  exterior: {
    title: "Exterior",
    accent: "Paints",
    tone: "#124c80",
    image: "/assets/images/landing-exterior.webp",
    features: [
      { icon: "rain", label: "Weather resistance" },
      { icon: "sun", label: "UV shields" },
      { icon: "wall", label: "Exterior finishes" },
      { icon: "shield", label: "Dirt-pick-up resistance" },
    ],
  },
  waterproofing: {
    title: "Waterproofing",
    accent: "Solutions",
    tone: "#3f195e",
    image: "/assets/images/landing-waterproofing.webp",
    features: [
      { icon: "drop", label: "Roof coatings" },
      { icon: "layers", label: "Elastomeric coatings" },
      { icon: "shield", label: "Damp-proof barriers" },
      { icon: "wall", label: "Moisture protection" },
    ],
  },
  "tile-adhesives": {
    title: "Tile",
    accent: "Adhesives",
    tone: "#443064",
    image: "/assets/images/landing-tile-adhesives.webp",
    features: [
      { icon: "bond", label: "Strong bonding" },
      { icon: "tiles", label: "Ceramic tiles" },
      { icon: "layers", label: "Vitrified tiles" },
      { icon: "wall", label: "Stone tiles" },
    ],
  },
  sealants: {
    title: "Joint",
    accent: "Sealants",
    tone: "#14545b",
    image: "/assets/images/landing-sealants.webp",
    features: [
      { icon: "flex", label: "Flexible joints" },
      { icon: "wrench", label: "Gap filling" },
      { icon: "flask", label: "PU & acrylic" },
      { icon: "bond", label: "Expansion joints" },
    ],
  },
  "putty-primers": {
    title: "Wall Putty",
    accent: "& Primers",
    tone: "#4a2468",
    image: "/assets/images/landing-putty-primers-branded.webp",
    features: [
      { icon: "roller", label: "Smooth surfaces" },
      { icon: "layers", label: "Surface leveling" },
      { icon: "wall", label: "Acrylic putties" },
      { icon: "bond", label: "High adhesion" },
    ],
  },
  textures: {
    title: "Textures &",
    accent: "Finishes",
    tone: "#4e225d",
    image: "/assets/images/landing-textures.webp",
    features: [
      { icon: "waves", label: "Exterior textures" },
      { icon: "palette", label: "Stone finishes" },
      { icon: "finish", label: "Rustic effects" },
      { icon: "wall", label: "Zester Series" },
    ],
  },
  chemicals: {
    title: "Construction",
    accent: "Chemicals",
    tone: "#164776",
    image: "/assets/images/landing-chemicals.webp",
    features: [
      { icon: "road", label: "Road repair" },
      { icon: "bond", label: "Bonding agents" },
      { icon: "flask", label: "Crystalline admixtures" },
      { icon: "building", label: "Specialist construction" },
    ],
  },
};
