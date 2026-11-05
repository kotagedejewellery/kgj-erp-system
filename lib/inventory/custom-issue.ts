type LegacyComponent = {
  id_gender: number | string | null;
  id_jenis_bahan: number | string | null;
};

type MaterialMapping = {
  sourceMaterialId: number;
  materialId: string;
};

type CustomIssueInput = {
  components: LegacyComponent[];
  berat_cincin_pria: string | number | null;
  berat_cincin_wanita: string | number | null;
  materials: MaterialMapping[];
};

export type CustomIssueLine = {
  materialId: string;
  weightGrams: string;
};

function canonicalWeight(value: string | number | null, label: string): string {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string") throw new Error(`Berat cincin ${label} belum tersedia`);

  const match = raw.match(/^(0|[1-9]\d*)(?:\.(\d{1,3}))?$/);
  if (!match) throw new Error(`Berat cincin ${label} tidak valid`);

  const weight = `${match[1]}.${(match[2] ?? "").padEnd(3, "0")}`;
  if (weight === "0.000") throw new Error(`Berat cincin ${label} belum tersedia`);

  return weight;
}

function asPositiveInteger(value: number | string | null): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toMilligrams(weight: string): number {
  const [whole, fraction] = weight.split(".");
  return Number(whole) * 1000 + Number(fraction);
}

function fromMilligrams(value: number): string {
  return `${Math.floor(value / 1000)}.${String(value % 1000).padStart(3, "0")}`;
}

export function buildCustomIssueLines(input: CustomIssueInput): CustomIssueLine[] {
  const mappings = new Map(input.materials.map((material) => [material.sourceMaterialId, material.materialId]));
  const quantities = new Map<string, number>();
  const genders = new Set<number>();

  for (const component of input.components) {
    const sourceMaterialId = asPositiveInteger(component.id_jenis_bahan);
    if (!sourceMaterialId) continue;

    const gender = asPositiveInteger(component.id_gender);
    if (gender !== 1 && gender !== 2) throw new Error("Gender komponen bahan tidak valid");
    if (genders.has(gender)) throw new Error(`Komponen bahan ${gender === 1 ? "pria" : "wanita"} lebih dari satu`);
    genders.add(gender);

    const materialId = mappings.get(sourceMaterialId);
    if (!materialId) throw new Error(`Belum ada mapping inventory untuk bahan Yii2 ${sourceMaterialId}`);

    const weight = canonicalWeight(
      gender === 1 ? input.berat_cincin_pria : input.berat_cincin_wanita,
      gender === 1 ? "pria" : "wanita",
    );
    quantities.set(materialId, (quantities.get(materialId) ?? 0) + toMilligrams(weight));
  }

  if (quantities.size === 0) throw new Error("Order tidak memiliki komponen bahan");

  return [...quantities.entries()].map(([materialId, quantity]) => ({
    materialId,
    weightGrams: fromMilligrams(quantity),
  }));
}
