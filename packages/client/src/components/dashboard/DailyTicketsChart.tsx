import { BarChart, type BarChartDatum } from './BarChart';

type DailyCount = { date: string; count: number };

function formatDayLabel(date: string) {
   return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
   });
}

export function DailyTicketsChart({ data }: { data: DailyCount[] }) {
   const chartData: BarChartDatum[] = data.map((d) => ({
      key: d.date,
      label: formatDayLabel(d.date),
      value: d.count,
   }));

   return <BarChart data={chartData} />;
}
