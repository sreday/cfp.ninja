// Timezone helpers: detection, listing, country→TZ suggestion, offset diff,
// and bucketing speakers as local/regional/remote relative to an event.

// Distance buckets (hours from event timezone, computed at event start date).
export const TZ_BUCKETS = {
    LOCAL: 'local',       // |diff| <= 3
    REGIONAL: 'regional', // 3 < |diff| <= 6
    REMOTE: 'remote',     // |diff| > 6
    UNKNOWN: 'unknown',   // missing speaker or event timezone
};

// Country name → IANA timezone. Keys must match the values in utils.js COUNTRIES.
// Ambiguous countries that span multiple zones (United States, Canada, Russia,
// Brazil, Australia, China*, Indonesia, Mexico, Kazakhstan) are intentionally
// omitted so the user picks explicitly. (*China uses one zone in practice but
// we still suggest Shanghai.)
const COUNTRY_TZ = {
    // Europe
    'United Kingdom': 'Europe/London', 'Ireland': 'Europe/Dublin',
    'France': 'Europe/Paris', 'Germany': 'Europe/Berlin',
    'Netherlands': 'Europe/Amsterdam', 'Belgium': 'Europe/Brussels',
    'Luxembourg': 'Europe/Luxembourg', 'Switzerland': 'Europe/Zurich',
    'Austria': 'Europe/Vienna', 'Italy': 'Europe/Rome',
    'Spain': 'Europe/Madrid', 'Portugal': 'Europe/Lisbon',
    'Sweden': 'Europe/Stockholm', 'Norway': 'Europe/Oslo',
    'Denmark': 'Europe/Copenhagen', 'Finland': 'Europe/Helsinki',
    'Iceland': 'Atlantic/Reykjavik', 'Poland': 'Europe/Warsaw',
    'Czech Republic': 'Europe/Prague', 'Slovakia': 'Europe/Bratislava',
    'Hungary': 'Europe/Budapest', 'Romania': 'Europe/Bucharest',
    'Bulgaria': 'Europe/Sofia', 'Greece': 'Europe/Athens',
    'Croatia': 'Europe/Zagreb', 'Slovenia': 'Europe/Ljubljana',
    'Serbia': 'Europe/Belgrade', 'Bosnia and Herzegovina': 'Europe/Sarajevo',
    'Montenegro': 'Europe/Podgorica', 'North Macedonia': 'Europe/Skopje',
    'Albania': 'Europe/Tirane', 'Kosovo': 'Europe/Belgrade',
    'Estonia': 'Europe/Tallinn', 'Latvia': 'Europe/Riga',
    'Lithuania': 'Europe/Vilnius', 'Belarus': 'Europe/Minsk',
    'Moldova': 'Europe/Chisinau', 'Turkey': 'Europe/Istanbul',
    'Ukraine': 'Europe/Kyiv', 'Malta': 'Europe/Malta',
    'Cyprus': 'Asia/Nicosia', 'Andorra': 'Europe/Andorra',
    'Monaco': 'Europe/Monaco', 'Liechtenstein': 'Europe/Vaduz',
    'San Marino': 'Europe/San_Marino', 'Vatican City': 'Europe/Vatican',
    // Asia
    'Japan': 'Asia/Tokyo', 'South Korea': 'Asia/Seoul',
    'North Korea': 'Asia/Pyongyang', 'China': 'Asia/Shanghai',
    'Taiwan': 'Asia/Taipei', 'Singapore': 'Asia/Singapore',
    'Malaysia': 'Asia/Kuala_Lumpur', 'Thailand': 'Asia/Bangkok',
    'Vietnam': 'Asia/Ho_Chi_Minh', 'Philippines': 'Asia/Manila',
    'India': 'Asia/Kolkata', 'Pakistan': 'Asia/Karachi',
    'Bangladesh': 'Asia/Dhaka', 'Sri Lanka': 'Asia/Colombo',
    'Nepal': 'Asia/Kathmandu', 'Bhutan': 'Asia/Thimphu',
    'Myanmar': 'Asia/Yangon', 'Cambodia': 'Asia/Phnom_Penh',
    'Laos': 'Asia/Vientiane', 'Mongolia': 'Asia/Ulaanbaatar',
    'United Arab Emirates': 'Asia/Dubai', 'Israel': 'Asia/Jerusalem',
    'Palestine': 'Asia/Gaza', 'Saudi Arabia': 'Asia/Riyadh',
    'Qatar': 'Asia/Qatar', 'Kuwait': 'Asia/Kuwait',
    'Bahrain': 'Asia/Bahrain', 'Oman': 'Asia/Muscat',
    'Yemen': 'Asia/Aden', 'Iraq': 'Asia/Baghdad',
    'Iran': 'Asia/Tehran', 'Syria': 'Asia/Damascus',
    'Lebanon': 'Asia/Beirut', 'Jordan': 'Asia/Amman',
    'Afghanistan': 'Asia/Kabul', 'Armenia': 'Asia/Yerevan',
    'Azerbaijan': 'Asia/Baku', 'Georgia': 'Asia/Tbilisi',
    'Kyrgyzstan': 'Asia/Bishkek', 'Tajikistan': 'Asia/Dushanbe',
    'Turkmenistan': 'Asia/Ashgabat', 'Uzbekistan': 'Asia/Tashkent',
    'Hong Kong': 'Asia/Hong_Kong', 'Macau': 'Asia/Macau',
    // Africa
    'Egypt': 'Africa/Cairo', 'South Africa': 'Africa/Johannesburg',
    'Nigeria': 'Africa/Lagos', 'Kenya': 'Africa/Nairobi',
    'Morocco': 'Africa/Casablanca', 'Tunisia': 'Africa/Tunis',
    'Algeria': 'Africa/Algiers', 'Libya': 'Africa/Tripoli',
    'Sudan': 'Africa/Khartoum', 'South Sudan': 'Africa/Juba',
    'Ethiopia': 'Africa/Addis_Ababa', 'Tanzania': 'Africa/Dar_es_Salaam',
    'Uganda': 'Africa/Kampala', 'Rwanda': 'Africa/Kigali',
    'Burundi': 'Africa/Bujumbura', 'Ghana': 'Africa/Accra',
    'Senegal': 'Africa/Dakar', 'Ivory Coast': 'Africa/Abidjan',
    'Cameroon': 'Africa/Douala', 'Angola': 'Africa/Luanda',
    'Mozambique': 'Africa/Maputo', 'Zambia': 'Africa/Lusaka',
    'Zimbabwe': 'Africa/Harare', 'Botswana': 'Africa/Gaborone',
    'Namibia': 'Africa/Windhoek', 'Madagascar': 'Indian/Antananarivo',
    'Mauritius': 'Indian/Mauritius', 'Seychelles': 'Indian/Mahe',
    // Oceania
    'New Zealand': 'Pacific/Auckland', 'Fiji': 'Pacific/Fiji',
    'Papua New Guinea': 'Pacific/Port_Moresby', 'Samoa': 'Pacific/Apia',
    'Tonga': 'Pacific/Tongatapu',
    // Americas
    'Argentina': 'America/Argentina/Buenos_Aires', 'Chile': 'America/Santiago',
    'Colombia': 'America/Bogota', 'Peru': 'America/Lima',
    'Venezuela': 'America/Caracas', 'Ecuador': 'America/Guayaquil',
    'Bolivia': 'America/La_Paz', 'Paraguay': 'America/Asuncion',
    'Uruguay': 'America/Montevideo', 'Guyana': 'America/Guyana',
    'Suriname': 'America/Paramaribo', 'Cuba': 'America/Havana',
    'Jamaica': 'America/Jamaica', 'Haiti': 'America/Port-au-Prince',
    'Dominican Republic': 'America/Santo_Domingo',
    'Panama': 'America/Panama', 'Costa Rica': 'America/Costa_Rica',
    'Nicaragua': 'America/Managua', 'Honduras': 'America/Tegucigalpa',
    'El Salvador': 'America/El_Salvador', 'Guatemala': 'America/Guatemala',
    'Belize': 'America/Belize',
};

export function detectBrowserTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (_) {
        return '';
    }
}

export function listTimezones() {
    if (typeof Intl.supportedValuesOf === 'function') {
        try { return Intl.supportedValuesOf('timeZone'); } catch (_) { /* fall through */ }
    }
    // Minimal fallback for ancient browsers.
    return [
        'UTC',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
        'Europe/Warsaw', 'Europe/Helsinki', 'Europe/Athens',
        'Africa/Cairo', 'Africa/Johannesburg',
        'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
        'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
        'Australia/Sydney',
        'Pacific/Auckland',
        'America/Anchorage', 'America/Los_Angeles', 'America/Denver',
        'America/Chicago', 'America/New_York', 'America/Halifax',
        'America/Sao_Paulo', 'America/Mexico_City',
    ];
}

export function suggestTimezoneFromCountry(country) {
    if (!country) return null;
    return COUNTRY_TZ[String(country).trim()] || null;
}

// Numeric offset (in hours) of `tz` from UTC at `date`. Returns NaN on failure.
export function offsetHours(tz, date) {
    if (!tz) return NaN;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return NaN;
    try {
        // longOffset gives "GMT+05:30" / "GMT-08:00" / "GMT" (= UTC).
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            timeZoneName: 'longOffset',
        }).formatToParts(d);
        const tzPart = parts.find(p => p.type === 'timeZoneName');
        if (!tzPart) return NaN;
        const m = tzPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
        if (!m) return tzPart.value === 'GMT' ? 0 : NaN;
        const sign = m[1] === '-' ? -1 : 1;
        const h = parseInt(m[2], 10);
        const mins = m[3] ? parseInt(m[3], 10) : 0;
        return sign * (h + mins / 60);
    } catch (_) {
        return NaN;
    }
}

// Signed difference (speaker - event) in hours at the event start date.
// Returns NaN if either timezone is missing or invalid.
export function diffHours(speakerTz, eventTz, eventStartDate) {
    const s = offsetHours(speakerTz, eventStartDate);
    const e = offsetHours(eventTz, eventStartDate);
    if (isNaN(s) || isNaN(e)) return NaN;
    return s - e;
}

export function bucket(speakerTz, eventTz, eventStartDate) {
    const diff = diffHours(speakerTz, eventTz, eventStartDate);
    if (isNaN(diff)) return TZ_BUCKETS.UNKNOWN;
    const abs = Math.abs(diff);
    if (abs <= 3) return TZ_BUCKETS.LOCAL;
    if (abs <= 6) return TZ_BUCKETS.REGIONAL;
    return TZ_BUCKETS.REMOTE;
}
