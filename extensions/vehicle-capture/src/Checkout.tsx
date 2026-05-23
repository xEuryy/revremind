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

const MODELS: Record<string, string[]> = {
  Acura: ["ILX", "Integra", "MDX", "NSX", "RDX", "TLX", "ZDX"],
  "Alfa Romeo": ["4C", "Giulia", "Giulietta", "Spider", "Stelvio", "Tonale"],
  Audi: [
    "A3", "A4", "A5", "A6", "A7", "A8",
    "e-tron", "e-tron GT",
    "Q3", "Q4 e-tron", "Q5", "Q7", "Q8",
    "RS3", "RS5", "RS6", "RS7",
    "S3", "S4", "S5", "S6", "S7", "S8",
    "SQ5", "SQ7", "SQ8", "TT",
  ],
  BMW: [
    "2 Series", "3 Series", "4 Series", "5 Series", "7 Series", "8 Series",
    "i3", "i4", "i5", "i7", "iX",
    "M2", "M3", "M4", "M5", "M8",
    "X1", "X2", "X3", "X4", "X5", "X6", "X7",
    "X5 M", "X6 M", "Z4",
  ],
  Buick: ["Enclave", "Encore", "Encore GX", "Envision", "Envista", "LaCrosse"],
  Cadillac: [
    "CT4", "CT5", "Escalade", "Escalade ESV",
    "Lyriq", "XT4", "XT5", "XT6",
  ],
  Chevrolet: [
    "Blazer", "Blazer EV", "Bolt EUV", "Bolt EV", "Camaro", "Colorado",
    "Corvette", "Equinox", "Equinox EV", "Express",
    "Malibu", "Silverado 1500", "Silverado 2500HD", "Silverado 3500HD",
    "Sonic", "Spark", "Suburban", "Tahoe",
    "Trailblazer", "Traverse", "Trax",
  ],
  Chrysler: ["300", "Pacifica", "Pacifica Hybrid", "Voyager"],
  Dodge: ["Challenger", "Charger", "Durango", "Hornet", "Journey"],
  Ford: [
    "Bronco", "Bronco Sport", "E-Transit", "Edge", "Escape",
    "Expedition", "Explorer", "F-150", "F-150 Lightning",
    "F-250 Super Duty", "F-350 Super Duty",
    "Maverick", "Mustang", "Mustang Mach-E",
    "Ranger", "Transit", "Transit Connect",
  ],
  Genesis: ["G70", "G80", "G90", "GV60", "GV70", "GV80"],
  GMC: [
    "Acadia", "Canyon", "Hummer EV", "Savana",
    "Sierra 1500", "Sierra 2500HD", "Sierra 3500HD",
    "Terrain", "Yukon", "Yukon XL",
  ],
  Honda: [
    "Accord", "Civic", "CR-V", "CR-V Hybrid",
    "HR-V", "Odyssey", "Passport", "Pilot",
    "Prologue", "Ridgeline",
  ],
  Hyundai: [
    "Accent", "Elantra", "Ioniq", "Ioniq 5", "Ioniq 6",
    "Kona", "Kona Electric", "Palisade",
    "Santa Cruz", "Santa Fe", "Sonata",
    "Tucson", "Venue",
  ],
  Infiniti: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80"],
  Jaguar: ["E-Pace", "F-Pace", "F-Type", "I-Pace", "XE", "XF", "XJ"],
  Jeep: [
    "Cherokee", "Compass", "Gladiator", "Grand Cherokee",
    "Grand Cherokee L", "Grand Wagoneer",
    "Renegade", "Wagoneer", "Wrangler",
  ],
  Kia: [
    "Carnival", "EV6", "EV9", "Forte", "K5",
    "Niro", "Niro EV", "Seltos", "Soul",
    "Sorento", "Sportage", "Stinger", "Telluride",
  ],
  "Land Rover": [
    "Defender", "Discovery", "Discovery Sport",
    "Range Rover", "Range Rover Evoque",
    "Range Rover Sport", "Range Rover Velar",
  ],
  Lexus: [
    "ES", "GX", "IS", "LC", "LS", "LX",
    "NX", "RC", "RX", "RZ", "TX", "UX",
  ],
  Lincoln: ["Aviator", "Corsair", "Navigator", "Nautilus"],
  Mazda: [
    "CX-30", "CX-5", "CX-50", "CX-70", "CX-90",
    "Mazda3", "Mazda6", "MX-5 Miata", "MX-30",
  ],
  "Mercedes-Benz": [
    "A-Class", "C-Class", "CLA", "CLE", "E-Class",
    "EQB", "EQE", "EQS",
    "G-Class", "GLA", "GLB", "GLC", "GLE", "GLS",
    "S-Class", "SL",
  ],
  MINI: [
    "Clubman", "Convertible", "Cooper",
    "Cooper SE", "Countryman", "Paceman",
  ],
  Mitsubishi: [
    "Eclipse Cross", "Mirage", "Mirage G4",
    "Outlander", "Outlander PHEV", "Outlander Sport",
  ],
  Nissan: [
    "Altima", "Armada", "Ariya", "Frontier",
    "Kicks", "Leaf", "Maxima", "Murano",
    "Pathfinder", "Rogue", "Rogue Sport",
    "Sentra", "Titan", "Versa", "Z",
  ],
  Porsche: [
    "718 Boxster", "718 Cayman", "911",
    "Cayenne", "Cayenne Coupe", "Macan",
    "Panamera", "Taycan",
  ],
  Ram: ["1500", "1500 Classic", "2500", "3500", "ProMaster", "ProMaster City"],
  Subaru: [
    "Ascent", "BRZ", "Crosstrek", "Forester",
    "Impreza", "Legacy", "Outback",
    "Solterra", "WRX",
  ],
  Tesla: ["Cybertruck", "Model 3", "Model S", "Model X", "Model Y"],
  Toyota: [
    "4Runner", "bZ4X", "Camry", "C-HR",
    "Corolla", "Corolla Cross", "Crown",
    "GR86", "GR Corolla", "GR Supra",
    "Highlander", "Land Cruiser", "Mirai",
    "Prius", "Prius Prime", "RAV4",
    "RAV4 Prime", "Sequoia", "Sienna",
    "Tacoma", "Tundra", "Venza",
  ],
  Volkswagen: [
    "Atlas", "Atlas Cross Sport", "Golf",
    "GTI", "ID.4", "Jetta", "Passat",
    "Taos", "Tiguan",
  ],
  Volvo: ["C40", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"],
};

function getModelOptions(make: string): { value: string; label: string }[] {
  const models = MODELS[make];
  if (!models) return [];
  return [
    { value: "", label: "Select model" },
    ...models.map((m) => ({ value: m, label: m })),
  ];
}

function VehicleCapture() {
  const applyAttributeChange = useApplyAttributeChange();
  const attributes = useAttributes();

  const get = (key: string) =>
    attributes.find((a) => a.key === key)?.value ?? "";

  const set = (key: string, value: string) =>
    void applyAttributeChange({ key, type: "updateAttribute", value });

  const selectedMake = get("_vehicle_make");
  const modelOptions = getModelOptions(selectedMake);
  const useModelDropdown = selectedMake !== "" && selectedMake !== "Other";

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
        value={selectedMake}
        onChange={(v) => {
          set("_vehicle_make", v);
          set("_vehicle_model", "");
        }}
      />
      {useModelDropdown ? (
        <Select
          label="Model"
          options={modelOptions}
          value={get("_vehicle_model")}
          onChange={(v) => set("_vehicle_model", v)}
        />
      ) : (
        <TextField
          label="Model"
          placeholder="e.g. Camry, F-150, Civic"
          value={get("_vehicle_model")}
          onChange={(v) => set("_vehicle_model", v)}
        />
      )}
    </BlockStack>
  );
}
