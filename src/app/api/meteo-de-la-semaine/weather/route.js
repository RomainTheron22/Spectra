export const dynamic = "force-dynamic";

const ICONS = {
  "1": "☀️", "2": "⛅", "3": "🌥️", "4": "☁️", "5": "🌫️",
  "6": "🌦️", "7": "🌧️", "8": "⛈️", "9": "❄️", "10": "🌨️",
};

const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export async function GET() {
  try {
    const res = await fetch(
      "https://my.meteoblue.com/packages/basic-day?apikey=0PJCFLOy5XQopWGB&lat=48.8566&lon=2.3522&format=json",
      { next: { revalidate: 3600 } }
    );
    const d = await res.json();
    const { time, pictocode } = d.data_day;

    const days = time.slice(0, 5).map((dateStr, i) => {
      const date = new Date(dateStr);
      const code = String(pictocode[i] || 1);
      return {
        day: DAY_SHORT[date.getDay()],
        icon: ICONS[code] || "🌤️",
      };
    });

    return Response.json({ days });
  } catch {
    return Response.json({ days: [] });
  }
}
