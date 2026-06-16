const COUNTRY_NAMES = [
  "united states",
  "usa",
  "us",
  "united states of america",
  "canada",
  "mexico",
];

const SUB_CITY_KEYWORDS = [
  "county",
  "parish",
  "district",
  "borough",
  "township",
  "municipality",
  "prefecture",
];

const PROV_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  // Canadian provinces
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "nova scotia": "NS",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  saskatchewan: "SK",
};

const ZIP_CODE_REGEX = /\d{5}(-\d{4})?/g;

function isSubCity(part: string) {
  const lower = part.toLowerCase();
  return SUB_CITY_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function formatCityState(address: string | null | undefined) {
  if (!address) return "";
  const parts = address.split(",").map((part) => part.trim());

  // Drop trailing country names.
  while (parts.length > 0 && COUNTRY_NAMES.includes(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }

  // Find the segment that contains the province/state.
  let stateIndex = -1;
  let stateCode = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const normalized = parts[i].toLowerCase().replace(/\s+/g, " ");
    const clean = normalized.replace(ZIP_CODE_REGEX, "").trim();
    if (PROV_ABBREVIATIONS[normalized] || PROV_ABBREVIATIONS[clean]) {
      stateIndex = i;
      stateCode = PROV_ABBREVIATIONS[normalized] ?? PROV_ABBREVIATIONS[clean];
      break;
    }
    if (/\b[A-Za-z]{2}\b/.test(clean) && clean.length <= 5) {
      stateIndex = i;
      stateCode = clean.toUpperCase();
      if (PROV_ABBREVIATIONS[clean]) {
        stateCode = PROV_ABBREVIATIONS[clean];
      }
      break;
    }
  }

  if (stateIndex <= 0) {
    return address;
  }

  // Walk backwards from the state to find the city, skipping sub-city parts like "Weld County".
  let city = "";
  for (let i = stateIndex - 1; i >= 0; i--) {
    if (!isSubCity(parts[i])) {
      city = parts[i];
      break;
    }
  }

  if (!city) {
    return address;
  }

  return `${city}, ${stateCode}`;
}
