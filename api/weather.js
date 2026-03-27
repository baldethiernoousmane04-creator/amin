export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const WEATHER_KEY = process.env.WEATHER_KEY;
  
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Dakar&appid=${WEATHER_KEY}&units=metric&lang=fr`
    );
    const data = await response.json();
    
    if (data.main) {
      return res.status(200).json({
        temp: data.main.temp,
        desc: data.weather[0].description,
        humidity: data.main.humidity
      });
    } else {
      return res.status(200).json({ temp: null, desc: '' });
    }
  } catch (err) {
    return res.status(200).json({ temp: null, desc: '' });
  }
}
