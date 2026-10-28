const LABEL_MAP: Record<string, string> = {
  laser_batik: "Laser Batik",
  laser_motif: "Laser Motif",
  laser_sidik_jari: "Laser Sidik Jari",
  laser_simbol: "Laser Simbol",
  laser_nama: "Laser Nama",
  micro_setting_micro_finishing_biasa: "Micro Setting - Micro Finishing Biasa",
  micro_setting_black_finishing: "Micro Setting - Black Finishing",
  permata_berlian_gia: "Permata - Berlian GIA",
  permata_berlian_natural: "Permata - Berlian Natural",
  permata_berlian_labground_diamond: "Permata - Berlian Labground Diamond",
  permata_blue_shapire: "Permata - Blue Shapire",
  permata_rubby: "Permata - Rubby",
  permata_moisanet: "Permata - Moisanet",
  "3d_design": "3D Design",
};

export function formatAddsOn(key: string): string {
  return LABEL_MAP[key] ?? key;
}

export function formatAddsOnList(keys: string[] | null): string {
  if (!keys || !Array.isArray(keys) || keys.length === 0) return "—";
  return keys.map(formatAddsOn).join(", ");
}
