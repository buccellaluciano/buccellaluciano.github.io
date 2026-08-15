/* Datos de presentación de cada Gran Premio. Generado desde OpenF1 (v1/meetings, 2026).
   Estático para no golpear la API en cada card. Regenerar si cambia el calendario. */
const GP_INFO = {
  "AUS": {
    "circuit": "Melbourne",
    "location": "Melbourne",
    "type": "Temporary - Street",
    "date": "2026-03-06",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Australia%20carbon.png"
  },
  "CHN": {
    "circuit": "Shanghai",
    "location": "Shanghai",
    "type": "Permanent",
    "date": "2026-03-13",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/China%20carbon.png"
  },
  "JPN": {
    "circuit": "Suzuka",
    "location": "Suzuka",
    "type": "Permanent",
    "date": "2026-03-27",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Japan%20carbon.png"
  },
  "BHR": {
    "circuit": "Sakhir",
    "location": "Sakhir",
    "type": "Permanent",
    "date": "2026-04-10",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Bahrain%20carbon.png"
  },
  "KSA": {
    "circuit": "Jeddah",
    "location": "Jeddah",
    "type": "Temporary - Street",
    "date": "2026-04-17",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Saudi Arabia%20carbon.png"
  },
  "MIA": {
    "circuit": "Miami",
    "location": "Miami Gardens",
    "type": "Temporary - Street",
    "date": "2026-05-01",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Miami%20carbon.png"
  },
  "MAD": {
    "circuit": "Madring",
    "location": "Madrid",
    "type": "Temporary - Street",
    "date": "2026-09-11",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Spain%20carbon.png"
  },
  "MCO": {
    "circuit": "Monte Carlo",
    "location": "Monte Carlo",
    "type": "Temporary - Street",
    "date": "2026-06-05",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Monaco%20carbon.png"
  },
  "CAN": {
    "circuit": "Montreal",
    "location": "Montréal",
    "type": "Permanent",
    "date": "2026-05-22",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Canada%20carbon.png"
  },
  "ESP": {
    "circuit": "Catalunya",
    "location": "Barcelona",
    "type": "Permanent",
    "date": "2026-06-12",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Barcelona-Catalunya%20carbon.png"
  },
  "AUT": {
    "circuit": "Spielberg",
    "location": "Spielberg",
    "type": "Permanent",
    "date": "2026-06-26",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Austria%20carbon.png"
  },
  "GBR": {
    "circuit": "Silverstone",
    "location": "Silverstone",
    "type": "Permanent",
    "date": "2026-07-03",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Great Britain%20carbon.png"
  },
  "BEL": {
    "circuit": "Spa-Francorchamps",
    "location": "Spa-Francorchamps",
    "type": "Temporary - Road",
    "date": "2026-07-17",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Belgium%20carbon.png"
  },
  "HUN": {
    "circuit": "Hungaroring",
    "location": "Budapest",
    "type": "Permanent",
    "date": "2026-07-24",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Hungary%20carbon.png"
  },
  "NED": {
    "circuit": "Zandvoort",
    "location": "Zandvoort",
    "type": "Permanent",
    "date": "2026-08-21",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Netherlands%20carbon.png"
  },
  "ITA": {
    "circuit": "Monza",
    "location": "Monza",
    "type": "Permanent",
    "date": "2026-09-04",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Italy%20carbon.png"
  },
  "AZE": {
    "circuit": "Baku",
    "location": "Baku",
    "type": "Temporary - Street",
    "date": "2026-09-24",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Azerbaijan%20carbon.png"
  },
  "SIN": {
    "circuit": "Singapore",
    "location": "Marina Bay",
    "type": "Temporary - Street",
    "date": "2026-10-09",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Singapore%20carbon.png"
  },
  "USA": {
    "circuit": "Austin",
    "location": "Austin",
    "type": "Permanent",
    "date": "2026-10-23",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/United States%20carbon.png"
  },
  "MEX": {
    "circuit": "Mexico City",
    "location": "Mexico City",
    "type": "Permanent",
    "date": "2026-10-30",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Mexico%20carbon.png"
  },
  "BRA": {
    "circuit": "Interlagos",
    "location": "São Paulo",
    "type": "Permanent",
    "date": "2026-11-06",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Brazil%20carbon.png"
  },
  "LVG": {
    "circuit": "Las Vegas",
    "location": "Las Vegas",
    "type": "Temporary - Street",
    "date": "2026-11-20",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Las Vegas%20carbon.png"
  },
  "QAT": {
    "circuit": "Lusail",
    "location": "Lusail",
    "type": "Permanent",
    "date": "2026-11-27",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Qatar%20carbon.png"
  },
  "UAE": {
    "circuit": "Yas Marina Circuit",
    "location": "Yas Marina",
    "type": "Permanent",
    "date": "2026-12-04",
    "image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Abu Dhabi%20carbon.png"
  }
};
