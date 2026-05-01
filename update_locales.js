import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'src/locales');

const translations = {
    en: {
        cs_journey_info: "Journey information",
        cs_train_formation: "Train formation",
        cs_air_condition: "Air conditioning",
        cs_wheelchair_space: "Wheelchair space with wheelchair-accessible toilet",
        cs_bike_space: "Bicycle loading",
        cs_quiet_zone: "Quiet zone in 1st class",
        cs_family_zone: "Family zone",
        cs_info_point: "Information",
        cs_dining_car: "Restaurant / Catering",
        cs_toilet: "Toilet",
        cs_low_floor: "Low-floor access",
        cs_occupancy_low: "Low to average occupancy expected",
        cs_occupancy_high: "High occupancy expected",
        cs_occupancy_very_high: "Very high occupancy expected",
        cs_class_1: "1st class coach",
        cs_class_2: "2nd class coach",
        cs_legend: "Legend",
        cs_no_data: "No train formation data available.",
        cs_disclaimer: "All information without guarantee.",
        cs_nf: "LF"
    },
    es: {
        cs_journey_info: "Información de viaje",
        cs_train_formation: "Formación de trenes",
        cs_air_condition: "Aire acondicionado",
        cs_wheelchair_space: "Espacio para sillas de ruedas con aseo accesible",
        cs_bike_space: "Carga de bicicletas",
        cs_quiet_zone: "Zona tranquila en 1ª clase",
        cs_family_zone: "Zona familiar",
        cs_info_point: "Información",
        cs_dining_car: "Restaurante / Catering",
        cs_toilet: "Aseos",
        cs_low_floor: "Acceso de piso bajo",
        cs_occupancy_low: "Se espera una ocupación baja a media",
        cs_occupancy_high: "Se espera una alta ocupación",
        cs_occupancy_very_high: "Se espera una ocupación muy alta",
        cs_class_1: "Coche de 1ª clase",
        cs_class_2: "Coche de 2ª clase",
        cs_legend: "Leyenda",
        cs_no_data: "No hay datos de formación de trenes disponibles.",
        cs_disclaimer: "Toda la información sin garantía.",
        cs_nf: "PB"
    },
    de: {
        cs_journey_info: "Reiseinformationen",
        cs_train_formation: "Zugbildung",
        cs_air_condition: "Klimaanlage",
        cs_wheelchair_space: "Rollstuhlstellplatz mit rollstuhlgängigem WC",
        cs_bike_space: "Veloverlad",
        cs_quiet_zone: "Ruhezone in der 1. Klasse",
        cs_family_zone: "Familienzone",
        cs_info_point: "Information",
        cs_dining_car: "Restaurant / Catering",
        cs_toilet: "WC",
        cs_low_floor: "Niederflureinstieg",
        cs_occupancy_low: "Tiefe bis mittlere Belegung erwartet",
        cs_occupancy_high: "Hohe Belegung erwartet",
        cs_occupancy_very_high: "Sehr hohe Belegung erwartet",
        cs_class_1: "Wagen 1. Klasse",
        cs_class_2: "Wagen 2. Klasse",
        cs_legend: "Legende",
        cs_no_data: "Keine Zugbildungsdaten verfügbar.",
        cs_disclaimer: "Alle Angaben ohne Gewähr.",
        cs_nf: "NF"
    },
    fr: {
        cs_journey_info: "Informations de voyage",
        cs_train_formation: "Composition du train",
        cs_air_condition: "Climatisation",
        cs_wheelchair_space: "Place pour chaises roulantes avec WC accessible",
        cs_bike_space: "Chargement de vélos",
        cs_quiet_zone: "Zone de silence en 1ère classe",
        cs_family_zone: "Zone familles",
        cs_info_point: "Information",
        cs_dining_car: "Restaurant / Restauration",
        cs_toilet: "Toilettes",
        cs_low_floor: "Accès à plancher surbaissé",
        cs_occupancy_low: "Occupation faible à moyenne attendue",
        cs_occupancy_high: "Forte occupation attendue",
        cs_occupancy_very_high: "Très forte occupation attendue",
        cs_class_1: "Voiture de 1ère classe",
        cs_class_2: "Voiture de 2ème classe",
        cs_legend: "Légende",
        cs_no_data: "Aucune donnée de composition de train disponible.",
        cs_disclaimer: "Toutes les informations sont sans garantie.",
        cs_nf: "PS"
    },
    it: {
        cs_journey_info: "Informazioni di viaggio",
        cs_train_formation: "Composizione del treno",
        cs_air_condition: "Aria condizionata",
        cs_wheelchair_space: "Posto per sedia a rotelle con toilette accessibile",
        cs_bike_space: "Carico biciclette",
        cs_quiet_zone: "Zona del silenzio in 1ª classe",
        cs_family_zone: "Zona famiglia",
        cs_info_point: "Informazioni",
        cs_dining_car: "Ristorante / Catering",
        cs_toilet: "Servizi igienici",
        cs_low_floor: "Accesso a pianale ribassato",
        cs_occupancy_low: "Attesa un'affluenza da bassa a media",
        cs_occupancy_high: "Attesa un'affluenza alta",
        cs_occupancy_very_high: "Attesa un'affluenza molto alta",
        cs_class_1: "Carrozza di 1ª classe",
        cs_class_2: "Carrozza di 2ª classe",
        cs_legend: "Leggenda",
        cs_no_data: "Nessun dato disponibile sulla composizione del treno.",
        cs_disclaimer: "Tutte le informazioni senza garanzia.",
        cs_nf: "PR"
    }
};

function run() {
    const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
        const lang = file.replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));

        let fallbackLang = translations[lang] || translations['en'];

        for (const [key, value] of Object.entries(fallbackLang)) {
            if (!data[key]) {
                data[key] = value;
            }
        }
        
        // Also add the english translations for keys missed by the fallback language if mapped partially
        if (lang !== 'en') {
             for (const [key, value] of Object.entries(translations['en'])) {
                 if (!data[key]) {
                     data[key] = value;
                 }
             }
        }

        fs.writeFileSync(path.join(localesDir, file), JSON.stringify(data, null, 2) + '\n');
    }
}

run();