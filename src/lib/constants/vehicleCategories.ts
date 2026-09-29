import { vehicleCatalog } from './vehicleCatalog';

export const VEHICLE_CATEGORIES = ['Otomobil', 'Motosiklet', 'SUV', 'Pickup', 'ATV', 'Ticari'] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

type CategoryOverrides = Partial<Record<Exclude<VehicleCategory, 'Otomobil'>, Record<string, readonly string[]>>>;

/** Explicit non-automobile assignments from the authoritative model-level mapping. */
const categoryOverrides: CategoryOverrides = {
  Motosiklet: {
    Dinka: ['Akuma', 'Double-T', 'Enduro', 'Thrust'], LCC: ['Avarus', 'Hexer', 'Templar'], LCS: ['Lycan', 'Nightblade'],
    Maibatsu: ['Manchez', 'Sanchez'], Nagasaki: ['BF400', 'Carbon RS', 'Chimera', 'Shinobi'],
    Pegassi: ['Bati 801', 'Esskey', 'Faggio', 'Faggio Sport', 'FCR1000', 'FCR1000 Custom', 'Ruffian'],
    Principe: ['Diablous', 'Nemesis'], Shitzu: ['Hakuchou', 'PCJ 600', 'Vader'],
    Western: ['Angel', 'Bagger', 'Cliffhanger', 'Daemon', 'Daemon Custom', 'Deathbike', 'Diabolus', 'Freeway', 'Gargoyle', 'Hellfury', 'Nightblade', 'Rat Bike', 'Reever', 'Revenant', 'Slave', 'Sovereign', 'Sovereign 2010', 'Wayfarer', 'Wintergreen', 'Wolfsbane', 'Wolfsbane 2010', 'Zombie Bobber', 'Zombie Chopper'],
  },
  SUV: {
    Albany: ['Cavalcade', 'Cavalcade II', 'Landstalker G'], Annis: ['Hellion'], Benefactor: ['Dubsta', 'Dubsta Sport', 'Serrano', 'Streiter', 'XLS'],
    Bravado: ['Gresley', 'Gresley Hellhound'], Canis: ['Kamacho', 'Mesa', 'Mesa Offroad Package', 'Seminole', 'Seminole Frontier'],
    Declasse: ['Alamo', 'Alamo Retro', 'Granger', 'Granger 3600LX', 'Rancher XL'], Dundreary: ['Landstalker', 'Landstalker XL'],
    Emperor: ['Habanero'], Enus: ['Huntley S', 'Jubilee'], Fathom: ['FQ 2'], Gallivanter: ['Baller', 'Baller II', 'Baller LE', 'Baller LE LWB', 'Baller ST'],
    Karin: ['BeeJay XL', 'Raider'], Lampadati: ['Novak'], Mammoth: ['Patriot'], Obey: ['i-wagen', 'Rocoto'], Pfister: ['Astron'], Ubermacht: ['Rebla GTS'], Vapid: ['Scout'],
  },
  Pickup: {
    Bravado: ['Bison', 'Bison Utility', 'Duneloader', 'Rat-Loader'], Canis: ['Bodhi'], Declasse: ['Yosemite', 'Yosemite Rancher'],
    Karin: ['Everon', 'Rebel', 'Rebel (Rusty)', 'Rebel 4x4', 'Rebel City', 'Rebel SWB'],
    Vapid: ['4x4 Caracara', 'Bobcat XL', 'Cara 2020', 'Contender', 'Contender Classic', 'Guardian', 'Riata', 'Riata Classic', 'Riata Retro', 'Sadler', 'Sadler Retro Sport Crew Cab', 'Sadler Retro Sport LWB', 'Sadler Retro Sport SWB', 'Sandking SWB', 'Sandking Utility Crew Cab', 'Sandking Utility Single Cab', 'Sandking Utility SWB', 'Sandking XL', 'Slamvan', 'Slamvan (Lost)'],
  },
  ATV: { Dinka: ['Verus'], Nagasaki: ['Blazer', 'Street Blazer'] },
  Ticari: {
    BF: ['Surfer', 'Surfer Ruster'], Bravado: ['Deludamol Rumpo', 'Paradise', 'Rumpo', 'Youga', 'Youga Classic', 'Youga Classic 4x4', 'Youga Custom'],
    Brute: ['Bus', 'Camper', 'Coach', 'Go Postal Boxville', 'Human Labs Boxville', 'Pony', 'Post Delivery Boxville', 'Public Utilities Boxville', 'Shuttle Bus', 'Taco Van'],
    Declasse: ['Bowboy Burrito', 'Bugstars Burrito', 'Burrito', 'Burrito Sport', 'Construction Burrito', 'Gang Burrito', 'Moonbeam', 'Moonbeam Custom'],
    HVY: ['Biff'], JoBuilt: ['Hauler', 'Phantom'], Maibatsu: ['Mule', 'Mule - Meteorite', 'Mule 4x4', 'Mule Armorer'],
    MTL: ['Flatbed', 'Packer', 'Pounder', 'Tanker'],
    Vapid: ['Benson', 'Clown Speedo', 'Guardian RV', 'Minivan', 'Sandking RV', 'Sandroamer RV', 'Scrap Truck', 'Speedo', 'Speedo Express', 'Tow Truck (Large)', 'Tow Truck (Slamvan)'], Zirconium: ['Journey'],
  },
};

const nonAutomobileKeys = new Set(Object.values(categoryOverrides).flatMap((brands) =>
  Object.entries(brands ?? {}).flatMap(([brand, models]) => models.map((model) => `${brand}\0${model}`))));
const automobiles = Object.fromEntries(Object.entries(vehicleCatalog).map(([brand, models]) =>
  [brand, models.filter((model) => !nonAutomobileKeys.has(`${brand}\0${model}`))]).filter(([, models]) => (models as string[]).length));

/** Authoritative model-level source of truth: category -> brand -> exact catalog models. */
export const vehicleCategoryCatalog: Readonly<Record<VehicleCategory, Readonly<Record<string, readonly string[]>>>> = {
  Otomobil: automobiles,
  Motosiklet: categoryOverrides.Motosiklet!, SUV: categoryOverrides.SUV!, Pickup: categoryOverrides.Pickup!,
  ATV: categoryOverrides.ATV!, Ticari: categoryOverrides.Ticari!,
};

export function getVehicleBrandsByCategory(category: VehicleCategory): string[] {
  const catalog = vehicleCategoryCatalog[category];
  return catalog ? Object.keys(catalog).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })) : [];
}
export function getVehicleModels(category: VehicleCategory, brand: string): string[] {
  return [...(vehicleCategoryCatalog[category]?.[brand] ?? [])];
}
export function isValidVehicleSelection(category: VehicleCategory, brand: string, model: string): boolean {
  return getVehicleModels(category, brand).includes(model);
}
export function reconcileVehicleSelection(category: VehicleCategory, brand: string, model: string) {
  if (!getVehicleBrandsByCategory(category).includes(brand)) return { category, brand: '', model: '' };
  return { category, brand, model: isValidVehicleSelection(category, brand, model) ? model : '' };
}
export function isMotorcycleCategory(category: VehicleCategory): boolean { return category === 'Motosiklet'; }
