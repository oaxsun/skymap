// Catálogo mínimo (RA/Dec en grados, magnitud visual).
// Para un póster “pro”, normalmente usarías miles de estrellas (HYG/Hipparcos).
export const STARS = [
  // name, raDeg, decDeg, mag
  ["Sirius", 101.2875, -16.7161, -1.46],
  ["Canopus", 95.9879, -52.6957, -0.74],
  ["Arcturus", 213.9154, 19.1825, -0.05],
  ["Vega", 279.2347, 38.7837, 0.03],
  ["Capella", 79.1723, 45.9979, 0.08],
  ["Rigel", 78.6345, -8.2016, 0.12],
  ["Procyon", 114.8255, 5.2250, 0.38],
  ["Betelgeuse", 88.7929, 7.4071, 0.50],
  ["Achernar", 24.4286, -57.2368, 0.46],
  ["Hadar", 210.9558, -60.3730, 0.61],
  ["Altair", 297.6958, 8.8683, 0.76],
  ["Acrux", 186.6496, -63.0991, 0.77],
  ["Aldebaran", 68.9802, 16.5093, 0.85],
  ["Antares", 247.3519, -26.4320, 1.06],
  ["Spica", 201.2983, -11.1614, 0.98],
  ["Pollux", 116.3289, 28.0262, 1.14],
  ["Fomalhaut", 344.4128, -29.6222, 1.16],
  ["Deneb", 310.3579, 45.2803, 1.25],
  ["Regulus", 152.0929, 11.9672, 1.35],
  ["Castor", 113.6494, 31.8883, 1.58],
  ["Bellatrix", 81.2828, 6.3497, 1.64],
  ["Elnath", 81.5729, 28.6074, 1.65],
  ["Miaplacidus", 138.3000, -69.7172, 1.67],
  ["Alnilam", 84.0534, -1.2019, 1.69],
  ["Alnair", 332.0583, -46.9611, 1.74],
  ["Alioth", 193.5073, 55.9598, 1.76],
  ["Dubhe", 165.9320, 61.7510, 1.79],
  ["Mirfak", 51.0807, 49.8612, 1.79],
  ["Wezen", 104.6564, -26.3932, 1.83],
  ["Sadr", 305.5571, 40.2567, 2.23],
  ["Alpheratz", 2.0969, 29.0904, 2.06],
  ["Almach", 30.9748, 42.3297, 2.10],
  ["Mizar", 200.9814, 54.9254, 2.23],
  ["Polaris", 37.9546, 89.2641, 1.98],
];

// Líneas de constelación (muy básico). Cada segmento: [indexStarA, indexStarB]
export const CONSTELLATIONS = {
  "Orion": [
    // Betelgeuse(7) - Bellatrix(20) - Alnilam(24) - Rigel(5)
    [7, 20], [20, 24], [24, 5],
    // Betelgeuse - Alnilam
    [7, 24],
  ],
  "Ursa Major": [
    // Dubhe(27)-Mizar(33)-Alioth(25)
    [27, 33], [33, 25],
  ],
};
