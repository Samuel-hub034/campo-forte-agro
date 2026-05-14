import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  CloudFog,
  Wind,
  Droplets,
  Thermometer,
  MapPin,
  Search,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/clima")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <Weather />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Clima — AgroGestor" }] }),
});

type Loc = { name: string; lat: number; lon: number; admin?: string };

const weatherInfo = (code: number): { label: string; Icon: typeof Sun } => {
  if (code === 0) return { label: "Céu limpo", Icon: Sun };
  if ([1, 2].includes(code)) return { label: "Parcialmente nublado", Icon: CloudSun };
  if (code === 3) return { label: "Nublado", Icon: Cloud };
  if ([45, 48].includes(code)) return { label: "Neblina", Icon: CloudFog };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Garoa", Icon: CloudRain };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { label: "Chuva", Icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Neve", Icon: CloudSnow };
  if ([95, 96, 99].includes(code)) return { label: "Tempestade", Icon: CloudLightning };
  return { label: "—", Icon: CloudSun };
};

function Weather() {
  const [loc, setLoc] = useState<Loc | null>(null);
  const [query, setQuery] = useState("");

  // Load saved location
  useEffect(() => {
    const raw = localStorage.getItem("agro_weather_loc");
    if (raw) {
      try {
        setLoc(JSON.parse(raw));
      } catch {}
    }
  }, []);

  // Try geolocation if no saved location
  useEffect(() => {
    if (loc) return;
    if (!navigator.geolocation) {
      // Default to Brasília
      setLoc({ name: "Brasília", admin: "DF", lat: -15.78, lon: -47.93 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          name: "Minha localização",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };
        setLoc(next);
        localStorage.setItem("agro_weather_loc", JSON.stringify(next));
      },
      () => {
        setLoc({ name: "Brasília", admin: "DF", lat: -15.78, lon: -47.93 });
      },
      { timeout: 5000 }
    );
  }, [loc]);

  const searchMutation = useQuery({
    queryKey: ["geocode", query],
    enabled: false,
    queryFn: async () => {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          query
        )}&count=1&language=pt&country=BR`
      );
      const j = await r.json();
      const hit = j?.results?.[0];
      if (!hit) throw new Error("Cidade não encontrada");
      const next: Loc = {
        name: hit.name,
        admin: hit.admin1,
        lat: hit.latitude,
        lon: hit.longitude,
      };
      setLoc(next);
      localStorage.setItem("agro_weather_loc", JSON.stringify(next));
      return next;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["weather", loc?.lat, loc?.lon],
    enabled: !!loc,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc!.lat}&longitude=${loc!.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=7`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("Falha ao buscar clima");
      return r.json();
    },
  });

  const current = data?.current;
  const daily = data?.daily;
  const info = current ? weatherInfo(current.weather_code) : null;

  const chartData =
    daily?.time?.map((t: string, i: number) => ({
      day: new Date(t).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      max: Math.round(daily.temperature_2m_max[i]),
      min: Math.round(daily.temperature_2m_min[i]),
      chuva: daily.precipitation_sum[i],
    })) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clima"
        subtitle="Condições atuais e previsão para 7 dias"
      />

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) searchMutation.refetch();
        }}
        className="flex gap-2"
      >
        <Input
          className="h-11"
          placeholder="Buscar cidade (ex: Ribeirão Preto)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" className="h-11" disabled={!query.trim()}>
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Buscar</span>
        </Button>
      </form>

      {/* Current */}
      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-primary/90 to-primary p-6 text-primary-foreground">
            {loc && (
              <div className="flex items-center gap-2 text-sm opacity-90">
                <MapPin className="h-4 w-4" />
                {loc.name}
                {loc.admin && ` — ${loc.admin}`}
              </div>
            )}
            {isLoading || !current ? (
              <div className="mt-4 h-24 animate-pulse rounded-lg bg-white/10" />
            ) : (
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-6xl font-bold leading-none">
                    {Math.round(current.temperature_2m)}°
                  </div>
                  <div className="mt-2 text-base opacity-90">{info?.label}</div>
                </div>
                {info && <info.Icon className="h-24 w-24 opacity-90" />}
              </div>
            )}
          </div>
          {current && (
            <div className="grid grid-cols-3 divide-x divide-border">
              <Metric
                icon={<Droplets className="h-4 w-4" />}
                label="Umidade"
                value={`${Math.round(current.relative_humidity_2m)}%`}
              />
              <Metric
                icon={<Wind className="h-4 w-4" />}
                label="Vento"
                value={`${Math.round(current.wind_speed_10m)} km/h`}
              />
              <Metric
                icon={<Thermometer className="h-4 w-4" />}
                label="Sensação"
                value={`${Math.round(current.temperature_2m)}°`}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="rounded-2xl border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Não foi possível carregar o clima. Verifique sua conexão.
          </CardContent>
        </Card>
      )}

      {/* 7-day forecast list */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Próximos 7 dias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {daily?.time?.map((t: string, i: number) => {
            const di = weatherInfo(daily.weather_code[i]);
            return (
              <div
                key={t}
                className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent/30"
              >
                <div className="flex items-center gap-3">
                  <di.Icon className="h-6 w-6 text-primary" />
                  <div>
                    <div className="font-medium capitalize">
                      {i === 0
                        ? "Hoje"
                        : new Date(t).toLocaleDateString("pt-BR", { weekday: "long" })}
                    </div>
                    <div className="text-xs text-muted-foreground">{di.label}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Droplets className="h-3 w-3" />
                    {daily.precipitation_probability_max[i] ?? 0}%
                  </div>
                  <div className="font-medium">
                    <span className="text-muted-foreground">
                      {Math.round(daily.temperature_2m_min[i])}°
                    </span>{" "}
                    / {Math.round(daily.temperature_2m_max[i])}°
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Temperature chart */}
      {chartData.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Temperaturas (°C)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="max" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="min" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-4">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
