/**
 * CANONICAL VEHICLE CATALOG FOR SANBOARD (GTA WORLD)
 * 
 * Central Source of Truth for all motor land vehicles.
 * Structure: Brand -> Model[]
 * 
 * Rules:
 * - NO dealership or gallery names
 * - NO bicycles, boats, helicopters, or airplanes
 * - Motorbikes, vans, trucks, and commercial land vehicles ARE included
 */

export const vehicleCatalog: Record<string, string[]> = {
  Albany: [
    'Alpha',
    'Buccaneer',
    'Buccaneer Custom',
    'Cavalcade',
    'Cavalcade II',
    'Emperor',
    'Emperor (Rusty)',
    'Esperanto',
    'Hermes',
    'Landstalker G',
    'Manana',
    'Manana Custom',
    'Presidente',
    'Presidente C-STR',
    'Primo',
    'V-STR',
    'Vigo',
    'Washington',
  ],

  Annis: [
    'Elegy Retro',
    'Euros',
    'Hellion',
    'Kawaii',
    'Remus',
    'Savestra',
    'ZR 350',
    'ZR-380',
    'ZR250',
  ],

  BF: [
    'Club',
    'Surfer',
    'Surfer Ruster',
  ],

  Benefactor: [
    'Dubsta',
    'Dubsta Sport',
    'Feltzer',
    'Glendale',
    'Glendale Custom',
    'Panto',
    'Schafter',
    'Schafter 2010',
    'Schafter LWB',
    'Schafter V12',
    'Scharmann',
    'Scheisser',
    'Schwartzer',
    'Serrano',
    'Streiter',
    'Surano',
    'XLS',
  ],

  Bollokan: [
    'Prairie',
  ],

  Bravado: [
    'Banshee',
    'Bison',
    'Bison Utility',
    'Buffalo',
    'Buffalo A/C',
    'Buffalo Hellhound',
    'Buffalo S',
    'Buffalo S Stock',
    'Buffalo STX',
    'Buffalo SX',
    'Deludamol Rumpo',
    'Duneloader',
    'Gauntlet',
    'Gauntlet A/C',
    'Gauntlet Classic',
    'Gauntlet Classic Custom',
    'Gauntlet Hellfire',
    'Gauntlet V6',
    'Gresley',
    'Gresley Hellhound',
    'Paradise',
    'Rat-Loader',
    'Recursion',
    'Rumpo',
    'Youga',
    'Youga Classic',
    'Youga Classic 4x4',
    'Youga Custom',
  ],

  Brute: [
    'Bus',
    'Camper',
    'Coach',
    'Go Postal Boxville',
    'Human Labs Boxville',
    'Pony',
    'Post Delivery Boxville',
    'Public Utilities Boxville',
    'Shuttle Bus',
    'Taco Van',
  ],

  Burgerfahrzeug: [
    'Club GTR',
    'Furzem',
  ],

  Canis: [
    'Bodhi',
    'Kamacho',
    'Mesa',
    'Mesa Offroad Package',
    'Seminole',
    'Seminole Frontier',
  ],

  Cheval: [
    'Fugitive',
    'Picador',
    'Surge',
  ],

  Classique: [
    'Tahoma',
  ],

  Coil: [
    'Raiden',
    'Taranis',
  ],

  Declasse: [
    'Alamo',
    'Alamo Retro',
    'Asea',
    'Bowboy Burrito',
    'Bugstars Burrito',
    'Burrito',
    'Burrito Sport',
    'Construction Burrito',
    'Gang Burrito',
    'Granger',
    'Granger 3600LX',
    'Impaler',
    'Merit',
    'Moonbeam',
    'Moonbeam Custom',
    'Premier',
    'Premier Classic',
    'Premier SS',
    'Rancher XL',
    'Rhapsody',
    'Sabre 550SS',
    'Sabre Turbo',
    'Sabre Turbo Custom',
    'Stallion',
    'Tampa',
    'Tornado',
    'Tornado Convertible',
    'Tornado Junker',
    'Tornado Junker Convertible',
    'Tulip',
    'Vamos',
    'Vigero',
    'Voodoo',
    'Voodoo Custom',
    'Yosemite',
    'Yosemite Rancher',
  ],

  Dewbauchee: [
    'Exemplar',
    'Massacro',
    'Rapid GT',
    'Rapid GT Classic',
    'Rapid GT Convertible',
    'Vesper',
  ],

  Dinka: [
    'Akuma',
    'Blista',
    'Blista Compact',
    'Blista Kanjo',
    'Chavos',
    'Double-T',
    'Enduro',
    'Hakumai',
    'Jester',
    'Jester Classic',
    'Jester RR',
    'Millennial',
    'RT3000',
    'Sugoi',
    'Thrust',
    'Verus',
  ],

  Dundreary: [
    'Admiral Classic',
    'Landstalker',
    'Landstalker XL',
    'Regina',
    'Stretch',
    'Virgo Classic',
    'Virgo Classic Custom',
  ],

  Emperor: [
    'Habanero',
    'Vectre',
  ],

  Enus: [
    'Cognoscenti Cabrio',
    'Deity',
    'Huntley S',
    'Jubilee',
    'Paragon R',
  ],

  Fathom: [
    'FQ 2',
  ],

  Gallivanter: [
    'Baller',
    'Baller II',
    'Baller LE',
    'Baller LE LWB',
    'Baller ST',
  ],

  Grotti: [
    'Bestia GTS',
    'Brioso 300',
    'Brioso R/A',
    'Carbonizzare',
    'Cheetah Classic',
    'GT500',
  ],

  HVY: [
    'Biff',
  ],

  Hijak: [
    'Khamelion',
  ],

  Imponte: [
    'Beater Dukes',
    'Dukes',
    'Phoenix',
    'Ruiner',
  ],

  Invetero: [
    'Coquette',
    'Coquette Targa',
  ],

  JoBuilt: [
    'Hauler',
    'Phantom',
  ],

  Karin: [
    'Ariant',
    'Asterope',
    'Asterope RS',
    'BeeJay XL',
    'Calico GTF',
    'Dilettante',
    'Dilettante DX',
    'Everon',
    'Futo',
    'Futo GTX',
    'Intruder',
    'Kuruma',
    'Previon',
    'Raider',
    'Rebel',
    'Rebel (Rusty)',
    'Rebel 4x4',
    'Rebel City',
    'Rebel SWB',
    'Sultan',
    'Sultan Classic',
    'Sultan RS Classic 2D',
    'Z190',
  ],

  LCC: [
    'Avarus',
    'Hexer',
    'Templar',
  ],

  LCS: [
    'Lycan',
    'Nightblade',
  ],

  Lampadati: [
    'Cinquemila',
    'Felon',
    'Felon GT',
    'Furore GT',
    'Komoda',
    'Michelli GT',
    'Novak',
  ],

  MTL: [
    'Flatbed',
    'Packer',
    'Pounder',
    'Tanker',
  ],

  Maibatsu: [
    'Manchez',
    'Mule',
    'Mule - Meteorite',
    'Mule 4x4',
    'Mule Armorer',
    'Penumbra',
    'Penumbra FF',
    'Sanchez',
  ],

  Mammoth: [
    'Patriot',
  ],

  Maxwell: [
    'Asbo',
  ],

  Nagasaki: [
    'BF400',
    'Blazer',
    'Carbon RS',
    'Chimera',
    'Shinobi',
    'Street Blazer',
  ],

  Obey: [
    '8F Drafter',
    '9F',
    '9F Cabrio',
    'Argento',
    'i-wagen',
    'Omnis',
    'Rocoto',
    'Tailgater',
    'Tailgator S',
  ],

  Ocelot: [
    'F620',
    'Jackal',
    'Lynx',
    'Pariah',
  ],

  Overflod: [
    'Imorgon',
  ],

  Pegassi: [
    'Bati 801',
    'Esskey',
    'Faggio',
    'Faggio Sport',
    'FCR1000',
    'FCR1000 Custom',
    'Ruffian',
  ],

  Pfister: [
    'Astron',
    'Comet',
    'Comet Retro',
    'Comet RS',
    'Comet S2',
    'Comet S2 Cabrio',
    'Growler',
    'Neon',
  ],

  Principe: [
    'Diablous',
    'Nemesis',
  ],

  RUNE: [
    'Cheburek',
  ],

  Schyster: [
    'Champion',
    'Deviant',
    'Fusilade',
  ],

  Shitzu: [
    'Hakuchou',
    'PCJ 600',
    'Vader',
  ],

  Ubermacht: [
    'Cypher',
    'Cypher Hatchback',
    'Kampfer',
    'Oracle',
    'Oracle XS',
    'Rebla GTS',
    'Sentinel 2013 Coupe',
    'Sentinel 2013 Sedan',
    'Sentinel Cabrio',
    'Sentinel Classic',
    'Sentinel SG3',
    'Sentinel SG3 Convertible',
    'Sentinel SG3 Coupe',
    'Sentinel SG3 Sedan',
    'Sentinel SG4',
    'Sentinel XS',
    'Seraph',
    'Vorstand',
    'Zion',
    'Zion Cabrio',
    'Zion Classic',
  ],

  Vapid: [
    '4x4 Caracara',
    'Benson',
    'Blade',
    'Bobcat XL',
    'Cara 2020',
    'Chino Classic',
    'Chino Custom',
    'Clique',
    'Clown Speedo',
    'Contender',
    'Contender Classic',
    'Dominator',
    'Dominator ASP',
    'Dominator Classic',
    'Dominator GTT',
    'Dominator GTX',
    'Ellie',
    'Executioner',
    'Flash',
    'Flash GT',
    'Guardian',
    'Guardian RV',
    'Huntley',
    'Minivan',
    'Peyote',
    'Peyote Gasser',
    'Radius',
    'Razor',
    'Retinue',
    'Riata',
    'Riata Classic',
    'Riata Retro',
    'Sadler',
    'Sadler Retro Sport Crew Cab',
    'Sadler Retro Sport LWB',
    'Sadler Retro Sport SWB',
    'Sandking RV',
    'Sandking SWB',
    'Sandking Utility Crew Cab',
    'Sandking Utility Single Cab',
    'Sandking Utility SWB',
    'Sandking XL',
    'Sandroamer RV',
    'Scout',
    'Scrap Truck',
    'Slamvan',
    'Slamvan (Lost)',
    'Speedo',
    'Speedo Express',
    'Stanier',
    'Stanier 2',
    'Stanier Taxi',
    'Torrence SSO',
    'Tow Truck (Large)',
    'Tow Truck (Slamvan)',
    'Uranus',
    'Victor',
  ],

  Vulcar: [
    'Fagaloa',
    'Ingot',
    'Nebula Turbo',
    'Warrener',
    'Warrener HKR',
  ],

  Weeny: [
    'Dynasty',
    'Issi',
    'Issi Classic',
  ],

  Western: [
    'Angel',
    'Bagger',
    'Cliffhanger',
    'Daemon',
    'Daemon Custom',
    'Deathbike',
    'Diabolus',
    'Freeway',
    'Gargoyle',
    'Hellfury',
    'Nightblade',
    'Rat Bike',
    'Reever',
    'Revenant',
    'Slave',
    'Sovereign',
    'Sovereign 2010',
    'Wayfarer',
    'Wintergreen',
    'Wolfsbane',
    'Wolfsbane 2010',
    'Zombie Bobber',
    'Zombie Chopper',
  ],

  Willard: [
    'Faction',
    'Faction Custom',
    'Faction Custom Donk',
    'Idaho',
  ],

  Zirconium: [
    'Journey',
    'Stratum',
  ],
};

/**
 * Returns all vehicle brands sorted alphabetically.
 */
export function getVehicleBrands(): string[] {
  return Object.keys(vehicleCatalog).sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  );
}

/**
 * Returns all models for a given brand sorted alphabetically.
 * If brand is not found, returns an empty array.
 */
export function getModelsByBrand(brand: string): string[] {
  if (!brand || !vehicleCatalog[brand]) return [];
  return [...vehicleCatalog[brand]].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' })
  );
}

/**
 * Checks if a brand exists in the catalog.
 */
export function isValidBrand(brand: string): boolean {
  return Boolean(brand && vehicleCatalog[brand]);
}

/**
 * Checks if a model exists under a specific brand.
 */
export function isValidModel(brand: string, model: string): boolean {
  if (!brand || !model || !vehicleCatalog[brand]) return false;
  return vehicleCatalog[brand].includes(model);
}

/**
 * Attempts to find which brand a model belongs to.
 * Useful for legacy listings or searches.
 */
export function findBrandForModel(modelName: string): string | undefined {
  if (!modelName) return undefined;
  const clean = modelName.trim().toLowerCase();
  for (const [brand, models] of Object.entries(vehicleCatalog)) {
    if (models.some((m) => m.toLowerCase() === clean)) {
      return brand;
    }
  }
  return undefined;
}
