import {
  reactExtension,
  BlockStack,
  Select,
  TextField,
  Text,
  useApplyAttributeChange,
  useAttributes,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension(
  "purchase.checkout.contact.render-after",
  () => <VehicleCapture />,
);

const CURRENT_YEAR = new Date().getFullYear();

const YEARS: { value: string; label: string }[] = [
  { value: "", label: "Select year" },
  ...Array.from({ length: 31 }, (_, i) => {
    const y = String(CURRENT_YEAR - i);
    return { value: y, label: y };
  }),
];

const MAKES: { value: string; label: string }[] = [
  { value: "", label: "Select make" },
  ...[
    "Acura", "Alfa Romeo", "Audi", "BMW", "Buick", "Cadillac",
    "Chevrolet", "Chrysler", "Dodge", "Ford", "Genesis", "GMC",
    "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
    "Land Rover", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz",
    "MINI", "Mitsubishi", "Nissan", "Porsche", "Ram", "Subaru",
    "Tesla", "Toyota", "Volkswagen", "Volvo", "Other",
  ].map((m) => ({ value: m, label: m })),
];

function VehicleCapture() {
  const applyAttributeChange = useApplyAttributeChange();
  const attributes = useAttributes();

  const get = (key: string) =>
    attributes.find((a) => a.key === key)?.value ?? "";

  const set = (key: string, value: string) =>
    void applyAttributeChange({ key, type: "updateAttribute", value });

  return (
    <BlockStack spacing="tight">
      <Text size="medium" emphasis="bold">
        Vehicle Information
      </Text>
      <Text size="small" appearance="subdued">
        Optional — helps us send timely maintenance reminders.
      </Text>
      <Select
        label="Year"
        options={YEARS}
        value={get("_vehicle_year")}
        onChange={(v) => set("_vehicle_year", v)}
      />
      <Select
        label="Make"
        options={MAKES}
        value={get("_vehicle_make")}
        onChange={(v) => set("_vehicle_make", v)}
      />
      <TextField
        label="Model"
        placeholder="e.g. Camry, F-150, Civic"
        value={get("_vehicle_model")}
        onChange={(v) => set("_vehicle_model", v)}
      />
    </BlockStack>
  );
}
