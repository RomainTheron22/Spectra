export const dynamic = "force-dynamic";

const ICONS = {
  "1": "☀️", "2": "⛅", "3": "🌥️", "4": "☁️", "5": "🌫️",
  "6": "🌦️", "7": "🌧️", "8": "⛈️", "9": "❄️", "10": "🌨️",
};
const DESCS = {
  "1": "Ensoleillé", "2": "Peu nuageux", "3": "Nuageux", "4": "Couvert",
  "5": "Brumeux", "6": "Averses", "7": "Pluie", "8": "Orageux",
  "9": "Neige", "10": "Neige légère",
};

export async function GET() {
  try {
    const res = await fetch(
      "https://my.meteoblue.com/packages/current?apikey=0PJCFLOy5XQopWGB&lat=48.8566&lon=2.3522&format=json",
      { next: { revalidate: 1800 } }
    );
    const d = await res.json();
    const cur = d.data_current;
    const code = String(cur.pictocode || 1);
    return Response.json({
      temp: Math.round(cur.temperature),
      icon: ICONS[code] || "🌤️",
      desc: DESCS[code] || "Paris",
    });
  } catch {
    return Response.json({ temp: null, icon: "🌤️", desc: "Paris" });
  }
}
