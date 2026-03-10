import idRegions from "../data/id-regions.json";

type RegionCity = {
  name?: string | null;
  districts?: Array<string | null> | null;
};

type RegionProvince = {
  name?: string | null;
  cities?: Array<RegionCity | null> | null;
};

type RegionsPayload = {
  provinces?: Array<RegionProvince | null> | null;
};

export type IdRegionDistrict = string;
export type IdRegionCityOption = {
  name: string;
  districts: IdRegionDistrict[];
};

export type IdRegionProvinceOption = {
  name: string;
  cities: IdRegionCityOption[];
};

const normalizeText = (value: unknown) => String(value ?? "").trim();
const regionsPayload = idRegions as RegionsPayload;

const withFallbackOption = (items: string[], selectedValue = "") => {
  const normalizedSelected = normalizeText(selectedValue);
  if (!normalizedSelected) return items;
  if (items.includes(normalizedSelected)) return items;
  return [normalizedSelected, ...items];
};

const normalizeDistricts = (districts: RegionCity["districts"]) =>
  Array.from(
    new Set(
      (Array.isArray(districts) ? districts : [])
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );

const normalizeCities = (cities: RegionProvince["cities"]) =>
  (Array.isArray(cities) ? cities : [])
    .map((city) => {
      const name = normalizeText(city?.name);
      if (!name) return null;
      return {
        name,
        districts: normalizeDistricts(city?.districts),
      };
    })
    .filter((city): city is IdRegionCityOption => Boolean(city));

export const REGION_DATA: IdRegionProvinceOption[] = (
  Array.isArray(regionsPayload.provinces) ? regionsPayload.provinces : []
)
  .map((province) => {
    const name = normalizeText(province?.name);
    if (!name) return null;
    return {
      name,
      cities: normalizeCities(province?.cities),
    };
  })
  .filter((province): province is IdRegionProvinceOption => Boolean(province));

export const getProvinceOptions = (selectedValue = "") =>
  withFallbackOption(
    REGION_DATA.map((item) => item.name).filter(Boolean),
    selectedValue
  );

export const getCityOptions = (provinceName = "", selectedValue = "") => {
  const province = REGION_DATA.find(
    (item) => item.name === normalizeText(provinceName)
  );
  const items = Array.isArray(province?.cities)
    ? province.cities.map((item) => item.name).filter(Boolean)
    : [];
  return withFallbackOption(items, selectedValue);
};

export const getDistrictOptions = (
  provinceName = "",
  cityName = "",
  selectedValue = ""
) => {
  const province = REGION_DATA.find(
    (item) => item.name === normalizeText(provinceName)
  );
  const city = province?.cities?.find(
    (item) => item.name === normalizeText(cityName)
  );
  const items = Array.isArray(city?.districts) ? city.districts : [];
  return withFallbackOption(items, selectedValue);
};
