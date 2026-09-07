export interface HealthcareBrand {
  id: number;
  name: string;
  form: string | null;
  strength: string | null;
  price: string | null;
  pack_size: string | null;
  manufacturers: { name: string } | null;
  generics: {
    id: number; name: string;
    indication: string | null; side_effect: string | null;
    precaution: string | null; adult_dose: string | null;
    child_dose: string | null; pregnancy_category_id: string | null;
  } | null;
}
